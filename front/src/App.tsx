import { Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { ProtectedRoute } from "./components/layout/ProtectedRoute";
import { PublicRoute } from "./components/layout/PublicRoute";
import { Login } from "./pages/Login";
import { LoginSuccess } from "./pages/LoginSuccess";
import { Signup } from "./pages/Signup";
import { Settings } from "./pages/Settings";
import { ForgotPassword } from "./pages/ForgotPassword";
import { ResetPassword } from "./pages/ResetPassword";
import { MainLayout } from "./components/layout/MainLayout";
import { HomeFeed } from "./pages/HomeFeed";
import { GroupsFeed } from "./pages/GroupsFeed";
import { Splash } from "./pages/Splash";

// استدعاء الصفحات اللي ESLint بيطلع فيها Error
import Profile from './pages/Profile'; 
import EditProfile from './pages/EditProfile';
import SetupProfile from './pages/SetupProfile';   
import { SavedContent } from './pages/SavedPage'; 
import { Notifications } from './pages/Notifications';
import { Privacy } from './pages/Privacy';
import { JobsBoard } from './pages/JobsBoard';
import { JobDetails } from './pages/JobDetails';
import { CallsPage } from './pages/CallsPage';
import { SharedChatRedirect } from './pages/SharedChatRedirect';
import { NewContact } from './pages/NewContact';


import CreateGroup from './components/Groups/CreateGroup'; 
import JoinGroup from './components/Groups/JoinGroup';
import GroupDetails from './components/Groups/GroupDetails';

import RequestAccess from "./pages/employer/RequestAccess";
import EmployerRegister from "./pages/employer/EmployerRegister";
import EmployerSetup from "./pages/employer/EmployerSetup";

import { useSelector } from "react-redux";
import type { RootState } from "./store/store";
import EmployerProfile from "./pages/employer/EmployerProfile";
import EmployerDashboard from "./pages/employer/EmployerDashboard";
import PostJob from "./pages/employer/PostJob";
import ManageProject from "./pages/employer/ManageProject";
import EditProject from "./pages/employer/EditProject";
import FreelancerProfile from "./pages/employer/FreelancerProfile";
import AppliedProjects from "./pages/freelancer/AppliedProjects";
import FreelancerDashboard from "./pages/freelancer/FreelancerDashboard";

// Admin Dashboard
import { AdminRoute } from "./components/layout/AdminRoute";
import { AdminLayout } from "./components/layout/AdminLayout";
import { AdminOverview } from "./pages/admin/AdminOverview";
import { AdminUsers } from "./pages/admin/AdminUsers";
import { AdminJobs } from "./pages/admin/AdminJobs";
import { AdminGroups } from "./pages/admin/AdminGroups";
import { AdminLogs } from "./pages/admin/AdminLogs";
import { AddAdmin } from "./pages/admin/AddAdmin";
import { AdminVerifications } from "./pages/admin/AdminVerifications";
import { AdminAITraining } from "./pages/admin/AdminAITraining";

function App() {
  const user = useSelector((state: RootState) => state.auth.user);

  return (
    <>
      <Toaster 
        position="top-right" 
        toastOptions={{
          className: 'dark:bg-[#141419] dark:text-white dark:border dark:border-white/10',
          style: {
            background: 'var(--tw-bg-opacity)',
            color: 'var(--tw-text-opacity)',
          },
        }} 
      />
      <Routes>
        <Route path="/" element={<Splash />} />

      {/* صفحة الـ Login والـ Signup */}
      <Route path="/login-success" element={<LoginSuccess />} />
      {/* Fully public — must work even when logged in (e.g. from reset email link) */}
      <Route path="/reset-password/:token" element={<ResetPassword />} />
      <Route element={<PublicRoute />}>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/employer/request-access" element={<RequestAccess />} />
        <Route path="/employer/register" element={<EmployerRegister />} />
      </Route>

      {/* الصفحات المحمية */}
      <Route element={<ProtectedRoute />}>
        <Route element={<MainLayout />}>
          <Route path="/chats" element={<HomeFeed />} />
          <Route path="/chats/new-contact" element={<NewContact />} />
          <Route path="/contact/:userId" element={<FreelancerProfile />} />
          <Route path="/groups" element={<GroupsFeed />} />
          <Route path="/groups/:id" element={<GroupDetails />} />
          <Route path="/jobs" element={<JobsBoard />} />
          <Route path="/jobs/:jobId" element={<JobDetails />} />
          <Route path="/calls" element={<CallsPage />} />
          <Route path="/shared/:id" element={<SharedChatRedirect />} />
          
          {/* 👇 المسارات الجديدة للجروبات عشان الزرار يشتغل وميرجعكيش للرئيسية */}
          <Route path="/create-group" element={<CreateGroup />} />
          <Route path="/join-group" element={<JoinGroup />} />
          
         
          <Route 
            path="/profile" 
            element={user?.role === 'employer' ? <EmployerProfile /> : <Profile />} 
          />
          <Route path="/edit-profile" element={<EditProfile />} />
          <Route path="/setup-profile" element={<SetupProfile />} />
          <Route path="/bookmarks" element={<SavedContent />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/privacy" element={<Privacy />} />
          
          <Route path="/settings" element={<Settings />} />
          <Route path="/employer/setup" element={<EmployerSetup />} />
          <Route path="/employer-dashboard" element={<EmployerDashboard />} />
          <Route path="/post-job" element={<PostJob />} />
          <Route path="/manage-project/:id" element={<ManageProject />} />
          <Route path="/edit-project/:id" element={<EditProject />} />
          <Route path="/freelancer-profile/:id" element={<FreelancerProfile />} />
          <Route path="/applied-projects" element={<AppliedProjects />} />
          <Route path="/freelancer-dashboard" element={<FreelancerDashboard />} />
        </Route>
      </Route>

      {/* 🛡️ Admin Dashboard (Isolated) */}
      <Route element={<AdminRoute />}>
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Navigate to="overview" replace />} />
          <Route path="overview" element={<AdminOverview />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="jobs" element={<AdminJobs />} />
          <Route path="groups" element={<AdminGroups />} />
          <Route path="logs" element={<AdminLogs />} />
          <Route path="add-admin" element={<AddAdmin />} />
          <Route path="verifications" element={<AdminVerifications />} />
          <Route path="ai-training" element={<AdminAITraining />} />
        </Route>
      </Route>

      {/* استخدام Navigate هنا عشان أي لينك غلط يرجع للسبلاش */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </>
  );
}

export default App;