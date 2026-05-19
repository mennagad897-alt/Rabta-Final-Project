
import { Navigate, Outlet } from 'react-router-dom';
import { useSelector } from 'react-redux';
import type { RootState } from '../../store/store';

export const AdminRoute = () => {
  const { user, token } = useSelector((state: RootState) => state.auth);

  if (!token || !user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role !== 'admin') {
    return <Navigate to="/chats" replace />;
  }

  return <Outlet />;
};
