import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';

export const ViewContact: React.FC = () => {
  const navigate = useNavigate();
  const { userId } = useParams<{ userId: string }>();

  return (
    <main className="flex-1 h-full overflow-y-auto relative custom-scrollbar bg-[#F8F7FC] dark:bg-[#121212] transition-colors duration-500">
      <div className="absolute top-0 left-0 w-full h-64 bg-linear-to-b from-[#8B5CF6]/10 to-transparent z-0 pointer-events-none"></div>

      <div className="relative max-w-5xl mx-auto px-4 sm:px-6 py-10 z-10">
        <button onClick={() => navigate(-1)} className="inline-flex items-center gap-2 text-[#8B5CF6] font-bold transition-all w-fit hover:-translate-x-1 mb-8 focus:outline-none">
          <span className="material-icons-round text-xl">arrow_back</span>
          Back to Chat
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Info Card */}
          <div className="lg:col-span-2 flex flex-col gap-8">
            <article className="bg-white dark:bg-[#1E1E1E] rounded-3xl shadow-sm border border-[#8B5CF6]/10 transition-all duration-500 overflow-hidden relative">
              {/* Cover */}
              <div className="h-32 w-full bg-linear-to-r from-[#8B5CF6]/40 to-blue-500/40 relative">
                <div className="absolute top-6 right-6 bg-white/20 backdrop-blur-md border border-white/30 text-white text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5">
                  <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span> Online
                </div>
              </div>

              {/* Profile Section - Fixed overlap */}
              <div className="px-6 sm:px-10 pb-8 relative">
                {/* Avatar - positioned to overlap the cover */}
                <div className="relative -mt-14 mb-4">
                  <div className="p-1.5 bg-white dark:bg-[#1E1E1E] rounded-full shadow-sm inline-block">
                    <img
                      src={`https://ui-avatars.com/api/?name=${encodeURIComponent(userId || 'Contact')}&background=8B5CF6&color=fff&size=256`}
                      alt="Contact Avatar"
                      className="w-24 h-24 sm:w-28 sm:h-28 rounded-full object-cover"
                    />
                  </div>
                </div>

                {/* User Info - clear space below avatar */}
                <div className="mb-8">
                  <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-1 dark:text-[#F5F5F5]">Mai Ahmed</h1>
                  <p className="sr-only">Contact user id: {userId}</p>
                  <p className="text-[#8B5CF6] font-bold text-lg mb-3">UI/UX Designer</p>
                  <p className="text-sm opacity-70 font-light leading-relaxed max-w-lg dark:text-[#F5F5F5]">
                    Creative designer focusing on user-centered digital experiences. Currently working on freelance projects and exploring modern UI trends.
                  </p>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-wrap items-center gap-3 sm:gap-4 mb-8 pb-8 border-b border-gray-100 dark:border-gray-800">
                  <button onClick={() => navigate('/chats')} className="flex-1 min-w-30 bg-[#8B5CF6] hover:bg-[#7C3AED] text-white py-3 sm:py-3.5 rounded-2xl font-bold text-sm transition-all hover:shadow-lg hover:shadow-[#8B5CF6]/20 active:scale-95 flex items-center justify-center gap-2">
                    <span className="material-icons-round text-xl">chat</span> Message
                  </button>
                  <button className="w-12 h-12 sm:w-14 sm:h-14 bg-gray-50 dark:bg-[#121212] border border-gray-100 dark:border-gray-800 text-gray-600 dark:text-gray-300 hover:text-[#8B5CF6] rounded-2xl flex items-center justify-center transition-colors hover:border-[#8B5CF6]/30">
                    <span className="material-icons-round text-xl">call</span>
                  </button>
                  <button className="w-12 h-12 sm:w-14 sm:h-14 bg-gray-50 dark:bg-[#121212] border border-gray-100 dark:border-gray-800 text-gray-600 dark:text-gray-300 hover:text-[#8B5CF6] rounded-2xl flex items-center justify-center transition-colors hover:border-[#8B5CF6]/30">
                    <span className="material-icons-round text-xl">videocam</span>
                  </button>
                </div>

                {/* Contact Info (Email, Location, etc) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 dark:text-[#F5F5F5]">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-[#8B5CF6]/10 flex items-center justify-center text-[#8B5CF6] shrink-0">
                      <span className="material-icons-round text-[20px]">email</span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold opacity-60 uppercase tracking-wider mb-0.5">Email</p>
                      <p className="text-sm font-bold truncate">mai.ahmed@example.com</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-[#8B5CF6]/10 flex items-center justify-center text-[#8B5CF6] shrink-0">
                      <span className="material-icons-round text-[20px]">location_on</span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold opacity-60 uppercase tracking-wider mb-0.5">Location</p>
                      <p className="text-sm font-bold">Cairo, Egypt</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-[#8B5CF6]/10 flex items-center justify-center text-[#8B5CF6] shrink-0">
                      <span className="material-icons-round text-[20px]">school</span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold opacity-60 uppercase tracking-wider mb-0.5">Track</p>
                      <p className="text-sm font-bold">UI/UX Design</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-[#8B5CF6]/10 flex items-center justify-center text-[#8B5CF6] shrink-0">
                      <span className="material-icons-round text-[20px]">work</span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold opacity-60 uppercase tracking-wider mb-0.5">Status</p>
                      <p className="text-sm font-bold">Freelancer</p>
                    </div>
                  </div>
                </div>
              </div>
            </article>
          </div>

          {/* Sidebar - Shared Content */}
          <aside className="w-full flex flex-col gap-6">
            <div className="bg-white dark:bg-[#1E1E1E] rounded-3xl shadow-sm border border-[#8B5CF6]/10 p-6 transition-all duration-500 lg:sticky lg:top-6">
              <h3 className="text-lg font-bold tracking-tight mb-6 dark:text-[#F5F5F5]">Shared Content</h3>
              
              {/* Media Preview - shows empty state when no data */}
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="w-14 h-14 bg-gray-100 dark:bg-[#262626] rounded-full flex items-center justify-center mb-3">
                  <span className="material-icons-round text-2xl text-gray-300 dark:text-gray-600">collections</span>
                </div>
                <p className="text-sm font-medium text-gray-400 dark:text-gray-500">No shared content yet</p>
                <p className="text-xs text-gray-300 dark:text-gray-600 mt-1">Media and files will appear here</p>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
};