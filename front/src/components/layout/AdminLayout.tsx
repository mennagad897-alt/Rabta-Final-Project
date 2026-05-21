import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { logout } from '../../store/slices/authSlice';
import { useState, useEffect } from 'react';

export const AdminLayout = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [isDarkMode, setIsDarkMode] = useState(true);

  // Check initial theme from document classes or local storage
  useEffect(() => {
    const isDark = document.documentElement.classList.contains('dark');
    setIsDarkMode(isDark);
  }, []);

  const toggleTheme = () => {
    if (isDarkMode) {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
      setIsDarkMode(false);
    } else {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
      setIsDarkMode(true);
    }
  };

  const handleLogout = () => {
    dispatch(logout());
    navigate('/login');
  };

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-[#0F0F12] text-gray-900 dark:text-white overflow-hidden transition-colors duration-200">
      {/* Sidebar */}
      <div className="w-64 bg-white dark:bg-[#141419] border-r border-gray-200 dark:border-white/5 flex flex-col transition-colors duration-200">
        <div className="p-6">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-500 to-indigo-500 bg-clip-text text-transparent">
            Rabta Admin
          </h1>
        </div>
        
        <nav className="flex-1 px-4 space-y-2 mt-4">
          <NavLink 
            to="/admin/overview" 
            className={({ isActive }) => `flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${isActive ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-white'}`}
          >
            <i className="fa-solid fa-chart-line text-lg w-5 text-center"></i>
            Overview
          </NavLink>
          
          <NavLink 
            to="/admin/users" 
            className={({ isActive }) => `flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${isActive ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-white'}`}
          >
            <i className="fa-solid fa-users text-lg w-5 text-center"></i>
            Users
          </NavLink>
          
          <NavLink 
            to="/admin/jobs" 
            className={({ isActive }) => `flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${isActive ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-white'}`}
          >
            <i className="fa-solid fa-briefcase text-lg w-5 text-center"></i>
            Jobs
          </NavLink>
          
          <NavLink 
            to="/admin/groups" 
            className={({ isActive }) => `flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${isActive ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-white'}`}
          >
            <i className="fa-solid fa-layer-group text-lg w-5 text-center"></i>
            Communities
          </NavLink>
          
          <NavLink 
            to="/admin/logs" 
            className={({ isActive }) => `flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${isActive ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-white'}`}
          >
            <i className="fa-solid fa-clipboard-list text-lg w-5 text-center"></i>
            Activity Logs
          </NavLink>

          <NavLink 
            to="/admin/add-admin" 
            className={({ isActive }) => `flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${isActive ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-white'}`}
          >
            <i className="fa-solid fa-user-plus text-lg w-5 text-center"></i>
            Add Admin
          </NavLink>

          <NavLink 
            to="/admin/verifications" 
            className={({ isActive }) => `flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${isActive ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-white'}`}
          >
            <i className="fa-solid fa-user-check text-lg w-5 text-center"></i>
            Verifications
          </NavLink>

          <NavLink 
            to="/admin/ai-training" 
            className={({ isActive }) => `flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${isActive ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-white'}`}
          >
            <i className="fa-solid fa-brain text-lg w-5 text-center"></i>
            AI Training
          </NavLink>
        </nav>

        <div className="p-4 space-y-2 border-t border-gray-200 dark:border-white/5">
          <button 
            onClick={toggleTheme} 
            className="flex items-center gap-3 px-4 py-3 w-full rounded-xl text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-white transition-all text-left"
          >
            <i className={`fa-solid ${isDarkMode ? 'fa-sun' : 'fa-moon'} text-lg w-5 text-center`}></i>
            {isDarkMode ? 'Light Mode' : 'Dark Mode'}
          </button>
          
          <button 
            onClick={() => navigate('/')} 
            className="flex items-center gap-3 px-4 py-3 w-full rounded-xl text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-white transition-all text-left"
          >
            <i className="fa-solid fa-house text-lg w-5 text-center"></i>
            Return to App
          </button>
          <button 
            onClick={handleLogout} 
            className="flex items-center gap-3 px-4 py-3 w-full rounded-xl text-red-400 hover:bg-red-500/10 transition-all text-left"
          >
            <i className="fa-solid fa-right-from-bracket text-lg w-5 text-center"></i>
            Logout
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-8 max-w-7xl mx-auto">
          <Outlet />
        </div>
      </div>
    </div>
  );
};
