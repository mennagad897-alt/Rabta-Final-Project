import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axiosInstance from '../../api/axiosInstance';
import toast from 'react-hot-toast';

interface Employer {
  _id: string;
  fullName: string;
  companyName?: string;
  email: string;
  socialLinks?: {
    linkedin?: string;
  };
  verificationLink?: string;
}

export const AdminVerifications = () => {
  const [employers, setEmployers] = useState<Employer[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchPendingEmployers();
  }, []);

  const fetchPendingEmployers = async () => {
    try {
      setLoading(true);
      const { data } = await axiosInstance.get('/admin/pending-employers');
      setEmployers(data.data.employers);
    } catch (error) {
      console.error('Error fetching pending employers:', error);
      toast.error('Failed to load pending employers');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id: string) => {
    try {
      await axiosInstance.patch(`/admin/verify-employer/${id}`);
      setEmployers((prev) => prev.filter((emp) => emp._id !== id));
      toast.success('Employer approved successfully');
    } catch (error) {
      console.error('Error approving employer:', error);
      toast.error('Failed to approve employer');
    }
  };

  const handleReject = async (id: string) => {
    const reason = window.prompt("Enter a reason for rejection:");
    if (reason === null) return; // User cancelled
    if (reason.trim() === '') {
      toast.error('Rejection reason cannot be empty');
      return;
    }
    
    try {
      await axiosInstance.patch(`/admin/reject-employer/${id}`, { reason });
      setEmployers((prev) => prev.filter((emp) => emp._id !== id));
      toast.success('Employer rejected successfully');
    } catch (error) {
      console.error('Error rejecting employer:', error);
      toast.error('Failed to reject employer');
    }
  };

  if (loading) {
    return <div className="p-8 text-gray-900 dark:text-white">Loading verification requests...</div>;
  }

  return (
    <div>
      <div className="mb-6 flex items-center gap-4">
        <button 
          onClick={() => navigate(-1)}
          className="flex items-center justify-center w-10 h-10 rounded-full bg-white dark:bg-[#141419] border border-gray-200 dark:border-white/5 text-zinc-400 hover:text-gray-900 dark:hover:text-white transition-colors shadow-sm"
          title="Go Back"
        >
          <i className="fa-solid fa-arrow-left text-lg"></i>
        </button>
        <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Employer Verification Requests</h2>
      </div>
      
      {employers.length === 0 ? (
        <div className="bg-white dark:bg-[#141419] rounded-2xl p-8 text-center border border-gray-200 dark:border-white/5 shadow-sm">
          <i className="fa-solid fa-check-circle text-4xl text-green-500 mb-4"></i>
          <p className="text-gray-500 dark:text-gray-400 font-medium">No pending verification requests at the moment.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {employers.map((employer) => {
            const linkedinUrl = employer.socialLinks?.linkedin || employer.verificationLink;
            
            return (
              <div key={employer._id} className="bg-white dark:bg-[#141419] p-6 rounded-2xl border border-gray-200 dark:border-white/5 shadow-sm transition-all hover:shadow-md flex flex-col">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-purple-600 dark:text-purple-400 text-xl font-bold">
                      {employer.fullName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900 dark:text-white text-lg">{employer.fullName}</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{employer.companyName || 'No Company Name'}</p>
                    </div>
                  </div>
                  
                  <div className="space-y-2 mb-6">
                    <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                      <i className="fa-solid fa-envelope w-4"></i>
                      <span>{employer.email}</span>
                    </div>
                    {linkedinUrl ? (
                      <div className="flex items-center gap-2 text-sm text-blue-500 hover:text-blue-600">
                        <i className="fa-brands fa-linkedin w-4"></i>
                        <a href={linkedinUrl} target="_blank" rel="noopener noreferrer" className="underline font-medium">
                          View LinkedIn Profile
                        </a>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-sm text-yellow-600 dark:text-yellow-500">
                        <i className="fa-solid fa-triangle-exclamation w-4"></i>
                        <span>No LinkedIn URL provided</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-auto pt-4 border-t border-gray-100 dark:border-white/5 flex gap-3">
                  <button 
                    onClick={() => handleReject(employer._id)}
                    className="flex-1 bg-red-50 hover:bg-red-100 text-red-600 dark:bg-red-900/20 dark:hover:bg-red-900/40 dark:text-red-400 rounded-lg px-4 py-2 text-sm font-bold transition-colors flex items-center justify-center gap-2"
                  >
                    <i className="fa-solid fa-xmark"></i>
                    Reject
                  </button>
                  <button 
                    onClick={() => handleApprove(employer._id)}
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white rounded-lg px-4 py-2 text-sm font-bold transition-colors flex items-center justify-center gap-2 shadow-sm"
                  >
                    <i className="fa-solid fa-check"></i>
                    Approve
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
