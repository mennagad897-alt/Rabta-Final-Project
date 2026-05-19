/**
 * ============================================================================
 * JobList Component - مثال كامل لاستخدام Redux Async Thunks للوظائف
 * ============================================================================
 */

import React, { useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { fetchJobs, resetFilters } from '../store/slices/jobsSlice';
import { updateProfile } from '../store/slices/authSlice';
import axiosInstance from '../api/axiosInstance';
import toast from 'react-hot-toast';
import { useNavigate, Link } from 'react-router-dom';

/**
 * Job Card Component
 * مثال على component لعرض بطاقة وظيفة واحد
 */
export interface Job {
  id?: string;
  _id?: string;
  title: string;
  company: string;
  location: string;
  salary: {
    min: number;
    max: number;
    currency: string;
  };
  category: string;
  level: string;
  description: string;
  applicants: number;
  postedAt: string;
}

export const JobCard: React.FC<{ job: Job, isSavedPage?: boolean }> = ({ job, isSavedPage }) => {
  const dispatch = useAppDispatch();
  const { user } = useAppSelector(state => state.auth);
  const [isSaving, setIsSaving] = useState(false);

  const jobId = job._id || job.id;
  const isSaved = user?.savedProjects?.includes(jobId);

  const handleSaveJob = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!jobId) return;
    try {
      setIsSaving(true);
      const res = await axiosInstance.post(`/users/toggle-save-project/${jobId}`);
      dispatch(updateProfile(res.data.data.user));
      console.log(`Job [${jobId}] saved/unsaved successfully. New savedProjects:`, res.data.data.user.savedProjects);
      toast.success(res.data.message);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to save job.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-white dark:bg-[#262626] rounded-lg p-5 mb-4 shadow-sm border border-gray-100 dark:border-gray-800 hover:shadow-md transition-shadow duration-200 cursor-pointer group">
      {/* Job Header */}
      <div className="flex justify-between items-start gap-4 mb-3">
        <div className="flex-1">
          <h3 className="text-lg font-bold text-[#171717] dark:text-[#F5F5F5] group-hover:text-[#7C3AED] dark:group-hover:text-[#8B5CF6] transition-colors">
            {job.title}
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            {job.company}
          </p>
        </div>
        <span className="px-3 py-1 bg-[#7C3AED]/10 dark:bg-[#8B5CF6]/10 text-[#7C3AED] dark:text-[#8B5CF6] text-xs font-semibold rounded-full">
          {job.level}
        </span>
      </div>

      {/* Job Details */}
      <p className="text-[#171717] dark:text-[#F5F5F5] text-sm mb-3 line-clamp-2">
        {job.description}
      </p>

      {/* Job Meta */}
      <div className="flex flex-wrap gap-4 mb-4 text-sm text-gray-600 dark:text-gray-400">
        <div className="flex items-center gap-1">
          <span className="text-base">📍</span>
          <span>{job.location}</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-base">💰</span>
          <span>
            {job.salary.currency}
            {job.salary.min}k - {job.salary.max}k
          </span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-base">🏷️</span>
          <span>{job.category}</span>
        </div>
      </div>

      {/* Job Footer */}
      <div className="flex justify-between items-center pt-3 border-t border-gray-200 dark:border-gray-800">
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {job.applicants} Applicants
        </span>
        <div className="flex gap-2">
          {user?.role === 'freelancer' && (
            <button
              onClick={handleSaveJob}
              disabled={isSaving}
              title={isSavedPage ? 'Remove from Saved' : (isSaved ? 'Unsave Job' : 'Save Job')}
              className={`p-2 rounded-lg transition-colors flex items-center justify-center disabled:opacity-50 ${
                isSavedPage 
                  ? 'bg-red-50 hover:bg-red-100 text-red-500 dark:bg-red-900/20 dark:hover:bg-red-900/40 dark:text-red-400'
                  : (isSaved ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400' : 'bg-gray-100 dark:bg-[#1f1f1f] text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-[#2a2a2a]')
              }`}
            >
              {isSavedPage ? (
                <>
                  <span className="material-icons-round text-sm mr-1">delete_outline</span>
                  <span className="text-xs font-bold">Remove</span>
                </>
              ) : (
                <span className="material-icons-round text-sm">{isSaved ? 'bookmark' : 'bookmark_border'}</span>
              )}
            </button>
          )}
          <Link 
            to={`/jobs/${job._id || job.id}`}
            onClick={(e) => {
              e.stopPropagation();
              console.log("Navigating to Job ID:", job._id || job.id, "Full Job Object:", job);
            }}
            className="px-4 py-2 bg-[#7C3AED] hover:bg-[#6D28D9] dark:bg-[#8B5CF6] dark:hover:bg-[#7C3AED] text-white rounded-lg font-medium transition-colors text-sm inline-flex items-center justify-center"
          >
            View Details
          </Link>
        </div>
      </div>
    </div>
  );
};

/**
 * ============================================================================
 * JobList Component - الـ MAIN COMPONENT
 * ============================================================================
 * 
 * استخدم هذا الـ component مثال لكيفية:
 * 1. Dispatch fetchJobs في useEffect عند تحميل الـ component
 * 2. استخدام setFilters لـ filter الوظائف
 * 3. عرض filtered jobs based على الـ filters من Redux
 */
export const JobList: React.FC = () => {
  const dispatch = useAppDispatch();
  const [searchTerm, setSearchTerm] = useState('');

  // ✅ Get data من Redux store
  const jobs = useAppSelector((state) => state.jobs.items);
  const filters = useAppSelector((state) => state.jobs.filters);
  const loading = useAppSelector((state) => state.jobs.loading);
  const error = useAppSelector((state) => state.jobs.error);

  /**
   * ✅ Live Search (Typeahead) with Debounce
   */
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      dispatch(fetchJobs({ search: searchTerm }));
    }, 400); // 400ms debounce to prevent API spam

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm, dispatch]);

  /**
   * Filter jobs based على الـ active filters و search term
   */
  const filteredJobs = jobs.filter((job: Job) => {
    const matchesCategory = !filters.category || job.category === filters.category;
    const matchesLocation = !filters.location || job.location === filters.location;
    const matchesSalary = !filters.salary ||
      ((job.salary?.max || 0) >= filters.salary.min && (job.salary?.min || 0) <= filters.salary.max);

    return matchesCategory && matchesLocation && matchesSalary;
  });

  // ============================================================================
  // LOADING STATE
  // ============================================================================
  if (loading && jobs.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#7C3AED]"></div>
          </div>
          <p className="text-gray-600 dark:text-gray-400 font-medium">
            Searching...
          </p>
        </div>
      </div>
    );
  }

  // ============================================================================
  // ERROR STATE
  // ============================================================================
  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6 max-w-md text-center">
          <div className="text-3xl mb-2">⚠️</div>
          <h3 className="text-lg font-bold text-red-600 mb-2">An Error Occurred</h3>
          <p className="text-red-600 text-sm mb-4">{error}</p>
          <button
            onClick={() => dispatch(fetchJobs())}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // ============================================================================
  // SUCCESS STATE - عرض الوظائف
  // ============================================================================
  return (
    <div className="min-h-screen bg-[#FAFAFA] dark:bg-[#171717] py-6">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-[#171717] dark:text-[#F5F5F5] mb-2">
            Available Jobs 💼
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            {filteredJobs.length} available jobs
          </p>
        </div>

        {/* Search Bar */}
        <div className="mb-8 relative">
          <input
            type="text"
            placeholder="Search for jobs..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-3 bg-white dark:bg-[#262626] border border-gray-200 dark:border-gray-800 rounded-lg text-[#171717] dark:text-[#F5F5F5] placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/50 transition-all"
          />
        </div>

        {/* Filters */}
        <div className="mb-8 flex gap-3 flex-wrap">
          <button
            onClick={() => dispatch(resetFilters())}
            className="px-4 py-2 bg-gray-200 dark:bg-gray-800 text-[#171717] dark:text-[#F5F5F5] rounded-lg text-sm font-medium hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors"
          >
            Reset Filters
          </button>
          {/* يمكنك إضافة filter buttons هنا */}
        </div>

        {/* Empty Filtered Results */}
        {filteredJobs.length === 0 && jobs.length > 0 && (
          <div className="text-center text-gray-500 dark:text-gray-400 py-12">
            <div className="text-4xl mb-2">🔍</div>
            <p className="text-lg">No jobs found matching your search.</p>
            <p className="text-sm mt-2">Try changing the filter criteria</p>
          </div>
        )}

        {/* ✅ KEY PART: تعيين الوظائف من Redux Store */}
        {/* استخدم .map() لـ render كل وظيفة */}
        {filteredJobs.length > 0 && (
          <div className="space-y-4">
            {filteredJobs.map((job: Job) => (
              <JobCard key={job.id} job={job} />
            ))}
          </div>
        )}

        {/* Load More */}
        {loading && jobs.length > 0 && (
          <div className="flex justify-center mt-8">
            <div className="text-sm text-gray-500 dark:text-gray-400">
              Loading more...
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default JobList;

/**
 * ============================================================================
 * استخدام هذا الـ Component
 * ============================================================================
 * 
 * في ملف routing أو App.tsx:
 * 
 * import JobList from './components/JobList';
 * 
 * <Route path="/jobs" element={<JobList />} />
 * 
 * ============================================================================
 */
