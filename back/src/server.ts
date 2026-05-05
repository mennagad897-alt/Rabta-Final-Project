// hello test yassa

import dotenv from 'dotenv';
dotenv.config();

process.on('uncaughtException', (err) => { 
  console.error('Uncaught Exception:', err); 
});

process.on('unhandledRejection', (err) => { 
  console.error('Unhandled Rejection:', err); 
});

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
import Chat from './models/chat';

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

export const userSocketMap = new Map<string, string>();

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
  try {
    const authenticatedUserId = (socket as any).userId;
    console.log(`🟢 A new device connected to the switchboard, line number: ${socket.id}`);

    // ==========================================
    // 📝 تسجيل اليوزر تلقائياً بعد المصادقة
    // ==========================================
    // بما إن اليوزر اتأكدنا من هويته في الـ middleware
    // بنسجله تلقائياً في الـ userSocketMap
    if (authenticatedUserId) {
      userSocketMap.set(authenticatedUserId, socket.id);
      console.log(`✅ [Auto] The user [${authenticatedUserId}] registered via auth middleware on line [${socket.id}]`);
      
      // ✅ Join all chat rooms the user belongs to so they get updates for everything
      Chat.find({ users: authenticatedUserId }).then((chats: any[]) => {
        if (Array.isArray(chats)) {
          chats.forEach(chat => {
            socket.join(chat._id.toString());
            console.log(`🏠 Joined background room: ${chat._id}`);
          });
        }
      }).catch(err => console.error("Error joining rooms on connect:", err));
    }

  // التسجيل اليدوي (للتوافق مع الكود القديم)
  socket.on('register-user', (userId: string) => {
    userSocketMap.set(userId, socket.id);
    console.log(`✅ The user [${userId}] Connected to the socket line [${socket.id}]`);
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
  socket.on('send-message', async (data: { chatId: string, content: string, messageType?: string, tempId?: string }) => {
    try {
      // 🚫 Block Check: prevent messages between blocked users
      const Chat = require('./models/chat').default;
      const { User } = require('./models/user');
      const chat = await Chat.findById(data.chatId);
      if (chat && !chat.isGroup) {
        const otherUserId = chat.members.find((id: any) => id.toString() !== authenticatedUserId)?.toString();
        if (otherUserId) {
          const sender = await User.findById(authenticatedUserId).select('blockedUsers');
          const receiver = await User.findById(otherUserId).select('blockedUsers');
          const senderBlockedReceiver = sender?.blockedUsers?.some((id: any) => id.toString() === otherUserId);
          const receiverBlockedSender = receiver?.blockedUsers?.some((id: any) => id.toString() === authenticatedUserId);
          if (senderBlockedReceiver || receiverBlockedSender) {
            return socket.emit('message-error', { message: 'You cannot send messages to this user.' });
          }
        }
      }

      // حفظ الرسالة في الداتا بيز
      const savedMessage = await chatService.createMessage({
        chatId: data.chatId,
        senderId: authenticatedUserId,
        content: data.content,
        messageType: data.messageType
      });

      if (!savedMessage) return;

      const messageToEmit = data.tempId 
        ? { ...savedMessage.toObject(), tempId: data.tempId } 
        : savedMessage;

      // بنبعت الرسالة لكل اللي في الـ room (الشات) - سواء فردي أو جماعي
      // io.to(roomId) بتبعت لكل اللي في الغرفة (بما فيهم المرسل)
      io.to(data.chatId).emit('receive-message', messageToEmit);

      console.log(`💬 Message from [${authenticatedUserId}] in chat [${data.chatId}]`);
    } catch (error: any) {
      // لو حصل أي مشكلة (زي إن اليوزر مش عضو في الشات)، نبلغ المرسل بس
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
  // 📞 أحداث المكالمات (Call Events)
  // ==========================================
  socket.on('call-user', async (data: { userToCall: string, signalData: any, from: string, callerName: string, callerAvatar?: string, callType?: 'voice' | 'video', chatId?: string }) => {
    try {
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

      const receiverSocketId = userSocketMap.get(data.userToCall);

      if (receiverSocketId) {
        io.to(receiverSocketId).emit('incoming-call', {
          signal: data.signalData,
          from: data.from,
          callerName: data.callerName,
          callerAvatar: data.callerAvatar || '',
          callType: data.callType || 'video',
          callId: newCall._id.toString(),
          chatId: resolvedChatId || ''
        });
        console.log(`📞 [${data.callType || 'video'}] call from [${data.from}] to [${data.userToCall}] — delivered to socket`);
      } else {
        socket.emit('user-offline', { message: 'The user is currently offline' });
        console.log(`⚠️ [call-user] Receiver [${data.userToCall}] is offline. Call saved as missed.`);
      }
    } catch (error: any) {
      console.error("CRITICAL DB ERROR CREATING 1-TO-1 CALL:", error.message, error.errors);
    }
  });

  socket.on('answer-call', async (data: { to: string, signal: any, callId: string }) => {
    try {
      if (data.callId) {
        await Call.findByIdAndUpdate(data.callId, { status: 'accepted' });
      }
      const callerSocketId = userSocketMap.get(data.to);
      if (callerSocketId) {
        io.to(callerSocketId).emit('call-accepted', data.signal);
        console.log(`✅ Call [${data.callId}] accepted — status updated`);
      }
    } catch (error) {
      console.log("Error updating call:", error);
    }
  });

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
      
      const toId = data.to || data.caller; // Fallback for 'to' using unified payload
      const callerSocketId = userSocketMap.get(toId);
      if (callerSocketId) io.to(callerSocketId).emit('call-rejected');
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
      
      const toId = data.to || data.receiver;
      const receiverSocketId = userSocketMap.get(toId);
      if (receiverSocketId) io.to(receiverSocketId).emit('call-cancelled');
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
      
      const toId = data.to || data.receiver;
      const receiverSocketId = userSocketMap.get(toId);
      if (receiverSocketId) {
        io.to(receiverSocketId).emit('call-ended');
      }
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
        type: 'group',
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
          const sId = userSocketMap.get(idStr);
          if (sId) {
            io.to(sId).emit('incoming-group-call', {
              groupId: data.groupId,
              callerName: data.callerName,
              callType: data.callType,
              callId: callId,
            });
          }
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

  socket.on('disconnect', () => {
    try {
      console.log(`🔴 Line disconnected: ${socket.id}`);
      for (let [userId, socketId] of userSocketMap.entries()) {
        if (socketId === socket.id) {
          userSocketMap.delete(userId);
          break;
        }
      }
    } catch (err) {
      console.error('Socket Disconnect Error:', err);
    }
  });
  } catch (error) {
    console.error('Global Socket Connection Error:', error);
  }
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
mongoose.connect(process.env.MONGO_URI as string)
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

app.use(`${BASE_URL}/auth`, authRoutes);
app.use(BASE_URL, apiRoutes);

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