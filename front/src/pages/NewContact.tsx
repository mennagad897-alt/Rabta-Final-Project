import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import axiosInstance from '../api/axiosInstance';
import { Input } from '../components/ui/Input';

const contactSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().optional(),
  phoneNumber: z
    .string()
    .min(1, 'Phone number is required')
    .regex(/^\+?\d+$/, 'Phone number must contain only digits (optional + at start)')
    .min(8, 'Phone number is too short'),
  email: z.string().email('Invalid email format').optional().or(z.literal('')),
  nickname: z.string().optional(),
});

interface ContactFormData {
  firstName: string;
  lastName?: string;
  phoneNumber: string;
  email?: string;
  nickname?: string;
}

interface FoundUser {
  _id: string;
  fullName: string;
  avatar?: string;
  jobTitle?: string;
  role?: string;
  phoneNumber?: string;
}

export const NewContact: React.FC = () => {
  const navigate = useNavigate();
  const [foundUser, setFoundUser] = useState<FoundUser | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searched, setSearched] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ContactFormData>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      phoneNumber: '',
      email: '',
      nickname: '',
    },
  });

  const phoneNumber = watch('phoneNumber');

  // Step 1: البحث عن اليوزر بالتليفون - بنستخدم find-by-phone عشان أدق
  const handleSearchByPhone = async () => {
    if (!phoneNumber || phoneNumber.length < 8) {
      toast.error('Please enter a valid phone number first.');
      return;
    }
    setIsSearching(true);
    setSearched(false);
    setFoundUser(null);
    try {
      const res = await axiosInstance.get('/users/find-by-phone', {
        params: { phone: phoneNumber },
      });
      const user = res.data?.data?.user;
      setFoundUser(user || null);
    } catch {
      setFoundUser(null);
    } finally {
      setIsSearching(false);
      setSearched(true);
    }
  };

  // Step 2: حفظ الكونكشن وفتح الشات
  const onSubmit = async (data: ContactFormData) => {
    if (!foundUser) {
      toast.error('Please search for and find a user first.');
      return;
    }
    try {
      // 1. إضافة المستخدم للـ connections
      await axiosInstance.post('/users/add-connection', { userId: foundUser._id });
      // 2. إنشاء أو جلب الشات
      const chatRes = await axiosInstance.post('/chats', { userId: foundUser._id });
      const chatId = chatRes.data?.data?.chat?._id;
      toast.success(`${data.firstName || foundUser.fullName} added to your contacts!`);
      // 3. فتح الشات مباشرة
      navigate('/chats', { state: { openChatId: chatId } });
    } catch (error: unknown) {
      const msg =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Failed to save contact.';
      toast.error(msg);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAFAFA] dark:bg-[#171717] transition-colors duration-300 font-sans">
      <header className="bg-white dark:bg-[#262626] border-b border-gray-100 dark:border-gray-800 p-4 sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-4 max-w-2xl mx-auto">
          <Link to="/chats" className="w-10 h-10 flex items-center justify-center rounded-full text-gray-500 hover:text-[#7C3AED] hover:bg-[#7C3AED]/10 transition-all">
            <span className="material-icons-round">arrow_back</span>
          </Link>
          <h1 className="text-xl font-bold text-[#171717] dark:text-[#F5F5F5]">New Contact</h1>
        </div>
      </header>

      <main className="p-4 md:p-8 max-w-2xl mx-auto">
        <div className="bg-white dark:bg-[#262626] rounded-3xl shadow-xl border border-gray-100 dark:border-gray-800 p-8">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">

            {/* Avatar / User Preview */}
            <div className="flex flex-col items-center mb-10">
              {foundUser?.avatar ? (
                <img src={foundUser.avatar} alt={foundUser.fullName} className="w-24 h-24 rounded-full object-cover border-4 border-[#7C3AED]/20" />
              ) : (
                <div className="w-24 h-24 bg-[#7C3AED]/5 dark:bg-[#8B5CF6]/10 rounded-full flex items-center justify-center mb-3 border-2 border-dashed border-[#7C3AED]/20">
                  <span className="material-icons-round text-5xl text-[#7C3AED]">{foundUser ? 'person' : 'person_add'}</span>
                </div>
              )}
              {foundUser ? (
                <div className="text-center mt-2">
                  <p className="font-bold text-[#171717] dark:text-[#F5F5F5]">{foundUser.fullName}</p>
                  {foundUser.jobTitle && <p className="text-sm text-[#7C3AED]">{foundUser.jobTitle}</p>}
                  <span className="inline-flex items-center gap-1 text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-3 py-1 rounded-full font-bold mt-1">
                    <span className="material-icons-round text-xs">check_circle</span>
                    Found on Rabta
                  </span>
                </div>
              ) : (
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mt-2">Enter phone number to find a Rabta user</p>
              )}
            </div>

            {/* Name Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
              <Input label="First Name *" id="firstName" placeholder="Required" {...register('firstName')} error={errors.firstName?.message} />
              <Input label="Last Name" id="lastName" placeholder="Optional" {...register('lastName')} error={errors.lastName?.message} />
            </div>

              {/* Phone + Search */}
            <div className="flex flex-col gap-2">
              <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Phone Number *</label>
              <div className="flex gap-3">
                <div className="flex-1">
                  <input
                    type="tel"
                    placeholder="01xxxxxxxxx or +201xxxxxxxxx"
                    {...register('phoneNumber')}
                    className={`w-full h-12 rounded-xl border ${errors.phoneNumber ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'} bg-transparent px-5 py-3 text-sm focus:border-[#7C3AED] focus:ring-1 focus:ring-[#7C3AED] outline-none transition-all placeholder-gray-400`}
                  />
                </div>
                <button
                  type="button"
                  onClick={handleSearchByPhone}
                  disabled={isSearching || !phoneNumber}
                  className="h-12 px-4 rounded-xl bg-[#7C3AED]/10 hover:bg-[#7C3AED]/20 text-[#7C3AED] font-bold transition-all disabled:opacity-40 flex items-center gap-1 text-sm whitespace-nowrap"
                >
                  {isSearching ? (
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  ) : (
                    <span className="material-icons-round text-lg">search</span>
                  )}
                  Find
                </button>
              </div>
              {errors.phoneNumber && <span className="text-xs text-red-500 mt-1 font-medium">{errors.phoneNumber.message}</span>}
              {searched && !foundUser && !isSearching && (
                <div className="mt-2 flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-3">
                  <span className="material-icons-round text-lg">info</span>
                  No Rabta user found with this number. They need to register on Rabta first.
                </div>
              )}
            </div>

            {/* Email */}
            <Input label="Email Address" id="email" type="email" placeholder="example@rabta.com" {...register('email')} error={errors.email?.message} />

            {/* Nickname */}
            <Input label="Note / Nickname" id="nickname" placeholder="e.g. Work colleague, Friend" {...register('nickname')} error={errors.nickname?.message} />

            {/* Submit */}
            <div className="pt-8">
              <button
                type="submit"
                disabled={isSubmitting || !foundUser}
                className="w-full py-4 rounded-2xl font-bold text-white bg-[#7C3AED] dark:bg-[#8B5CF6] hover:bg-[#6D28D9] shadow-xl shadow-[#7C3AED]/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-3 active:scale-[0.98]"
              >
                {isSubmitting ? (
                  <>
                    <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <span className="material-icons-round text-[20px]">person_add</span>
                    <span>{foundUser ? `Add ${foundUser.fullName} & Open Chat` : 'Search for a user first'}</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
};
