import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axiosInstance from '../../api/axiosInstance';
import toast from 'react-hot-toast';

const ManageProject: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [project, setProject] = useState<any>(null);
  const [applicants, setApplicants] = useState<any[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const fetchProjectDetails = async () => {
      try {
        setIsLoading(true);
        const [jobRes, applicantsRes] = await Promise.all([
          axiosInstance.get(`/jobs/${id}`),
          axiosInstance.get(`/jobs/${id}/applicants`)
        ]);
        
        setProject(jobRes.data.data.job);
        setApplicants(applicantsRes.data.data.applicants || []);
      } catch (error) {
        console.error("Failed to fetch project details", error);
        toast.error("Failed to load project");
      } finally {
        setIsLoading(false);
      }
    };
    if (id) fetchProjectDetails();
  }, [id]);

  const handleDelete = async () => {
    if (!window.confirm("Are you sure you want to delete this project? This action cannot be undone.")) return;
    
    try {
      setIsDeleting(true);
      await axiosInstance.delete(`/jobs/${id}`);
      toast.success("Project deleted successfully");
      navigate('/employer-dashboard');
    } catch (error) {
      console.error("Failed to delete project", error);
      toast.error("Failed to delete project");
      setIsDeleting(false);
    }
  };

  const handleEdit = () => {
    navigate(`/edit-project/${id}`);
  };

  if (isLoading || !project) {
    return <div className="p-8 text-center text-gray-500 animate-pulse">Loading project details...</div>;
  }

  return (
    <div className="p-8 max-w-7xl mx-auto text-[#171717] dark:text-[#F5F5F5] font-sans transition-colors duration-300">
      
      {/* Header & Breadcrumb */}
      <div className="flex items-center gap-4 mb-8">
        <button 
          onClick={() => navigate('/employer-dashboard')}
          className="w-10 h-10 rounded-xl bg-white dark:bg-[#262626] flex items-center justify-center hover:bg-gray-100 dark:hover:bg-[#1f1f1f] transition-colors shadow-sm border border-gray-100 dark:border-white/5"
        >
          <span className="material-icons-round">arrow_back</span>
        </button>
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-black tracking-tight">{project.title}</h1>
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
              {project.status}
            </span>
          </div>
          <p className="text-gray-500 dark:text-gray-400 font-medium">Project Management Dashboard</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Project Details & Controls */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white dark:bg-[#262626] rounded-2xl shadow-sm border border-gray-100 dark:border-white/5 p-6">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <span className="material-icons-round text-[#7C3AED]">description</span>
              Details
            </h2>
            <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed mb-6">
              {project.description}
            </p>
            
            <div className="space-y-3 pt-6 border-t border-gray-100 dark:border-gray-800">
              <button 
                onClick={handleEdit}
                className="w-full py-3 bg-[#7C3AED] hover:bg-[#6D28D9] text-white rounded-xl font-bold transition-all shadow-lg shadow-purple-200 dark:shadow-none flex items-center justify-center gap-2"
              >
                <span className="material-icons-round text-sm">edit</span>
                Edit Project
              </button>
              <button 
                onClick={handleDelete}
                disabled={isDeleting}
                className="w-full py-3 bg-red-50 text-red-600 dark:bg-red-900/10 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/20 rounded-xl font-bold transition-all border border-red-100 dark:border-red-900/30 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <span className="material-icons-round text-sm">delete</span>
                {isDeleting ? 'Deleting...' : 'Delete Project'}
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Applicants List */}
        <div className="lg:col-span-2">
          <div className="bg-white dark:bg-[#262626] rounded-2xl shadow-sm border border-gray-100 dark:border-white/5 overflow-hidden">
            <div className="p-6 border-b border-gray-100 dark:border-gray-800">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <span className="material-icons-round text-[#7C3AED]">groups</span>
                Applicants ({applicants.length})
              </h2>
            </div>
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {applicants.length === 0 ? (
                <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                  No applicants yet.
                </div>
              ) : (
                applicants.map((applicant: any) => {
                  const user = applicant.userId;
                  if (!user) return null; // Safe guard
                  return (
                    <div key={applicant._id || user._id} className="p-6 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-[#1f1f1f]/50 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-purple-600 dark:text-purple-400 font-bold overflow-hidden">
                          {user.avatar ? (
                            <img src={user.avatar} alt={user.fullName} className="w-full h-full object-cover" />
                          ) : (
                            user.fullName?.charAt(0) || '?'
                          )}
                        </div>
                        <div>
                          <h4 className="font-bold text-[#171717] dark:text-[#F5F5F5]">{user.fullName}</h4>
                          <p className="text-sm text-gray-500 dark:text-gray-400">{user.jobTitle || 'Freelancer'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-6">
                        <div className="text-right hidden sm:block">
                          <div className="text-sm font-bold text-green-600 dark:text-green-400">
                            {/* Mocking match % for now since backend doesn't store match per applicant */}
                            {Math.floor(Math.random() * 40) + 60}% Match
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            Applied {new Date(applicant.appliedAt).toLocaleDateString()}
                          </div>
                        </div>
                        <button 
                          onClick={() => navigate(`/freelancer-profile/${user._id}`)}
                          className="px-4 py-2 border-2 border-gray-100 dark:border-gray-800 hover:border-[#7C3AED] dark:hover:border-[#7C3AED] text-[#171717] dark:text-[#F5F5F5] font-bold rounded-xl transition-all"
                        >
                          View Profile
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ManageProject;
