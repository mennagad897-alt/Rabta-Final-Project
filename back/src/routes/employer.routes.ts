import { Router } from 'express';
import * as employerController from '../controllers/employer.controller';
import { protect } from '../middlewares/auth.middleware';
import { restrictTo } from '../middlewares/authorize.middleware';

const router = Router();

// مسارات عامة (Public)
router.post('/request', employerController.submitRequest);
router.get('/validate-token/:token', employerController.validateToken);
router.post('/register', employerController.registerWithToken);

// مسارات للمسؤولين فقط (Admin only)
// ملحوظة: تقدري تضيفي يوزر بنوع 'admin' يدوي في قاعدة البيانات عشان تجربي المسار ده
router.patch('/approve/:id', protect, restrictTo('admin' as any), employerController.approveRequest);

export default router;
