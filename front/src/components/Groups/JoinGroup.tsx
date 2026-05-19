import React from 'react';

const JoinGroup: React.FC = () => {
  return (
    <div className="flex items-center justify-center min-h-[80vh] text-[#171717] dark:text-white p-4 font-sans">
      <div className="w-full max-w-md p-8 text-center bg-white dark:bg-[#262626] border border-gray-100 dark:border-white/5 rounded-3xl shadow-xl relative overflow-hidden">
        
        <div className="flex items-center justify-center w-20 h-20 mx-auto mb-6 rounded-full bg-[#7C3AED]/10 dark:bg-[#8B5CF6]/20 shadow-inner">
          <span className="material-icons-round text-4xl text-[#7C3AED] dark:text-[#8B5CF6]">group_add</span>
        </div>
        
        <h2 className="text-3xl font-black tracking-tight">Join Community</h2>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 font-medium">Enter the invitation code to join your colleagues</p>

        <div className="mt-8 space-y-5">
          <input 
            type="text" 
            placeholder="ENTER CODE (e.g. RABTA-2026)"
            className="w-full py-4 text-xl font-bold tracking-widest text-center uppercase border border-gray-200 dark:border-white/10 rounded-2xl outline-none bg-gray-50 dark:bg-[#171717] focus:ring-2 focus:ring-[#7C3AED] transition-all placeholder-gray-400"
          />
          <button className="w-full py-4 font-black text-white transition-all transform bg-[#7C3AED] hover:bg-[#6D28D9] rounded-2xl shadow-lg hover:shadow-xl active:scale-95">
            Join Now
          </button>
          <p className="text-xs font-medium text-gray-500 mt-4">
            Don't have a code? Contact your group admin.
          </p>
        </div>
      </div>
    </div>
  );
};

export default JoinGroup;