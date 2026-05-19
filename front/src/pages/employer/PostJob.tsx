import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { Input } from '../../components/ui/Input';
import axiosInstance from '../../api/axiosInstance';
import toast from 'react-hot-toast';
import { useAppSelector, useAppDispatch } from '../../store/hooks';
import { updateProfile } from '../../store/slices/authSlice';

interface PostJobInputs {
  title: string;
  description: string;
  skills: string;
  budget: string;
}

export const PostJob: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { user } = useAppSelector(state => state.auth);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<PostJobInputs>();

  const [verificationLink, setVerificationLink] = useState('');
  const [isSubmittingLink, setIsSubmittingLink] = useState(false);

  const onSubmit = async (data: PostJobInputs) => {
    try {
      const payload = {
        title: data.title,
        description: data.description,
        jobType: 'full_time', // default for now
        requiredSkills: data.skills.split(',').map(s => s.trim()).filter(Boolean),
        budgetOrSalary: data.budget
      };

      await axiosInstance.post('/jobs', payload);
      toast.success('Job posted successfully!');
      navigate('/employer-dashboard');
    } catch (error) {
      console.error('Failed to post job:', error);
      toast.error('Failed to post job. Please try again.');
    }
  };

  const handleVerificationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verificationLink.trim()) {
      return toast.error('Please enter a valid link');
    }

    try {
      setIsSubmittingLink(true);
      const res = await axiosInstance.put('/users/verify-request', { verificationLink });
      dispatch(updateProfile(res.data.data.user));
      toast.success('Verification link submitted successfully!');
    } catch (error: any) {
      console.error('Verification error:', error);
      toast.error(error.response?.data?.message || 'Failed to submit verification request.');
    } finally {
      setIsSubmittingLink(false);
    }
  };

  const renderContent = () => {
    if (user?.role === 'employer' && !user?.isVerified) {
      if (user?.verificationLink) {
        // Pending State
        return (
          <div className="bg-white dark:bg-[#262626] rounded-2xl shadow-sm border border-orange-200 dark:border-orange-900/50 p-8 text-center">
            <div className="w-16 h-16 bg-orange-100 dark:bg-orange-900/20 text-orange-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="material-icons-round text-3xl">hourglass_empty</span>
            </div>
            <h2 className="text-2xl font-bold mb-2">Verification Pending</h2>
            <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto mb-6">
              Thank you! Your link has been submitted for review.
            </p>
            <button 
              onClick={() => navigate('/employer-dashboard')}
              className="px-6 py-2.5 bg-gray-100 dark:bg-[#1f1f1f] hover:bg-gray-200 dark:hover:bg-[#2a2a2a] rounded-xl font-semibold transition-colors"
            >
              Return to Dashboard
            </button>
          </div>
        );
      }

      // Needs Verification Link State
      return (
        <div className="bg-white dark:bg-[#262626] rounded-2xl shadow-sm border border-gray-100 dark:border-white/5 p-8 text-center">
           <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/20 text-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="material-icons-round text-3xl">verified_user</span>
            </div>
          <h2 className="text-2xl font-bold mb-2">Account Verification Required</h2>
          <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto mb-6">
            Welcome to Rabta! To maintain the quality of opportunities for our youth, please provide us with your company's website or LinkedIn page to verify your account. Verification usually takes less than 24 hours.
          </p>
          <form onSubmit={handleVerificationSubmit} className="max-w-sm mx-auto space-y-4">
            <Input 
              id="verificationLink"
              label="Website or LinkedIn URL"
              type="url"
              placeholder="https://linkedin.com/company/..."
              value={verificationLink}
              onChange={(e) => setVerificationLink(e.target.value)}
              required
            />
            <button 
              type="submit"
              disabled={isSubmittingLink}
              className="w-full px-6 py-3 bg-[#7C3AED] hover:bg-[#6D28D9] text-white rounded-xl font-bold shadow-lg shadow-purple-200 dark:shadow-none transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isSubmittingLink ? 'Submitting...' : 'Submit for Verification'}
            </button>
          </form>
        </div>
      );
    }

    // Normal Post Job Form
    return (
      <div className="bg-white dark:bg-[#262626] rounded-2xl shadow-sm border border-gray-100 dark:border-white/5 p-6 md:p-8">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <Input 
            label="Job Title" 
            id="title" 
            type="text" 
            placeholder="e.g. Senior Frontend Engineer" 
            {...register('title', { required: 'Job Title is required' })} 
            error={errors.title?.message} 
          />

          <div className="flex flex-col gap-1.5">
            <label htmlFor="description" className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              Description
            </label>
            <textarea 
              id="description"
              rows={5}
              placeholder="Describe the responsibilities, requirements, and benefits..."
              {...register('description', { required: 'Description is required' })}
              className="w-full rounded-xl border border-gray-200 dark:border-gray-800 bg-[#FAFAFA] dark:bg-[#1f1f1f] px-4 py-3 text-sm text-[#171717] dark:text-[#F5F5F5] focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/20 focus:border-[#7C3AED] transition-all resize-y"
            ></textarea>
            {errors.description && <span className="text-sm text-red-500">{errors.description.message}</span>}
          </div>

          <Input 
            label="Required Skills (comma separated)" 
            id="skills" 
            type="text" 
            placeholder="e.g. React, Node.js, TypeScript" 
            {...register('skills', { required: 'Skills are required' })} 
            error={errors.skills?.message} 
          />

          <Input 
            label="Budget / Salary" 
            id="budget" 
            type="text" 
            placeholder="e.g. $5000 - $7000 / month or $50/hr" 
            {...register('budget', { required: 'Budget is required' })} 
            error={errors.budget?.message} 
          />

          <div className="pt-4 border-t border-gray-100 dark:border-gray-800 flex justify-end gap-3">
            <button 
              type="button"
              onClick={() => navigate('/employer-dashboard')}
              className="px-6 py-3 font-bold text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[#1f1f1f] rounded-xl transition-all"
            >
              Cancel
            </button>
            <button 
              type="submit"
              disabled={isSubmitting}
              className="px-8 py-3 bg-[#7C3AED] hover:bg-[#6D28D9] text-white rounded-xl font-bold shadow-lg shadow-purple-200 dark:shadow-none transition-all flex items-center gap-2 disabled:opacity-50"
            >
              <span className="material-icons-round text-sm">publish</span>
              {isSubmitting ? 'Posting...' : 'Post Job'}
            </button>
          </div>
        </form>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#FAFAFA] dark:bg-[#171717] text-[#171717] dark:text-[#F5F5F5] transition-colors duration-300 font-sans p-4 md:p-8">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <button 
            onClick={() => navigate('/employer-dashboard')}
            className="w-10 h-10 rounded-xl bg-white dark:bg-[#262626] flex items-center justify-center hover:bg-gray-100 dark:hover:bg-[#1f1f1f] transition-colors shadow-sm border border-gray-100 dark:border-white/5"
          >
            <span className="material-icons-round">arrow_back</span>
          </button>
          <div>
            <h1 className="text-3xl font-black tracking-tight">Post New Job</h1>
            <p className="text-gray-500 dark:text-gray-400 font-medium">Create a new opportunity to find the best talent.</p>
          </div>
        </div>

        {renderContent()}
      </div>
    </div>
  );
};

export default PostJob;
