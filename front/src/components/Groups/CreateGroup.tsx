import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axiosInstance from '../../api/axiosInstance';
import toast from 'react-hot-toast';

const CreateGroup: React.FC = () => {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // --- الجزء الجديد الخاص بالصور ---
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'cover' | 'avatar') => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (type === 'cover') setCoverPreview(reader.result as string);
        else setAvatarPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };
  // ------------------------------

  // 1. الداتا الأساسية للفورم
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    track: '',
    groupType: 'project',
    privacy: 'public',
  });

  // 2. إدارة المهارات (Skills)
  const [skills, setSkills] = useState<string[]>(['React.js', 'Tailwind CSS']);
  const [skillInput, setSkillInput] = useState('');

  const handleAddSkill = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && skillInput.trim() !== '') {
      e.preventDefault();
      if (!skills.includes(skillInput.trim())) {
        setSkills([...skills, skillInput.trim()]);
      }
      setSkillInput('');
    }
  };

  const handleRemoveSkill = (skillToRemove: string) => {
    setSkills(skills.filter(skill => skill !== skillToRemove));
  };

  // 3. إدارة دعوة الأشخاص (Invite Connections)
  const [searchQuery, setSearchQuery] = useState('');
  const [invitedUsers, setInvitedUsers] = useState<string[]>([]);

  const [connections, setConnections] = useState<any[]>([]);
  const [phoneSearchUser, setPhoneSearchUser] = useState<any | null>(null);
  const [isSearchingPhone, setIsSearchingPhone] = useState(false);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await axiosInstance.get('/users/recent-contacts');
        const raw = response.data.data?.contacts ?? [];
        const usersList = raw.map((u: { _id: string; fullName?: string; jobTitle?: string; role?: string; avatar?: string }) => ({
          id: String(u._id),
          name: u.fullName || 'User',
          role: u.jobTitle || u.role,
          avatar: u.avatar,
          initial: (u.fullName || 'U').charAt(0).toUpperCase(),
          color: 'bg-purple-100 text-purple-600'
        }));
        setConnections(usersList);
      } catch (err) {
        console.error("Failed to load contacts", err);
      }
    };
    fetchUsers();
  }, []);

  useEffect(() => {
    setPhoneSearchUser(null);
    if (formData.privacy !== 'private' || !searchQuery.trim()) return;
    
    // Check if searchQuery contains only digits and has reasonable length for phone number
    const isPhoneNumber = /^[0-9+]+$/.test(searchQuery) && searchQuery.length >= 8;
    if (isPhoneNumber) {
      const searchPhone = async () => {
        setIsSearchingPhone(true);
        try {
          const response = await axiosInstance.get(`/users/find-by-phone?phone=${searchQuery}`);
          if (response.data.data.user) {
            const u = response.data.data.user;
            setPhoneSearchUser({
              id: u._id,
              name: u.fullName,
              role: u.jobTitle || u.role,
              avatar: u.avatar,
              initial: u.fullName ? u.fullName.charAt(0).toUpperCase() : '?',
              color: 'bg-green-100 text-green-600'
            });
          }
        } catch (error) {
          console.error("Phone search failed");
        } finally {
          setIsSearchingPhone(false);
        }
      };
      
      const timer = setTimeout(searchPhone, 500);
      return () => clearTimeout(timer);
    }
  }, [searchQuery, formData.privacy]);

  const filteredConnections = connections.filter(user =>
    (user.name || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const displayList = [...filteredConnections];
  if (phoneSearchUser && !displayList.some(u => u.id === phoneSearchUser.id)) {
    displayList.unshift(phoneSearchUser);
  }

  const handleToggleUser = (userId: string) => {
    setInvitedUsers(prev => 
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      
      const payload = {
        name: formData.name,
        description: formData.description,
        category: formData.track,
        tags: skills,
        isPublic: formData.privacy === 'public',
        invitedUsers: invitedUsers
      };

      const { data } = await axiosInstance.post('/groups', payload);
      const community = data.data?.community;

      toast.success('Group created successfully!');
      navigate('/groups', {
        replace: true,
        state: {
          openGroupId: community?._id,
          newCommunity: community,
        },
      });
    } catch (error: unknown) {
      const axiosError = error as {
        response?: { status?: number; data?: { message?: string } };
      };
      const status = axiosError.response?.status;
      const serverMessage = axiosError.response?.data?.message;

      if (status && status >= 400 && status < 500 && serverMessage) {
        toast.error(serverMessage);
      } else {
        toast.error('Something went wrong! Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full flex-1 overflow-y-auto bg-[#FAFAFA] dark:bg-[#171717] text-[#171717] dark:text-[#F5F5F5] transition-colors duration-300 min-h-screen pb-10 font-sans">
      
      {/* Header */}
      <header className="bg-white dark:bg-[#262626] border-b border-gray-200 dark:border-white/10 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 h-16 flex items-center gap-4">
          <button 
            onClick={() => navigate(-1)}
            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-white/5 transition-colors flex items-center justify-center"
          >
            <span className="material-icons-round">arrow_back</span>
          </button>
          <h1 className="text-xl font-bold">Create New Group</h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-3xl mx-auto px-4 mt-8">
        <div className="bg-white dark:bg-[#262626] rounded-2xl shadow-sm border border-gray-200 dark:border-white/10 overflow-hidden">
          
          {/* Cover & Avatar (تم تعديل هذا الجزء فقط للصور) */}
          <div className="relative h-40 bg-gray-200 dark:bg-white/5 flex items-center justify-center group cursor-pointer transition-colors hover:bg-gray-300 dark:hover:bg-white/10">
            
            <input type="file" id="coverInput" accept="image/*" className="hidden" onChange={(e) => handleFileChange(e, 'cover')} />
            
            {coverPreview ? (
              <img src={coverPreview} alt="Cover" className="w-full h-full object-cover" />
            ) : (
              <label htmlFor="coverInput" className="flex flex-col items-center text-gray-500 dark:text-gray-400 cursor-pointer">
                <span className="material-icons-round text-3xl mb-1">add_a_photo</span>
                <span className="text-sm font-semibold">Add Cover Photo</span>
              </label>
            )}

            <div className="absolute -bottom-10 left-6 w-24 h-24 rounded-full bg-white dark:bg-[#262626] border-4 border-white dark:border-[#262626] flex items-center justify-center shadow-md overflow-hidden group/avatar hover:opacity-90 transition-opacity">
              <input type="file" id="avatarInput" accept="image/*" className="hidden" onChange={(e) => handleFileChange(e, 'avatar')} />
              
              {avatarPreview ? (
                <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <label htmlFor="avatarInput" className="w-full h-full bg-gray-100 dark:bg-[#1f1f1f] flex items-center justify-center text-gray-400 cursor-pointer">
                  <span className="material-icons-round text-2xl">camera_alt</span>
                </label>
              )}
            </div>
          </div>

          {/* Form - باقي الـ UI زي ما هو بالظبط */}
          <form className="p-6 pt-14 space-y-6" onSubmit={handleSubmit}>
            
            {/* Group Name */}
            <div>
              <div className="flex justify-between items-end mb-2">
                <label className="block text-sm font-semibold">Group Name <span className="text-red-500">*</span></label>
                <span className="text-xs text-gray-400">{formData.name.length} / 50</span>
              </div>
              <input 
                type="text" 
                maxLength={50} 
                required
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                placeholder="e.g., Front-End React 2026" 
                className="w-full bg-[#FAFAFA] dark:bg-[#1f1f1f] border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-[#7C3AED] dark:focus:border-[#8B5CF6] transition-colors"
              />
            </div>

            {/* Description */}
            <div>
              <div className="flex justify-between items-end mb-2">
                <label className="block text-sm font-semibold">Description</label>
                <span className="text-xs text-gray-400">{formData.description.length} / 200</span>
              </div>
              <textarea 
                rows={3} 
                maxLength={200} 
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                placeholder="Write a description explaining the goals of the group..." 
                className="w-full bg-[#FAFAFA] dark:bg-[#1f1f1f] border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-[#7C3AED] dark:focus:border-[#8B5CF6] transition-colors resize-none"
              ></textarea>
            </div>

            {/* Technical Specialization */}
            <div>
              <label className="block text-sm font-semibold mb-2">Technical Specialization <span className="text-red-500">*</span></label>
              <div className="relative">
                <select 
                  required
                  value={formData.track}
                  onChange={(e) => setFormData({...formData, track: e.target.value})}
                  className="w-full bg-[#FAFAFA] dark:bg-[#1f1f1f] border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 appearance-none focus:outline-none focus:border-[#7C3AED] dark:focus:border-[#8B5CF6] transition-colors cursor-pointer"
                >
                  <option value="" disabled>Select specialization...</option>
                  <option value="programming">Programming</option>
                  <option value="uiux">UI/UX Design</option>
                  <option value="data">Data Science</option>
                  <option value="cyber">Cyber Security</option>
                  <option value="cloud">Cloud Computing</option>
                </select>
                <span className="material-icons-round absolute right-4 top-3.5 text-gray-400 pointer-events-none">expand_more</span>
              </div>
            </div>

            {/* Keywords & Skills */}
            <div>
              <label className="block text-sm font-semibold mb-2">Keywords & Skills</label>
              <div className="w-full bg-[#FAFAFA] dark:bg-[#1f1f1f] border border-gray-200 dark:border-white/10 rounded-xl p-2 flex flex-wrap gap-2 focus-within:border-[#7C3AED] dark:focus-within:border-[#8B5CF6] transition-colors">
                {skills.map((skill, index) => (
                  <span key={index} className="flex items-center gap-1 bg-[#7C3AED]/10 text-[#7C3AED] dark:bg-[#8B5CF6]/20 dark:text-[#8B5CF6] px-3 py-1.5 rounded-lg text-sm font-bold">
                    {skill}
                    <button type="button" onClick={() => handleRemoveSkill(skill)} className="hover:text-red-500 flex items-center ml-1">
                      <span className="material-icons-round text-[16px]">close</span>
                    </button>
                  </span>
                ))}
                <input 
                  type="text" 
                  value={skillInput}
                  onChange={(e) => setSkillInput(e.target.value)}
                  onKeyDown={handleAddSkill}
                  placeholder="Type a skill and press Enter..." 
                  className="flex-1 bg-transparent min-w-50 px-2 py-1.5 focus:outline-none text-sm dark:text-white"
                />
              </div>
            </div>

            {/* Discussion Type & Privacy */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold mb-3">Discussion Type</label>
                <div className="space-y-3 bg-[#FAFAFA] dark:bg-[#1f1f1f] p-4 rounded-xl border border-gray-100 dark:border-white/5">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input 
                      type="radio" 
                      name="group_type" 
                      value="project"
                      checked={formData.groupType === 'project'}
                      onChange={(e) => setFormData({...formData, groupType: e.target.value})}
                      className="w-4 h-4 text-[#7C3AED] focus:ring-[#7C3AED]"
                    />
                    <span className="text-sm font-medium">Project-based</span>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input 
                      type="radio" 
                      name="group_type" 
                      value="learning"
                      checked={formData.groupType === 'learning'}
                      onChange={(e) => setFormData({...formData, groupType: e.target.value})}
                      className="w-4 h-4 text-[#7C3AED] focus:ring-[#7C3AED]"
                    />
                    <span className="text-sm font-medium">Learning-based</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-3">Privacy</label>
                <div className="space-y-3 bg-[#FAFAFA] dark:bg-[#1f1f1f] p-4 rounded-xl border border-gray-100 dark:border-white/5">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input 
                      type="radio" 
                      name="privacy" 
                      value="public"
                      checked={formData.privacy === 'public'}
                      onChange={(e) => setFormData({...formData, privacy: e.target.value})}
                      className="w-4 h-4 mt-0.5 text-[#7C3AED] focus:ring-[#7C3AED]"
                    />
                    <div>
                      <span className="text-sm font-medium block">Public</span>
                      <span className="text-xs text-gray-500">Anyone on the platform can join</span>
                    </div>
                  </label>
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input 
                      type="radio" 
                      name="privacy" 
                      value="private"
                      checked={formData.privacy === 'private'}
                      onChange={(e) => setFormData({...formData, privacy: e.target.value})}
                      className="w-4 h-4 mt-0.5 text-[#7C3AED] focus:ring-[#7C3AED]"
                    />
                    <div>
                      <span className="text-sm font-medium block">Private</span>
                      <span className="text-xs text-gray-500">Requires approval to join</span>
                    </div>
                  </label>
                </div>
              </div>
            </div>

            {/* Quick Invite Connections */}
            <div>
              <label className="block text-sm font-semibold mb-2">Quick Invite Connections (Optional)</label>
              <div className="border border-gray-200 dark:border-white/10 rounded-xl overflow-hidden">
                <div className="bg-[#FAFAFA] dark:bg-[#1f1f1f] p-3 border-b border-gray-200 dark:border-white/10 flex items-center gap-2">
                  <span className="material-icons-round text-gray-400">search</span>
                  <input 
                    type="text" 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search connections to invite..." 
                    className="w-full bg-transparent focus:outline-none text-sm dark:text-white"
                  />
                </div>
                <div className="max-h-40 overflow-y-auto p-2 space-y-1">
                  {isSearchingPhone && (
                    <div className="text-center text-xs text-gray-500 py-2">Searching by phone...</div>
                  )}
                  {displayList.length === 0 && !isSearchingPhone && (
                    <div className="text-center text-sm text-gray-500 py-4 font-medium">No available connections to invite.</div>
                  )}
                  {displayList.map(user => (
                    <label key={user.id} className="flex items-center justify-between p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg cursor-pointer transition-colors">
                      <div className="flex items-center gap-3">
                        {user.avatar ? (
                          <img src={user.avatar} alt={user.name} className="w-8 h-8 rounded-full object-cover" />
                        ) : (
                          <div className={`w-8 h-8 rounded-full ${user.color} flex items-center justify-center font-bold text-sm`}>{user.initial}</div>
                        )}
                        <div>
                          <p className="text-sm font-semibold">{user.name}</p>
                          <p className="text-xs text-gray-500">{user.role}</p>
                        </div>
                      </div>
                      <input 
                        type="checkbox" 
                        checked={invitedUsers.includes(user.id)}
                        onChange={() => handleToggleUser(user.id)}
                        className="w-4 h-4 text-[#7C3AED] rounded border-gray-300"
                      />
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <hr className="border-gray-200 dark:border-white/10 my-6" />

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-4">
              <button 
                type="button" 
                disabled={isSubmitting}
                onClick={() => navigate(-1)}
                className="px-6 py-2.5 rounded-xl text-sm font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
              >
                Cancel
              </button>
              <button 
                type="submit" 
                disabled={isSubmitting}
                className="px-8 py-2.5 rounded-xl text-sm font-bold text-white bg-[#7C3AED] hover:bg-[#6D28D9] transition-all shadow-lg shadow-purple-200 dark:shadow-none active:scale-95 disabled:opacity-50"
              >
                {isSubmitting ? 'Creating...' : 'Create Group'}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
};

export default CreateGroup;
