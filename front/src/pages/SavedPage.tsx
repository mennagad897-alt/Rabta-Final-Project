// src/pages/SavedPage.tsx
import React, { useState, useEffect } from 'react';
import { useAppSelector, useAppDispatch } from '../store/hooks';
import { updateProfile } from '../store/slices/authSlice';
import axiosInstance from '../api/axiosInstance';
import toast from 'react-hot-toast';
import { JobCard } from '../components/JobList';
import { Link } from 'react-router-dom';
import type { Job } from '../components/JobList';

// ============================================================
// Interfaces
// ============================================================
interface SavedFreelancer {
  _id: string;
  fullName: string;
  avatar?: string;
  jobTitle?: string;
  skills?: string[];
}

interface SavedJob {
  _id: string;
  title?: string;
  description?: string;
  jobType?: string;
  budgetOrSalary?: string;
  requiredSkills?: string[];
  location?: string;
  createdAt?: string;
  applicants?: unknown[];
  publisherId?: { companyName?: string };
}

// ============================================================
// Empty State Sub-component
// ============================================================
interface EmptyStateProps {
  icon: string;
  heading: string;
  subtext: string;
}
const EmptyState: React.FC<EmptyStateProps> = ({ icon, heading, subtext }) => (
  <div className="bg-white dark:bg-[#1E1E1E] rounded-3xl p-12 text-center border border-dashed border-gray-200 dark:border-white/10 max-w-md mx-auto mt-8">
    <div className="w-20 h-20 bg-gray-100 dark:bg-[#262626] rounded-full flex items-center justify-center mx-auto mb-5">
      <span className="material-icons-round text-4xl text-gray-300 dark:text-gray-600">{icon}</span>
    </div>
    <h3 className="font-bold text-xl mb-2 text-[#171717] dark:text-[#F5F5F5]">{heading}</h3>
    <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed max-w-xs mx-auto">{subtext}</p>
  </div>
);

// ============================================================
// Main Component
// ============================================================
export const SavedContent = () => {
  const { user } = useAppSelector((state) => state.auth);
  const dispatch = useAppDispatch();

  // Derive role flags once — these won't change mid-render
  const isFreelancer = user?.role === 'freelancer';
  const isEmployer = user?.role === 'employer';

  const [savedFreelancers, setSavedFreelancers] = useState<SavedFreelancer[]>([]);
  const [savedJobs, setSavedJobs] = useState<SavedJob[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Listen for changes in the saved array length from Redux to trigger a refetch if needed
  const savedProjectsCount = user?.savedProjects?.length || 0;
  const savedFreelancersCount = user?.savedFreelancers?.length || 0;

  useEffect(() => {
    // Don't fetch until we know who the user is
    if (!user?._id) return;

    const fetchSavedItems = async () => {
      try {
        setIsLoading(true);
        setFetchError(null);
        const res = await axiosInstance.get('/users/saved-items');
        // Backend always returns 200 with an array (empty or not)
        const items = res.data.data.savedItems ?? [];

        if (user.role === 'employer') {
          setSavedFreelancers(items);
        } else {
          setSavedJobs(items);
        }
      } catch (error) {
        // Only set error on real network / server failures (4xx, 5xx)
        console.error('Failed to fetch saved items:', error);
        setFetchError('Failed to load your saved items. Please check your connection and try again.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchSavedItems();
  }, [user?._id, user?.role, savedProjectsCount, savedFreelancersCount]);

  const handleClearAll = async () => {
    if (window.confirm("Are you sure you want to clear all saved items?")) {
      try {
        setIsLoading(true);
        const res = await axiosInstance.delete('/users/saved-items/clear');
        dispatch(updateProfile(res.data.data.user));
        toast.success(res.data.message);
        if (isEmployer) setSavedFreelancers([]);
        if (isFreelancer) setSavedJobs([]);
      } catch (error: any) {
        toast.error(error.response?.data?.message || 'Failed to clear saved items.');
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleRemoveFreelancer = async (freelancerId: string) => {
    try {
      const res = await axiosInstance.post(`/users/toggle-save-freelancer/${freelancerId}`);
      dispatch(updateProfile(res.data.data.user));
      toast.success("Freelancer removed from saved list.");
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to remove freelancer.');
    }
  };

  // ─── Render Helpers ──────────────────────────────────────
  const renderFreelancerCard = (freelancer: SavedFreelancer) => (
    <div key={freelancer._id} className="bg-white dark:bg-[#262626] rounded-xl shadow-sm border border-gray-100 dark:border-white/5 p-6 flex flex-col md:flex-row gap-4 items-center">
      <div className="w-16 h-16 shrink-0 bg-[#7C3AED] rounded-full flex items-center justify-center text-white font-bold text-xl overflow-hidden">
        {freelancer.avatar ? (
          <img src={freelancer.avatar} alt="Avatar" className="w-full h-full object-cover" />
        ) : (
          freelancer.fullName?.substring(0, 2).toUpperCase()
        )}
      </div>
      <div className="flex-1 text-center md:text-left">
        <h3 className="text-xl font-bold">{freelancer.fullName}</h3>
        <p className="text-[#7C3AED] dark:text-[#8B5CF6] font-medium">{freelancer.jobTitle || 'Freelancer'}</p>
        <div className="flex flex-wrap gap-2 mt-2 justify-center md:justify-start">
          {(freelancer.skills || []).slice(0, 3).map((skill: string, index: number) => (
            <span key={index} className="px-2 py-1 bg-[#F3E8FF] dark:bg-[#7C3AED]/20 text-[#7C3AED] dark:text-[#A78BFA] rounded text-xs font-bold">
              {skill}
            </span>
          ))}
          {(freelancer.skills?.length || 0) > 3 && (
            <span className="text-xs text-gray-500 font-medium">+{(freelancer.skills?.length || 0) - 3} more</span>
          )}
        </div>
      </div>
      <div className="flex flex-col gap-2 mt-4 md:mt-0">
        <button
          onClick={() => handleRemoveFreelancer(freelancer._id)}
          className="px-4 py-2 border-2 border-red-100 text-red-500 hover:bg-red-50 dark:border-red-900/30 dark:hover:bg-red-900/20 rounded-xl font-bold transition-all text-sm flex items-center justify-center gap-1"
        >
          <span className="material-icons-round text-sm">delete_outline</span>
          Remove
        </button>
        <Link
          to={`/freelancer/${freelancer._id}`}
          className="px-6 py-2 border-2 border-[#7C3AED] text-[#7C3AED] hover:bg-[#7C3AED] hover:text-white dark:hover:bg-[#8B5CF6] dark:border-[#8B5CF6] dark:text-[#8B5CF6] rounded-xl font-bold transition-all text-sm flex items-center justify-center"
        >
          View Profile
        </Link>
      </div>
    </div>
  );

  const toJobCardProps = (item: SavedJob): Job => ({
    id: item._id,
    title: item.title || 'Untitled Job',
    company: item.publisherId?.companyName || 'Unknown Company',
    location: item.location || 'Remote',
    salary: {
      min: parseInt(item.budgetOrSalary || '0') || 0,
      max: parseInt(item.budgetOrSalary || '0') || 0,
      currency: '$',
    },
    category: item.requiredSkills?.[0] || 'General',
    level: item.jobType || 'Freelance',
    description: item.description || '',
    applicants: item.applicants?.length || 0,
    postedAt: item.createdAt || '',
  });

  // ─── Derived Flags ────────────────────────────────────────
  const activeTabName = isFreelancer ? 'Saved Projects' : isEmployer ? 'Saved Talents' : 'Saved Items';

  const isEmpty = isEmployer
    ? savedFreelancers.length === 0
    : savedJobs.length === 0;

  // ─── Render ───────────────────────────────────────────────
  return (
    <div className="p-6 md:p-10 max-w-5xl mx-auto min-h-screen">
      <header className="mb-8">
        <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
          <span className="material-icons-round text-[#7C3AED]">bookmark</span>
          Saved Items
        </h1>
        <p className="opacity-60 text-sm italic">Items you've bookmarked for later.</p>
      </header>

      {/* Tabs & Actions */}
      <div className="flex justify-between items-center mb-8 border-b border-gray-200 dark:border-white/5 pb-3">
        <button className="text-sm font-bold text-[#7C3AED] border-b-2 border-[#7C3AED] transition-all -mb-[14px]">
          {activeTabName}
        </button>
        {!isEmpty && !isLoading && !fetchError && (
          <button 
            onClick={handleClearAll}
            className="text-sm font-bold text-red-500 hover:text-red-600 transition-colors flex items-center gap-1"
          >
            <span className="material-icons-round text-[16px]">delete_sweep</span>
            Clear All Saved
          </button>
        )}
      </div>

      {/* ── Loading State ── */}
      {isLoading && (
        <div className="flex justify-center items-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#7C3AED]"></div>
        </div>
      )}

      {/* ── Real Error State (network / server failure only) ── */}
      {!isLoading && fetchError && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-8 text-center">
          <span className="material-icons-round text-4xl text-red-400 mb-3 block">error_outline</span>
          <h3 className="font-bold text-red-600 mb-2">Something went wrong</h3>
          <p className="text-sm text-red-500">{fetchError}</p>
        </div>
      )}

      {/* ── Empty States (no error, no loading, zero items) ── */}
      {!isLoading && !fetchError && isEmpty && isEmployer && (
        <EmptyState
          icon="person_search"
          heading="No saved talents yet"
          subtext="You haven't saved any freelancers. Explore profiles and click the save icon to bookmark talents for later."
        />
      )}

      {!isLoading && !fetchError && isEmpty && isFreelancer && (
        <EmptyState
          icon="work_outline"
          heading="No saved projects yet"
          subtext="You haven't bookmarked any projects. Browse jobs and save them to apply later."
        />
      )}

      {/* ── Content ── */}
      {!isLoading && !fetchError && !isEmpty && (
        <div className="space-y-4">
          {/* Employer: render saved freelancer talent cards */}
          {isEmployer && savedFreelancers.map(freelancer => renderFreelancerCard(freelancer))}

          {/* Freelancer: render saved job/project cards */}
          {isFreelancer && savedJobs.map(item => (
            <div key={item._id} className="animate-in fade-in slide-in-from-bottom-2 duration-300">
              <JobCard job={toJobCardProps(item)} isSavedPage={true} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SavedContent;
