// hello test yassa

import dotenv from 'dotenv';
dotenv.config();

console.log("👀 GOOGLE_CLIENT_ID IS:", process.env.GOOGLE_CLIENT_ID);
console.log("👀 GOOGLE_CLIENT_SECRET IS:", process.env.GOOGLE_CLIENT_SECRET);

import express, { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import passport from 'passport';
import './config/passport';
import fs from 'fs';
import path from 'path';

// التأكد من وجود مجلد الرفع عند بدء التشغيل
const uploadDir = path.join(process.cwd(), 'uploads', 'avatars');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
  console.log('📁 Created upload directory at:', uploadDir);
}

import authRoutes from './routes/authRoutes'; 
import apiRoutes from './routes'; 
import { notFound, errorHandler } from './middlewares/errorHandler';

import http from 'http'; 
import { Server } from 'socket.io'; 
import jwt from 'jsonwebtoken';
import Call from './models/Call'; 
import { User } from './models/user';
import * as chatService from './services/chat.service';

const app = express();
const PORT = Number(process.env.PORT) || 5000;
const BASE_URL = '/api/v1';

// ==========================================
// 🛡️ الميدلويرز الأساسية (CORS & JSON) - مكانها الصح هنا
// ==========================================
const frontendOriginEnv = process.env.FRONTEND_URL?.trim();
const allowedOrigins = [
  frontendOriginEnv,
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:3000',
].filter(Boolean) as string[];

const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS policy does not allow access from origin ${origin}`));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(express.json());
app.use('/uploads', express.static('uploads'));

// ==========================================
// 🔌 تغليف السيرفر وتهيئة Socket.io (السنترال)
// ==========================================
const server = http.createServer(app);
export const io = new Server(server, {
  cors: {
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`Socket.io CORS policy does not allow access from origin ${origin}`));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  }
});

// إتاحة الـ io كمتغير في الـ app عشان نقدر نستخدمه في أي Controller بدون Circular Dependency
app.set('io', io);

const activeUsers = new Map<string, Set<string>>();

const addUserSocket = (userId: string, socketId: string) => {
  const existingSockets = activeUsers.get(userId) ?? new Set<string>();
  existingSockets.add(socketId);
  activeUsers.set(userId, existingSockets);
};

const removeUserSocket = (socketId: string): string | null => {
  for (const [userId, socketIds] of activeUsers.entries()) {
    if (!socketIds.has(socketId)) continue;
    socketIds.delete(socketId);
    if (socketIds.size === 0) {
      activeUsers.delete(userId);
    } else {
      activeUsers.set(userId, socketIds);
    }
    return userId;
  }
  return null;
};

export const getUserSocketIds = (userId: string): string[] => {
  return Array.from(activeUsers.get(userId) ?? []);
};

export const isUserOnline = (userId: string): boolean => getUserSocketIds(userId).length > 0;

// ==========================================
// 🔐 مصادقة اتصال الـ Socket (Socket Authentication Middleware)
// ==========================================
// الفرق بين API auth و socket auth:
// 1. في الـ API العادي: التوكن بييجي في الـ Header مع كل Request (Authorization: Bearer xxx)
//    والميدل وير بيتحقق منه قبل ما يسمح بالوصول للـ endpoint
// 2. في الـ Socket: التوكن بييجي مرة واحدة بس وقت الـ connection (handshake)
//    لأن الاتصال بيفضل مفتوح طول الوقت (persistent connection)
//    فمينفعش نبعت header مع كل event زي الـ REST API
// 3. عشان كده بنستخدم io.use() كـ middleware بيتنفذ قبل ما الاتصال يتم
//    لو التوكن غلط أو مش موجود، بنرفض الاتصال من الأول
io.use(async (socket, next) => {
  try {
    // التوكن ممكن ييجي في الـ auth object أو كـ query parameter
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;

    if (!token) {
      return next(new Error('Authentication error: Token is required'));
    }

    // التحقق من صحة التوكن (نفس اللوجيك بتاع الـ API بالظبط)
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as jwt.JwtPayload;

    // التأكد إن اليوزر لسه موجود في الداتا بيز
    const user = await User.findById(decoded.id);
    if (!user) {
      return next(new Error('Authentication error: User not found'));
    }

    // بنحفظ بيانات اليوزر على الـ socket عشان نستخدمها بعد كده في الـ events
    (socket as any).userId = user._id.toString();
    (socket as any).user = user;

    next();
  } catch (error) {
    return next(new Error('Authentication error: Invalid token'));
  }
});

io.on('connection', (socket) => {
  const authenticatedUserId = (socket as any).userId;
  console.log(`🟢 A new device connected to the switchboard, line number: ${socket.id}`);

  const broadcastActiveUsers = async () => {
    try {
      const { User } = require('./models/user');
      const activeIds = Array.from(activeUsers.keys());
      const users = await User.find({
        _id: { $in: activeIds },
        $or: [
          { 'settings.privacy.showOnline': true },
          { 'settings.privacy.showOnline': { $exists: false } }
        ]
      }).select('_id');
      const visibleOnlineUsers = users.map((u: any) => u._id.toString());
      io.emit('online-users', visibleOnlineUsers);
    } catch (err) {
      console.error('Error broadcasting active users:', err);
    }
  };

  // ==========================================
  // 📝 تسجيل اليوزر تلقائياً بعد المصادقة
  // ==========================================
  // بما إن اليوزر اتأكدنا من هويته في الـ middleware
  // بنسجله تلقائياً في الـ userSocketMap
  if (authenticatedUserId) {
    addUserSocket(authenticatedUserId, socket.id);
    console.log(`✅ [Auto] The user [${authenticatedUserId}] registered via auth middleware on line [${socket.id}]`);
    broadcastActiveUsers();
  }

  // التسجيل اليدوي (للتوافق مع الكود القديم)
  socket.on('register-user', (userId: string) => {
    addUserSocket(userId, socket.id);
    socket.join(userId); // Early room join as requested
    console.log(`✅ The user [${userId}] Connected to the socket line [${socket.id}]`);
    broadcastActiveUsers();
  });

  socket.on('registerUser', (userId: string) => {
    addUserSocket(userId, socket.id);
    socket.join(userId); // Early room join as requested
    console.log(`✅ The user [${userId}] Connected to the socket line [${socket.id}]`);
    broadcastActiveUsers();
  });

  socket.on('join', (userId: string) => {
    socket.join(userId);
    console.log(`✅ The user [${userId}] explicitly joined their personal room`);
  });

  // ==========================================
  // 🏠 الانضمام لغرف الشات (Socket Rooms)
  // ==========================================
  // فكرة الـ rooms:
  // بدل ما نبعت الرسالة لكل عضو في الجروب لوحده (يعني 100 emit لـ 100 عضو)
  // بنستخدم الـ rooms عشان نبعت emit واحد بس والـ Socket.io بيوزعها على كل اللي في الغرفة
  // 1. كل شات (سواء فردي أو جماعي) بيكون ليه room باسم الـ chatId
  // 2. لما يوزر يفتح شات، بينضم للـ room بتاعته
  // 3. لما حد يبعت رسالة، بنعمل emit للـ room كلها مش لشخص واحد
  // ليه بنستخدمها بدل ما نبعت لكل واحد لوحده؟
  // - الأداء: emit واحد بدل N emits
  // - التنظيم: كل غرفة مسؤولة عن نفسها
  // - السهولة: مش محتاج نلف على كل الأعضاء ونبعت لكل واحد
  socket.on('join-room', (roomId: string) => {
    socket.join(roomId);
    console.log(`🏠 User [${authenticatedUserId}] joined room [${roomId}]`);
  });

  // مغادرة غرفة (لما اليوزر يقفل الشات)
  socket.on('leave-room', (roomId: string) => {
    socket.leave(roomId);
    console.log(`🚪 User [${authenticatedUserId}] left room [${roomId}]`);
  });

  // ==========================================
  // 💬 إرسال واستقبال الرسائل (Chat Events)
  // ==========================================
  socket.on('send-message', async (data: { chatId: string, content: string, messageType?: string, postId?: string, mediaUrl?: string, tempId?: string, replyTo?: string }) => {
      console.log('🚀 send-message received:', data.chatId);  // ← ضيفي ده
    try {
      const blockStatus = await chatService.checkDirectChatBlockStatus(authenticatedUserId, data.chatId);
          console.log('🚫 blockStatus:', blockStatus);  // ← وده

      if (blockStatus.senderBlockedOther || blockStatus.receiverBlockedSender) {
        socket.emit('blocked', { message: 'You cannot send messages to this user.' });
        return;
      }

   const ChatModel = require('./models/chat').default;
      const chat = await ChatModel.findById(data.chatId).select('users isGroup name');

      // Set delivered instantly when the other participant(s) is online
      let initialStatus: 'sent' | 'delivered' = 'sent';
      if (chat && !chat.isGroup) {
        const otherUserId = (chat.users || []).find((id: any) => id.toString() !== authenticatedUserId)?.toString();
        if (otherUserId && isUserOnline(otherUserId)) {
          initialStatus = 'delivered';
        }
      } else if (chat && chat.isGroup) {
        const isAnyOtherOnline = (chat.users || []).some((id: any) => {
          const userId = id.toString();
          return userId !== authenticatedUserId && isUserOnline(userId);
        });
        if (isAnyOtherOnline) {
          initialStatus = 'delivered';
        }
      }

      // حفظ الرسالة في الداتا بيز
      const savedMessage = await chatService.createMessage({
        chatId: data.chatId,
        senderId: authenticatedUserId,
        content: data.content,
        messageType: data.messageType,
        postId: data.postId,
        mediaUrl: data.mediaUrl,
        replyTo: data.replyTo,
        status: initialStatus
      });

      if (!savedMessage) return;

      const messageToEmit = data.tempId 
        ? { ...savedMessage.toObject(), tempId: data.tempId } 
        : savedMessage;

      // بنبعت الرسالة لكل اللي في الـ room (الشات) - سواء فردي أو جماعي
      io.to(data.chatId).emit('receiveMessage', messageToEmit);
      io.to(data.chatId).emit('receive-message', messageToEmit);

      // Notify for direct chat
      const receiverId = chat && !chat.isGroup 
        ? (chat.users || []).find((id: any) => id.toString() !== authenticatedUserId)?.toString() 
        : null;

      console.log('📨 receiverId:', receiverId);
      console.log('💬 chat.isGroup:', chat?.isGroup);

      if (receiverId) {
        const receiverUser = await User.findById(receiverId)
          .select('notificationSettings')
          .lean();
        console.log('🔔 receiver notificationSettings:', receiverUser?.notificationSettings);
        if (receiverUser?.notificationSettings?.chatMessages !== false) {
          const senderName = (socket as any).user?.fullName || 'Someone';
          console.log('✅ Emitting notification to:', receiverId);
          io.to(receiverId).emit('notification', {
            type: 'chat',
            message: `New message from ${senderName}`,
            senderId: authenticatedUserId,
            chatId: data.chatId
          });
        }
      }

      // Notify group members who are NOT the sender
      if (chat?.isGroup) {
        const groupMembers = (chat.users || []).filter(
          (id: any) => id.toString() !== authenticatedUserId
        );
        console.log('👥 group members to notify:', groupMembers);
        
        for (const memberId of groupMembers) {
          const memberUser = await User.findById(memberId)
            .select('notificationSettings')
            .lean();
          if (memberUser?.notificationSettings?.communityMentions !== false) {
            const senderName = (socket as any).user?.fullName || 'Someone';
            console.log('✅ Emitting group notification to:', memberId.toString());
            io.to(memberId.toString()).emit('notification', {
              type: 'group',
              message: `New message in ${chat.name || 'a group'} from ${senderName}`,
              senderId: authenticatedUserId,
              chatId: data.chatId
            });
          }
        }
      }
      
      if (initialStatus === 'delivered') {
        io.to(authenticatedUserId).emit('messageDelivered', {
          chatId: data.chatId,
          messageId: (savedMessage as any)._id?.toString?.() || (savedMessage as any)._id,
          status: 'delivered'
        });
      }

      await chatService.emitNewCommunityMessage(io, data.chatId, savedMessage as any);

      console.log(`💬 Message from [${authenticatedUserId}] in chat [${data.chatId}]`);
    } catch (error: any) {
      if (error?.statusCode === 403) {
        socket.emit('blocked', { message: error.message || 'You cannot send messages to this user.' });
      }
      socket.emit('message-error', { message: error.message || 'Failed to send message' });
      console.log("Error sending message:", error);
    }
  });

  // ==========================================
  // 📨 تحديث حالة الرسائل (Message ACKs: Delivered / Read)
  // ==========================================
  socket.on('message_delivered', async (data: { messageId: string, chatId: string }) => {
    try {
      const Message = require('./models/Message').default;
      const msg = await Message.findById(data.messageId);
      if (msg && msg.status !== 'read') {
        msg.status = 'delivered';
        await msg.save();
        io.to(data.chatId).emit('message-status-update', { messageId: data.messageId, chatId: data.chatId, status: 'delivered' });
      }
    } catch (err) {
      console.error("Error updating delivered status:", err);
    }
  });

  socket.on('message_read', async (data: { messageId: string, chatId: string }) => {
    try {
      const Message = require('./models/Message').default;
      const msg = await Message.findById(data.messageId);
      if (msg && msg.status !== 'read') {
        msg.status = 'read';
        if (!msg.readBy.includes(authenticatedUserId)) {
          msg.readBy.push(authenticatedUserId);
        }
        await msg.save();
        io.to(data.chatId).emit('message-status-update', { messageId: data.messageId, chatId: data.chatId, status: 'read', readBy: authenticatedUserId });
      }
    } catch (err) {
      console.error("Error updating read status:", err);
    }
  });

  socket.on('markAsRead', async (data: { chatId: string, userId: string }) => {
    try {
      await chatService.markChatAsRead(data.chatId, data.userId, io);
    } catch (err) {
      console.error('Error in markAsRead:', err);
    }
  });

  // ==========================================
  // ✍️ حالة الكتابة (Typing Indicator)
  // ==========================================
  socket.on('typing', (data: { chatId: string }) => {
    socket.to(data.chatId).emit('user-typing', { userId: authenticatedUserId, chatId: data.chatId });
  });

  socket.on('stop-typing', (data: { chatId: string }) => {
    socket.to(data.chatId).emit('user-stop-typing', { userId: authenticatedUserId, chatId: data.chatId });
  });

  // ==========================================
  // 📞 Fast Ringing Optimization (Zero-Latency UI)
  // ==========================================
  socket.on('start-ringing', async (data: any) => {
    try {
      const toId = String(data.to || data.userToCall);
      const blockStatus = await chatService.checkUsersBlockStatusPair(data.from, toId);
      if (blockStatus.senderBlockedOther || blockStatus.receiverBlockedSender) {
        return; // Silently ignore ringing
      }

      const receiverSocketIds = getUserSocketIds(toId);
      if (receiverSocketIds.length > 0) {
        receiverSocketIds.forEach((receiverSocketId) => {
          io.to(receiverSocketId).emit('incoming-ring', {
            from: data.from,
            callerName: data.callerName,
            callerAvatar: data.callerAvatar,
            callType: data.callType,
            chatId: data.chatId
          });
        });
        console.log(`⚡ [start-ringing] Fast ring signal sent to [${toId}]`);
      }
    } catch (err) {
      console.error('Error in start-ringing:', err);
    }
  });

  // ==========================================
  // 📞 WebRTC Signaling (Heavy SDP Payloads)
  // ==========================================
  const handleCallUser = async (data: { userToCall: string, signalData: any, from: string, callerName: string, callerAvatar?: string, callType?: 'voice' | 'video', chatId?: string }) => {
    try {
      const blockStatus = await chatService.checkUsersBlockStatusPair(data.from, data.userToCall);
      if (blockStatus.senderBlockedOther) {
        socket.emit('blocked', { message: 'You cannot call this user.' });
        return;
      }

      // ✅ Use forwarded chatId directly; only do the lookup as a fallback
      let resolvedChatId = data.chatId;
      if (!resolvedChatId) {
        const Chat = require('./models/chat').default;
        const chat = await Chat.findOne({
          isGroup: false,
          users: { $all: [data.from, data.userToCall] }
        });
        resolvedChatId = chat?._id?.toString();
      }
      const newCall = await Call.create({
        caller: data.from,
        receiver: data.userToCall,
        chatId: resolvedChatId,
        type: data.callType || 'video',
        status: 'missed'
      });
      console.log(`📞 [call-user] Saved call type=${newCall.type}, chatId=${resolvedChatId}, id=${newCall._id}`);

      // ✅ ALWAYS send callId back to caller so they can cancel/end it properly, even if receiver is offline
      socket.emit('call-delivered', { callId: newCall._id.toString() });

      if (blockStatus.receiverBlockedSender) {
        // If receiver blocked caller, save as missed but DO NOT ring the receiver
        console.log(`⚠️ [call-user] Receiver [${data.userToCall}] blocked caller. Call saved as missed.`);
        return;
      }

      const receiverSocketIds = getUserSocketIds(String(data.userToCall));

      if (receiverSocketIds.length > 0) {
        receiverSocketIds.forEach((receiverSocketId) => {
          io.to(receiverSocketId).emit('incomingCall', {
            signal: data.signalData,
            from: data.from,
            name: data.callerName,
            type: data.callType || 'video',
            callerAvatar: data.callerAvatar || '',
            callId: newCall._id.toString(),
            chatId: resolvedChatId || ''
          });
          io.to(receiverSocketId).emit('incoming-call', {
            signal: data.signalData,
            from: data.from,
            callerName: data.callerName,
            callerAvatar: data.callerAvatar || '',
            callType: data.callType || 'video',
            callId: newCall._id.toString(),
            chatId: resolvedChatId || ''
          });
        });
        console.log(`📞 [${data.callType || 'video'}] call from [${data.from}] to [${data.userToCall}] — delivered to socket`);
      } else {
        socket.emit('userOffline', { message: 'The user is currently offline' });
        socket.emit('user-offline', { message: 'The user is currently offline' });
        console.log(`⚠️ [call-user] Receiver [${data.userToCall}] is offline. Call saved as missed.`);
      }
    } catch (error: any) {
      if (error?.statusCode === 403) {
        socket.emit('blocked', { message: error.message || 'You cannot call this user.' });
        return;
      }
      console.error("CRITICAL DB ERROR CREATING 1-TO-1 CALL:", error.message, error.errors);
    }
  };

  socket.on('call-user', handleCallUser);

  socket.on('callUser', async (data: { userToCall: string, signal: any, from: string, name: string, type?: 'voice' | 'video', callerAvatar?: string, chatId?: string }) => {
    await handleCallUser({
      userToCall: data.userToCall,
      signalData: data.signal,
      from: data.from,
      callerName: data.name,
      callerAvatar: data.callerAvatar,
      callType: data.type,
      chatId: data.chatId
    });
  });

  const handleAnswerCall = async (data: { to: string, signal: any, callId?: string }) => {
    try {
      if (data.callId) {
        await Call.findByIdAndUpdate(data.callId, { status: 'accepted' });
      }
      const callerSocketIds = getUserSocketIds(String(data.to));
      callerSocketIds.forEach((callerSocketId) => {
        console.log('🟡 BACKEND: answerCall triggered. Emitting to caller socket:', callerSocketId);
        console.log('🟡 Backend routed answerCall to Caller:', callerSocketId);
        io.to(callerSocketId).emit('callAccepted', { signal: data.signal });
        io.to(callerSocketId).emit('call-accepted', data.signal);
      });
      if (callerSocketIds.length > 0) {
        console.log(`✅ Call [${data.callId}] accepted — status updated`);
      }
    } catch (error) {
      console.log("Error updating call:", error);
    }
  };

  socket.on('answer-call', handleAnswerCall);
  socket.on('answerCall', handleAnswerCall);

  // 🔴 Receiver explicitly rejects the call
  socket.on('reject-call', async (data: any) => {
    try {
      let callDoc: any;
      if (data.callId) {
        callDoc = await Call.findByIdAndUpdate(data.callId, { status: data.status || 'rejected' }, { new: true });
      } else if (data.caller && data.receiver && data.chatId) {
        // Fallback if callId was missed: Create it now
        callDoc = await Call.create({
          caller: data.caller, receiver: data.receiver,
          chatId: data.chatId, type: data.type || 'video', status: data.status || 'rejected', duration: data.duration || 0
        });
      }
      
      const effectiveChatId = callDoc?.chatId?.toString() || data.chatId;
      if (effectiveChatId) {
        const callType = callDoc?.type || data.type || 'voice';
        const content = `Rejected ${callType} call`;
        const savedMessage = await chatService.createMessage({
          chatId: effectiveChatId,
          senderId: callDoc?.caller?.toString() || data.caller || '',
          content,
          messageType: 'call_summary'
        });
        io.to(effectiveChatId).emit('receive-message', savedMessage);
      }
      
      const toId = String(data.to || data.caller); // Fallback for 'to' using unified payload
      const callerSocketIds = getUserSocketIds(toId);
      callerSocketIds.forEach((callerSocketId) => io.to(callerSocketId).emit('call-rejected'));
      console.log(`🚫 Call [${data.callId || 'fallback'}] rejected`);
    } catch (error: any) {
      console.error("CRITICAL DB ERROR REJECTING CALL:", error.message, error.errors);
    }
  });

  // ❌ Caller cancels before answer (or ring timeout)
  socket.on('cancel-call', async (data: any) => {
    try {
      let callDoc: any;
      if (data.callId) {
        callDoc = await Call.findByIdAndUpdate(data.callId, { status: data.status || 'missed' }, { new: true });
      } else if (data.caller && data.receiver && data.chatId) {
        // Fallback creation
        callDoc = await Call.create({
          caller: data.caller, receiver: data.receiver,
          chatId: data.chatId, type: data.type || 'video', status: data.status || 'missed', duration: data.duration || 0
        });
      }
      
      const effectiveChatId = callDoc?.chatId?.toString() || data.chatId;
      if (effectiveChatId) {
        const callType = callDoc?.type || data.type || 'voice';
        const content = `Missed ${callType} call`;
        const savedMessage = await chatService.createMessage({
          chatId: effectiveChatId,
          senderId: callDoc?.caller?.toString() || data.caller || '',
          content,
          messageType: 'call_summary'
        });
        io.to(effectiveChatId).emit('receive-message', savedMessage);
      }
      
      const toId = String(data.to || data.receiver);
      const receiverSocketIds = getUserSocketIds(toId);
      receiverSocketIds.forEach((receiverSocketId) => io.to(receiverSocketId).emit('call-cancelled'));
      console.log(`❌ Call [${data.callId || 'fallback'}] cancelled/missed`);
    } catch (error: any) {
      console.error("CRITICAL DB ERROR CANCELLING CALL:", error.message, error.errors);
    }
  });

  // ✅ Call ended normally — persist duration
  socket.on('end-call', async (data: any) => {
    try {
      let callDoc: any;
      if (data.callId) {
        callDoc = await Call.findByIdAndUpdate(data.callId, {
          status: data.status || 'ended',
          duration: data.duration || 0
        }, { new: true });
      } else if (data.caller && data.receiver && data.chatId) {
        // Fallback creation
        callDoc = await Call.create({
          caller: data.caller, receiver: data.receiver,
          chatId: data.chatId, type: data.type || 'video', status: data.status || 'ended', duration: data.duration || 0
        });
      }

      const effectiveChatId = callDoc?.chatId?.toString() || data.chatId;

      if (effectiveChatId) {
        const duration = data.duration || callDoc?.duration || 0;
        const min = Math.floor(duration / 60).toString().padStart(2, '0');
        const sec = (duration % 60).toString().padStart(2, '0');
        const callType = callDoc?.type || data.type || 'voice';
        const content = `${callType.charAt(0).toUpperCase() + callType.slice(1)} call - ${min}:${sec}`;
        
        const savedMessage = await chatService.createMessage({
          chatId: effectiveChatId,
          senderId: callDoc?.caller?.toString() || data.caller || '',
          content,
          messageType: 'call_summary'
        });
        io.to(effectiveChatId).emit('receive-message', savedMessage);
        console.log(`💬 [end-call] call_summary sent to room ${effectiveChatId}`);
      } else {
        console.log(`⚠️ [end-call] No chatId — call_summary skipped for call ${data.callId}`);
      }
      
      const toId = String(data.to || data.receiver);
      const receiverSocketIds = getUserSocketIds(toId);
      receiverSocketIds.forEach((receiverSocketId) => {
        io.to(receiverSocketId).emit('call-ended');
      });
      console.log(`📴 Call [${data.callId || 'fallback'}] ended — duration: ${data.duration}s`);
    } catch (error: any) {
      console.error("CRITICAL DB ERROR ENDING CALL:", error.message, error.errors);
    }
  });

  // ==========================================
  // 🎥 Group Calling (Mesh WebRTC)
  // ==========================================

  socket.on('start-group-call', async (data: { groupId: string, callerId: string, callerName: string, callType: 'video' | 'voice' }) => {
    try {
      const Chat = require('./models/chat').default;
      const chat = await Chat.findById(data.groupId);
      if (!chat) return;

      const newCall = await Call.create({
        caller: data.callerId,
        chatId: data.groupId,
        type: data.callType || 'video',
        status: 'missed'
      });

      const callId = newCall._id.toString();
      console.log(`📞 [start-group-call] Saved call with type=${newCall.type}, id=${callId}`);
      
      // ✅ CRITICAL: Send callId back to the CALLER so they can reference it on end-call
      socket.emit('call-delivered', { callId });
      
      // Auto-join the caller to the room
      socket.join(data.groupId);

      // Notify all other members
      chat.users.forEach((userId: any) => {
        const idStr = userId.toString();
        if (idStr !== data.callerId) {
          const socketIds = getUserSocketIds(idStr);
          socketIds.forEach((sId) => {
            io.to(sId).emit('incoming-group-call', {
              groupId: data.groupId,
              callerName: data.callerName,
              callType: data.callType,
              callId: callId,
            });
          });
        }
      });
      console.log(`🎥 Group call started in ${data.groupId} by ${data.callerName}`);
    } catch (error) {
      console.log("Error starting group call:", error);
    }
  });

  socket.on('join-group-room', async (data: { groupId: string, isCaller?: boolean, callId?: string }) => {
    // Return all socket IDs currently in this room (except the new joiner)
    const room = io.sockets.adapter.rooms.get(data.groupId);
    const usersInRoom = room ? Array.from(room).filter(id => id !== socket.id) : [];
    
    if (data.callId && !data.isCaller) {
      await Call.findByIdAndUpdate(data.callId, { status: 'accepted' });
    }

    socket.emit('all-users-in-group', usersInRoom);
    socket.join(data.groupId);
  });

  socket.on('sending-group-signal', (payload: { userToSignal: string, signal: any, callerID: string }) => {
    // Send signal to specific peer so they can generate a return signal
    io.to(payload.userToSignal).emit('user-joined-group', { signal: payload.signal, callerID: payload.callerID });
  });

  socket.on('returning-group-signal', (payload: { callerID: string, signal: any }) => {
    // Send the return signal back to the initiator to complete handshake
    io.to(payload.callerID).emit('receiving-returned-signal', { signal: payload.signal, id: socket.id });
  });

  socket.on('leave-group-room', (data: { groupId: string }) => {
    socket.leave(data.groupId);
    socket.to(data.groupId).emit('user-left-group', socket.id);
  });

  // ==========================================
  // 👁️ تحديث مرئية الأونلاين (Online Visibility Toggle)
  // ==========================================
  socket.on('update-online-visibility', async (data: { visible: boolean }) => {
    try {
      await User.findByIdAndUpdate(authenticatedUserId, {
        'settings.privacy.showOnline': data.visible
      });
      broadcastActiveUsers();
      console.log(`👁️ User [${authenticatedUserId}] set online visibility to: ${data.visible}`);
    } catch (err) {
      console.error('Error updating online visibility:', err);
    }
  });

  socket.on('disconnect', () => {
    console.log(`🔴 Line disconnected: ${socket.id}`);
    const disconnectedUserId = removeUserSocket(socket.id);
    if (disconnectedUserId) {
      broadcastActiveUsers();
    }
  });
});

// ==========================================
// 🛡️ إعدادات الحماية (Rate Limiting)
// ==========================================
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 100, 
  message: { 
    status: 'error',
    message: "The allowed request limit has been exceeded, please try again after 15 minutes." 
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(BASE_URL, apiLimiter); 

// ==========================================
// 🔑 تهيئة المصادقة عبر Passport
// ==========================================
app.use(passport.initialize());

// ==========================================
// 🗄️ الاتصال بقاعدة البيانات
// ==========================================
mongoose.connect(process.env.MONGO_URI as string, { dbName: 'RabtaDB' })
  .then(() => { 
    console.log('✅ MongoDB Connected');
    console.log('📂 Writing to Database:', mongoose.connection.name);
  })
  .catch(err => console.log('❌ Database Connection Error:', err));

// ==========================================
// 🚀 ربط المسارات بالسيرفر
// ==========================================
app.get('/test', (req: Request, res: Response) => {
  res.send('Server is running');
});

import notificationRouter from './routes/notification.routes';

app.use(`${BASE_URL}/auth`, authRoutes);
app.use(BASE_URL, apiRoutes);
app.use('/api/notifications', notificationRouter);

// ==========================================
// 🚨 حراس معالجة الأخطاء (Global Error Handlers)
// ==========================================
// دول كفاية جداً ومكانهم هنا صح 100% (في أخر المسارات وقبل تشغيل السيرفر)
app.use(notFound);
app.use(errorHandler);

// ==========================================
// 🌐 تشغيل السيرفر
// ==========================================
server.on('error', (error: NodeJS.ErrnoException) => {
  if (error.syscall !== 'listen') {
    throw error;
  }

  const bind = typeof PORT === 'string'
    ? `Pipe ${PORT}`
    : `Port ${PORT}`;

  switch (error.code) {
    case 'EACCES':
      console.error(`${bind} requires elevated privileges.`);
      process.exit(1);
    case 'EADDRINUSE':
      console.error(`${bind} is already in use.`);
      process.exit(1);
    default:
      throw error;
  }
});

server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🔗 Base URL is ready at: http://localhost:${PORT}${BASE_URL}`);
  console.log(`🔌 Socket.io Central is ready!`);
});