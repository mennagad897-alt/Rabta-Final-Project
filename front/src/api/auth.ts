import axiosInstance from './axiosInstance';

// ==========================================
// 1. واجهات البيانات (Interfaces)
// ==========================================

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  fullName: string;
  email: string;
  phoneNumber: string;
  password: string;
  role: 'freelancer' | 'employer';
}

export interface AuthResponse {
  status: string;
  data: {
    user: {
      _id: string;
      fullName: string;
      email: string;
      phoneNumber: string;
      role: string;
      jobTitle?: string;
      bioHeadline?: string;
      profileComplete?: boolean;
    };
    token: string;
    profileComplete?: boolean;
  };
  message?: string;
}

// ==========================================
// 3. دوال الاتصال (API Functions)
// ==========================================

/**
 * دالة تسجيل الدخول
 */
export const loginUser = async (credentials: LoginCredentials): Promise<{ token: string; user: any; profileComplete: boolean }> => {
  const response = await axiosInstance.post<AuthResponse>('/auth/login', credentials);
  return { 
    token: response.data.data.token, 
    user: response.data.data.user,
    profileComplete: response.data.data.profileComplete ?? false
  };
};

/**
 * دالة إنشاء حساب جديد
 */
export const registerUser = async (userData: RegisterData): Promise<{ token: string; user: any }> => {
  const response = await axiosInstance.post<AuthResponse>('/auth/register', userData);
  return { token: response.data.data.token, user: response.data.data.user };
};

/**
 * دالة رفع صورة البروفايل
 */
export const uploadProfilePicture = async (file: File): Promise<{ status: string; avatar: string }> => {
  const formData = new FormData();
  formData.append('avatar', file);

  const response = await axiosInstance.patch('/profile/me/avatar', formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  });

  return { status: response.data.status, avatar: response.data.data.user.avatar };
};

/**
 * دالة تحديث بيانات البروفايل بالكامل
 */
export const updateMyProfileData = async (data: any): Promise<any> => {
  const response = await axiosInstance.patch('/profile/me', data);
  return response.data.data.user;
};

/**
 * دالة جلب بيانات البروفايل الشخصي الكاملة
 */
export const fetchMyProfile = async (): Promise<any> => {
  const response = await axiosInstance.get('/profile/me');
  return response.data.data.user;
};

/**
 * دالة تسجيل الخروج
 */
export const logoutUser = (): void => {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.href = '/login';
};
