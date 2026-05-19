import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import axiosInstance from '../../api/axiosInstance';
import toast from 'react-hot-toast';
import { Input } from '../../components/ui/Input';

const requestSchema = z.object({
  companyName: z.string().min(2, "Company name is required"),
  companyEmail: z.string().email("Invalid company email"),
  linkedinUrl: z.string().optional().refine(val => !val || val.startsWith('https://www.linkedin.com/company/'), {
    message: "Must be a valid LinkedIn company URL"
  }),
  contactPersonName: z.string().min(2, "Contact name is required"),
  industry: z.string().min(1, "Please select an industry"),
  companySize: z.enum(['1-10', '11-50', '51-200', '201-500', '500+']),
  website: z.string().url().optional().or(z.literal('')),
  message: z.string().optional()
});

type RequestFormData = z.infer<typeof requestSchema>;

const RequestAccess: React.FC = () => {
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<RequestFormData>({
    resolver: zodResolver(requestSchema)
  });

  const onSubmit = async (data: RequestFormData) => {
    try {
      setLoading(true);
      await axiosInstance.post('/employer/request', data);
      setSubmitted(true);
      toast.success("Request submitted successfully!");
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to submit request");
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAFAFA] dark:bg-[#171717] px-4">
        <div className="max-w-md w-full text-center bg-white dark:bg-[#262626] p-10 rounded-3xl shadow-xl border border-gray-100 dark:border-gray-800 animate-in fade-in zoom-in duration-500">
          <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="material-icons-round text-5xl">check_circle</span>
          </div>
          <h2 className="text-3xl font-black mb-4">Request Sent!</h2>
          <p className="text-gray-500 dark:text-gray-400 mb-8 leading-relaxed">
            We've received your partnership request. Our team will review your application within 2-3 business days.
          </p>
          <Link 
            to="/login" 
            className="inline-block w-full py-4 bg-[#7C3AED] hover:bg-[#6D28D9] text-white font-bold rounded-2xl transition-all shadow-lg shadow-[#7C3AED]/25"
          >
            Back to Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA] dark:bg-[#171717] py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-black mb-3 text-[#7C3AED] dark:text-[#8B5CF6]">Partner with Rabta</h1>
          <p className="text-gray-500 dark:text-gray-400">Join our network of elite companies and hire top talent</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="bg-white dark:bg-[#262626] p-8 sm:p-12 rounded-3xl shadow-xl border border-gray-100 dark:border-gray-800 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <Input label="Company Name" id="companyName" {...register("companyName")} error={errors.companyName?.message} placeholder="e.g. TechVortex" />
            <Input label="Official Company Email" id="companyEmail" {...register("companyEmail")} error={errors.companyEmail?.message} placeholder="name@company.com" />
          </div>

          <Input label="LinkedIn Company Page (Recommended)" id="linkedinUrl" {...register("linkedinUrl")} error={errors.linkedinUrl?.message} placeholder="https://linkedin.com/company/..." />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <Input label="Contact Person Name" id="contactPersonName" {...register("contactPersonName")} error={errors.contactPersonName?.message} />
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-bold opacity-80 ml-1">Industry</label>
              <select 
                {...register("industry")}
                className="w-full bg-[#FAFAFA] dark:bg-[#1f1f1f] border border-gray-100 dark:border-gray-800 rounded-xl px-4 py-3.5 focus:ring-2 focus:ring-[#7C3AED]/20 focus:border-[#7C3AED] outline-none transition-all"
              >
                <option value="">Select Industry</option>
                <option value="Technology">Technology</option>
                <option value="Design">Design</option>
                <option value="Marketing">Marketing</option>
                <option value="Finance">Finance</option>
                <option value="Healthcare">Healthcare</option>
                <option value="Other">Other</option>
              </select>
              {errors.industry && <p className="text-xs text-red-500 ml-1">{errors.industry.message}</p>}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-bold opacity-80 ml-1">Company Size</label>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
              {['1-10', '11-50', '51-200', '201-500', '500+'].map((size) => (
                <label key={size} className="cursor-pointer">
                  <input type="radio" value={size} {...register("companySize")} className="peer hidden" />
                  <div className="py-2.5 text-center rounded-xl border border-gray-100 dark:border-gray-800 peer-checked:bg-[#7C3AED] peer-checked:text-white peer-checked:border-[#7C3AED] transition-all text-sm font-bold">
                    {size}
                  </div>
                </label>
              ))}
            </div>
            {errors.companySize && <p className="text-xs text-red-500 ml-1">{errors.companySize.message}</p>}
          </div>

          <Input label="Company Website (Optional)" id="website" {...register("website")} error={errors.website?.message} placeholder="https://..." />

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-bold opacity-80 ml-1">Why do you want to join Rabta? (Optional)</label>
            <textarea 
              {...register("message")}
              className="w-full bg-[#FAFAFA] dark:bg-[#1f1f1f] border border-gray-100 dark:border-gray-800 rounded-xl px-4 py-3.5 h-32 focus:ring-2 focus:ring-[#7C3AED]/20 focus:border-[#7C3AED] outline-none transition-all resize-none"
              placeholder="Tell us about your hiring needs..."
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-[#7C3AED] hover:bg-[#6D28D9] text-white font-bold rounded-2xl transition-all shadow-lg shadow-[#7C3AED]/25 disabled:opacity-70 flex items-center justify-center gap-2"
          >
            {loading ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : "Submit Request"}
          </button>
        </form>

        <p className="text-center mt-8 text-sm text-gray-500">
          Already have an account? <Link to="/login" className="text-[#7C3AED] font-bold hover:underline">Log In</Link>
        </p>
      </div>
    </div>
  );
};

export default RequestAccess;
