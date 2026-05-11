/* eslint-disable @typescript-eslint/no-explicit-any */
import { Navigate, Outlet } from "react-router-dom";
import { useSelector } from "react-redux";
// التعديل الجوهري: إضافة كلمة type عشان الـ Vite يفهم إنه مجرد Type مش كود
import type { RootState } from "../../store/store";

export const PublicRoute = () => {
  // بنشيك على الـ token من الـ Redux state
  const isAuthenticated = useSelector((state: RootState) => state.auth.isAuthenticated);

  // لو اليوزر مسجل دخول (معاه توكن) وبيحاول يفتح صفحة اللوجين أو الساين أب
  if (isAuthenticated) {
    const user = useSelector((state: RootState) => state.auth.user);
    // لو اليوزر جديد ولسه مكملش بياناته الأساسية، بنوديه للـ Setup
    if (!user?.jobTitle && !user?.bioHeadline) {
      return <Navigate to="/setup-profile" replace />;
    }
    // لو بياناته كاملة، بنوديه للـ chats عادي
    return <Navigate to="/chats" replace />;
  }

  // لو مش مسجل دخول، بنسيبه يكمل لصفحات الـ Login أو Signup عادي
  return <Outlet />;
};