import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

// ==========================================
// Interfaces
// ==========================================
interface ClientInfo {
  name: string;
  avatar: string;
  industry: string;
  location: string;
  memberSince: string;
  jobsPosted: number;
}

interface ProjectData {
  _id: string;
  title: string;
  status: 'Open' | 'Closed' | 'In Progress';
  category: string;
  locationType: string;
  postedAt: string;
  proposalsCount: number;
  description: string;
  responsibilities: string[];
  requirements: string[];
  skills: string[];
  salary: string;
  views: number;
  applicants: number;
  client: ClientInfo;
}

// ==========================================
// Component
// ==========================================
export const ProjectDetails: React.FC = () => {
  const navigate = useNavigate();
  const { projectId } = useParams();

  // TODO (Backend): جلب تفاصيل المشروع
  // useEffect(() => {
  //   axios.get(`/api/projects/${projectId}`).then(res => setProject(res.data));
  // }, [projectId]);

  const [project] = useState<ProjectData | null>(null);



  if (!project) {
    return (
      <main className="flex-1 overflow-y-auto relative custom-scrollbar bg-[#FAFAFA] dark:bg-[#171717]">
        <div className="max-w-7xl mx-auto px-6 py-12">
          <button onClick={() => navigate('/jobs')} className="inline-flex items-center gap-2 text-[#8B5CF6] font-bold transition-all duration-300 w-fit group hover:-translate-x-1 mb-8">
            <span className="material-icons-round text-xl">arrow_back</span>
            Back to Jobs
          </button>
          <div className="flex flex-col items-center justify-center min-h-[50vh]">
            <div className="w-20 h-20 bg-[#7C3AED]/10 dark:bg-[#8B5CF6]/20 rounded-full flex items-center justify-center mb-4">
              <span className="material-icons-round text-4xl text-[#7C3AED] dark:text-[#8B5CF6]">work_outline</span>
            </div>
            <p className="text-lg font-bold text-gray-400 dark:text-gray-500 mb-2">Project not found</p>
            <p className="text-sm text-gray-300 dark:text-gray-600">This project may be loading or unavailable.</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 overflow-y-auto relative custom-scrollbar bg-[#FAFAFA] dark:bg-[#171717]">
      {/* Gradient Accent */}
      <div className="absolute top-0 left-0 w-full h-72 bg-gradient-to-b from-[#8B5CF6]/10 to-transparent z-0 pointer-events-none"></div>

      <div className="relative max-w-7xl mx-auto px-6 py-12 z-10">
        {/* Back */}
        <button onClick={() => navigate('/jobs')} className="inline-flex items-center gap-2 text-[#8B5CF6] font-bold transition-all duration-300 w-fit group hover:-translate-x-1 mb-8">
          <span className="material-icons-round text-xl">arrow_back</span>
          Back to Jobs
        </button>

        <div className="flex flex-col lg:flex-row gap-8">
          {/* Left - Job Description */}
          <div className="w-full lg:w-[65%] flex flex-col gap-8">
            <article className="bg-white dark:bg-[#1E1E1E] rounded-3xl shadow-lg border border-[#8B5CF6]/5 dark:border-[#8B5CF6]/10 p-10 transition-all duration-500 relative overflow-hidden">
              {/* Top accent */}
              <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-[#8B5CF6]/50 to-transparent"></div>

              {/* Status Badges */}
              <div className="mb-6">
                <div className="flex flex-wrap gap-3 mb-5">
                  <span className={`text-xs px-3 py-1.5 rounded-lg font-bold uppercase tracking-wider shadow-sm border ${
                    project.status === 'Open'
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800'
                      : project.status === 'In Progress'
                      ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800'
                      : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400 border-gray-200 dark:border-gray-700'
                  }`}>{project.status}</span>
                  <span className="bg-[#8B5CF6]/10 text-[#8B5CF6] border border-[#8B5CF6]/20 text-xs px-3 py-1.5 rounded-lg font-bold shadow-sm">{project.category}</span>
                  <span className="bg-[#1F1F1F]/5 dark:bg-[#F5F5F5]/10 text-[#1F1F1F] dark:text-[#F5F5F5] border border-[#1F1F1F]/10 dark:border-[#F5F5F5]/10 text-xs px-3 py-1.5 rounded-lg font-bold shadow-sm">{project.locationType}</span>
                </div>

                <h1 className="text-3xl sm:text-4xl font-bold mb-3 tracking-tight leading-tight text-[#171717] dark:text-[#F5F5F5]">{project.title}</h1>
                <p className="text-base opacity-70 font-medium tracking-wide">{project.postedAt} • {project.proposalsCount} proposals received</p>
              </div>

              <hr className="border-[#1F1F1F]/10 dark:border-[#F5F5F5]/10 my-8" />

              {/* Description */}
              <div>
                <h3 className="text-2xl font-bold mb-4 tracking-tight text-[#171717] dark:text-[#F5F5F5]">Job Description</h3>
                <p className="leading-loose mb-8 text-lg font-light text-[#171717] dark:text-[#F5F5F5]">{project.description}</p>

                {project.responsibilities.length > 0 && (
                  <>
                    <h4 className="text-xl font-bold mb-4 tracking-tight text-[#171717] dark:text-[#F5F5F5]">Key Responsibilities:</h4>
                    <ul className="space-y-4 mb-8">
                      {project.responsibilities.map((item, i) => (
                        <li key={i} className="flex items-start gap-3">
                          <span className="material-icons-round text-[#8B5CF6] shrink-0 mt-0.5">check_circle</span>
                          <span className="text-lg font-light leading-relaxed">{item}</span>
                        </li>
                      ))}
                    </ul>
                  </>
                )}

                {project.requirements.length > 0 && (
                  <>
                    <h4 className="text-xl font-bold mb-4 tracking-tight text-[#171717] dark:text-[#F5F5F5]">Requirements:</h4>
                    <ul className="space-y-4 mb-8">
                      {project.requirements.map((item, i) => (
                        <li key={i} className="flex items-start gap-3">
                          <span className="material-icons-round text-[#8B5CF6] shrink-0 mt-0.5">arrow_right</span>
                          <span className="text-lg font-light leading-relaxed">{item}</span>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>

              <hr className="border-[#1F1F1F]/10 dark:border-[#F5F5F5]/10 my-8" />

              {/* Skills */}
              <div>
                <h3 className="text-2xl font-bold mb-6 tracking-tight text-[#171717] dark:text-[#F5F5F5]">Required Skills</h3>
                <div className="flex flex-wrap gap-3">
                  {project.skills.map((skill, i) => (
                    <span key={i} className="bg-[#8B5CF6]/10 text-[#8B5CF6] border border-[#8B5CF6]/20 rounded-xl px-5 py-2 text-sm font-bold shadow-sm">{skill}</span>
                  ))}
                </div>
              </div>

              <hr className="border-[#1F1F1F]/10 dark:border-[#F5F5F5]/10 my-8" />

              {/* About Client */}
              <div>
                <h3 className="text-2xl font-bold mb-6 tracking-tight text-[#171717] dark:text-[#F5F5F5]">About the Client</h3>
                <div className="bg-[#FAFAFA] dark:bg-[#121212] rounded-2xl p-6 flex flex-col sm:flex-row items-center sm:items-start gap-6 border border-[#1F1F1F]/5 dark:border-[#F5F5F5]/5 shadow-inner">
                  <div className="p-1 bg-gradient-to-br from-[#8B5CF6]/20 to-[#8B5CF6]/5 rounded-2xl shrink-0">
                    <img src={project.client.avatar} alt={project.client.name} className="w-16 h-16 rounded-2xl object-cover border-2 border-white dark:border-[#1E1E1E]" />
                  </div>
                  <div className="flex-grow text-center sm:text-left">
                    <h4
                      onClick={() => navigate(`/employer/${project.client.name}`)}
                      className="font-bold text-xl hover:text-[#8B5CF6] transition-colors cursor-pointer tracking-tight mb-1 text-[#171717] dark:text-[#F5F5F5]"
                    >{project.client.name}</h4>
                    <p className="text-sm opacity-70 mb-3 font-medium">{project.client.industry} • {project.client.location}</p>
                    <div className="flex flex-wrap justify-center sm:justify-start items-center gap-4 text-sm font-bold opacity-90">
                      <span className="bg-[#8B5CF6]/10 text-[#8B5CF6] px-3 py-1 rounded-md">{project.client.memberSince}</span>
                      <span>{project.client.jobsPosted} jobs posted</span>
                    </div>
                  </div>
                </div>
              </div>
            </article>
          </div>

          {/* Right Sidebar - Job Summary */}
          <aside className="w-full lg:w-[35%]">
            <div className="sticky top-8 flex flex-col gap-6">
              <div className="bg-white dark:bg-[#1E1E1E] rounded-3xl shadow-lg border border-[#8B5CF6]/5 dark:border-[#8B5CF6]/10 p-8 transition-all duration-500">
                <h3 className="text-2xl font-bold mb-6 tracking-tight border-b-2 border-[#1F1F1F]/5 dark:border-[#F5F5F5]/5 pb-4 text-[#171717] dark:text-[#F5F5F5]">Job Summary</h3>

                <div className="flex flex-col gap-6 mb-8">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-[#8B5CF6]/10 flex items-center justify-center text-[#8B5CF6] shrink-0">
                      <span className="material-icons-round text-xl">payments</span>
                    </div>
                    <div>
                      <p className="text-xs font-bold opacity-60 uppercase tracking-wider mb-0.5">Salary Range</p>
                      <p className="text-base font-bold text-[#171717] dark:text-[#F5F5F5]">{project.salary}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-[#8B5CF6]/10 flex items-center justify-center text-[#8B5CF6] shrink-0">
                      <span className="material-icons-round text-xl">calendar_today</span>
                    </div>
                    <div>
                      <p className="text-xs font-bold opacity-60 uppercase tracking-wider mb-0.5">Posted Date</p>
                      <p className="text-base font-bold text-[#171717] dark:text-[#F5F5F5]">{project.postedAt}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-[#8B5CF6]/10 flex items-center justify-center text-[#8B5CF6] shrink-0">
                      <span className="material-icons-round text-xl">public</span>
                    </div>
                    <div>
                      <p className="text-xs font-bold opacity-60 uppercase tracking-wider mb-0.5">Location Type</p>
                      <p className="text-base font-bold text-[#171717] dark:text-[#F5F5F5]">{project.locationType}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-4 border-t-2 border-[#1F1F1F]/5 dark:border-[#F5F5F5]/5 mt-2">
                    <div>
                      <p className="text-xs font-bold opacity-60 uppercase tracking-wider mb-0.5">Views</p>
                      <p className="text-lg font-bold text-[#171717] dark:text-[#F5F5F5]">{project.views}</p>
                    </div>
                    <div>
                      <p className="text-xs font-bold opacity-60 uppercase tracking-wider mb-0.5">Applicants</p>
                      <p className="text-lg font-bold text-[#8B5CF6]">{project.applicants}</p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-4">
                  <button className="w-full bg-[#8B5CF6] hover:bg-[#8B5CF6]/90 text-white py-4 rounded-xl font-bold text-lg transition-all duration-300 shadow-lg hover:-translate-y-0.5">
                    Apply Now
                  </button>
                  <button className="w-full border-2 border-[#1F1F1F]/10 dark:border-[#F5F5F5]/10 hover:border-[#8B5CF6] hover:text-[#8B5CF6] py-4 rounded-xl font-bold transition-all duration-300 text-[#171717] dark:text-[#F5F5F5]">
                    Save Job
                  </button>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
};
