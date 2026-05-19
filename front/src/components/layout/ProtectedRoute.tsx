/* eslint-disable @typescript-eslint/no-explicit-any */
import { Navigate, Outlet } from "react-router-dom";
import { useSelector } from "react-redux";
// تأكدي أن المسار ../../store/store صحيح بالنسبة لمكان الفايل
import type { RootState } from "../../store/store";

export const ProtectedRoute = () => {
  // بنشيك على الـ token من الـ Redux state
  // بنستخدم RootState كنوع (Type) عشان الـ TypeScript يفهم الـ state جواه إيه
  const isAuthenticated = useSelector((state: RootState) => state.auth.isAuthenticated);

  // لو مفيش توكن (المستخدم مش مسجل دخول)، بنرجعه لصفحة الـ Login
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // لو فيه توكن، بنسمح له يشوف الصفحات اللي جوه (الـ Child Routes)
  return <Outlet />;
};