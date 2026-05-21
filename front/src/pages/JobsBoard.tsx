import React, { useState, useEffect } from "react";
import { type AxiosResponse, isAxiosError } from "axios";
import axiosInstance from "../api/axiosInstance";
import { useNavigate } from "react-router-dom";
import { useAppSelector } from "../store/hooks";
import { useDispatch } from "react-redux";
import { updateProfile } from "../store/slices/authSlice";
import toast from "react-hot-toast";
// ==========================================
// 1. Interfaces
// ==========================================
export interface JobType {
  _id: string;
  title: string;
  companyName: string;
  companyLogo: string;
  location: string;
  postedAt: string;
  description: string;
  projectType: string;
  salaryOrBudget: string;
  experienceLevel: string;
  tags: string[];
  isSaved?: boolean;
}

interface JobsApiResponse {
  status: string;
  results: number;
  data: {
    jobs: JobType[];
    totalPages: number;
    currentPage: number;
  };
}

// ==========================================
// 2. Component
// ==========================================
export const JobsBoard: React.FC = () => {
  // Grab the current user from Redux to enable role-based UI rendering
  const { user } = useAppSelector((state) => state.auth);
  const dispatch = useDispatch();

  // --- States ---
  const [jobs, setJobs] = useState<JobType[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  // States للفلترة والبحث
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]); // 💡 شلنا الديفولت الثابت
  const [selectedExperience, setSelectedExperience] = useState<string[]>([]);
  const [selectedBudget, setSelectedBudget] = useState<string>("Any Budget");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [sortOption, setSortOption] = useState<string>("newest");
  const [isSortMenuOpen, setIsSortMenuOpen] = useState<boolean>(false);
  const [newVerificationLink, setNewVerificationLink] = useState<string>("");
  const [isSubmittingLink, setIsSubmittingLink] = useState<boolean>(false);

  // Sync user profile on mount if employer
  useEffect(() => {
    if (user?.role === 'employer') {
      axiosInstance.get('/profile/me')
        .then(res => {
          if (res.data?.data?.user) {
            dispatch(updateProfile(res.data.data.user));
          }
        })
        .catch(err => console.error("Failed to sync profile:", err));
    }
  }, [user?.role, dispatch]);

  // --- دالة جلب الوظائف من الباك-إند (Dynamic 100%) ---
  const fetchJobs = async () => {
    try {
      setIsLoading(true);
      setError(null); // تصفير الأخطاء مع كل طلب جديد

      const params = new URLSearchParams({
        search: searchQuery,
        types: selectedTypes.join(","),
        experience: selectedExperience.join(","),
        budget: selectedBudget !== "Any Budget" ? selectedBudget : "",
        page: currentPage.toString(),
        sort: sortOption,
      });

      const response: AxiosResponse<JobsApiResponse> = await axiosInstance.get(
        `/jobs?${params.toString()}`
      );

      // 💡 استقبال الداتا الحقيقية فقط
      setJobs(response.data.data.jobs || []);
      setTotalPages(response.data.data.totalPages || 1);
    } catch (err: unknown) {
      // 💡 تسجيل الخطأ الحقيقي من الباك-إند بدون أي داتا ثابتة
      if (isAxiosError(err)) {
        const errorMessage =
          err.response?.data?.message ||
          "Failed to fetch jobs. Please try again.";
        setError(errorMessage);

      } else {
        setError("An unexpected error occurred.");

      }
      setJobs([]); // التأكد إن القائمة فاضية في حالة الخطأ
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    selectedTypes,
    selectedExperience,
    selectedBudget,
    currentPage,
    sortOption,
  ]);

  const toggleFilter = (
    stateSetter: React.Dispatch<React.SetStateAction<string[]>>,
    value: string,
  ) => {
    stateSetter((prev) =>
      prev.includes(value)
        ? prev.filter((item) => item !== value)
        : [...prev, value],
    );
  };

  const handleSearchSubmit = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      setCurrentPage(1);
      fetchJobs();
    }
  };

  const handleResubmitVerification = async () => {
    if (!newVerificationLink.trim()) {
      toast.error('Please provide a valid LinkedIn or Website URL');
      return;
    }

    try {
      setIsSubmittingLink(true);
      const res = await axiosInstance.post('/profile/request-verification', {
        verificationLink: newVerificationLink
      });
      dispatch(updateProfile(res.data.data.user));
      toast.success('Verification request resubmitted successfully!');
      setNewVerificationLink("");
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to resubmit request');
    } finally {
      setIsSubmittingLink(false);
    }
  };

  // --- Current Status Helper ---
  const currentStatus = user?.isVerifiedEmployer ? 'approved' : (user?.verificationStatus || 'pending');

  return (
    <div className="flex-1 overflow-y-auto relative custom-scrollbar bg-[#F8F7FC] dark:bg-[#121212] transition-colors duration-300">
      <div className="absolute top-0 left-0 w-full h-64 bg-gradient-to-b from-[#8B5CF6]/10 to-transparent z-0 pointer-events-none"></div>

      <div className="relative max-w-7xl mx-auto px-6 py-10 z-10">
        {/* Header & Search */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
          <div>
            <h1 className="text-3xl font-bold tracking-tight mb-2 text-[#1F1F1F] dark:text-[#F5F5F5]">
              Find Your Next Project
            </h1>
            <p className="text-sm opacity-70 font-medium text-[#1F1F1F] dark:text-[#F5F5F5]">
              Discover freelance gigs and full-time opportunities.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto">
            {/* Conditional Add New Job Button for Employers */}
            {user?.role === 'employer' && currentStatus === 'approved' && (
              <button
                onClick={() => navigate('/post-job')}
                className="w-full sm:w-auto bg-purple-600 hover:bg-purple-700 text-white rounded-lg px-5 py-3 sm:py-2.5 flex items-center justify-center gap-2 font-bold transition-colors shadow-sm"
              >
                <span className="material-icons-round text-[18px]">add</span> Add New Job
              </button>
            )}

            {user?.role === 'employer' && currentStatus === 'pending' && (
              <span className="text-sm font-medium text-orange-500 bg-orange-50 dark:bg-orange-900/20 px-4 py-2 rounded-lg border border-orange-200 dark:border-orange-800/30">
                Your account is awaiting admin verification to post jobs.
              </span>
            )}

            <div className="relative w-full md:w-80">
              <span className="material-icons-round absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                search
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleSearchSubmit}
                placeholder="Search jobs, skills, or companies..."
                className="w-full bg-white dark:bg-[#1E1E1E] text-[#1F1F1F] dark:text-[#F5F5F5] border border-[#1F1F1F]/10 dark:border-[#F5F5F5]/10 rounded-2xl pl-12 pr-4 py-3.5 focus:outline-none focus:border-[#8B5CF6] transition-all shadow-sm font-medium"
              />
            </div>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
          {/* Main content layout adjustment */}
          <div className="w-full flex flex-col gap-6">

            {user?.role === 'employer' && currentStatus === 'rejected' && (
              <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/30 rounded-2xl p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 w-full">
                <div>
                  <h3 className="text-red-800 dark:text-red-400 font-bold text-lg mb-1 flex items-center gap-2">
                    <i className="fa-solid fa-triangle-exclamation"></i>
                    Account Verification Rejected
                  </h3>
                  <p className="text-red-600 dark:text-red-300 text-sm">
                    Reason: <span className="font-semibold">{user.rejectionReason || "No specific reason provided."}</span>
                  </p>
                  <p className="text-red-600 dark:text-red-300 text-sm mt-1">
                    You cannot post jobs until your account is approved. Please provide a new valid LinkedIn profile or website link.
                  </p>
                </div>

                <div className="flex flex-col w-full md:w-auto gap-2">
                  <input
                    type="text"
                    value={newVerificationLink}
                    onChange={(e) => setNewVerificationLink(e.target.value)}
                    placeholder="https://linkedin.com/in/..."
                    className="px-4 py-2 text-sm border border-red-200 dark:border-red-800/50 rounded-lg outline-none focus:ring-2 focus:ring-red-500 bg-white dark:bg-black/20 text-gray-900 dark:text-white"
                  />
                  <button
                    onClick={handleResubmitVerification}
                    disabled={isSubmittingLink}
                    className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors shadow-sm disabled:opacity-50"
                  >
                    {isSubmittingLink ? 'Submitting...' : 'Resubmit Verification'}
                  </button>
                </div>
              </div>
            )}

            <div className="flex flex-col lg:flex-row gap-8 w-full">
              {/* Sidebar Filters */}
              <aside className="w-full lg:w-[25%] flex flex-col gap-6">
                <div className="bg-white dark:bg-[#1E1E1E] rounded-3xl shadow-sm border border-[#8B5CF6]/5 dark:border-[#8B5CF6]/10 p-6 sticky top-6">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-bold tracking-tight text-[#1F1F1F] dark:text-[#F5F5F5]">
                      Filters
                    </h3>
                    <button
                      onClick={() => {
                        setSelectedTypes([]);
                        setSelectedExperience([]);
                        setSelectedBudget("Any Budget");
                        setCurrentPage(1);
                      }}
                      className="text-xs font-bold text-[#8B5CF6] hover:underline"
                    >
                      Clear All
                    </button>
                  </div>

                  {/* Project Type Filter */}
                  <div className="mb-8">
                    <h4 className="text-sm font-bold opacity-70 uppercase tracking-wider mb-4 text-[#1F1F1F] dark:text-[#F5F5F5]">
                      Project Type
                    </h4>
                    <div className="flex flex-col gap-3">
                      {["Freelance", "Full-Time", "Internship"].map((type) => (
                        <label
                          key={type}
                          className="flex items-center gap-3 cursor-pointer group"
                        >
                          <div className="relative flex items-center justify-center">
                            <input
                              type="checkbox"
                              checked={selectedTypes.includes(type)}
                              onChange={() => toggleFilter(setSelectedTypes, type)}
                              className="peer opacity-0 absolute w-full h-full cursor-pointer z-10"
                            />
                            <div className="w-5 h-5 border-2 border-gray-300 dark:border-gray-600 rounded-md transition-colors flex items-center justify-center group-hover:border-[#8B5CF6] peer-checked:bg-[#8B5CF6] peer-checked:border-[#8B5CF6]">
                              <svg
                                className={`w-3 h-3 text-white ${selectedTypes.includes(type) ? "block" : "hidden"}`}
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth="3"
                                  d="M5 13l4 4L19 7"
                                ></path>
                              </svg>
                            </div>
                          </div>
                          <span className="text-sm font-medium text-[#1F1F1F] dark:text-[#F5F5F5]">
                            {type}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Experience Filter */}
                  <div className="mb-8">
                    <h4 className="text-sm font-bold opacity-70 uppercase tracking-wider mb-4 text-[#1F1F1F] dark:text-[#F5F5F5]">
                      Experience
                    </h4>
                    <div className="flex flex-col gap-3">
                      {["Entry Level", "Intermediate", "Expert"].map((level) => (
                        <label
                          key={level}
                          className="flex items-center gap-3 cursor-pointer group"
                        >
                          <div className="relative flex items-center justify-center">
                            <input
                              type="checkbox"
                              checked={selectedExperience.includes(level)}
                              onChange={() =>
                                toggleFilter(setSelectedExperience, level)
                              }
                              className="peer opacity-0 absolute w-full h-full cursor-pointer z-10"
                            />
                            <div className="w-5 h-5 border-2 border-gray-300 dark:border-gray-600 rounded-md transition-colors flex items-center justify-center group-hover:border-[#8B5CF6] peer-checked:bg-[#8B5CF6] peer-checked:border-[#8B5CF6]">
                              <svg
                                className={`w-3 h-3 text-white ${selectedExperience.includes(level) ? "block" : "hidden"}`}
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth="3"
                                  d="M5 13l4 4L19 7"
                                ></path>
                              </svg>
                            </div>
                          </div>
                          <span className="text-sm font-medium text-[#1F1F1F] dark:text-[#F5F5F5]">
                            {level}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Budget Filter */}
                  <div>
                    <h4 className="text-sm font-bold opacity-70 uppercase tracking-wider mb-4 text-[#1F1F1F] dark:text-[#F5F5F5]">
                      Budget
                    </h4>
                    <div className="flex flex-col gap-3">
                      {[
                        "Any Budget",
                        "$500 - $1,000",
                        "$1,000 - $5,000",
                        "$5,000+",
                      ].map((budget) => (
                        <label
                          key={budget}
                          className="flex items-center gap-3 cursor-pointer group"
                        >
                          <input
                            type="radio"
                            name="budget"
                            value={budget}
                            checked={selectedBudget === budget}
                            onChange={(e) => setSelectedBudget(e.target.value)}
                            className="w-4 h-4 text-[#8B5CF6] bg-gray-100 border-gray-300 focus:ring-[#8B5CF6]"
                          />
                          <span className="text-sm font-medium text-[#1F1F1F] dark:text-[#F5F5F5]">
                            {budget}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </aside>

              {/* Job Listings Area */}
              <main className="w-full lg:w-[75%] flex flex-col gap-6">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-xl font-bold tracking-tight text-[#1F1F1F] dark:text-[#F5F5F5]">
                    {jobs.length} Projects Found
                  </h2>

                  {/* 💡 قائمة الترتيب التفاعلية (Dropdown) */}
                  <div className="relative">
                    <button
                      onClick={() => setIsSortMenuOpen(!isSortMenuOpen)}
                      className="flex items-center gap-2 text-sm font-medium opacity-70 cursor-pointer hover:text-[#8B5CF6] transition-colors text-[#1F1F1F] dark:text-[#F5F5F5] focus:outline-none"
                    >
                      Sort by:{" "}
                      {sortOption === "newest"
                        ? "Newest"
                        : sortOption === "oldest"
                          ? "Oldest"
                          : "Salary (High to Low)"}
                      <span
                        className={`material-icons-round text-lg transition-transform ${isSortMenuOpen ? "rotate-180" : ""}`}
                      >
                        expand_more
                      </span>
                    </button>

                    {/* المنيو اللي بتفتح لما ندوس على الزرار */}
                    {isSortMenuOpen && (
                      <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-[#262626] rounded-xl shadow-lg border border-gray-100 dark:border-white/5 overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-200">
                        <button
                          onClick={() => {
                            setSortOption("newest");
                            setIsSortMenuOpen(false);
                            setCurrentPage(1);
                          }}
                          className={`w-full text-left px-4 py-3 text-sm transition-colors ${sortOption === "newest" ? "bg-[#8B5CF6]/10 text-[#8B5CF6] font-bold" : "text-[#171717] dark:text-[#F5F5F5] hover:bg-gray-50 dark:hover:bg-white/5"}`}
                        >
                          Newest first
                        </button>
                        <button
                          onClick={() => {
                            setSortOption("oldest");
                            setIsSortMenuOpen(false);
                            setCurrentPage(1);
                          }}
                          className={`w-full text-left px-4 py-3 text-sm transition-colors border-t border-gray-100 dark:border-white/5 ${sortOption === "oldest" ? "bg-[#8B5CF6]/10 text-[#8B5CF6] font-bold" : "text-[#171717] dark:text-[#F5F5F5] hover:bg-gray-50 dark:hover:bg-white/5"}`}
                        >
                          Oldest first
                        </button>
                        {/* تقدروا تزودوا فلاتر تانية هنا لو الباك-إند بيدعمها زي الراتب الأعلى */}
                      </div>
                    )}
                  </div>
                </div>

                {/* 💡 التحكم في الحالات: تحميل، خطأ، لا يوجد داتا، عرض الداتا */}
                {isLoading ? (
                  <div className="flex flex-col items-center justify-center p-20 bg-white dark:bg-[#1E1E1E] rounded-3xl border border-[#8B5CF6]/5">
                    <span className="material-icons-round text-[#8B5CF6] text-4xl animate-spin mb-4">
                      refresh
                    </span>
                    <p className="text-gray-500 dark:text-gray-400 font-medium animate-pulse">
                      Loading amazing projects...
                    </p>
                  </div>
                ) : error ? (
                  <div className="flex flex-col items-center justify-center p-20 bg-red-50 dark:bg-red-900/10 rounded-3xl border border-red-100 dark:border-red-900/30">
                    <span className="material-icons-round text-red-500 text-4xl mb-4">
                      error_outline
                    </span>
                    <p className="text-red-600 dark:text-red-400 font-medium text-center">
                      {error}
                    </p>
                  </div>
                ) : jobs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center p-20 bg-white dark:bg-[#1E1E1E] rounded-3xl border border-[#8B5CF6]/5">
                    <span className="material-icons-round text-gray-300 dark:text-gray-600 text-5xl mb-4">
                      search_off
                    </span>
                    <p className="text-gray-500 dark:text-gray-400 font-medium">
                      No jobs found matching your filters.
                    </p>
                  </div>
                ) : (
                  jobs.map((job) => (
                    <article
                      key={job._id}
                      onClick={() => navigate(`/jobs/${job._id}`)}
                      className="bg-white dark:bg-[#1E1E1E] rounded-3xl shadow-sm hover:shadow-lg transition-all duration-300 p-8 border border-[#8B5CF6]/5 dark:border-[#8B5CF6]/10 group cursor-pointer relative overflow-hidden"
                    >
                      <div className="absolute top-0 left-0 w-1.5 h-full bg-[#8B5CF6] transform -translate-x-full group-hover:translate-x-0 transition-transform duration-300"></div>

                      <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center gap-4">
                          <img
                            src={job.companyLogo || "/default-avatar.png"}
                            alt={job.companyName}
                            className="w-14 h-14 rounded-2xl object-cover border-2 border-[#FAFAFA] dark:border-[#121212]"
                          />
                          <div>
                            <h3 className="text-xl font-bold group-hover:text-[#8B5CF6] transition-colors tracking-tight text-[#1F1F1F] dark:text-[#F5F5F5]">
                              {job.title}
                            </h3>
                            <p className="text-sm opacity-70 font-medium text-[#1F1F1F] dark:text-[#F5F5F5]">
                              {job.companyName} • Posted{" "}
                              {new Date(job.postedAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        {/* ✅ Role-Based Visibility: Only Freelancers see the Save button */}
                        {user?.role === 'freelancer' && (
                          <button
                            title={job.isSaved ? 'Unsave Job' : 'Save Job'}
                            onClick={(e) => { e.stopPropagation(); /* handleSave(job._id) */ }}
                            className="text-gray-400 hover:text-[#8B5CF6] transition-colors p-2"
                          >
                            <span className="material-icons-round">
                              {job.isSaved ? 'bookmark' : 'bookmark_border'}
                            </span>
                          </button>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-2 mb-4">
                        <span className="bg-[#1F1F1F]/5 dark:bg-[#F5F5F5]/10 border border-[#1F1F1F]/10 dark:border-[#F5F5F5]/10 text-xs px-3 py-1.5 rounded-lg font-bold text-[#1F1F1F] dark:text-[#F5F5F5]">
                          {job.projectType}
                        </span>
                        <span className="bg-[#8B5CF6]/10 text-[#8B5CF6] border border-[#8B5CF6]/20 text-xs px-3 py-1.5 rounded-lg font-bold">
                          {job.salaryOrBudget}
                        </span>
                        <span className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-xs px-3 py-1.5 rounded-lg font-bold">
                          {job.experienceLevel}
                        </span>
                      </div>

                      <p className="text-base font-light opacity-80 mb-6 leading-relaxed line-clamp-2 text-[#1F1F1F] dark:text-[#F5F5F5]">
                        {job.description}
                      </p>

                      <div className="flex items-center justify-between mt-auto">
                        <div className="flex flex-wrap gap-2">
                          {job.tags?.map((tag) => (
                            <span
                              key={tag}
                              className="text-xs font-bold opacity-60 bg-[#FAFAFA] dark:bg-[#121212] px-2 py-1 rounded-md text-[#1F1F1F] dark:text-[#F5F5F5]"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation(); // لمنع الضغط مرتين لو الكارت كله قابل للضغط
                            navigate(`/jobs/${job._id}`); // 💡 التوجيه إلى مسار التفاصيل مع الـ ID
                          }}
                          className="text-xs font-bold text-[#8B5CF6] group-hover:underline focus:outline-none"
                        >
                          View Details &rarr;
                        </button>
                      </div>
                    </article>
                  ))
                )}

                {/* Pagination */}
                {totalPages > 1 && jobs.length > 0 && (
                  <div className="flex justify-center mt-4">
                    <div className="flex items-center gap-2 text-[#1F1F1F] dark:text-[#F5F5F5]">
                      <button
                        disabled={currentPage === 1}
                        onClick={() =>
                          setCurrentPage((prev) => Math.max(1, prev - 1))
                        }
                        className="w-10 h-10 rounded-xl flex items-center justify-center border border-[#1F1F1F]/10 dark:border-[#F5F5F5]/10 hover:bg-[#8B5CF6]/10 hover:text-[#8B5CF6] disabled:opacity-50 transition-colors"
                      >
                        <span className="material-icons-round">chevron_left</span>
                      </button>

                      {[...Array(totalPages)].map((_, idx) => {
                        const pageNum = idx + 1;
                        return (
                          <button
                            key={pageNum}
                            onClick={() => setCurrentPage(pageNum)}
                            className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold transition-colors ${currentPage === pageNum
                                ? "bg-[#8B5CF6] text-white shadow-md"
                                : "border border-[#1F1F1F]/10 dark:border-[#F5F5F5]/10 hover:bg-[#8B5CF6]/10 hover:text-[#8B5CF6]"
                              }`}
                          >
                            {pageNum}
                          </button>
                        );
                      })}

                      <button
                        disabled={currentPage === totalPages}
                        onClick={() =>
                          setCurrentPage((prev) => Math.min(totalPages, prev + 1))
                        }
                        className="w-10 h-10 rounded-xl flex items-center justify-center border border-[#1F1F1F]/10 dark:border-[#F5F5F5]/10 hover:bg-[#8B5CF6]/10 hover:text-[#8B5CF6] disabled:opacity-50 transition-colors"
                      >
                        <span className="material-icons-round">chevron_right</span>
                      </button>
                    </div>
                  </div>
                )}
              </main>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
