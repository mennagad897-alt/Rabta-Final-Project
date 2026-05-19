import { useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';

export const AdminJobs = () => {
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const filteredJobs = (Array.isArray(jobs) ? jobs : []).filter(job => 
    job?.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    job?.position?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    job?.publisherId?.companyName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    job?.publisherId?.fullName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentJobs = filteredJobs.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredJobs.length / itemsPerPage);

  const fetchJobs = async () => {
    try {
      const { data } = await axios.get('http://localhost:5000/api/v1/admin/jobs', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setJobs(data?.data?.jobs || data?.jobs || data || []);
    } catch (error) {
      console.error('Error fetching jobs:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, []);

  const deleteJob = async (jobId: string) => {
    if (!window.confirm('Are you sure you want to permanently delete this job?')) return;
    
    try {
      await axios.delete(`http://localhost:5000/api/v1/admin/jobs/${jobId}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setJobs(jobs.filter(j => j._id !== jobId));
      toast.success('Job deleted successfully');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Action failed. Please try again.');
    }
  };

  if (loading) return <div className="text-gray-900 dark:text-white p-8">Loading jobs...</div>;

  return (
    <div>
      <h2 className="text-3xl font-bold mb-6 text-gray-900 dark:text-white">Jobs Moderation</h2>
      
      <div className="mb-6 flex items-center justify-between">
        <div className="relative w-full max-w-md">
          <i className="fa-solid fa-search absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"></i>
          <input
            type="text"
            placeholder="Search jobs by title or company..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-11 pr-4 py-3 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#141419] text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all"
          />
        </div>
      </div>

      <div className="bg-white dark:bg-[#141419] rounded-2xl border border-gray-200 dark:border-white/5 overflow-hidden shadow-sm">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 dark:bg-white/5 border-b border-gray-200 dark:border-white/5 text-gray-500 dark:text-gray-400">
              <th className="p-4 font-medium">Title</th>
              <th className="p-4 font-medium">Employer</th>
              <th className="p-4 font-medium">Budget</th>
              <th className="p-4 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {currentJobs.map(job => (
              <tr key={job?._id || Math.random()} className="border-b border-gray-200 dark:border-white/5 hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors">
                <td className="p-4 font-medium text-gray-900 dark:text-white">{job?.title || job?.position || 'No Title'}</td>
                <td className="p-4 text-gray-600 dark:text-gray-400">{job?.publisherId?.fullName || job?.publisherId?.companyName || 'Unknown'}</td>
                <td className="p-4 text-green-400 font-medium">${job?.budgetOrSalary || 'N/A'}</td>
                <td className="p-4 text-right">
                  <button
                    onClick={() => deleteJob(job?._id)}
                    className="px-4 py-2 rounded-lg text-sm bg-red-100 text-red-600 hover:bg-red-200 dark:bg-red-500/10 dark:text-red-400 dark:hover:bg-red-500/20 transition-all"
                  >
                    Delete Job
                  </button>
                </td>
              </tr>
            ))}
            {filteredJobs.length === 0 && (
              <tr>
                <td colSpan={4} className="p-8 text-center text-gray-500">No jobs found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {filteredJobs.length > 0 && (
        <div className="mt-6 flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
          <div>
            Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, filteredJobs.length)} of {filteredJobs.length} results
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="px-4 py-2 rounded-lg border border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              Previous
            </button>
            <button
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="px-4 py-2 rounded-lg border border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
