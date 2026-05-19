import axios from "axios";

// 1. إنشاء الـ Instance الأساسي
const axiosInstance = axios.create({
  // بنقرا رابط الباك-إند من ملف الـ .env، ولو مش موجود بنستخدم اللوكال هوست مؤقتاً
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api/v1",
  timeout: 10000, // أقصى وقت للرد (10 ثواني)
  headers: {
    "Content-Type": "application/json",
  },
});

// 2. Request Interceptor (التفتيش قبل ما الريكويست يخرج)
// هنا بنقوله: قبل ما تروح للباك-إند، خد التوكن من الـ Local Storage وحطه في جيبك (الـ Headers)
axiosInstance.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

// 3. Response Interceptor (التفتيش والرد راجع من الباك-إند)
// هنا بنقوله: لو الرد رجع سليم عديه، لو رجع بـ Error 401 (يعني التوكن خلص أو اليوزر مش عامل لوجن)، اطرده بره
axiosInstance.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (error.response && error.response.status === 401) {
      // التوكن انتهى أو غير صالح
      localStorage.removeItem("token");
      // تحويل المستخدم لصفحة تسجيل الدخول
      window.location.href = "/login";
    }
    return Promise.reject(error);
  },
);

export default axiosInstance;
