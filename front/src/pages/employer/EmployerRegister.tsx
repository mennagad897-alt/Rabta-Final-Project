import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import axiosInstance from '../../api/axiosInstance';
import toast from 'react-hot-toast';
import { useDispatch } from 'react-redux';
import { setCredentials } from '../../store/slices/authSlice';
import { Input } from '../../components/ui/Input';

const registerSchema = z.object({
  fullName: z.string().min(2, "Name is required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string()
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"]
});

type RegisterFormData = z.infer<typeof registerSchema>;

const EmployerRegister: React.FC = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const [companyInfo, setCompanyInfo] = useState<{ name: string, email: string } | null>(null);
  const [validating, setValidating] = useState(true);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema)
  });

  useEffect(() => {
    if (!token) {
      navigate('/employer/request-access');
      return;
    }

    const validate = async () => {
      try {
        const response = await axiosInstance.get(`/employer/validate-token/${token}`);
        setCompanyInfo({
          name: response.data.data.companyName,
          email: response.data.data.companyEmail
        });
      } catch (error) {
        toast.error("Invitation link is invalid or expired.");
        navigate('/employer/request-access');
      } finally {
        setValidating(false);
      }
    };

    validate();
  }, [token, navigate]);

  const onSubmit = async (data: RegisterFormData) => {
    try {
      const response = await axiosInstance.post('/employer/register', {
        token,
        fullName: data.fullName,
        password: data.password
      });

      dispatch(setCredentials({
        user: response.data.data.user,
        token: response.data.token
      }));

      toast.success("Registration successful!");
      navigate('/employer/setup');
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Registration failed");
    }
  };

  if (validating) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAFAFA] dark:bg-[#171717]">
        <div className="w-12 h-12 border-4 border-[#7C3AED]/30 border-t-[#7C3AED] rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA] dark:bg-[#171717] flex items-center justify-center py-12 px-4">
      <div className="max-w-md w-full">
        <div className="bg-white dark:bg-[#262626] p-10 rounded-3xl shadow-xl border border-gray-100 dark:border-gray-800">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-black mb-2">Complete Registration</h2>
            <p className="text-gray-500 dark:text-gray-400">Welcome to Rabta, <span className="font-bold text-[#7C3AED]">{companyInfo?.name}</span></p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div className="bg-gray-50 dark:bg-[#1f1f1f] p-4 rounded-xl mb-6">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Company Email</label>
              <p className="font-bold opacity-80">{companyInfo?.email}</p>
            </div>

            <Input label="Your Full Name" id="fullName" {...register("fullName")} error={errors.fullName?.message} />
            <Input label="Create Password" type="password" id="password" {...register("password")} error={errors.password?.message} />
            <Input label="Confirm Password" type="password" id="confirmPassword" {...register("confirmPassword")} error={errors.confirmPassword?.message} />

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-4 bg-[#7C3AED] hover:bg-[#6D28D9] text-white font-bold rounded-2xl transition-all shadow-lg shadow-[#7C3AED]/25 disabled:opacity-70 flex items-center justify-center gap-2"
            >
              {isSubmitting ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : "Complete Account"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default EmployerRegister;
