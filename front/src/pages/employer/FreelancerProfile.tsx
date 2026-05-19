import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axiosInstance from '../../api/axiosInstance';
import toast from 'react-hot-toast';
import { useAppSelector, useAppDispatch } from '../../store/hooks';
import { updateProfile } from '../../store/slices/authSlice';

const FreelancerProfile: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { user } = useAppSelector(state => state.auth);
  const [profile, setProfile] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Check if current profile is already saved by this employer
  const isSaved = user?.savedFreelancers?.includes(id);

  const handleSaveCandidate = async () => {
    try {
      setIsSaving(true);
      const res = await axiosInstance.post(`/users/toggle-save-freelancer/${id}`);
      // Update local user state in Redux
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

  if (isLoading || !profile) {
    return <div className="p-8 text-center text-gray-500 animate-pulse">Loading profile...</div>;
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA] dark:bg-[#171717] text-[#171717] dark:text-[#F5F5F5] font-sans p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <button 
          onClick={() => navigate(-1)}
          className="mb-6 w-10 h-10 rounded-xl bg-white dark:bg-[#262626] flex items-center justify-center hover:bg-gray-100 dark:hover:bg-[#1f1f1f] transition-colors shadow-sm border border-gray-100 dark:border-white/5"
        >
          <span className="material-icons-round">arrow_back</span>
        </button>

        <div className="bg-white dark:bg-[#262626] rounded-2xl shadow-md p-8 border border-gray-100 dark:border-white/5 flex flex-col md:flex-row gap-8 items-start">
          <div className="w-32 h-32 bg-[#7C3AED] rounded-full flex shrink-0 items-center justify-center text-white text-4xl font-black shadow-lg overflow-hidden">
            {profile.avatar ? (
              <img src={profile.avatar} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              getInitials(profile.fullName)
            )}
          </div>
          <div className="flex-1">
            <h1 className="text-3xl font-bold mb-1">{profile.fullName}</h1>
            <p className="text-[#7C3AED] dark:text-[#8B5CF6] font-medium text-lg mb-4">{profile.jobTitle || (profile.role === 'employer' ? 'Employer' : 'Freelancer')}</p>
            <p className="text-gray-600 dark:text-gray-400 leading-relaxed mb-6">
              {profile.bio || "No bio provided."}
            </p>
            
            <h3 className="font-bold text-lg mb-3">Skills</h3>
            <div className="flex flex-wrap gap-2 mb-6">
              {profile.skills && profile.skills.length > 0 ? (
                profile.skills.map((skill: string, index: number) => (
                  <span key={index} className="px-3 py-1 bg-[#F3E8FF] dark:bg-[#7C3AED]/20 text-[#7C3AED] dark:text-[#A78BFA] rounded-lg text-sm font-bold">
                    {skill}
                  </span>
                ))
              ) : (
                <span className="text-gray-400 text-sm italic">No skills listed</span>
              )}
            </div>

            <div className="flex gap-4">
              <button className="px-6 py-3 bg-[#7C3AED] hover:bg-[#6D28D9] text-white rounded-xl font-bold transition-all shadow-lg shadow-purple-200 dark:shadow-none flex items-center gap-2">
                <span className="material-icons-round text-sm">chat</span>
                Message
              </button>
              {profile.resume && (
                <a href={profile.resume} target="_blank" rel="noopener noreferrer" className="px-6 py-3 border-2 border-[#7C3AED] text-[#7C3AED] dark:text-[#8B5CF6] hover:bg-[#7C3AED]/5 rounded-xl font-bold transition-all flex items-center gap-2">
                  <span className="material-icons-round text-sm">download</span>
                  Resume
                </a>
              )}
              {/* Only Employers can save candidates */}
              {user?.role === 'employer' && (
                <button 
                  onClick={handleSaveCandidate}
                  disabled={isSaving}
                  className={`px-6 py-3 rounded-xl font-bold transition-all flex items-center gap-2 disabled:opacity-50 ${isSaved ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400' : 'bg-gray-100 dark:bg-[#1f1f1f] text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-[#2a2a2a]'}`}
                >
                  <span className="material-icons-round text-sm">{isSaved ? 'bookmark' : 'bookmark_border'}</span>
                  {isSaved ? 'Saved' : 'Save Candidate'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FreelancerProfile;
