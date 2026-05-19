import React, { useState } from 'react';

interface AiAssistantProps {
  placeholder?: string;
  className?: string;
}

export const AiAssistant: React.FC<AiAssistantProps> = ({ 
  placeholder = "How can I help you today?",
  className = "fixed bottom-6 right-6 z-50"
}) => {
  const [showAiPopup, setShowAiPopup] = useState(false);

  return (
    <div className={`flex flex-col items-end gap-3 ${className}`}>
      {showAiPopup && (
        <div className="w-80 bg-white dark:bg-[#262626] rounded-2xl shadow-2xl border border-gray-100 dark:border-white/5 overflow-hidden animate-in slide-in-from-bottom-5 mb-2">
          <div className="bg-[#7C3AED] p-4 text-white flex justify-between items-center font-bold text-sm">
            <span>Rabta AI Assistant</span>
            <button onClick={() => setShowAiPopup(false)}>
              <span className="material-icons-round text-sm">close</span>
            </button>
          </div>
          <div className="h-32 p-4 text-xs italic text-gray-500 dark:text-gray-400">
            {placeholder}
          </div>
        </div>
      )}
      <button 
        onClick={() => setShowAiPopup(!showAiPopup)}
        className="w-12 h-12 bg-[#7C3AED] rounded-full flex items-center justify-center text-white shadow-xl hover:scale-110 transition-all"
      >
        <span className="material-icons-round">bolt</span>
      </button>
    </div>
  );
};
