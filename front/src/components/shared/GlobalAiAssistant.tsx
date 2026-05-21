import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import axiosInstance from '../../api/axiosInstance';

interface Message {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: Date;
}

interface GlobalAiAssistantProps {
  onClose: () => void;
}

export const GlobalAiAssistant: React.FC<GlobalAiAssistantProps> = ({ onClose }) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      sender: 'ai',
      text: 'Hello! I am your Rabta AI Guide. Ask me anything about project guidelines, platform rules, or details about communities and jobs! How can I help you today?',
      timestamp: new Date(),
    },
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to the bottom of the conversation
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  // API Call Wrapper with fallbacks for robust integration
  const askGlobalAi = async (question: string): Promise<string> => {
    const token = localStorage.getItem('token');
    const headers = { Authorization: `Bearer ${token}` };
    const baseUrls = [
      axiosInstance.defaults.baseURL || 'http://localhost:5000/api/v1',
      'http://localhost:5000/api/v1'
    ];
    
    const paths = [
      `/api/ai/ask-global`,
      `/ai/ask-global`,
      `/ask-global`
    ];

    let lastError: any = null;

    for (const baseUrl of baseUrls) {
      for (const path of paths) {
        try {
          const url = `${baseUrl}${path}`;
          const res = await axios.post(url, { question }, { headers });
          if (res.data?.status === 'success' && res.data?.data) {
            return res.data.data;
          }
          if (res.data?.data) {
            return res.data.data;
          }
        } catch (err: any) {
          lastError = err;
          // Loop through alternative endpoints if 404
          if (err.response?.status !== 404) {
            throw err;
          }
        }
      }
    }
    throw lastError || new Error('Global AI Assistant service is unreachable');
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedInput = inputValue.trim();
    if (!trimmedInput) return;

    // Append user message instantly
    const userMsgId = Math.random().toString(36).substr(2, 9);
    const userMessage: Message = {
      id: userMsgId,
      sender: 'user',
      text: trimmedInput,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    setIsTyping(true);

    try {
      const aiResponseText = await askGlobalAi(trimmedInput);
      
      const aiMsgId = Math.random().toString(36).substr(2, 9);
      const aiMessage: Message = {
        id: aiMsgId,
        sender: 'ai',
        text: aiResponseText,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, aiMessage]);
    } catch (err: any) {
      const errorMsgId = Math.random().toString(36).substr(2, 9);
      const errorMessageText = err.response?.data?.message || err.message || 'I encountered an error retrieving data. Please try again.';
      const errorMsg: Message = {
        id: errorMsgId,
        sender: 'ai',
        text: `⚠️ ${errorMessageText}`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 w-[360px] h-[520px] bg-white dark:bg-[#1e1e24] rounded-2xl shadow-2xl border border-gray-200 dark:border-white/5 flex flex-col overflow-hidden z-50 animate-in fade-in slide-in-from-bottom-6 duration-300">
      
      {/* Header banner */}
      <div className="bg-gradient-to-r from-purple-600 via-indigo-500 to-indigo-600 px-4 py-3 flex items-center justify-between text-white shadow-md">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center border border-white/20">
              <i className="fa-solid fa-robot text-base text-white"></i>
            </div>
            {/* Green Online status dot */}
            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-400 border-2 border-purple-600 rounded-full animate-pulse"></span>
          </div>
          <div>
            <h3 className="font-bold text-sm leading-none">Rabta AI Guide</h3>
            <span className="text-[10px] text-purple-100 font-medium">Virtual Assistant</span>
          </div>
        </div>
        
        <button 
          onClick={onClose} 
          className="w-7 h-7 rounded-lg hover:bg-white/10 flex items-center justify-center transition-all cursor-pointer"
        >
          <span className="material-icons-round text-base text-white">close</span>
        </button>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/50 dark:bg-black/10">
        {messages.map((msg) => (
          <div 
            key={msg.id}
            className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
          >
            <div 
              className={`p-3 rounded-2xl text-sm shadow-sm leading-relaxed max-w-[80%] whitespace-pre-line border transition-all ${
                msg.sender === 'user'
                  ? 'bg-purple-600 text-white border-purple-500 rounded-tr-none ml-auto'
                  : 'bg-white dark:bg-[#282830] text-gray-800 dark:text-gray-100 border-gray-100 dark:border-white/5 rounded-tl-none mr-auto'
              }`}
            >
              {msg.text}
            </div>
            <span className="text-[10px] text-gray-400 dark:text-gray-500 mt-1 px-1">
              {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        ))}

        {/* Typing indicator */}
        {isTyping && (
          <div className="flex flex-col items-start">
            <div className="p-3 rounded-2xl bg-white dark:bg-[#282830] border border-gray-100 dark:border-white/5 rounded-tl-none mr-auto shadow-sm flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
              <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
              <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Form area */}
      <form 
        onSubmit={handleSend}
        className="p-3 bg-white dark:bg-[#1e1e24] border-t border-gray-100 dark:border-white/5 flex gap-2 items-center"
      >
        <div className="relative flex-1">
          <input
            type="text"
            placeholder="Type your message..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            disabled={isTyping}
            className="w-full pl-4 pr-11 py-2.5 bg-gray-50 dark:bg-black/25 border border-gray-200 dark:border-white/10 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all text-gray-900 dark:text-white"
          />
          <button
            type="submit"
            disabled={isTyping || !inputValue.trim()}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg bg-purple-600 hover:bg-purple-700 text-white flex items-center justify-center transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className="material-icons-round text-base">send</span>
          </button>
        </div>
      </form>
    </div>
  );
};
