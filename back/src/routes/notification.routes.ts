import { Router } from 'express';
import { protect } from '../middlewares/auth.middleware';
import {
  getNotificationSettings,
  updateNotificationSettings,
  getPrivacySettings,
  updatePrivacySettings,
} from '../controllers/notification.controller';

const router = Router();

router.use(protect);

// GET  /api/notifications/settings  → fetch current user's notification settings
router.get('/settings', getNotificationSettings);

// PATCH /api/notifications/settings → partially update notification settings
router.patch('/settings', updateNotificationSettings);

// GET  /api/privacy/settings  → fetch current user's privacy settings
router.get('/privacy/settings', getPrivacySettings);

// PATCH /api/privacy/settings → update privacy settings
router.patch('/privacy/settings', updatePrivacySettings);

export default router;
