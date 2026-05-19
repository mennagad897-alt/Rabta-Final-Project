import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axiosInstance from '../../api/axiosInstance';
import toast from 'react-hot-toast';

const FreelancerDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [applications, setApplications] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchApplications = async () => {
      try {
        const response = await axiosInstance.get('/jobs/applied');
        setApplications(response.data.data.applications);
      } catch (error) {
        console.error("Failed to fetch applications:", error);
        toast.error("Failed to load your applications.");
      } finally {
        setIsLoading(false);
      }
    };
    fetchApplications();
  }, []);

  const formatDate = (dateString: string) => {
    if (!dateString) return 'Unknown Date';
    return new Date(dateString).toLocaleDateString();
  };

  const getStatusStyle = (status: string) => {
    switch(status) {
      case 'Pending': return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400';
      case 'Reviewed': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
      case 'Accepted': return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
      default: return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400';
    }
  };

  return (
    <div className="min-h-screen bg-[#FAFAFA] dark:bg-[#171717] text-[#171717] dark:text-[#F5F5F5] font-sans p-4 md:p-8 transition-colors duration-300">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-black tracking-tight">Freelancer Dashboard</h1>
            <p className="text-gray-500 dark:text-gray-400 font-medium">Manage your job applications and track your success.</p>
          </div>
          <button 
            onClick={() => navigate('/jobs')}
            className="px-6 py-3 bg-[#7C3AED] hover:bg-[#6D28D9] text-white rounded-xl font-bold transition-all shadow-lg shadow-purple-200 dark:shadow-none flex items-center gap-2"
          >
            <span className="material-icons-round text-sm">search</span>
            Find More Jobs
          </button>
        </div>

        {/* Applied Projects Table */}
        <div className="bg-white dark:bg-[#262626] rounded-2xl shadow-sm border border-gray-100 dark:border-white/5 overflow-hidden">
          <div className="p-6 border-b border-gray-100 dark:border-gray-800">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <span className="material-icons-round text-[#7C3AED]">work</span>
              Applied Projects ({applications.length})
            </h2>
          </div>

          <div className="overflow-x-auto">
            {isLoading ? (
              <div className="p-8 text-center text-gray-500 animate-pulse">Loading your applications...</div>
            ) : applications.length === 0 ? (
              <div className="p-12 text-center text-gray-500 flex flex-col items-center">
                <span className="material-icons-round text-4xl mb-3 opacity-20">assignment</span>
                <p>You haven't applied to any projects yet.</p>
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50/50 dark:bg-[#1f1f1f]/50 border-b border-gray-100 dark:border-gray-800">
                    <th className="p-4 text-sm font-semibold text-gray-600 dark:text-gray-400">Project Title</th>
                    <th className="p-4 text-sm font-semibold text-gray-600 dark:text-gray-400">Employer</th>
                    <th className="p-4 text-sm font-semibold text-gray-600 dark:text-gray-400">Applied Date</th>
                    <th className="p-4 text-sm font-semibold text-gray-600 dark:text-gray-400">Status</th>
                    <th className="p-4 text-right text-sm font-semibold text-gray-600 dark:text-gray-400">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {applications.map((app) => (
                    <tr key={app.id} className="hover:bg-gray-50/50 dark:hover:bg-[#1f1f1f]/50 transition-colors">
                      <td className="p-4"><span className="font-bold">{app.title}</span></td>
                      <td className="p-4 text-sm text-gray-600 dark:text-gray-400">{app.employer}</td>
                      <td className="p-4 text-sm text-gray-500 font-medium">{formatDate(app.appliedAt)}</td>
                      <td className="p-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${getStatusStyle(app.status)} capitalize`}>
                          {app.status}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <button 
                          onClick={() => navigate(`/jobs/${app.id}`)}
                          className="text-[#7C3AED] dark:text-[#8B5CF6] hover:underline font-bold text-sm"
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FreelancerDashboard;
