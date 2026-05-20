import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axiosInstance from '../../api/axiosInstance';
import toast from 'react-hot-toast';
import { useAppSelector, useAppDispatch } from '../../store/hooks';
import { updateProfile } from '../../store/slices/authSlice';
import { useOnlineUsers } from '../../hooks/useOnlineUsers';

const FreelancerProfile: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { user } = useAppSelector(state => state.auth);
  const { isOnline } = useOnlineUsers();
  const [profile, setProfile] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Check if current profile is already saved by this employer
  const isSaved = user?.savedFreelancers?.includes(id);

  const handleSaveCandidate = async () => {
    try {
      setIsSaving(true);
      const res = await axiosInstance.post(`/users/toggle-save-freelancer/${id}`);
      dispatch(updateProfile(res.data.data.user));
      toast.success(res.data.message);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to save candidate.');
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const response = await axiosInstance.get(`/users/${id}`);
        setProfile(response.data.data.user);
      } catch (error) {
        console.error("Failed to fetch profile", error);
        toast.error("Failed to load profile.");
        navigate(-1);
      } finally {
        setIsLoading(false);
      }
    };
    if (id) fetchProfile();
  }, [id, navigate]);

  const getInitials = (name: string) => {
    if (!name) return "??";
    const parts = name.trim().split(" ");
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
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

  if (isLoading || !profile) {
    return (
      <div className="p-8 text-center text-gray-500 animate-pulse">
        Loading profile...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA] dark:bg-[#171717] text-[#171717] dark:text-[#F5F5F5] font-sans p-4 md:p-8">
      <div className="max-w-6xl mx-auto">

        {/* Back Button */}
        <button
          onClick={() => navigate(-1)}
          className="mb-6 w-10 h-10 rounded-xl bg-white dark:bg-[#262626] flex items-center justify-center hover:bg-gray-100 dark:hover:bg-[#1f1f1f] transition-colors shadow-sm border border-gray-100 dark:border-white/5"
        >
          <span className="material-icons-round">arrow_back</span>
        </button>

        <div className="grid lg:grid-cols-3 gap-6 w-full">

          {/* ===== Left Column ===== */}
          <div className="lg:col-span-1 flex flex-col gap-6">

            {/* Card 1: User Info */}
            <div className="bg-white dark:bg-[#1E1E22] rounded-2xl shadow-md p-6 border border-gray-100 dark:border-zinc-800 text-center">

              {/* Avatar Container with relative position */}
              <div className="relative w-32 h-32 mx-auto mb-6 shrink-0">
                <div className="w-full h-full bg-[#7C3AED] rounded-full flex items-center justify-center text-white text-4xl font-black shadow-lg overflow-hidden">
                  {profile.avatar ? (
                    <img src={profile.avatar} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    getInitials(profile.fullName)
                  )}
                </div>
                {profile && isOnline(profile._id) && (
                  <span className="w-4 h-4 bg-green-400 rounded-full absolute bottom-1 right-1 ring-2 ring-white dark:ring-[#1E1E22] animate-pulse"></span>
                )}
              </div>

              {/* Name */}
              <h1 className="text-2xl font-bold mb-1">{profile.fullName}</h1>

              {/* Job Title */}
              <p className="text-[#7C3AED] dark:text-[#8B5CF6] font-medium text-lg mb-2">
                {profile.jobTitle || (profile.role === 'employer' ? 'Employer' : 'Freelancer')}
              </p>

              {/* Location */}
              {profile.location && (
                <div className="flex items-center justify-center gap-1 text-sm opacity-70 mb-3">
                  <span className="material-icons-round text-sm">location_on</span>
                  <span>{profile.location}</span>
                </div>
              )}

              {/* Bio Headline */}
              {profile.bioHeadline && (
                <p className="text-sm opacity-80 mb-4 italic">"{profile.bioHeadline}"</p>
              )}

              {/* Social Links */}
              {profile.links && profile.links.length > 0 && (
                <div className="flex justify-center gap-3 mb-6">
                  {profile.links.map((link: any, index: number) => (
                    <a
                      key={index}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={link.platform}
                      className="w-10 h-10 rounded-full bg-gray-50 dark:bg-[#2A2A2E] flex items-center justify-center text-gray-500 hover:text-[#7C3AED] hover:bg-[#7C3AED]/10 transition-all border border-gray-100 dark:border-zinc-700"
                    >
                      <i className={`${getSocialIcon(link.platform)} text-lg`}></i>
                    </a>
                  ))}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-col gap-3">
                <button className="w-full px-6 py-3 bg-[#7C3AED] hover:bg-[#6D28D9] text-white rounded-xl font-bold transition-all shadow-lg shadow-purple-200 dark:shadow-none flex items-center justify-center gap-2">
                  <span className="material-icons-round text-sm">chat</span>
                  Message
                </button>

                {profile.resume && (
                  <a
                    href={profile.resume}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full px-6 py-3 border-2 border-[#7C3AED] text-[#7C3AED] dark:text-[#8B5CF6] hover:bg-[#7C3AED]/5 rounded-xl font-bold transition-all flex items-center justify-center gap-2"
                  >
                    <span className="material-icons-round text-sm">download</span>
                    Resume
                  </a>
                )}

                {/* Only Employers can save candidates */}
                {user?.role === 'employer' && (
                  <button
                    onClick={handleSaveCandidate}
                    disabled={isSaving}
                    className={`w-full px-6 py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2 disabled:opacity-50 ${
                      isSaved
                        ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
                        : 'bg-gray-100 dark:bg-[#1f1f1f] text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-[#2a2a2a]'
                    }`}
                  >
                    <span className="material-icons-round text-sm">
                      {isSaved ? 'bookmark' : 'bookmark_border'}
                    </span>
                    {isSaved ? 'Saved' : 'Save Candidate'}
                  </button>
                )}
              </div>
            </div>

            {/* Card 2: Technical Skills */}
            <div className="bg-white dark:bg-[#1E1E22] rounded-2xl shadow-md p-6 border border-gray-100 dark:border-zinc-800">
              <h3 className="text-lg font-bold mb-4">Technical Skills</h3>
              <div className="flex flex-wrap gap-2">
                {profile.skills && profile.skills.length > 0 ? (
                  profile.skills.map((skill: string, index: number) => (
                    <span
                      key={index}
                      className="px-3 py-1 bg-[#F3E8FF] dark:bg-[#7C3AED]/20 text-[#7C3AED] dark:text-[#A78BFA] rounded-full text-sm font-bold"
                    >
                      {skill}
                    </span>
                  ))
                ) : (
                  <span className="text-gray-400 text-sm italic">No skills listed</span>
                )}
              </div>
            </div>
          </div>

          {/* ===== Right Column ===== */}
          <div className="lg:col-span-2 flex flex-col gap-6">

            {/* Card 3: About Me */}
            <div className="bg-white dark:bg-[#1E1E22] rounded-2xl shadow-md p-6 border border-gray-100 dark:border-zinc-800">
              <h3 className="text-2xl font-bold mb-3">About Me</h3>
              <div className="w-12 h-1 bg-[#7C3AED] dark:bg-[#8B5CF6] rounded-full mb-6"></div>
              <p className="leading-relaxed whitespace-pre-wrap opacity-80">
                {profile.bio || profile.aboutMe || 'No details provided.'}
              </p>
            </div>

            {/* Card 4: Featured Projects */}
            {profile.projects && profile.projects.length > 0 && (
              <div className="bg-white dark:bg-[#1E1E22] rounded-2xl shadow-md p-6 border border-gray-100 dark:border-zinc-800">
                <h3 className="text-2xl font-bold mb-3">Featured Projects</h3>
                <div className="w-12 h-1 bg-[#7C3AED] dark:bg-[#8B5CF6] rounded-full mb-6"></div>

                <div className="grid grid-cols-1 gap-6">
                  {profile.projects.map((project: any, index: number) => (
                    <article
                      key={index}
                      className="bg-gray-50 dark:bg-[#2A2A2E] rounded-xl shadow-md p-6 border border-gray-200 dark:border-zinc-700"
                    >
                      <h4 className="text-xl font-bold mb-2">{project.title}</h4>
                      <p className="text-sm opacity-80 mb-4 leading-relaxed">
                        {project.description}
                      </p>
                      <div className="flex gap-3 flex-wrap">
                        {project.projectLink && (
                          <a
                            href={project.projectLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 shadow-sm"
                          >
                            Live Demo
                            <span className="material-icons-round text-[16px]">open_in_new</span>
                          </a>
                        )}
                        {project.githubLink && (
                          <a
                            href={project.githubLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="border border-zinc-600 hover:bg-zinc-800 text-[#171717] hover:text-white dark:text-[#F5F5F5] px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                          >
                            <i className="fa-brands fa-github text-[16px]"></i>
                            GitHub Repo
                          </a>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
};

export default FreelancerProfile;