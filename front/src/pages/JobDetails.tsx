import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { type AxiosResponse, isAxiosError } from 'axios';
import axiosInstance from '../api/axiosInstance';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { updateProfile } from '../store/slices/authSlice';
import toast from 'react-hot-toast';
// 1. Interfaces
// ==========================================
export interface JobDetailType {
  _id: string;
  title: string;
  companyName: string;
  companyLogo: string;
  location: string;
  postedAt: string;
  projectType: string;
  salaryOrBudget: string;
  tags: string[];
  aboutJob: string;
  responsibilities: string[];
  requiredSkills: string[];
  companyDescription: string;
  matchPercentage: number;
  publisherId?: any;
}

interface JobDetailApiResponse {
  status: string;
  data: {
    job: JobDetailType;
  };
}

// ==========================================
// 2. Component
// ==========================================
export const JobDetails: React.FC = () => {
  const { jobId } = useParams<{ jobId: string }>(); // جلب الـ ID من الرابط
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { user } = useAppSelector(state => state.auth);

  // --- States ---
  const [job, setJob] = useState<JobDetailType | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // States for the Application Form
  const [applicationNote, setApplicationNote] = useState<string>('');
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [isSending, setIsSending] = useState<boolean>(false);
  const [hasApplied, setHasApplied] = useState<boolean>(false);

  // --- Fetch Job Details ---
  useEffect(() => {
    const fetchJobDetails = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const response: AxiosResponse<JobDetailApiResponse> = await axiosInstance.get(
          `/jobs/${jobId}`
        );

        const rawJob = response.data.data.job as any;
        const publisher = rawJob.publisherId || {};
        
        const formattedJob: JobDetailType = {
          _id: rawJob._id,
          title: rawJob.title || 'Untitled Job',
          companyName: publisher.companyName || publisher.fullName || 'Unknown Company',
          companyLogo: publisher.avatar || '',
          location: publisher.location || rawJob.location || 'Remote',
          postedAt: rawJob.createdAt || new Date().toISOString(),
          projectType: (rawJob.jobType || 'freelance').replace('_', '-').toUpperCase(),
          salaryOrBudget: rawJob.budgetOrSalary || 'Negotiable',
          tags: rawJob.requiredSkills || [],
          aboutJob: rawJob.description || 'No description provided.',
          responsibilities: rawJob.responsibilities || [],
          requiredSkills: rawJob.requiredSkills || [],
          companyDescription: publisher.industry || 'No company description available.',
          matchPercentage: (response.data.data as any).matchPercentage || 85,
        };

        setJob(formattedJob);
        // Read hasApplied from backend so the button is correct immediately on page load
        setHasApplied((response.data.data as any).hasApplied === true);
      } catch (err: unknown) {
        if (isAxiosError(err)) {
          const errorMessage = err.response?.data?.message || "Failed to load job details.";
          setError(errorMessage);
        } else {
          setError("An unexpected error occurred.");
        }
      } finally {
        setIsLoading(false);
      }
    };

    if (jobId) {
      fetchJobDetails();
    }
  }, [jobId]);

  // --- Handlers ---
  const isSaved = user?.savedProjects?.includes(job?._id || jobId);
  const [isSaving, setIsSaving] = useState(false);

  const handleSaveJob = async () => {
    const targetId = job?._id || jobId;
    if (!targetId) return;
    try {
      setIsSaving(true);
      const res = await axiosInstance.post(`/users/toggle-save-project/${targetId}`);
      dispatch(updateProfile(res.data.data.user));
      toast.success(res.data.message);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to save job.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleApply = async () => {
    try {
      setIsSending(true);

      const formData = new FormData();
      formData.append('note', applicationNote);
      if (cvFile) {
        formData.append('cv', cvFile);
      }
      
      // Send selected skills as JSON string if necessary, or omit if not required by backend anymore.
      await axiosInstance.post(`/jobs/${jobId}/apply`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      toast.success("Application submitted and sent to the employer via chat.");
      setHasApplied(true); // Immediately lock the button
      setIsModalOpen(false);
      setApplicationNote('');
      setCvFile(null);
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to send application. Please try again.");
    } finally {
      setIsSending(false);
    }
  };

  // --- Render States ---
  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-background-light dark:bg-background-dark h-full">
         <span className="material-icons-round text-brand-light text-4xl animate-spin mb-4">refresh</span>
         <p className="text-gray-500 animate-pulse">Loading job details...</p>
      </div>
    );
  }

  if (error || !job) {
    return (
       <div className="flex-1 flex flex-col items-center justify-center bg-background-light dark:bg-background-dark h-full">
         <div className="p-10 bg-red-50 dark:bg-red-900/10 rounded-3xl border border-red-100 dark:border-red-900/30 text-center">
            <span className="material-icons-round text-red-500 text-4xl mb-4">error_outline</span>
            <p className="text-red-600 dark:text-red-400 font-medium">{error || "Job not found"}</p>
            <button onClick={() => navigate('/jobs')} className="mt-4 text-brand-light hover:underline font-medium">
              &larr; Back to Jobs
            </button>
         </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-[#FAFAFA] dark:bg-[#171717]">
      <div className="max-w-6xl mx-auto p-6 md:p-10">
        
        {/* Top: Back Link */}
        <button onClick={() => navigate('/jobs')} className="mb-6 flex items-center gap-2 text-sm text-gray-500 hover:text-[#7C3AED] transition-colors">
          <span className="material-icons-round text-base">arrow_back</span>
          Back to Jobs
        </button>

        {/* 2-Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-11 gap-8">
          
          {/* 🟢 LEFT COLUMN (7 cols) */}
          <div className="lg:col-span-7 space-y-8">
            
            {/* Header: Badges, Title, Meta */}
            <div>
              <div className="flex gap-3 mb-4">
                <span className="px-3 py-1 bg-green-100 text-green-700 text-xs font-bold rounded-full">OPEN</span>
                <span className="px-3 py-1 bg-[#7C3AED]/10 text-[#7C3AED] text-xs font-bold rounded-full">{job.projectType}</span>
                <span className="px-3 py-1 bg-gray-100 dark:bg-white/10 text-gray-700 dark:text-gray-300 text-xs font-bold rounded-full">{job.location}</span>
              </div>
              <h1 className="text-3xl md:text-4xl font-bold text-[#171717] dark:text-[#F5F5F5] mb-4">
                {job.title}
              </h1>
              <p className="text-gray-500 dark:text-gray-400 text-sm flex items-center gap-2">
                Posted {new Date(job.postedAt).toLocaleDateString()} &bull; {job.matchPercentage || 24} proposals received
              </p>
            </div>

            <hr className="border-gray-200 dark:border-white/5" />

            {/* Sections */}
            <section>
              <h2 className="text-xl font-bold mb-4 text-[#171717] dark:text-[#F5F5F5]">Job Description</h2>
              <p className="text-gray-600 dark:text-gray-400 leading-relaxed whitespace-pre-line">{job.aboutJob}</p>
            </section>

            <section>
              <h2 className="text-xl font-bold mb-4 text-[#171717] dark:text-[#F5F5F5]">Key Responsibilities</h2>
              <ul className="space-y-3">
                {job.responsibilities.map((resp, i) => (
                  <li key={i} className="flex items-start gap-3 text-gray-600 dark:text-gray-400">
                    <span className="material-icons-round text-[#7C3AED] text-xl mt-0.5 shrink-0">check_circle</span>
                    <span>{resp}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-bold mb-4 text-[#171717] dark:text-[#F5F5F5]">Requirements</h2>
              <ul className="list-disc list-inside space-y-2 text-gray-600 dark:text-gray-400">
                 <li>Proven experience in the field</li>
                 <li>Strong communication skills</li>
                 <li>Ability to work independently</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-bold mb-4 text-[#171717] dark:text-[#F5F5F5]">Required Skills</h2>
              <div className="flex flex-wrap gap-2">
                {job.tags.map(skill => (
                  <span key={skill} className="px-4 py-2 bg-[#F3E8FF] dark:bg-[#7C3AED]/20 text-[#7C3AED] dark:text-[#A78BFA] text-sm font-semibold rounded-lg">
                    {skill}
                  </span>
                ))}
              </div>
            </section>

            {/* About the Client Card */}
            <div className="bg-gray-50 dark:bg-[#262626] border border-gray-200 dark:border-white/10 rounded-2xl p-6 flex items-start gap-5">
              <div className="w-16 h-16 bg-[#7C3AED] rounded-full text-white flex items-center justify-center font-bold text-2xl shrink-0 overflow-hidden">
                {job.companyLogo ? <img src={job.companyLogo} className="w-full h-full object-cover" /> : job.companyName.charAt(0)}
              </div>
              <div>
                <h3 className="text-lg font-bold text-[#171717] dark:text-[#F5F5F5]">{job.companyName}</h3>
                <p className="text-gray-500 text-sm mb-3">{job.companyDescription} &bull; {job.location}</p>
                <div className="flex gap-4 text-sm font-medium text-gray-700 dark:text-gray-300">
                  <span>Member since 2020</span>
                  <span>&bull;</span>
                  <span>42 jobs posted</span>
                </div>
              </div>
            </div>

          </div>

          {/* 🟢 RIGHT COLUMN (4 cols - Sticky Sidebar) */}
          <div className="lg:col-span-4">
            <div className="sticky top-10 bg-white dark:bg-[#262626] rounded-2xl p-6 shadow-xl shadow-gray-200/50 dark:shadow-none border border-gray-100 dark:border-white/5">
              <h3 className="text-xl font-bold mb-6 text-[#171717] dark:text-[#F5F5F5]">Job Summary</h3>
              
              <div className="space-y-5 mb-8">
                <div className="flex items-center gap-4 text-gray-600 dark:text-gray-400">
                  <span className="material-icons-round text-[#7C3AED] p-3 bg-[#7C3AED]/10 rounded-xl">payments</span>
                  <div>
                    <p className="text-xs text-gray-400 uppercase font-bold">Salary Range</p>
                    <p className="font-semibold text-[#171717] dark:text-[#F5F5F5]">{job.salaryOrBudget}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-gray-600 dark:text-gray-400">
                  <span className="material-icons-round text-[#7C3AED] p-3 bg-[#7C3AED]/10 rounded-xl">calendar_today</span>
                  <div>
                    <p className="text-xs text-gray-400 uppercase font-bold">Posted Date</p>
                    <p className="font-semibold text-[#171717] dark:text-[#F5F5F5]">{new Date(job.postedAt).toLocaleDateString()}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-gray-600 dark:text-gray-400">
                  <span className="material-icons-round text-[#7C3AED] p-3 bg-[#7C3AED]/10 rounded-xl">public</span>
                  <div>
                    <p className="text-xs text-gray-400 uppercase font-bold">Location Type</p>
                    <p className="font-semibold text-[#171717] dark:text-[#F5F5F5]">{job.projectType}</p>
                  </div>
                </div>
              </div>

              <div className="flex justify-between py-4 border-y border-gray-100 dark:border-white/5 mb-6 text-sm font-bold">
                <div className="text-center w-1/2 border-r border-gray-100 dark:border-white/5">
                  <span className="text-gray-400 block text-xs">VIEWS</span>
                  <span className="text-[#171717] dark:text-[#F5F5F5] text-lg">342</span>
                </div>
                <div className="text-center w-1/2">
                  <span className="text-gray-400 block text-xs">APPLICANTS</span>
                  <span className="text-[#7C3AED] text-lg">{job.matchPercentage || 24}</span>
                </div>
              </div>

              <div className="space-y-3">
                {user?.role === 'freelancer' && (
                  <>
                    <button 
                      onClick={() => !hasApplied && setIsModalOpen(true)}
                      disabled={hasApplied}
                      className={`w-full py-4 rounded-xl font-bold transition-all ${
                        hasApplied
                          ? 'bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed opacity-70 flex items-center justify-center gap-2'
                          : 'bg-[#7C3AED] hover:bg-[#6D28D9] text-white shadow-lg shadow-[#7C3AED]/20'
                      }`}
                    >
                      {hasApplied ? (
                        <>
                          <span className="material-icons-round text-[18px]">check_circle</span>
                          Already Applied
                        </>
                      ) : 'Apply Now'}
                    </button>
                    <button 
                      onClick={handleSaveJob} 
                      disabled={isSaving}
                      className="w-full py-4 bg-transparent border-2 border-gray-200 dark:border-gray-700 hover:border-[#7C3AED] dark:hover:border-[#8B5CF6] text-gray-700 dark:text-gray-300 font-bold rounded-xl transition-all flex items-center justify-center gap-2"
                    >
                      <span className="material-icons-round">{isSaved ? 'bookmark' : 'bookmark_border'}</span>
                      {isSaved ? 'Saved' : 'Save Job'}
                    </button>
                  </>
                )}

                {user?.role === 'employer' && user?._id === job.publisherId?._id && (
                  <Link 
                    to={`/jobs/${jobId}/applicants`}
                    className="w-full py-4 bg-[#7C3AED] hover:bg-[#6D28D9] text-white rounded-xl font-bold transition-all shadow-lg shadow-[#7C3AED]/20 flex items-center justify-center gap-2"
                  >
                    <span className="material-icons-round">group</span>
                    View Applicants
                  </Link>
                )}
              </div>
              
            </div>
          </div>

        </div>
      </div>

      {/* Apply Now Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#262626] rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden border border-gray-100 dark:border-white/5 animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-gray-100 dark:border-white/5 flex justify-between items-center">
              <h3 className="text-xl font-bold text-[#171717] dark:text-[#F5F5F5] flex items-center gap-2">
                <span className="material-icons-round text-[#7C3AED]">send</span>
                Apply for {job.title}
              </h3>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-red-500 transition-colors"
              >
                <span className="material-icons-round">close</span>
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              <div className="space-y-3">
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">
                  Upload CV / Resume <span className="text-red-500">*</span>
                </label>
                <div className="flex items-center justify-center w-full">
                  <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-xl cursor-pointer bg-gray-50 dark:hover:bg-bray-800 dark:bg-[#171717] hover:bg-gray-100 dark:border-gray-600 dark:hover:border-gray-500 dark:hover:bg-gray-800 transition-all">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <span className="material-icons-round text-3xl text-gray-400 mb-2">cloud_upload</span>
                      <p className="mb-2 text-sm text-gray-500 dark:text-gray-400 font-semibold">Click to upload or drag and drop</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">PDF, DOC, DOCX (MAX. 10MB)</p>
                    </div>
                    <input 
                      type="file" 
                      className="hidden" 
                      accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                      onChange={(e) => setCvFile(e.target.files ? e.target.files[0] : null)}
                    />
                  </label>
                </div>
                {cvFile && (
                  <p className="text-sm text-[#7C3AED] font-medium flex items-center gap-2">
                    <span className="material-icons-round text-[16px]">description</span>
                    {cvFile.name}
                  </p>
                )}
              </div>

              <div className="space-y-3">
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">
                  Cover Letter / Notes
                </label>
                <textarea 
                  value={applicationNote}
                  onChange={(e) => setApplicationNote(e.target.value)}
                  placeholder="Why are you a great fit for this role?" 
                  rows={4}
                  className="w-full bg-[#FAFAFA] dark:bg-[#171717] text-sm p-4 rounded-xl border border-gray-200 dark:border-white/10 outline-none focus:border-[#7C3AED] dark:focus:border-[#8B5CF6] text-[#171717] dark:text-[#F5F5F5] transition-all resize-none"
                ></textarea>
              </div>
            </div>

            <div className="p-6 border-t border-gray-100 dark:border-white/5 flex justify-end gap-3 bg-gray-50 dark:bg-[#171717]">
              <button 
                onClick={() => setIsModalOpen(false)}
                className="px-6 py-2.5 rounded-xl font-bold text-gray-600 hover:bg-gray-200 dark:text-gray-300 dark:hover:bg-white/10 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleApply}
                disabled={isSending || !cvFile}
                className="px-6 py-2.5 rounded-xl font-bold bg-[#7C3AED] text-white hover:bg-[#6D28D9] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2 shadow-lg shadow-[#7C3AED]/20"
              >
                {isSending ? (
                  <>
                    <span className="material-icons-round animate-spin text-[18px]">refresh</span>
                    Sending...
                  </>
                ) : (
                  <>
                    <span className="material-icons-round text-[18px]">send</span>
                    Send Application
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};