import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import toast from 'react-hot-toast';
import axiosInstance from '../../api/axiosInstance';
import type { RootState } from "../../store/store";
import { updateProfile } from '../../store/slices/authSlice';
import { Input } from '../../components/ui/Input';
import { uploadProfilePicture } from '../../api/auth';

const EmployerSetup: React.FC = () => {
  const { user } = useSelector((state: RootState) => state.auth);
  const navigate = useNavigate();
  const dispatch = useDispatch();
  
  const [loading, setLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [formData, setFormData] = useState({
    companyName: '',
    tagline: '',
    bio: '',
    location: '',
    industry: '',
    website: '',
    linkedin: '',
    hiringRoles: [] as string[]
  });

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    let loadingToast: string | undefined;
    try {
      setIsUploading(true);
      loadingToast = toast.loading("Uploading logo...");
      const response = await uploadProfilePicture(file);
      dispatch(updateProfile({ avatar: response.avatar }));
      toast.success("Logo uploaded!", { id: loadingToast });
    } catch (error) {
      toast.error("Failed to upload logo.", { id: loadingToast });
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      const loadingToast = toast.loading("Saving company profile...");
      
      // Map linkedin to socialLinks.linkedin so the backend saves it correctly
      const payload = {
        ...formData,
        socialLinks: { linkedin: formData.linkedin },
        profileCompleted: true
      };
      
      const response = await axiosInstance.patch('/profile/me', 
        payload,
        {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        }
      );
      
      dispatch(updateProfile({ ...response.data.data.user, profileCompleted: true }));
      toast.success("Company profile ready!", { id: loadingToast });
      navigate('/profile');
    } catch (error) {
      toast.error("Failed to save. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAFAFA] dark:bg-[#171717] py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-black mb-3">Company Setup</h1>
          <p className="text-gray-500 dark:text-gray-400">Complete your company profile to start hiring</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white dark:bg-[#262626] p-10 rounded-3xl shadow-xl border border-gray-100 dark:border-gray-800 space-y-8">
          {/* Logo Upload */}
          <div className="flex flex-col items-center gap-4">
            <div className="relative group">
              <div className="w-32 h-32 rounded-3xl bg-gray-100 dark:bg-[#1f1f1f] flex items-center justify-center overflow-hidden border-2 border-dashed border-[#7C3AED]/30 group-hover:border-[#7C3AED] transition-all">
                {user?.avatar ? (
                  <img src={user.avatar} alt="Logo" className="w-full h-full object-cover" />
                ) : (
                  <span className="material-icons-round text-4xl text-gray-400 group-hover:text-[#7C3AED] transition-all">business</span>
                )}
                {isUploading && (
                  <div className="absolute inset-0 bg-white/80 dark:bg-black/80 flex items-center justify-center">
                    <div className="w-6 h-6 border-2 border-[#7C3AED] border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
              </div>
              <input type="file" id="logo" className="hidden" onChange={handleImageUpload} accept="image/*" />
              <label htmlFor="logo" className="absolute -bottom-2 -right-2 w-10 h-10 bg-[#7C3AED] text-white rounded-xl flex items-center justify-center shadow-lg cursor-pointer hover:scale-110 transition-all">
                <span className="material-icons-round text-xl">add_a_photo</span>
              </label>
            </div>
            <p className="text-sm font-bold opacity-60">Company Logo</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Input label="Company Name" id="companyName" value={formData.companyName} onChange={(e) => setFormData({...formData, companyName: e.target.value})} />
            <Input label="Tagline" id="tagline" value={formData.tagline} onChange={(e) => setFormData({...formData, tagline: e.target.value})} placeholder="e.g. Building the future of AI" />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-bold opacity-80 ml-1">Company Description</label>
            <textarea 
              value={formData.bio}
              onChange={(e) => setFormData({...formData, bio: e.target.value})}
              className="w-full bg-[#FAFAFA] dark:bg-[#1f1f1f] border border-gray-100 dark:border-gray-800 rounded-xl px-4 py-3.5 h-32 focus:ring-2 focus:ring-[#7C3AED]/20 focus:border-[#7C3AED] outline-none transition-all resize-none"
              placeholder="Tell talent about your company mission and culture..."
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Input label="Location" id="location" value={formData.location} onChange={(e) => setFormData({...formData, location: e.target.value})} placeholder="City, Country" />
            <Input label="Website" id="website" value={formData.website} onChange={(e) => setFormData({...formData, website: e.target.value})} placeholder="https://..." />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-[#7C3AED] hover:bg-[#6D28D9] text-white font-bold rounded-2xl transition-all shadow-lg shadow-[#7C3AED]/25 disabled:opacity-70 flex items-center justify-center gap-2"
          >
            {loading ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : "Complete Company Setup"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default EmployerSetup;
