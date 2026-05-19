import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import axiosInstance from '../api/axiosInstance';
import toast from 'react-hot-toast';

export const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSent, setIsSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return toast.error('Please enter your email address');

    try {
      setIsLoading(true);
      await axiosInstance.post('/auth/forgot-password', { email });
      setIsSent(true);
      toast.success('Reset link sent!');
    } catch (error: any) {
      // Don't leak if email exists or not usually, but let's show the error from backend
      toast.error(error.response?.data?.message || 'Failed to send reset link');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAFAFA] dark:bg-[#121212] flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center mb-6">
          <div className="w-12 h-12 bg-[#7C3AED] rounded-xl flex items-center justify-center transform rotate-12">
            <span className="material-icons-round text-white text-2xl -rotate-12">lock_reset</span>
          </div>
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-[#171717] dark:text-[#F5F5F5]">
          Reset your password
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
          Or{' '}
          <Link to="/login" className="font-medium text-[#7C3AED] hover:text-[#6D28D9] transition-colors">
            return to login
          </Link>
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white dark:bg-[#1E1E1E] py-8 px-4 shadow sm:rounded-2xl sm:px-10 border border-gray-100 dark:border-white/5">
          {isSent ? (
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 dark:bg-green-900/30 mb-4">
                <span className="material-icons-round text-green-600 dark:text-green-400">mark_email_read</span>
              </div>
              <h3 className="text-lg font-medium text-[#171717] dark:text-[#F5F5F5] mb-2">Check your email</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                If an account exists for <span className="font-bold text-[#171717] dark:text-white">{email}</span>, a reset link has been sent to your email.
              </p>
              <button
                onClick={() => setIsSent(false)}
                className="text-[#7C3AED] text-sm font-bold hover:underline"
              >
                Try another email
              </button>
            </div>
          ) : (
            <form className="space-y-6" onSubmit={handleSubmit}>
              <div>
                <label htmlFor="email" className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                  Email address
                </label>
                <div className="mt-1 relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="material-icons-round text-gray-400 text-[20px]">email</span>
                  </div>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="appearance-none block w-full pl-10 pr-3 py-3 border border-gray-300 dark:border-gray-700 rounded-xl shadow-sm placeholder-gray-400 focus:outline-none focus:ring-[#7C3AED] focus:border-[#7C3AED] sm:text-sm bg-white dark:bg-[#262626] text-[#171717] dark:text-[#F5F5F5]"
                    placeholder="you@example.com"
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
                      Sending...
                    </div>
                  ) : (
                    'Send Reset Link'
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
