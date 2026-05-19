import axiosInstance from './axiosInstance';

/**
 * تحديث بيانات الملف الشخصي
 */
export const updateProfile = async (userData: any) => {
  const response = await axiosInstance.patch('/profile/me', userData);
  return response.data;
};

/**
 * رفع صورة الملف الشخصي
 */
export const uploadAvatar = async (file: File) => {
  const formData = new FormData();
  formData.append('avatar', file);

  const response = await axiosInstance.patch('/profile/me/avatar', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
};

/**
 * جلب بيانات الملف الشخصي لليوزر الحالي
 */
export const getMyProfile = async () => {
  const response = await axiosInstance.get('/profile/me');
  return response.data;
};
