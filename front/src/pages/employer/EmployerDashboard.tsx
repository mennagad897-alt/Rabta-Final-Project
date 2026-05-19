import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import type { RootState } from '../../store/store';
import axiosInstance from '../../api/axiosInstance';
import { updateProfile } from '../../store/slices/authSlice';
import { useChat } from '../../context/ChatContext';
import toast from 'react-hot-toast';

const EmployerDashboard: React.FC = () => {
  const navigate = useNavigate();
  const user = useSelector((state: RootState) => state.auth.user);
  const dispatch = useDispatch();
  const { socket } = useChat();
  const [jobs, setJobs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Silent sync on mount
  useEffect(() => {
    if (user?.role === 'employer') {
      axiosInstance.get('/profile/me')
        .then(res => {
          if (res.data?.data?.user) {
            dispatch(updateProfile(res.data.data.user));
          }
        })
        .catch(err => console.error("Failed to silently sync profile:", err));
    }
  }, [user?.role, dispatch]);

  // Real-time socket listener
  useEffect(() => {
    if (!socket) return;

    const handleStatusUpdate = (data: any) => {
      dispatch(updateProfile(data.user));
      if (data.status === 'rejected') {
        toast.error(`Your account verification was rejected: ${data.reason}`);
      } else if (data.status === 'approved') {
        toast.success("Your account verification was approved!");
      }
    };

    socket.on('employerStatusUpdated', handleStatusUpdate);

    return () => {
      socket.off('employerStatusUpdated', handleStatusUpdate);
    };
  }, [socket, dispatch]);

  useEffect(() => {
    const fetchEmployerJobs = async () => {
      try {
        setIsLoading(true);
        // Fetch all jobs, then filter on frontend by the current user's ID
        const response = await axiosInstance.get('/jobs');
        const allJobs = response.data.data.jobs || [];

        // Filter jobs where the publisherId matches the logged-in employer's ID
        const myJobs = allJobs.filter((job: any) =>
          job.publisherId?._id === user?._id || job.publisherId === user?._id
        );

        setJobs(myJobs);
      } catch (error) {
        console.error("Failed to fetch jobs", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchEmployerJobs();
  }, [user?._id]);

  const activeProjects = jobs.length;
  const totalApplicants = jobs.reduce((sum, job) => sum + (job.applicantsCount || 0), 0);
  const interviewsScheduled = 0; // Mock stat for now
  const currentStatus = user?.isVerifiedEmployer ? 'approved' : (user?.verificationStatus || 'pending');

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#7C3AED]"></div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto text-[#171717] dark:text-[#F5F5F5] font-sans transition-colors duration-300">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight mb-1">Employer Workspace</h1>
          <p className="text-gray-500 dark:text-gray-400 font-medium">Here is an overview of your hiring activity and projects.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          {currentStatus === 'pending' && (
            <div className="flex items-center text-sm font-medium text-orange-500 bg-orange-50 dark:bg-orange-900/20 px-4 py-2 rounded-xl border border-orange-200 dark:border-orange-800/30">
              Your account is awaiting admin verification to post jobs.
            </div>
          )}

          {currentStatus === 'approved' && (
            <button
              onClick={() => navigate('/post-job')}
              className="px-6 py-2.5 bg-[#7C3AED] hover:bg-[#6D28D9] text-white rounded-xl font-bold shadow-lg shadow-purple-200 dark:shadow-none transition-all flex items-center justify-center gap-2 w-full sm:w-fit"
            >
              <span className="material-icons-round text-sm">add</span>
              Post New Job
            </button>
          )}
        </div>
      </div>

      {/* Prominent Dashboard Alert for Rejection */}
      {currentStatus === 'rejected' && (
        <div className="w-full bg-red-500/10 border border-red-500 text-red-500 p-4 rounded-lg mb-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm">
          <div className="flex items-start gap-3">
            <span className="material-icons-round text-red-500 mt-0.5">error_outline</span>
            <div>
              <p className="font-bold text-lg">Account Verification Rejected</p>
              <p className="text-sm">Reason: {user?.rejectionReason}</p>
            </div>
          </div>
          <button
            onClick={() => navigate('/jobs')}
            className="px-4 py-2 bg-red-500 text-white rounded-lg text-sm font-bold shadow-md hover:bg-red-600 transition-colors whitespace-nowrap"
          >
            Resubmit Request
          </button>
        </div>
      )}

      {/* Projects Overview & Total Applicants Stats */}
      <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
        <span className="material-icons-round text-[#7C3AED]">bar_chart</span>
        Projects Overview
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        <div className="bg-white dark:bg-[#262626] p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 flex flex-col items-center justify-center transition-all hover:border-[#7C3AED]/30">
          <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-4">
            <span className="material-icons-round">work</span>
          </div>
          <h3 className="text-4xl font-black mb-1 text-[#171717] dark:text-[#F5F5F5]">{isLoading ? '-' : activeProjects}</h3>
          <p className="text-gray-500 dark:text-gray-400 font-bold text-sm uppercase tracking-wider">Active Projects</p>
        </div>

        <div className="bg-white dark:bg-[#262626] p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 flex flex-col items-center justify-center transition-all hover:border-[#7C3AED]/30">
          <div className="w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 flex items-center justify-center mb-4">
            <span className="material-icons-round">groups</span>
          </div>
          <h3 className="text-4xl font-black mb-1 text-[#171717] dark:text-[#F5F5F5]">{isLoading ? '-' : totalApplicants}</h3>
          <p className="text-gray-500 dark:text-gray-400 font-bold text-sm uppercase tracking-wider">Total Applicants</p>
        </div>

        <div className="bg-white dark:bg-[#262626] p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 flex flex-col items-center justify-center transition-all hover:border-[#7C3AED]/30">
          <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 flex items-center justify-center mb-4">
            <span className="material-icons-round">event_available</span>
          </div>
          <h3 className="text-4xl font-black mb-1 text-[#171717] dark:text-[#F5F5F5]">{isLoading ? '-' : interviewsScheduled}</h3>
          <p className="text-gray-500 dark:text-gray-400 font-bold text-sm uppercase tracking-wider">Interviews Scheduled</p>
        </div>
      </div>

      {/* Manage Job Postings Section */}
      <div className="bg-white dark:bg-[#262626] rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden">
        <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <span className="material-icons-round text-[#7C3AED]">dashboard</span>
            Manage Job Postings
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 dark:bg-[#1f1f1f] border-b border-gray-100 dark:border-gray-800 text-sm text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                <th className="p-4 font-bold">Job Title</th>
                <th className="p-4 font-bold">Status</th>
                <th className="p-4 font-bold">Applicants</th>
                <th className="p-4 font-bold">Posted</th>
                <th className="p-4 font-bold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-gray-500 font-medium">Loading your projects...</td>
                </tr>
              ) : jobs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-12 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-[#1f1f1f] flex items-center justify-center text-gray-400 mb-4">
                        <span className="material-icons-round text-3xl">inbox</span>
                      </div>
                      <p className="text-lg font-bold text-[#171717] dark:text-[#F5F5F5] mb-1">No projects posted yet</p>
                      <p className="text-gray-500 dark:text-gray-400 mb-4">You haven't posted any jobs. Create one to start hiring.</p>
                      <button onClick={() => navigate('/post-job')} className="text-[#7C3AED] hover:underline font-bold">
                        + Post your first job
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                jobs.map((job) => (
                  <tr key={job._id} className="hover:bg-gray-50 dark:hover:bg-[#1f1f1f]/50 transition-colors">
                    <td className="p-4 font-bold text-[#171717] dark:text-[#F5F5F5]">{job.title}</td>
                    <td className="p-4">
                      <span className="px-3 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                        Active
                      </span>
                    </td>
                    <td className="p-4 font-medium">
                      <span className="flex items-center gap-1.5">
                        <span className="material-icons-round text-[16px] text-gray-400">person</span>
                        {job.applicantsCount || 0}
                      </span>
                    </td>
                    <td className="p-4 text-sm text-gray-500 dark:text-gray-400 font-medium">
                      {new Date(job.postedAt || new Date()).toLocaleDateString()}
                    </td>
                    <td className="p-4 text-right">
                      <button
                        onClick={() => navigate(`/manage-project/${job._id}`)}
                        className="text-[#7C3AED] dark:text-[#8B5CF6] hover:underline font-bold text-sm"
                      >
                        Manage
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default EmployerDashboard;
