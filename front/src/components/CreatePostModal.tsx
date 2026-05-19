import React, { useState, useRef } from 'react';
import axiosInstance from '../api/axiosInstance';
import axios from 'axios';

// ==========================================
// 1. Interfaces
// ==========================================
interface CreatePostModalProps {
  isOpen: boolean;
  onClose: () => void;
  groupId: string;      // 💡 الـ ID بتاع الجروب عشان الباك إند يعرف البوست رايح فين
  groupName: string;    // 💡 اسم الجروب (عشان يظهر دايناميك فوق)
  groupAvatar?: string; // 💡 صورة الجروب
  onPostSuccess: () => void; // 💡 دالة تتنفذ لما البوست ينجح (عشان نحدث الشات)
}

// ==========================================
// 2. Component
// ==========================================
export const CreatePostModal: React.FC<CreatePostModalProps> = ({ 
  isOpen, 
  onClose, 
  groupId, 
  groupName, 
  groupAvatar,
  onPostSuccess 
}) => {
  // --- States ---
  const [content, setContent] = useState<string>('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // --- Refs للتحكم في رفع الملفات ---
  const imageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // لو المودال مقفول، مترسمش حاجة
  if (!isOpen) return null;

  // --- Handlers ---
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files);
      setSelectedFiles(prev => [...prev, ...newFiles]);
    }
  };

  const removeFile = (indexToRemove: number) => {
    setSelectedFiles(prev => prev.filter((_, index) => index !== indexToRemove));
  };

  // --- دالة الإرسال للباك-إند ---
  const handleSubmit = async () => {
    if (!content.trim() && selectedFiles.length === 0) {
      setError("Please write something or attach a file.");
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      const formData = new FormData();
      formData.append('content', content);
      formData.append('communityId', groupId); // 💡 Pass the group ID to the backend
      
      selectedFiles.forEach((file) => {
        formData.append('media', file);
      });

      await axiosInstance.post(
        `/posts`,
        formData,
        { 
          headers: { 
            'Content-Type': 'multipart/form-data' 
          } 
        }
      );

      // تنظيف الفورم وقفل المودال بعد النجاح
      setContent('');
      setSelectedFiles([]);
      onPostSuccess(); 
      onClose();

    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.message || "Failed to create post.");
      } else {
        setError("An unexpected error occurred.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Background Overlay */}
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-sm" 
        onClick={onClose}
      ></div>
      
      {/* Modal Container */}
      <div className="relative w-full max-w-lg bg-[#1E1E1E] rounded-2xl border border-white/10 shadow-2xl flex flex-col animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-center p-4 border-b border-white/5 relative">
          <button 
            onClick={onClose}
            className="absolute left-4 text-gray-400 hover:text-white transition-colors"
          >
            <span className="material-icons-round">close</span>
          </button>
          <h2 className="text-lg font-bold text-white tracking-wide">Create Post</h2>
        </div>

        {/* Dynamic Context Header (Group Info) */}
        <div className="p-5 flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#7C3AED]/20 flex items-center justify-center text-[#8B5CF6] font-bold text-sm border border-[#7C3AED]/30 overflow-hidden shrink-0">
               {groupAvatar ? (
                 <img src={groupAvatar} alt={groupName} className="w-full h-full object-cover" />
               ) : (
                 groupName.substring(0, 3).toUpperCase()
               )}
            </div>
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Posting to Community</p>
              <h3 className="text-sm font-bold text-[#8B5CF6]">{groupName}</h3>
            </div>
          </div>

          {/* Text Area */}
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="What's on your mind? Share news or updates..."
            className="w-full h-32 bg-transparent text-[#F5F5F5] placeholder-gray-500 outline-none resize-none text-base leading-relaxed custom-scrollbar"
          />

          {/* Error Message */}
          {error && <p className="text-red-400 text-xs font-medium">{error}</p>}

          {/* Selected Files Preview Area */}
          {selectedFiles.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {selectedFiles.map((file, idx) => (
                <div key={idx} className="flex items-center gap-2 bg-[#262626] px-3 py-1.5 rounded-lg border border-white/10">
                  <span className="material-icons-round text-sm text-[#8B5CF6]">
                    {file.type.startsWith('image/') ? 'image' : 'insert_drive_file'}
                  </span>
                  <span className="text-xs text-gray-300 max-w-[100px] truncate">{file.name}</span>
                  <button onClick={() => removeFile(idx)} className="text-gray-500 hover:text-red-400 ml-1">
                    <span className="material-icons-round text-sm">close</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 flex items-center justify-between border-t border-white/5">
          <div className="flex items-center gap-2">
            {/* Hidden Inputs for files */}
            <input type="file" accept="image/*" multiple ref={imageInputRef} onChange={handleFileSelect} className="hidden" />
            <input type="file" accept=".pdf,.doc,.docx,.zip" multiple ref={fileInputRef} onChange={handleFileSelect} className="hidden" />

            <button 
              onClick={() => imageInputRef.current?.click()}
              className="w-10 h-10 rounded-xl bg-[#262626] hover:bg-[#333333] border border-white/5 flex items-center justify-center text-gray-400 hover:text-white transition-colors"
              title="Add Image"
            >
              <span className="material-icons-round">image</span>
            </button>
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="w-10 h-10 rounded-xl bg-[#262626] hover:bg-[#333333] border border-white/5 flex items-center justify-center text-gray-400 hover:text-white transition-colors"
              title="Add File"
            >
              <span className="material-icons-round">attach_file</span>
            </button>
          </div>

          <button 
            onClick={handleSubmit}
            disabled={isSubmitting || (!content.trim() && selectedFiles.length === 0)}
            className="px-6 py-2.5 bg-[#8B5CF6] hover:bg-[#7C3AED] text-white font-bold rounded-xl shadow-lg flex items-center gap-2 transition-all disabled:opacity-50 disabled:hover:bg-[#8B5CF6]"
          >
            {isSubmitting ? 'Posting...' : 'Post to Group'}
            {!isSubmitting && <span className="material-icons-round text-sm">double_arrow</span>}
          </button>
        </div>

      </div>
    </div>
  );
};