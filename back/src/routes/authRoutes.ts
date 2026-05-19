// src/routes/authRoutes.ts

import { Router } from 'express';
import passport from 'passport';
import { login, register, googleAuthCallback, forgotPassword, resetPassword } from '../controllers/auth.controller';
import { registerValidator, loginValidator } from '../validators/authValidator';

const router = Router();

router.post('/register', registerValidator, register);
router.post('/login', loginValidator, login);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password/:token', resetPassword);
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'], session: false }));

// ✅ التعديل النهائي الجاهز للفرونت إند
router.get('/google/callback', 
  passport.authenticate('google', { 
    session: false, 
    // لو الإيميل مش متسجل، هنحدفه لصفحة اللوجين في الفرونت إند ونقوله السبب في اللينك
    failureRedirect: `${process.env.FRONTEND_URL}/login?error=not_registered` 
  }), 
  googleAuthCallback
);

export default router;