import { useState, useEffect, useCallback } from 'react';
import { useChat } from '../context/ChatContext';
import { useAppSelector } from '../store/hooks';

export const useOnlineUsers = () => {
  const { socket } = useChat();
  const reduxToken = useAppSelector((state) => state.auth.token);
  // Get token from localStorage key 'token' OR from Redux state.auth.token
  const token = localStorage.getItem('token') || reduxToken;

  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!socket) return;

    const handleOnlineUsers = (userIds: string[]) => {
      setOnlineUsers(new Set(userIds));
    };

    // Listen to 'online-users' event
    socket.on('online-users', handleOnlineUsers);

    // Initial check in case the event was already fired
    // Let's ask server for online users if needed, or if it emits periodically.
    // The server emits 'online-users' when someone connects/disconnects.
    
    return () => {
      socket.off('online-users', handleOnlineUsers);
    };
  }, [socket]);

  const isOnline = useCallback((userId: string): boolean => {
    if (!userId) return false;
    return onlineUsers.has(userId);
  }, [onlineUsers]);

  return { isOnline, onlineUsers, token };
};
