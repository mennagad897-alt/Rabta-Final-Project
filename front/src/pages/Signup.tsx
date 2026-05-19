/* eslint-disable @typescript-eslint/no-explicit-any */
import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import { useDispatch } from "react-redux";
import { Input } from "../components/ui/Input";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import toast from "react-hot-toast";
import { registerUser } from "../api/auth";
import { setCredentials } from "../store/slices/authSlice"; 

// 1. تعريف شكل البيانات (Interfaces)
interface RegisterData {
  fullName: string;
  email: string;
  phoneNumber: string;
  password: string;
  role: 'freelancer' | 'employer';
}

// 2. الـ Schema بتاعة الفحص (Zod)
const signupSchema = z
  .object({
    fullname: z.string().min(3, "Full name must be at least 3 characters"),
    email: z.string().min(1, "Email is required").email("Invalid email format"),
    phone: z
      .string()
      .min(1, "Phone number is required")
      .regex(/^01[0125][0-9]{8}$/, "Invalid Egyptian phone number"), 
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string().min(1, "Please confirm your password"),
    role: z.enum(['freelancer', 'employer']),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type SignupFormInputs = z.infer<typeof signupSchema>;

export const Signup = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignupFormInputs>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      role: 'freelancer' 
    }
  });

  // 3. دالة الإرسال (تم تنظيف التكرار)
  const onSubmit = async (data: SignupFormInputs) => {
    try {
      const payload: RegisterData = {
        fullName: data.fullname,
        email: data.email,
        phoneNumber: data.phone,
        password: data.password,
        role: data.role
      };

      // إرسال البيانات للباك إند
      const responseData = await registerUser(payload);

      // حفظ البيانات في Redux (عشان يبقى مسجل دخول)
      dispatch(setCredentials({ 
        user: responseData.user, 
        token: responseData.token 
      }));
      
      toast.success("Account created! Let's set up your profile.");

      // التوجيه لصفحة الـ Setup Profile (دائماً بعد التسجيل يكون البروفايل غير مكتمل)
      navigate("/setup-profile");

    } catch (error: any) {
      const errorMessage = error.response?.data?.message || "Registration failed. Please try again.";
      toast.error(errorMessage);
      console.error("Signup Error:", error);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAFAFA] dark:bg-[#171717] text-[#171717] dark:text-[#F5F5F5] transition-colors duration-300 font-sans">
      <header className="w-full py-4 px-6 shadow-sm bg-[#FFFFFF] dark:bg-[#262626] border-b border-gray-100 dark:border-gray-800">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <Link to="/login" className="hover:opacity-80 transition-opacity text-[#7C3AED] dark:text-[#8B5CF6]">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path>
            </svg>
          </Link>
          <h1 className="text-xl font-bold">Sign Up</h1>
          <div className="w-6"></div>
        </div>
      </header>

      <main className="flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-md">
          <div className="bg-[#FFFFFF] dark:bg-[#262626] rounded-2xl shadow-xl p-8 border border-gray-100 dark:border-gray-800">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold mb-2">Create Account</h2>
              <p className="text-gray-500 dark:text-gray-400">Join the Rabta community</p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="flex flex-col gap-1.5 mb-2">
                <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Register as:</label>
                <select
                  {...register("role")}
                  className="w-full rounded-lg border border-gray-200 dark:border-gray-800 bg-[#FAFAFA] dark:bg-[#1f1f1f] px-4 py-3 text-sm text-[#171717] dark:text-[#F5F5F5] focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/20 focus:border-[#7C3AED] transition-all cursor-pointer"
                >
                  <option value="freelancer">Freelancer</option>
                  <option value="employer">Employer / Company</option>
                </select>
              </div>

              <Input label="Full Name" id="fullname" type="text" placeholder="Enter your full name" {...register("fullname")} error={errors.fullname?.message} />
              <Input label="Email" id="email" type="email" placeholder="example@mail.com" {...register("email")} error={errors.email?.message} />
              <Input label="Phone Number" id="phone" type="tel" placeholder="01xxxxxxxxx" {...register("phone")} error={errors.phone?.message} />

              {/* Password with eye toggle */}
              <div>
                <label htmlFor="password" className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">Password</label>
                <div className="relative mb-1">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Min. 8 characters"
                    {...register("password")}
                    className={`w-full px-4 py-3 pr-12 bg-[#FAFAFA] dark:bg-[#1f1f1f] border ${errors.password ? "border-red-500" : "border-gray-300 dark:border-gray-600"} rounded-lg focus:outline-none focus:border-[#7C3AED] dark:focus:border-[#8B5CF6] focus:ring-1 focus:ring-[#7C3AED] transition-all placeholder-gray-400`}
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-[#7C3AED] transition-colors" tabIndex={-1}>
                    {showPassword ? (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                    )}
                  </button>
                </div>
                {errors.password && <span className="text-xs text-red-500 block">{errors.password.message}</span>}
              </div>

              {/* Confirm Password with eye toggle */}
              <div>
                <label htmlFor="confirm-password" className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">Confirm Password</label>
                <div className="relative mb-1">
                  <input
                    id="confirm-password"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Confirm your password"
                    {...register("confirmPassword")}
                    className={`w-full px-4 py-3 pr-12 bg-[#FAFAFA] dark:bg-[#1f1f1f] border ${errors.confirmPassword ? "border-red-500" : "border-gray-300 dark:border-gray-600"} rounded-lg focus:outline-none focus:border-[#7C3AED] dark:focus:border-[#8B5CF6] focus:ring-1 focus:ring-[#7C3AED] transition-all placeholder-gray-400`}
                  />
                  <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-[#7C3AED] transition-colors" tabIndex={-1}>
                    {showConfirmPassword ? (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                    )}
                  </button>
                </div>
                {errors.confirmPassword && <span className="text-xs text-red-500 block">{errors.confirmPassword.message}</span>}
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full mt-6 py-3.5 px-4 rounded-xl font-bold text-white bg-[#7C3AED] dark:bg-[#8B5CF6] hover:bg-[#6D28D9] dark:hover:bg-[#7C3AED] shadow-lg transition-all disabled:opacity-70 disabled:cursor-not-allowed flex justify-center items-center active:scale-[0.98]"
              >
                {isSubmitting ? "Creating Account..." : "Sign Up"}
              </button>
            </form>

            <div className="mt-8 text-center border-t border-gray-100 dark:border-gray-800 pt-6">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Already have an account?{" "}
                <Link to="/login" className="font-bold text-[#7C3AED] dark:text-[#8B5CF6] hover:underline">Log In</Link>
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};