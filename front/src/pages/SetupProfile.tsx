import React, { useState } from 'react';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { updateProfile } from '../store/slices/authSlice';
import { useNavigate } from 'react-router-dom';
import { uploadProfilePicture } from '../api/auth';
import axiosInstance from '../api/axiosInstance';
import toast from 'react-hot-toast';
import { Popup } from '../components/ui/Popup';

const SetupProfile: React.FC = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const user = useAppSelector((state) => state.auth.user);
  const [isAiOpen, setIsAiOpen] = useState(false);
  const [showSuccessPopup] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // Redirect if profile is already complete
  React.useEffect(() => {
    if (user?.jobTitle || user?.bioHeadline) {
      navigate('/chats', { replace: true });
    }
  }, [user, navigate]);

  const [formData, setFormData] = useState({
    fullName: '',
    jobTitle: '',
    location: '',
    bioHeadline: '',
    detailedAbout: '',
    contactEmail: '',
    skills: [] as string[],
    links: [{ id: 1, platform: '', url: '' }],
    projects: [{ id: 2, title: '', description: '', viewLink: '', githubLink: '' }],
    companyName: '',
    industry: ''
  });

  // --- دوال التحكم (Handlers) ---

  const handleInputChange = (field: string, value: string) => {
    setFormData({ ...formData, [field]: value });
  };

  const handleLinkChange = (id: number, field: string, value: string) => {
    setFormData({
      ...formData,
      links: formData.links.map(l => l.id === id ? { ...l, [field]: value } : l)
    });
  };

  const handleProjectChange = (id: number, field: string, value: string) => {
    setFormData({
      ...formData,
      projects: formData.projects.map(p => p.id === id ? { ...p, [field]: value } : p)
    });
  };

  const addLink = () => {
    setFormData({
      ...formData,
      links: [...formData.links, { id: Date.now(), platform: '', url: '' }]
    });
  };

  const removeLink = (id: number) => {
    setFormData({ ...formData, links: formData.links.filter(l => l.id !== id) });
  };

  const addProject = () => {
    setFormData({
      ...formData,
      projects: [...formData.projects, { id: Date.now() + 1, title: '', description: '', viewLink: '', githubLink: '' }]
    });
  };

  const removeProject = (id: number) => {
    setFormData({ ...formData, projects: formData.projects.filter(p => p.id !== id) });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    let loadingToast: string | undefined;
    try {
      setIsUploading(true);
      loadingToast = toast.loading("Uploading image...");
      const response = await uploadProfilePicture(file);

      // تحديث الداتا في الـ Redux والـ localStorage
      dispatch(updateProfile({ avatar: response.avatar }));

      toast.success("Profile photo uploaded!", { id: loadingToast });
    } catch (error) {
      toast.error("Failed to upload image. Please try again.", { id: loadingToast });
      console.error("Upload Error:", error);
    } finally {
      setIsUploading(false);
    }
  };

  const getInitials = (name: string) => {
    if (!name) return "??";
    const parts = name.trim().split(" ");
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return parts[0].slice(0, 2).toUpperCase();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const loadingToast = toast.loading("Saving profile...");
      const response = await axiosInstance.patch('/profile/me', 
        { ...formData, profileCompleted: true }
      );
      dispatch(updateProfile({ ...response.data.data.user, profileCompleted: true }));
      toast.success("Profile setup complete!", { id: loadingToast });
      navigate('/profile');
    } catch (error) {
      console.error(error);
      toast.error("Failed to save profile.");
    }
  };

  return (
    <div className="flex h-screen w-full bg-[#FAFAFA] dark:bg-[#171717] text-[#171717] dark:text-[#F5F5F5] font-sans antialiased overflow-hidden transition-colors duration-300">
      {/* Sidebar */}
      {/* <aside className="w-18 sm:w-20 flex flex-col items-center py-6 bg-white dark:bg-[#1E1E1E] border-r border-[#1F1F1F]/5 dark:border-[#F5F5F5]/5 shrink-0 transition-colors duration-300 z-20 h-full">
        <div className="flex flex-col items-center gap-5 w-full">
          <div className="mb-4">
            <div className="w-12 h-12 bg-[#7C3AED]/10 dark:bg-[#8B5CF6]/20 rounded-2xl flex items-center justify-center text-[#7C3AED] dark:text-[#8B5CF6] shadow-sm">
              <span className="material-icons-round text-2xl">hub</span>
            </div>
          </div>
          <button className="w-12 h-12 flex items-center justify-center text-gray-400 hover:text-[#7C3AED] dark:hover:text-[#8B5CF6] hover:bg-[#7C3AED]/10 dark:hover:bg-[#8B5CF6]/10 rounded-2xl transition-all duration-300" title="Chats">
            <span className="material-icons-round text-2xl">chat_bubble_outline</span>
          </button>
          <button className="w-12 h-12 flex items-center justify-center text-gray-400 hover:text-[#7C3AED] dark:hover:text-[#8B5CF6] hover:bg-[#7C3AED]/10 dark:hover:bg-[#8B5CF6]/10 rounded-2xl transition-all duration-300" title="Community">
            <span className="material-icons-round text-2xl">groups</span>
          </button>
          <button className="w-12 h-12 flex items-center justify-center text-gray-400 hover:text-[#7C3AED] dark:hover:text-[#8B5CF6] hover:bg-[#7C3AED]/10 dark:hover:bg-[#8B5CF6]/10 rounded-2xl transition-all duration-300" title="Saved">
            <span className="material-icons-round text-2xl">bookmark_border</span>
          </button>
          <button className="w-12 h-12 flex items-center justify-center text-gray-400 hover:text-[#7C3AED] dark:hover:text-[#8B5CF6] hover:bg-[#7C3AED]/10 dark:hover:bg-[#8B5CF6]/10 rounded-2xl transition-all duration-300" title="Jobs">
            <span className="material-icons-round text-2xl">work_outline</span>
          </button>
          <button className="w-10 h-10 flex items-center justify-center text-gray-400 hover:text-[#7C3AED] dark:hover:text-[#8B5CF6] hover:bg-[#7C3AED]/10 dark:hover:bg-[#8B5CF6]/10 rounded-2xl transition-all duration-300" title="Calls">
            <span className="material-icons-round">call</span>
          </button>
        </div>

        <div className="mt-auto flex flex-col items-center gap-5 w-full">
          <button className="w-12 h-12 flex items-center justify-center text-gray-400 hover:text-[#7C3AED] dark:hover:text-[#8B5CF6] hover:bg-[#7C3AED]/10 dark:hover:bg-[#8B5CF6]/10 rounded-2xl transition-all duration-300" title="Settings">
            <span className="material-icons-round text-2xl">settings</span>
          </button>
          <button className="w-11 h-11 flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded-full border-2 border-white dark:border-[#1E1E1E] transition-transform hover:scale-105" title="My Profile">
            <span className="material-icons-round text-2xl text-gray-400">person_outline</span>
          </button>
        </div>
      </aside> */}

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto relative">
        <div className="max-w-4xl mx-auto px-4 py-12">
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-bold mb-2">Setup Your Profile</h1>
            <p className="opacity-80">Welcome to Rabta! Let's get your profile set up so clients can find you.</p>
          </div>

          <div className="bg-[#FFFFFF] dark:bg-[#262626] rounded-xl shadow-lg p-8 transition-colors duration-300">
            <form onSubmit={handleSubmit} className="flex flex-col gap-10">

              {/* 1. Basic Information */}
              <div>
                <h3 className="text-xl font-bold mb-4 border-b border-[#171717]/10 dark:border-[#F5F5F5]/10 pb-2">1. Basic Information</h3>

                <div className="flex flex-col sm:flex-row items-center gap-6 mb-6">
                  <div className="w-32 h-32 rounded-full bg-[#FAFAFA] dark:bg-[#171717] border-2 border-dashed border-[#7C3AED] dark:border-[#8B5CF6] flex items-center justify-center text-[#7C3AED] dark:text-[#8B5CF6] transition-colors hover:bg-[#7C3AED]/5 cursor-pointer overflow-hidden relative group">
                    {user?.avatar ? (
                      <img src={user.avatar} className="w-full h-full object-cover" alt="avatar" />
                    ) : (
                      <span className="text-4xl font-bold uppercase">
                        {formData.fullName ? getInitials(formData.fullName) : (
                          <span className="material-icons-round text-4xl">upload</span>
                        )}
                      </span>
                    )}
                  </div>
                  <div>
                    <h4 className="font-bold mb-1">Profile Photo</h4>
                    <p className="text-sm opacity-70 mb-3">Square image recommended. Max 2MB.</p>
                    <input
                      type="file"
                      id="avatar-setup-upload"
                      className="hidden"
                      accept="image/*"
                      onChange={handleImageUpload}
                    />
                    <button
                      type="button"
                      disabled={isUploading}
                      className="bg-[#7C3AED]/10 text-[#7C3AED] hover:bg-[#7C3AED]/20 dark:bg-[#8B5CF6]/20 dark:text-[#8B5CF6] dark:hover:bg-[#8B5CF6]/30 px-6 py-2.5 rounded-xl text-sm font-bold transition-all cursor-pointer inline-block disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <label
                        htmlFor="avatar-setup-upload"
                        className={isUploading ? "cursor-not-allowed" : "cursor-pointer"}
                      >
                        {isUploading ? "Uploading..." : (user?.avatar ? "Change Photo" : "Upload Image")}
                      </label>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  <div>
                    <label className="block text-sm font-bold mb-2">Full Name</label>
                    <input type="text" placeholder="e.g. John Doe" value={formData.fullName} onChange={(e) => handleInputChange('fullName', e.target.value)} className="w-full bg-[#FAFAFA] dark:bg-[#171717] border border-[#171717]/10 dark:border-[#F5F5F5]/10 rounded-lg px-4 py-3 focus:outline-none focus:border-[#7C3AED] dark:focus:border-[#8B5CF6] transition-all duration-300 placeholder-[#171717]/40 dark:placeholder-[#F5F5F5]/40" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold mb-2">Job Title</label>
                    <input type="text" placeholder="e.g. Senior Front-End Developer" value={formData.jobTitle} onChange={(e) => handleInputChange('jobTitle', e.target.value)} className="w-full bg-[#FAFAFA] dark:bg-[#171717] border border-[#171717]/10 dark:border-[#F5F5F5]/10 rounded-lg px-4 py-3 focus:outline-none focus:border-[#7C3AED] dark:focus:border-[#8B5CF6] transition-all duration-300 placeholder-[#171717]/40 dark:placeholder-[#F5F5F5]/40" />
                  </div>
                </div>

                <div className="mb-6">
                  <label className="block text-sm font-bold mb-2">Location</label>
                  <input type="text" placeholder="e.g. Cairo, Egypt" value={formData.location} onChange={(e) => handleInputChange('location', e.target.value)} className="w-full bg-[#FAFAFA] dark:bg-[#171717] border border-[#171717]/10 dark:border-[#F5F5F5]/10 rounded-lg px-4 py-3 focus:outline-none focus:border-[#7C3AED] dark:focus:border-[#8B5CF6] transition-all duration-300 placeholder-[#171717]/40 dark:placeholder-[#F5F5F5]/40" />
                </div>

                <div>
                  <label className="block text-sm font-bold mb-2">Short Bio (Headline)</label>
                  <textarea rows={2} placeholder="Write a short catchphrase that appears under your name..." value={formData.bioHeadline} onChange={(e) => handleInputChange('bioHeadline', e.target.value)} className="w-full bg-[#FAFAFA] dark:bg-[#171717] border border-[#171717]/10 dark:border-[#F5F5F5]/10 rounded-lg px-4 py-3 focus:outline-none focus:border-[#7C3AED] dark:focus:border-[#8B5CF6] transition-all duration-300 placeholder-[#171717]/40 dark:placeholder-[#F5F5F5]/40 resize-none" />
                </div>
              </div>

              {/* 2. Social Links & Contact */}
              <div>
                <div className="flex justify-between items-center mb-4 border-b border-[#171717]/10 dark:border-[#F5F5F5]/10 pb-2">
                  <h3 className="text-xl font-bold">2. Social Links & Contact</h3>
                  <button type="button" onClick={addLink} className="text-sm font-bold text-[#7C3AED] dark:text-[#8B5CF6] hover:underline">
                    + Add Link
                  </button>
                </div>

                <div className="mb-6">
                  <label className="block text-sm font-bold mb-2">Contact Email</label>
                  <input type="email" placeholder="your.email@example.com" value={formData.contactEmail} onChange={(e) => handleInputChange('contactEmail', e.target.value)} className="w-full bg-[#FAFAFA] dark:bg-[#171717] border border-[#171717]/10 dark:border-[#F5F5F5]/10 rounded-lg px-4 py-3 focus:outline-none focus:border-[#7C3AED] dark:focus:border-[#8B5CF6] transition-all duration-300 placeholder-[#171717]/40 dark:placeholder-[#F5F5F5]/40" />
                </div>

                <div className="flex flex-col gap-4">
                  {formData.links.map(link => (
                    <div key={link.id} className="flex flex-col sm:flex-row items-end gap-4">
                      <div className="w-full sm:w-1/3">
                        <label className="block text-sm font-bold mb-2">Platform</label>
                        <select value={link.platform} onChange={(e) => handleLinkChange(link.id, 'platform', e.target.value)} className="w-full bg-[#FAFAFA] dark:bg-[#171717] border border-[#171717]/10 dark:border-[#F5F5F5]/10 rounded-lg px-4 py-3 focus:outline-none focus:border-[#7C3AED] dark:focus:border-[#8B5CF6] transition-all duration-300 cursor-pointer appearance-none">
                          <option value="">Select Platform</option>
                          <option value="GitHub">GitHub</option>
                          <option value="LinkedIn">LinkedIn</option>
                          <option value="Portfolio">Portfolio / Website</option>
                          <option value="Twitter">Twitter / X</option>
                          <option value="Behance">Behance</option>
                        </select>
                      </div>
                      <div className="grow w-full">
                        <label className="block text-sm font-bold mb-2">URL</label>
                        <input type="url" placeholder="https://..." value={link.url} onChange={(e) => handleLinkChange(link.id, 'url', e.target.value)} className="w-full bg-[#FAFAFA] dark:bg-[#171717] border border-[#171717]/10 dark:border-[#F5F5F5]/10 rounded-lg px-4 py-3 focus:outline-none focus:border-[#7C3AED] dark:focus:border-[#8B5CF6] transition-all duration-300 placeholder-[#171717]/40 dark:placeholder-[#F5F5F5]/40" />
                      </div>
                      <button type="button" onClick={() => removeLink(link.id)} className="p-3 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors">
                        <span className="material-icons-round">delete_outline</span>
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* 3. Professional Details & Conditional Sections */}
              <div>
                <h3 className="text-xl font-bold mb-4 border-b border-[#171717]/10 dark:border-[#F5F5F5]/10 pb-2">3. Professional Details</h3>

                <div className="mb-6">
                  <label className="block text-sm font-bold mb-2">About Me (Detailed)</label>
                  <textarea rows={5} placeholder="Tell potential clients about your background, experience, and what you excel at..." value={formData.detailedAbout} onChange={(e) => handleInputChange('detailedAbout', e.target.value)} className="w-full bg-[#FAFAFA] dark:bg-[#171717] border border-[#171717]/10 dark:border-[#F5F5F5]/10 rounded-lg px-4 py-3 focus:outline-none focus:border-[#7C3AED] dark:focus:border-[#8B5CF6] transition-all duration-300 placeholder-[#171717]/40 dark:placeholder-[#F5F5F5]/40 resize-none" />
                </div>

                {user?.role === 'employer' ? (
                  <>
                    <div className="mb-6">
                      <label className="block text-sm font-bold mb-2">Company Name</label>
                      <input type="text" placeholder="e.g. Acme Corp" value={formData.companyName} onChange={(e) => handleInputChange('companyName', e.target.value)} className="w-full bg-[#FAFAFA] dark:bg-[#171717] border border-[#171717]/10 dark:border-[#F5F5F5]/10 rounded-lg px-4 py-3 focus:outline-none focus:border-[#7C3AED] dark:focus:border-[#8B5CF6] transition-all duration-300 placeholder-[#171717]/40 dark:placeholder-[#F5F5F5]/40" />
                    </div>
                    <div className="mb-6">
                      <label className="block text-sm font-bold mb-2">Industry</label>
                      <input type="text" placeholder="e.g. Technology, Healthcare, Finance" value={formData.industry} onChange={(e) => handleInputChange('industry', e.target.value)} className="w-full bg-[#FAFAFA] dark:bg-[#171717] border border-[#171717]/10 dark:border-[#F5F5F5]/10 rounded-lg px-4 py-3 focus:outline-none focus:border-[#7C3AED] dark:focus:border-[#8B5CF6] transition-all duration-300 placeholder-[#171717]/40 dark:placeholder-[#F5F5F5]/40" />
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <label className="block text-sm font-bold mb-2">Technical Skills</label>
                      <div className="w-full bg-[#FAFAFA] dark:bg-[#171717] border border-[#171717]/10 dark:border-[#F5F5F5]/10 rounded-lg p-2 flex flex-wrap gap-2 focus-within:border-[#7C3AED] dark:focus-within:border-[#8B5CF6] transition-all duration-300">
                        <input type="text" placeholder="Type a skill and press Enter..." className="bg-transparent border-none focus:outline-none grow min-w-50 px-2 py-1 text-[#171717] dark:text-[#F5F5F5] placeholder-[#171717]/40 dark:placeholder-[#F5F5F5]/40" />
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* 4. Featured Projects (Only for Freelancers) */}
              {user?.role !== 'employer' && (
                <div>
                  <div className="flex justify-between items-center mb-4 border-b border-[#171717]/10 dark:border-[#F5F5F5]/10 pb-2">
                    <h3 className="text-xl font-bold">4. Featured Projects</h3>
                    <button type="button" onClick={addProject} className="text-sm font-bold text-[#7C3AED] dark:text-[#8B5CF6] hover:underline">
                      + Add Project
                    </button>
                  </div>

                  {formData.projects.map(project => (
                    <div key={project.id} className="bg-[#FAFAFA] dark:bg-[#171717] border border-[#171717]/10 dark:border-[#F5F5F5]/10 rounded-xl p-6 relative group mb-6">
                      <button type="button" onClick={() => removeProject(project.id)} className="absolute top-4 right-4 text-red-500 hover:text-red-700 transition-colors">
                        <span className="material-icons-round">delete_outline</span>
                      </button>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4 mt-2">
                        <div className="md:col-span-2">
                          <label className="block text-sm font-bold mb-2">Project Title</label>
                          <input type="text" placeholder="e.g. My Awesome App" value={project.title} onChange={(e) => handleProjectChange(project.id, 'title', e.target.value)} className="w-full bg-[#FFFFFF] dark:bg-[#262626] border border-[#171717]/10 dark:border-[#F5F5F5]/10 rounded-lg px-4 py-3 focus:outline-none focus:border-[#7C3AED] dark:focus:border-[#8B5CF6] transition-all duration-300 placeholder-[#171717]/40 dark:placeholder-[#F5F5F5]/40" />
                        </div>
                        <div className="md:col-span-2">
                          <label className="block text-sm font-bold mb-2">Project Description</label>
                          <textarea rows={3} placeholder="Briefly describe what this project is and what technologies you used..." value={project.description} onChange={(e) => handleProjectChange(project.id, 'description', e.target.value)} className="w-full bg-[#FFFFFF] dark:bg-[#262626] border border-[#171717]/10 dark:border-[#F5F5F5]/10 rounded-lg px-4 py-3 focus:outline-none focus:border-[#7C3AED] dark:focus:border-[#8B5CF6] transition-all duration-300 placeholder-[#171717]/40 dark:placeholder-[#F5F5F5]/40 resize-none" />
                        </div>
                        <div>
                          <label className="block text-sm font-bold mb-2">View Project Link (Optional)</label>
                          <input type="url" placeholder="https://..." value={project.viewLink} onChange={(e) => handleProjectChange(project.id, 'viewLink', e.target.value)} className="w-full bg-[#FFFFFF] dark:bg-[#262626] border border-[#171717]/10 dark:border-[#F5F5F5]/10 rounded-lg px-4 py-3 focus:outline-none focus:border-[#7C3AED] dark:focus:border-[#8B5CF6] transition-all duration-300 placeholder-[#171717]/40 dark:placeholder-[#F5F5F5]/40" />
                        </div>
                        <div>
                          <label className="block text-sm font-bold mb-2">GitHub Repo Link (Optional)</label>
                          <input type="url" placeholder="https://github.com/..." value={project.githubLink} onChange={(e) => handleProjectChange(project.id, 'githubLink', e.target.value)} className="w-full bg-[#FFFFFF] dark:bg-[#262626] border border-[#171717]/10 dark:border-[#F5F5F5]/10 rounded-lg px-4 py-3 focus:outline-none focus:border-[#7C3AED] dark:focus:border-[#8B5CF6] transition-all duration-300 placeholder-[#171717]/40 dark:placeholder-[#F5F5F5]/40" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Action Buttons */}
              <div className="mt-4 flex justify-end gap-4 border-t border-[#171717]/10 dark:border-[#F5F5F5]/10 pt-6">
                <button type="button" onClick={() => navigate('/profile')} className="px-8 py-3 rounded-lg font-bold border border-[#171717]/20 dark:border-[#F5F5F5]/20 hover:bg-[#171717]/5 dark:hover:bg-[#F5F5F5]/5 transition-all duration-300">
                  Cancel
                </button>
                <button type="submit" className="bg-[#7C3AED] hover:bg-opacity-90 dark:bg-[#8B5CF6] text-white px-8 py-3 rounded-lg font-bold transition-all duration-300 shadow-md">
                  Create Profile
                </button>
              </div>
            </form>
          </div>
        </div>
      </main>

      {/* AI Popup */}
      <div className="fixed bottom-6 right-6 flex flex-col items-end gap-4 z-50">
        {isAiOpen && (
          <div className="w-80 bg-white dark:bg-[#262626] rounded-2xl shadow-2xl border border-gray-100 dark:border-white/5 overflow-hidden flex flex-col transition-all duration-300 animate-in slide-in-from-bottom-5">
            <div className="bg-[#7C3AED] dark:bg-[#8B5CF6] p-4 text-white flex justify-between items-center transition-colors">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                <span className="font-bold text-sm">Rabta AI</span>
              </div>
              <button onClick={() => setIsAiOpen(false)} className="hover:bg-white/20 p-1 rounded-lg transition-colors">
                <span className="material-icons-round">close</span>
              </button>
            </div>

            <div className="h-48 bg-[#FAFAFA] dark:bg-[#171717] p-4 text-sm text-gray-500 dark:text-[#F5F5F5]/50 italic overflow-y-auto">
              Welcome! I can help you write a professional bio or list your skills effectively.
            </div>

            <div className="p-4 bg-white dark:bg-[#262626] border-t border-gray-100 dark:border-white/10">
              <input type="text" placeholder="Ask AI for help..."
                className="w-full text-sm p-2.5 rounded-xl bg-gray-50 dark:bg-[#171717] text-[#171717] dark:text-[#F5F5F5] border border-gray-200 dark:border-white/10 outline-none focus:border-[#7C3AED] dark:focus:border-[#8B5CF6] transition-all" />
            </div>
          </div>
        )}
        <button onClick={() => setIsAiOpen(!isAiOpen)} className="w-12 h-12 bg-[#7C3AED] dark:bg-[#8B5CF6] rounded-full flex items-center justify-center text-white shadow-xl hover:scale-110 transition-transform">
          <span className="material-icons-round text-2xl">bolt</span>
        </button>
      </div>

      <style>{`
        .nav-icon-btn { @apply w-12 h-12 flex items-center justify-center text-gray-400 hover:text-[#7C3AED] dark:hover:text-[#8B5CF6] hover:bg-[#7C3AED]/10 dark:hover:bg-[#8B5CF6]/10 rounded-2xl transition-all duration-300; }
        .hide-scrollbar::-webkit-scrollbar { display: none; }
      `}</style>

      {showSuccessPopup && (
        <Popup onClose={() => navigate('/profile')}>
          <div className="text-center p-4">
            <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="material-icons-round text-3xl">check</span>
            </div>
            <h2 className="text-2xl font-black mb-2 text-[#7C3AED]">Profile Created!</h2>
            <p className="opacity-60 mb-6">Welcome to Rabta community. Your professional journey starts here.</p>
            <button
              onClick={() => navigate('/profile')}
              className="w-full bg-[#7C3AED] text-white py-3 rounded-xl font-bold shadow-lg"
            >
              Go to Profile
            </button>
          </div>
        </Popup>
      )}
    </div>
  );
};

export default SetupProfile;