import { Router } from 'express';
import {
  getAdminStats,
  getAllUsers,
  toggleBanUser,
  getAllJobs,
  deleteJob,
  getAllGroups,
  deleteGroup,
  getAdminLogs,
  promoteAdmin,
  deleteUser,
  getPendingEmployers,
  verifyEmployer,
  rejectEmployer
} from '../controllers/admin.controller';
import { protect } from '../middlewares/auth.middleware';
import { isAdmin } from '../middlewares/admin.middleware';

const router = Router();

// Secure all admin routes with authentication and admin authorization
router.use(protect);
router.use(isAdmin);

// Stats
router.get('/stats', getAdminStats);

// Users
router.get('/users', getAllUsers);
router.put('/users/:id/ban', toggleBanUser);
router.put('/users/:id/role', promoteAdmin);
router.delete('/users/:id', deleteUser);

// Employers
router.get('/pending-employers', getPendingEmployers);
router.patch('/verify-employer/:id', verifyEmployer);
router.patch('/reject-employer/:id', rejectEmployer);

// Jobs
router.get('/jobs', getAllJobs);
router.delete('/jobs/:id', deleteJob);

// Groups
router.get('/groups', getAllGroups);
router.delete('/groups/:id', deleteGroup);

// Activity Logs
router.get('/logs', getAdminLogs);

export default router;
