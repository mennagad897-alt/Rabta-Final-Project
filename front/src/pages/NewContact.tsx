import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import axiosInstance from '../api/axiosInstance';
import { Input } from '../components/ui/Input';

/**
 * 1. تعريف شكل البيانات (Validation Schema)
 */
const contactSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().optional(),
  countryCode: z.string().min(1, 'Country code is required'),
  phoneNumber: z
    .string()
    .min(1, 'Phone number is required')
    .regex(/^\d+$/, 'Phone number must contain only digits')
    .min(8, 'Phone number is too short'),
  email: z.string().email('Invalid email format').optional().or(z.literal('')),
  nickname: z.string().optional(),
});

interface ContactFormData {
  firstName: string;
  lastName?: string;
  countryCode: string;
  phoneNumber: string;
  email?: string;
  nickname?: string;
}

/**
 * 2. مكون صفحة "إضافة جهة اتصال جديدة"
 */
export const NewContact: React.FC = () => {
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ContactFormData>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      countryCode: '+20',
      phoneNumber: '',
      email: '',
      nickname: '',
    },
  });

  /**
   * 3. معالجة الإرسال
   */
  const onSubmit = async (data: ContactFormData) => {
    try {
      const fullPhone = `${data.countryCode}${data.phoneNumber}`;
      
      // البحث عن المستخدم برقم الهاتف
      const searchResponse = await axiosInstance.get('/users/search/all', {
        params: { keyword: fullPhone }
      });

      const users = searchResponse.data.data.users || [];
      // التأكد من التطابق التام لرقم الهاتف
      const matchedUser = users.find((u: unknown) => (u as { phoneNumber: string }).phoneNumber === fullPhone);

      if (!matchedUser) {
        toast.error('User not found in Rabta. They must be registered first.');
        return;
      }

      // إنشاء محادثة مع المستخدم المكتشف
      const chatResponse = await axiosInstance.post('/chats', { userId: matchedUser._id });
      
      toast.success(`Contact ${data.firstName} added and chat started!`);
      
      // التوجيه لصفحة الشات مع تمرير الـ ID الجديد
      navigate('/chats', { state: { pendingChatId: chatResponse.data.data.chat._id } });
      
    } catch (error: unknown) {
      const errorMessage = (error as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to save contact.';
      toast.error(errorMessage);
      console.error('Save Contact Error:', error);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAFAFA] dark:bg-[#171717] transition-colors duration-300 font-sans">
      {/* 🚀 Header */}
      <header className="bg-white dark:bg-[#262626] border-b border-gray-100 dark:border-gray-800 p-4 sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-4 max-w-2xl mx-auto">
          <Link to="/chats" className="w-10 h-10 flex items-center justify-center rounded-full text-gray-500 hover:text-[#7C3AED] hover:bg-[#7C3AED]/10 transition-all">
            <span className="material-icons-round">arrow_back</span>
          </Link>
          <h1 className="text-xl font-bold text-[#171717] dark:text-[#F5F5F5]">New Contact</h1>
        </div>
      </header>

      {/* 📝 Form Content */}
      <main className="p-4 md:p-8 max-w-2xl mx-auto">
        <div className="bg-white dark:bg-[#262626] rounded-3xl shadow-xl border border-gray-100 dark:border-gray-800 p-8">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            
            {/* Profile Avatar Placeholder */}
            <div className="flex flex-col items-center mb-10">
              <div className="w-24 h-24 bg-[#7C3AED]/5 dark:bg-[#8B5CF6]/10 rounded-full flex items-center justify-center mb-3 border-2 border-dashed border-[#7C3AED]/20">
                <span className="material-icons-round text-5xl text-[#7C3AED]">person_add</span>
              </div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Save details to start messaging</p>
            </div>

            {/* Name Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
              <Input 
                label="First Name *" 
                id="firstName" 
                placeholder="Required" 
                {...register('firstName')} 
                error={errors.firstName?.message} 
              />
              <Input 
                label="Last Name" 
                id="lastName" 
                placeholder="Optional" 
                {...register('lastName')} 
                error={errors.lastName?.message} 
              />
            </div>

            {/* Phone Field with Country Code */}
            <div className="flex flex-col gap-2">
              <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Phone Number *</label>
              <div className="flex gap-3">
                <div className="relative group">
                  <select 
                    {...register('countryCode')}
                    className="h-13 w-28 rounded-xl border border-gray-300 dark:border-gray-600 bg-transparent px-3 py-3 text-sm font-medium focus:border-[#7C3AED] dark:focus:border-[#8B5CF6] focus:ring-1 focus:ring-[#7C3AED] outline-none transition-all cursor-pointer appearance-none"
                  >
                    <option value="+20">🇪🇬 +20</option>
                    <option value="+966">🇸🇦 +966</option>
                    <option value="+971">🇦🇪 +971</option>
                    <option value="+965">🇰🇼 +965</option>
                    <option value="+974">🇶🇦 +974</option>
                    <option value="+1">🇺🇸 +1</option>
                    <option value="+44">🇬🇧 +44</option>
                  </select>
                  <span className="material-icons-round absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none text-sm">expand_more</span>
                </div>
                
                <div className="flex-1">
                  <input 
                    type="tel" 
                    placeholder="10xxxxxxxx"
                    {...register('phoneNumber')}
                    className={`w-full h-13 rounded-xl border ${errors.phoneNumber ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'} bg-transparent px-5 py-3 text-sm focus:border-[#7C3AED] dark:focus:border-[#8B5CF6] focus:ring-1 focus:ring-[#7C3AED] outline-none transition-all placeholder-gray-400`}
                  />
                </div>
              </div>
              {errors.phoneNumber && <span className="text-xs text-red-500 mt-1 font-medium">{errors.phoneNumber.message}</span>}
            </div>

            {/* Email Field */}
            <Input 
              label="Email Address" 
              id="email" 
              type="email" 
              placeholder="example@rabta.com" 
              {...register('email')} 
              error={errors.email?.message} 
            />

            {/* Nickname/Note Field */}
            <Input 
              label="Note / Nickname" 
              id="nickname" 
              placeholder="e.g. Work colleague, Friend" 
              {...register('nickname')} 
              error={errors.nickname?.message} 
            />

            {/* Submit Button */}
            <div className="pt-8">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-4 rounded-2xl font-bold text-white bg-[#7C3AED] dark:bg-[#8B5CF6] hover:bg-[#6D28D9] dark:hover:bg-[#7C3AED] shadow-xl shadow-[#7C3AED]/20 dark:shadow-[#8B5CF6]/10 transition-all disabled:opacity-70 disabled:cursor-not-allowed flex justify-center items-center gap-3 active:scale-[0.98]"
              >
                {isSubmitting ? (
                  <>
                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <span className="material-icons-round text-[20px]">save</span>
                    <span>Save Contact</span>
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