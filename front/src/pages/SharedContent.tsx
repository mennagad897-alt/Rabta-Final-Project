import React from 'react';
import { useNavigate } from 'react-router-dom';

export const SharedContent: React.FC = () => {
  const navigate = useNavigate();

  return (
    <main className="flex-1 h-full overflow-y-auto relative custom-scrollbar bg-[#F8F7FC] dark:bg-[#121212] transition-colors">
      <div className="absolute top-0 left-0 w-full h-64 bg-gradient-to-b from-[#8B5CF6]/10 to-transparent z-0 pointer-events-none"></div>

      <div className="relative max-w-7xl mx-auto px-6 py-10 z-10">
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
          <div>
            <button onClick={() => navigate(-1)} className="inline-flex items-center gap-2 text-[#8B5CF6] font-bold transition-all w-fit hover:-translate-x-1 mb-4 focus:outline-none">
              <span className="material-icons-round text-xl">arrow_back</span>
              Back to Contact
            </button>
            <h1 className="text-3xl font-bold tracking-tight dark:text-[#F5F5F5]">Shared Content</h1>
            <p className="text-sm opacity-70 font-medium mt-1 dark:text-gray-400">265 items shared in this conversation</p>
          </div>
          
          <div className="relative w-full md:w-80">
            <span className="material-icons-round absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">search</span>
            <input type="text" placeholder="Search files, links, media..." className="w-full bg-white dark:bg-[#1E1E1E] border border-gray-200 dark:border-gray-800 rounded-2xl pl-12 pr-4 py-3.5 focus:outline-none focus:border-[#8B5CF6] transition-all shadow-sm font-medium dark:text-[#F5F5F5]" />
          </div>
        </div>

        {/* Tabs */}
        <div className="flex overflow-x-auto hide-scrollbar gap-2 mb-10 bg-white dark:bg-[#1E1E1E] p-2 rounded-2xl border border-gray-100 dark:border-gray-800 w-fit max-w-full">
          <button className="px-6 py-2.5 bg-[#8B5CF6]/10 text-[#8B5CF6] font-bold rounded-xl flex items-center gap-2"><span className="material-icons-round text-lg">collections</span> Media (142)</button>
          <button className="px-6 py-2.5 text-gray-500 font-medium hover:bg-gray-50 dark:hover:bg-[#262626] rounded-xl flex items-center gap-2"><span className="material-icons-round text-lg">folder</span> Files (38)</button>
          <button className="px-6 py-2.5 text-gray-500 font-medium hover:bg-gray-50 dark:hover:bg-[#262626] rounded-xl flex items-center gap-2"><span className="material-icons-round text-lg">link</span> Links (85)</button>
        </div>

        {/* Media Grid */}
        <div className="mb-10">
          <h3 className="text-lg font-bold mb-5 tracking-tight border-b border-gray-100 dark:border-gray-800 pb-2 dark:text-[#F5F5F5]">April 2026</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            <img src="https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=400&q=80" className="aspect-square rounded-2xl object-cover cursor-pointer hover:opacity-80 transition-opacity" alt="Media" />
            <img src="https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=400&q=80" className="aspect-square rounded-2xl object-cover cursor-pointer hover:opacity-80 transition-opacity" alt="Media" />
            <img src="https://images.unsplash.com/photo-1542744094-3a31f272c490?w=400&q=80" className="aspect-square rounded-2xl object-cover cursor-pointer hover:opacity-80 transition-opacity" alt="Media" />
          </div>
        </div>

      </div>
    </main>
  );
};