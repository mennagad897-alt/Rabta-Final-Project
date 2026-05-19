import React from 'react';

interface PopupProps {
  children: React.ReactNode;
  onClose?: () => void;
}

export const Popup = ({ children, onClose }: PopupProps) => {
  return (
    // الخلفية الضبابية (Overlay)
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center z-100 p-4 animate-in fade-in duration-300">
      
      {/* جسم الـ Popup */}
      <div className="bg-white dark:bg-[#262626] border border-gray-100 dark:border-white/5 w-full max-w-md p-6 rounded-3xl shadow-2xl relative animate-in zoom-in-95 duration-300">
        
        {/* زرار القفل */}
        {onClose && (
          <button 
            onClick={onClose} 
            className="absolute top-4 right-4 text-gray-400 hover:text-[#7C3AED] dark:hover:text-[#8B5CF6] transition-colors p-1 hover:bg-gray-100 dark:hover:bg-white/5 rounded-full"
          >
            <span className="material-icons-round">close</span>
          </button>
        )}

        {/* المحتوى الداخلي */}
        <div className="mt-2 text-[#171717] dark:text-[#F5F5F5]">
          {children}
        </div>
      </div>
    </div>
  );
};