import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router-dom';
import { Input } from '../../components/ui/Input';
import axiosInstance from '../../api/axiosInstance';
import toast from 'react-hot-toast';

interface EditJobInputs {
  title: string;
  description: string;
  skills: string;
  budget: string;
}

export const EditProject: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const { register, handleSubmit, formState: { errors, isSubmitting }, setValue } = useForm<EditJobInputs>();

  useEffect(() => {
    const fetchJob = async () => {
      try {
        const response = await axiosInstance.get(`/jobs/${id}`);
        const job = response.data.data.job;
        setValue('title', job.title);
        setValue('description', job.description);
        setValue('skills', job.requiredSkills?.join(', ') || '');
        setValue('budget', job.budgetOrSalary || '');
      } catch (error) {
        toast.error("Failed to fetch project details.");
        navigate('/employer-dashboard');
      } finally {
        setIsLoading(false);
      }
    };
    if (id) fetchJob();
  }, [id, setValue, navigate]);

  const onSubmit = async (data: EditJobInputs) => {
    try {
      const payload = {
        title: data.title,
        description: data.description,
        requiredSkills: data.skills.split(',').map(s => s.trim()).filter(Boolean),
        budgetOrSalary: data.budget
      };

      await axiosInstance.patch(`/jobs/${id}`, payload);
      toast.success('Project updated successfully!');
      navigate(`/manage-project/${id}`);
    } catch (error) {
      console.error('Failed to update project:', error);
      toast.error('Failed to update project.');
    }
  };

  if (isLoading) {
    return <div className="p-8 text-center text-gray-500 animate-pulse">Loading project details...</div>;
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA] dark:bg-[#171717] text-[#171717] dark:text-[#F5F5F5] transition-colors duration-300 font-sans p-4 md:p-8">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <button 
            onClick={() => navigate(`/manage-project/${id}`)}
            className="w-10 h-10 rounded-xl bg-white dark:bg-[#262626] flex items-center justify-center hover:bg-gray-100 dark:hover:bg-[#1f1f1f] transition-colors shadow-sm border border-gray-100 dark:border-white/5"
          >
            <span className="material-icons-round">arrow_back</span>
          </button>
          <div>
            <h1 className="text-3xl font-black tracking-tight">Edit Project</h1>
            <p className="text-gray-500 dark:text-gray-400 font-medium">Update the details of your opportunity.</p>
          </div>
        </div>

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
                onClick={() => navigate(`/manage-project/${id}`)}
                className="px-6 py-3 font-bold text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[#1f1f1f] rounded-xl transition-all"
              >
                Cancel
              </button>
              <button 
                type="submit"
                disabled={isSubmitting}
                className="px-8 py-3 bg-[#7C3AED] hover:bg-[#6D28D9] text-white rounded-xl font-bold shadow-lg shadow-purple-200 dark:shadow-none transition-all flex items-center gap-2 disabled:opacity-50"
              >
                <span className="material-icons-round text-sm">save</span>
                {isSubmitting ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default EditProject;
