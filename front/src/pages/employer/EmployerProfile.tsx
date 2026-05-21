import React, { useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import type { RootState } from '../../store/store';
import { fetchMyProfile } from '../../api/auth';
import { updateProfile } from '../../store/slices/authSlice';

const EmployerProfile: React.FC = () => {
  const user = useSelector((state: RootState) => state.auth.user);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const freshUser = await fetchMyProfile();
        dispatch(updateProfile(freshUser));
      } catch (error) {
        console.error('Failed to fetch fresh profile data', error);
      } finally {
        setLoading(false);
      }
    };
    loadProfile();
  }, [dispatch]);

  return (
    <div className="min-h-screen bg-[#FAFAFA] dark:bg-[#171717] text-[#171717] dark:text-[#F5F5F5] p-4 md:p-10">
      <main className="max-w-6xl mx-auto">
        <div className="grid lg:grid-cols-3 gap-6 w-full">

          {/* Left Column */}
          <div className="lg:col-span-1 flex flex-col gap-6">

            {/* Card 1: User Info */}
            <div className="bg-[#FFFFFF] dark:bg-[#1E1E22] rounded-xl p-6 shadow-lg border border-gray-100 dark:border-zinc-800 text-center">
              <div className="w-32 h-32 bg-[#7C3AED] rounded-full flex items-center justify-center text-white text-4xl font-black shadow-lg mx-auto mb-6 overflow-hidden">
                {user?.avatar ? (
                  <img src={user.avatar} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-[#7C3AED] flex items-center justify-center text-white text-4xl font-black">
                    {user?.fullName?.charAt(0) || "C"}
                  </div>
                )}
              </div>
              <h2 className="text-2xl font-bold mb-1">{user?.fullName || 'Company Name'}</h2>
              <p className="text-[#7C3AED] dark:text-[#8B5CF6] font-medium mb-1 flex items-center justify-center gap-1">
                <span className="material-icons-round text-sm">verified</span>
                {user?.jobTitle || 'Hiring Company'}
              </p>
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
                    <i className="fa-solid fa-link text-lg"></i>
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
                  onClick={() => navigate('/employer-dashboard')}
                  className="w-full border-2 border-[#7C3AED] text-[#7C3AED] dark:text-[#8B5CF6] dark:border-[#8B5CF6] hover:bg-[#7C3AED]/5 py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2"
                >
                  <span className="material-icons-round text-sm">dashboard</span>
                  My Dashboard
                </button>
              </div>
            </div>

            {/* Card 2: Technical Skills */}
            <div className="bg-[#FFFFFF] dark:bg-[#1E1E22] rounded-xl p-6 shadow-lg border border-gray-100 dark:border-zinc-800">
              <h3 className="text-lg font-bold mb-4">Core Competencies / Skills</h3>
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
              <h3 className="text-2xl font-bold mb-3">About Company</h3>
              <div className="w-12 h-1 bg-[#7C3AED] dark:bg-[#8B5CF6] rounded-full mb-6"></div>
              <p className="leading-relaxed text-[#171717] dark:text-[#F5F5F5] whitespace-pre-wrap">
                {user?.aboutMe || 'No details provided.'}
              </p>
            </div>

            {/* Projects Section */}
            <div className="flex flex-col gap-6">
              <div>
                <h3 className="text-2xl font-bold mb-3">Projects</h3>
                <div className="w-12 h-1 bg-[#7C3AED] dark:bg-[#8B5CF6] rounded-full"></div>
              </div>

              {user?.projects && user.projects.length > 0 ? (
                user.projects.map((project: any, index: number) => (
                  <article key={index} className="bg-[#FFFFFF] dark:bg-[#1E1E22] rounded-xl p-6 shadow-lg border border-gray-100 dark:border-zinc-800 flex flex-col gap-4">
                    <div>
                      <h4 className="text-xl font-bold mb-2">{project.title}</h4>
                      <p className="text-sm opacity-80 leading-relaxed text-[#171717] dark:text-[#F5F5F5] whitespace-pre-wrap">
                        {project.description}
                      </p>
                    </div>
                    <div className="flex gap-3 mt-2">
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
                  </article>
                ))
              ) : (
                <div className="bg-[#FFFFFF] dark:bg-[#1E1E22] rounded-xl p-10 shadow-lg border border-gray-100 dark:border-zinc-800 text-center">
                  <p className="opacity-50 italic">No projects added yet.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default EmployerProfile;
