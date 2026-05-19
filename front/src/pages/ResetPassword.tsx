import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { logout } from '../store/slices/authSlice';
import axiosInstance from '../api/axiosInstance';
import toast from 'react-hot-toast';

export const ResetPassword = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const dispatch = useDispatch();

  // Clear any existing session so an already-logged-in user
  // can still land on this page from their reset email link
  useEffect(() => {
    dispatch(logout());
  }, [dispatch]);
  
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      return toast.error('Passwords do not match');
    }
    if (password.length < 8) {
      return toast.error('Password must be at least 8 characters long');
    }

    try {
      setIsLoading(true);
      const res = await axiosInstance.post(`/auth/reset-password/${token}`, { password });
      toast.success(res.data.message || 'Password updated successfully!');
      navigate('/login');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to reset password. The token may be expired.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAFAFA] dark:bg-[#121212] flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center mb-6">
          <div className="w-12 h-12 bg-[#7C3AED] rounded-xl flex items-center justify-center">
            <span className="material-icons-round text-white text-2xl">password</span>
          </div>
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-[#171717] dark:text-[#F5F5F5]">
          Create new password
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
          Your new password must be different from previous used passwords.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white dark:bg-[#1E1E1E] py-8 px-4 shadow sm:rounded-2xl sm:px-10 border border-gray-100 dark:border-white/5">
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="password" className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                New Password
              </label>
              <div className="mt-1 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <span className="material-icons-round text-gray-400 text-[20px]">lock</span>
                </div>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="appearance-none block w-full pl-10 pr-10 py-3 border border-gray-300 dark:border-gray-700 rounded-xl shadow-sm placeholder-gray-400 focus:outline-none focus:ring-[#7C3AED] focus:border-[#7C3AED] sm:text-sm bg-white dark:bg-[#262626] text-[#171717] dark:text-[#F5F5F5]"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  <span className="material-icons-round text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors text-[20px]">
                    {showPassword ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                Confirm New Password
              </label>
              <div className="mt-1 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <span className="material-icons-round text-gray-400 text-[20px]">lock_clock</span>
                </div>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="appearance-none block w-full pl-10 pr-3 py-3 border border-gray-300 dark:border-gray-700 rounded-xl shadow-sm placeholder-gray-400 focus:outline-none focus:ring-[#7C3AED] focus:border-[#7C3AED] sm:text-sm bg-white dark:bg-[#262626] text-[#171717] dark:text-[#F5F5F5]"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-bold text-white bg-[#7C3AED] hover:bg-[#6D28D9] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#7C3AED] disabled:opacity-70 disabled:cursor-not-allowed transition-all"
              >
                {isLoading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Resetting...
                  </div>
                ) : (
                  'Reset Password'
                )}
              </button>
            </div>
            
            <div className="mt-4 text-center">
              <Link to="/login" className="text-sm font-medium text-gray-500 hover:text-[#7C3AED] transition-colors">
                Back to Login
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
