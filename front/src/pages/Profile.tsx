import React, { useEffect, useState } from 'react';
import { useAppSelector, useAppDispatch } from '../store/hooks';
import { useNavigate, Link } from 'react-router-dom';
import { fetchMyProfile } from '../api/auth';
import { updateProfile } from '../store/slices/authSlice';
import { useOnlineUsers } from '../hooks/useOnlineUsers';

const Profile: React.FC = () => {
  const user = useAppSelector((state) => state.auth.user);
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { isOnline } = useOnlineUsers();
  const [isAiOpen, setIsAiOpen] = useState(false);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const freshUser = await fetchMyProfile();
        dispatch(updateProfile(freshUser));
      } catch (error) {
        console.error('Failed to fetch fresh profile data', error);
      }
    };
    loadProfile();
  }, [dispatch]);


  const getInitials = (name: string) => {
    if (!name) return "??";
    const parts = name.trim().split(" ");
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return parts[0].slice(0, 2).toUpperCase();
  };

  const getSocialIcon = (platform: string) => {
    switch (platform.toLowerCase()) {
      case 'github': return 'fa-brands fa-github';
      case 'linkedin': return 'fa-brands fa-linkedin';
      case 'twitter':
      case 'twitter / x': return 'fa-brands fa-x-twitter';
      case 'behance': return 'fa-brands fa-behance';
      case 'portfolio':
      case 'portfolio / website': return 'fa-solid fa-globe';
      default: return 'fa-solid fa-link';
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#FAFAFA] dark:bg-[#171717] text-[#171717] dark:text-[#F5F5F5] font-sans antialiased">
      <main className="max-w-6xl mx-auto p-4 md:p-10">
        <div className="grid lg:grid-cols-3 gap-6 w-full">

          {/* Left Column */}
          <div className="lg:col-span-1 flex flex-col gap-6">

            {/* Card 1: User Info */}
            <div className="bg-[#FFFFFF] dark:bg-[#1E1E22] rounded-xl p-6 shadow-lg border border-gray-100 dark:border-zinc-800 text-center">
              <div className="relative w-32 h-32 mx-auto mb-6">
                <div className="w-full h-full bg-[#7C3AED] rounded-full flex items-center justify-center text-white text-4xl font-black shadow-lg overflow-hidden">
                  {user?.avatar ? (
                    <img src={user.avatar} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    getInitials(user?.fullName || "")
                  )}
                </div>
                {user && isOnline(user._id || user.id) && (
                  <span className="w-4 h-4 bg-green-400 rounded-full absolute bottom-1 right-1 ring-2 ring-white dark:ring-[#1E1E22] animate-pulse"></span>
                )}
              </div>
              <h2 className="text-2xl font-bold mb-1">{user?.fullName || 'User Name'}</h2>
              <p className="text-[#7C3AED] dark:text-[#8B5CF6] font-medium mb-1">{user?.jobTitle || 'No Title Provided'}</p>
              <div className="flex items-center justify-center gap-1 text-sm opacity-70 mb-3">
                <span className="material-icons-round text-sm">location_on</span>
                <span>{user?.location || 'Location not specified'}</span>
              </div>
              <p className="text-sm opacity-80 mb-6 italic">"{user?.bioHeadline || 'No short bio added.'}"</p>

              <div className="flex justify-center gap-4 mb-6">
                {user?.links?.map((link: any, index: number) => (
                  <a
                    key={index}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-10 h-10 rounded-full bg-gray-50 dark:bg-[#2A2A2E] flex items-center justify-center text-gray-500 hover:text-[#7C3AED] hover:bg-[#7C3AED]/10 transition-all border border-gray-100 dark:border-zinc-700"
                    title={link.platform}
                  >
                    <i className={`${getSocialIcon(link.platform)} text-lg`}></i>
                  </a>
                ))}
              </div>

              <div className="flex flex-col gap-3">
                <button
                  onClick={() => navigate('/edit-profile')}
                  className="w-full bg-[#7C3AED] hover:bg-[#6D28D9] text-white py-3 rounded-xl font-bold transition-all active:scale-95 flex items-center justify-center gap-2"
                >
                  <span className="material-icons-round text-sm">edit</span>
                  Edit Profile
                </button>

                <button
                  onClick={() => navigate('/freelancer-dashboard')}
                  className="w-full border-2 border-[#7C3AED] text-[#7C3AED] dark:text-[#8B5CF6] dark:border-[#8B5CF6] hover:bg-[#7C3AED]/5 py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2"
                >
                  <span className="material-icons-round text-sm">dashboard</span>
                  My Dashboard
                </button>

                {user && user.role === 'admin' && (
                  <Link
                    to="/admin"
                    className="w-full border-2 border-[#7C3AED] text-[#7C3AED] dark:text-[#8B5CF6] dark:border-[#8B5CF6] hover:bg-[#7C3AED]/5 py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2"
                  >
                    <i className="fa-solid fa-user-shield mr-2"></i>
                    Admin Dashboard
                  </Link>
                )}
              </div>
            </div>

            {/* Card 2: Technical Skills */}
            <div className="bg-[#FFFFFF] dark:bg-[#1E1E22] rounded-xl p-6 shadow-lg border border-gray-100 dark:border-zinc-800">
              <h3 className="text-lg font-bold mb-4">Technical Skills</h3>
              <div className="flex flex-wrap gap-2">
                {user?.skills && user.skills.length > 0 ? user.skills.map((skill: string, index: number) => (
                  <span key={index} className="bg-purple-100 dark:bg-purple-900/30 text-[#7C3AED] dark:text-purple-400 rounded-full px-3 py-1 text-sm font-bold">
                    {skill}
                  </span>
                )) : <p className="text-sm opacity-50 italic">No skills added yet.</p>}
              </div>
            </div>
          </div>

          {/* Right Column */}
          <div className="lg:col-span-2 flex flex-col gap-6">

            {/* Card 3: About Me */}
            <div className="bg-[#FFFFFF] dark:bg-[#1E1E22] rounded-xl p-6 shadow-lg border border-gray-100 dark:border-zinc-800 transition-colors duration-300">
              <h3 className="text-2xl font-bold mb-3">About Me</h3>
              <div className="w-12 h-1 bg-[#7C3AED] dark:bg-[#8B5CF6] rounded-full mb-6"></div>
              <p className="leading-relaxed text-[#171717] dark:text-[#F5F5F5] whitespace-pre-wrap">
                {user?.aboutMe || 'No details provided.'}
              </p>
            </div>

            {/* Card 4: Featured Projects */}
            <div className="bg-[#FFFFFF] dark:bg-[#1E1E22] rounded-xl p-6 shadow-lg border border-gray-100 dark:border-zinc-800">
              <h3 className="text-2xl font-bold mb-3">Featured Projects</h3>
              <div className="w-12 h-1 bg-[#7C3AED] dark:bg-[#8B5CF6] rounded-full mb-6"></div>

              <div className="grid grid-cols-1 gap-6">
                {user?.projects && user.projects.length > 0 ? (
                  user.projects.map((project: any, index: number) => (
                    <article key={index} className="bg-gray-50 dark:bg-[#2A2A2E] rounded-xl shadow-md p-6 flex flex-col md:flex-row gap-6 items-start md:items-center border border-gray-200 dark:border-zinc-700">
                      <div className="grow">
                        <h4 className="text-xl font-bold mb-2">{project.title}</h4>
                        <p className="text-sm opacity-80 mb-2 leading-relaxed">
                          {project.description}
                        </p>
                        <div className="flex gap-3 mt-4">
                          {project.projectLink && (
                            <a href={project.projectLink} target="_blank" rel="noopener noreferrer" className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 shadow-sm">
                              Live Demo <span className="material-icons-round text-[16px]">open_in_new</span>
                            </a>
                          )}
                          {project.githubLink && (
                            <a href={project.githubLink} target="_blank" rel="noopener noreferrer" className="border border-zinc-600 hover:bg-zinc-800 text-[#171717] hover:text-white dark:text-[#F5F5F5] px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2">
                              <i className="fa-brands fa-github text-[16px]"></i> GitHub Repo
                            </a>
                          )}
                        </div>
                      </div>
                    </article>
                  ))
                ) : (
                  <p className="text-center opacity-50 py-10 italic">No projects added yet.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

    </div>
  );
};

export default Profile;