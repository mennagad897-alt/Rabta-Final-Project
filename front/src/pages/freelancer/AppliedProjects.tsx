import React, { useState, useEffect } from 'react';
import axiosInstance from '../../api/axiosInstance';
import toast from 'react-hot-toast';

const AppliedProjects: React.FC = () => {
  const [appliedJobs, setAppliedJobs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchAppliedJobs = async () => {
      try {
        setIsLoading(true);
        // Assuming a future endpoint for fetching a freelancer's applied jobs
        const response = await axiosInstance.get('/jobs/applied');
        setAppliedJobs(response.data.data.jobs || []);
      } catch (error) {
        console.error("Failed to fetch applied jobs", error);
        // For demonstration, keep empty state if no endpoint exists yet
      } finally {
        setIsLoading(false);
      }
    };
    fetchAppliedJobs();
  }, []);

  return (
    <div className="p-8 max-w-4xl mx-auto text-[#171717] dark:text-[#F5F5F5]">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Applied Projects</h1>
        <p className="text-gray-500 dark:text-gray-400">Track the status of your recent job applications.</p>
      </div>

      <div className="space-y-4">
        {isLoading ? (
          <div className="p-10 text-center text-gray-500 animate-pulse">Loading your applications...</div>
        ) : appliedJobs.length === 0 ? (
          <div className="p-10 text-center text-gray-500 bg-white dark:bg-[#262626] rounded-2xl border border-gray-100 dark:border-gray-800">
            You haven't applied to any projects yet.
          </div>
        ) : (
          appliedJobs.map((job) => (
            <div key={job._id || job.id} className="bg-white dark:bg-[#262626] rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-all hover:border-[#7C3AED]/30 dark:hover:border-[#8B5CF6]/30">
              <div>
                <h3 className="text-xl font-bold mb-1">{job.title}</h3>
                <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                  <span className="material-icons-round text-[16px]">business</span>
                  <span>{job.companyName || job.company}</span>
                  <span className="mx-2">•</span>
                  <span className="material-icons-round text-[16px]">schedule</span>
                  <span>{new Date(job.appliedAt || job.date).toLocaleDateString()}</span>
                </div>
              </div>
              
              <div className={`px-4 py-1.5 rounded-full text-sm font-bold border flex items-center gap-2
                ${job.status === 'Interview' ? 'bg-green-50 text-green-600 border-green-200 dark:bg-green-900/20 dark:border-green-800' : ''}
                ${job.status === 'In Review' ? 'bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800' : ''}
                ${(job.status === 'Applied' || job.status === 'pending') ? 'bg-gray-50 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700' : ''}
              `}>
                <span className="w-2 h-2 rounded-full bg-current"></span>
                {job.status || 'Applied'}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default AppliedProjects;
