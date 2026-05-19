/* eslint-disable @typescript-eslint/no-explicit-any */
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import { useDispatch } from "react-redux";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import toast from "react-hot-toast";
import { Input } from "../components/ui/Input";
import { loginUser } from "../api/auth";
import { setCredentials } from "../store/slices/authSlice";

const loginSchema = z.object({
  email: z
    .string()
    .min(1, "Email or phone is required")
    .email("Invalid email format"),
  password: z
    .string()
    .min(6, "Password must be at least 6 characters"),
});

type LoginFormInputs = z.infer<typeof loginSchema>;

export const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("error") === "not_registered") {
      toast.error("This account is not registered. Please create an account first.");
    }
  }, [location]);

  const handleGoogleLogin = () => {
    // Redirects to the backend Google Auth endpoint
    const baseURL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api/v1";
    window.location.href = `${baseURL}/auth/google`;
  };

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormInputs>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormInputs) => {
    try {
      const responseData = await loginUser({
        email: data.email,
        password: data.password,
      });
      dispatch(setCredentials({ user: responseData.user, token: responseData.token }));
      toast.success("Successfully logged in!", { duration: 4000 });
      
      // التوجيه بناءً على حالة البروفايل
      if (responseData.user.role === 'employer' && responseData.profileComplete) {
        navigate("/employer-dashboard");
      } else if (!responseData.profileComplete) {
        navigate("/setup-profile");
      } else {
        // Freelancer with complete profile
        navigate("/freelancer-dashboard");
      }
      
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || "Login failed. Please check your credentials.";
      console.error('[LOGIN ERROR]', error.response?.data || error.message);
      toast.error(errorMessage, { duration: 4000 });
    }
  };

  return (
    <div className="min-h-screen bg-[#FAFAFA] dark:bg-[#171717] text-[#171717] dark:text-[#F5F5F5] transition-colors duration-300">
      <header className="w-full py-4 px-6 shadow-sm bg-[#FFFFFF] dark:bg-[#262626] transition-colors duration-300">
        <div className="flex items-center justify-between">
          <Link to="/" className="hover:opacity-80 transition-opacity text-[#7C3AED] dark:text-[#8B5CF6]">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path>
            </svg>
          </Link>
          <h1 className="text-xl font-bold tracking-tight">Log In</h1>
          <div className="w-6"></div>
        </div>
      </header>

      <main className="flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="bg-[#FFFFFF] dark:bg-[#262626] rounded-2xl shadow-lg p-8 border border-gray-100 dark:border-gray-800 transition-colors duration-300">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold mb-2">Welcome Back</h2>
              <p className="text-gray-500 dark:text-gray-400">Enter your credentials to continue</p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              <Input
                label="Email"
                id="email"
                type="text"
                placeholder="Enter your email"
                {...register("email")}
                error={errors.email?.message}
              />

              <div>
                <label htmlFor="password" className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                  Password
                </label>
                <div className="relative mb-4">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    {...register("password")}
                    className={`w-full px-4 py-3 pr-12 bg-[#FAFAFA] dark:bg-[#1f1f1f] border ${
                      errors.password ? "border-red-500" : "border-gray-300 dark:border-gray-600"
                    } rounded-lg focus:outline-none focus:border-[#7C3AED] dark:focus:border-[#8B5CF6] focus:ring-1 focus:ring-[#7C3AED] dark:focus:ring-[#8B5CF6] transition-all placeholder-gray-400 dark:placeholder-gray-500`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-[#7C3AED] dark:hover:text-[#8B5CF6] transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                  {errors.password && (
                    <span className="text-xs text-red-500 mt-1 block">{errors.password.message}</span>
                  )}
                </div>
                <div className="flex justify-end -mt-2">
                  <Link to="/forgot-password" className="text-sm font-medium text-[#7C3AED] hover:text-[#6D28D9] transition-colors">
                    Forgot Password?
                  </Link>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full mt-6 py-3.5 px-4 rounded-xl font-bold text-white bg-[#7C3AED] dark:bg-[#8B5CF6] hover:bg-[#6D28D9] dark:hover:bg-[#7C3AED] shadow-lg transition-all disabled:opacity-70 disabled:cursor-not-allowed flex justify-center items-center active:scale-[0.98]"
              >
                {isSubmitting ? "Loading..." : "Log In"}
              </button>
            </form>

            <div className="relative mt-8 mb-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200 dark:border-gray-800"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-[#FFFFFF] dark:bg-[#262626] text-gray-500 dark:text-gray-400 font-medium">Or continue with</span>
              </div>
            </div>

            <button
              onClick={handleGoogleLogin}
              className="w-full py-3.5 px-4 rounded-xl font-bold text-[#171717] dark:text-[#F5F5F5] bg-white dark:bg-[#1f1f1f] border-2 border-gray-100 dark:border-white/5 hover:bg-gray-50 dark:hover:bg-white/5 transition-all flex justify-center items-center gap-3 active:scale-[0.98]"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Login with Google
            </button>

            <div className="mt-6 text-center">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Don't have an account?{" "}
                <Link to="/signup" className="font-bold text-[#7C3AED] dark:text-[#8B5CF6] hover:underline">
                  Sign Up
                </Link>
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};