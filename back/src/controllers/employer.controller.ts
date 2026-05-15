import { Request, Response, NextFunction } from 'express';
import EmployerRequest from '../models/EmployerRequest.model';
import { catchAsync } from '../utils/catchAsync';
import { AppError } from '../utils/AppError';
import crypto from 'crypto';

/**
 * 1. تقديم طلب انضمام كشركة
 */
export const submitRequest = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { companyEmail, linkedinUrl } = req.body;

  // فحص الإيميل واللينكد إن حسب القواعد المطلوبة
  const freeEmailProviders = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com'];
  const emailDomain = companyEmail.split('@')[1];
  const isFreeEmail = freeEmailProviders.includes(emailDomain);
  const isValidLinkedIn = linkedinUrl && linkedinUrl.startsWith('https://www.linkedin.com/company/');

  if (isFreeEmail && !isValidLinkedIn) {
    return next(new AppError('Please provide a company email address or a valid LinkedIn company page URL.', 400));
  }

  const existingRequest = await EmployerRequest.findOne({ companyEmail });
  if (existingRequest) {
    return next(new AppError('A request with this email already exists.', 400));
  }

  const newRequest = await EmployerRequest.create(req.body);

  res.status(201).json({
    status: 'success',
    message: 'Request submitted successfully. We will review it soon.',
    data: { request: newRequest }
  });
});

/**
 * 2. التحقق من التوكن (للفرونت إند)
 */
export const validateToken = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { token } = req.params;
  const request = await EmployerRequest.findOne({ 
    invitationToken: token,
    status: 'approved'
  });

  if (!request) {
    return next(new AppError('Invalid or expired invitation.', 404));
  }

  const hoursSinceSent = (Date.now() - new Date(request.invitationSentAt!).getTime()) / (1000 * 60 * 60);
  if (hoursSinceSent > 72) {
    return next(new AppError('Invitation has expired.', 400));
  }

  res.status(200).json({
    status: 'success',
    data: { 
      companyName: request.companyName,
      companyEmail: request.companyEmail
    }
  });
});

/**
 * 3. الموافقة على الطلب (للمسؤولين فقط)
 */
export const approveRequest = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params;
  const invitationToken = crypto.randomBytes(32).toString('hex');

  const request = await EmployerRequest.findByIdAndUpdate(id, {
    status: 'approved',
    invitationToken,
    invitationSentAt: new Date(),
    reviewedBy: (req.user as any)?._id,
    reviewedAt: new Date()
  }, { new: true });

  if (!request) return next(new AppError('Request not found', 404));

  // ملاحظة: هنا المفروض نبعت إيميل حقيقي للمستخدم فيه اللينك ده:
  // ${process.env.FRONTEND_URL}/employer/register?token=${invitationToken}

  res.status(200).json({
    status: 'success',
    message: 'Request approved and invitation token generated.',
    data: { invitationToken }
  });
});

/**
 * 4. التسجيل النهائي باستخدام التوكن
 */
export const registerWithToken = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { token, fullName, password } = req.body;

  const request = await EmployerRequest.findOne({ 
    invitationToken: token,
    status: 'approved'
  });

  if (!request) return next(new AppError('Invalid or expired invitation token.', 400));

  // إنشاء مستخدم جديد بنوع Employer
  const { User } = require('../models/user');
  const jwt = require('jsonwebtoken');

  const newUser = await User.create({
    fullName,
    email: request.companyEmail,
    password,
    role: 'employer',
    companyName: request.companyName,
    profileCompleted: false,
    socialLinks: {
      linkedin: request.linkedinUrl || ''
    }
  });

  // مسح التوكن عشان ميتسخدمش تاني
  request.invitationToken = undefined;
  await request.save();

  const jwtToken = jwt.sign(
    { id: newUser._id, role: newUser.role }, 
    process.env.JWT_SECRET, 
    { expiresIn: '7d' }
  );

  res.status(201).json({
    status: 'success',
    token: jwtToken,
    data: { user: newUser }
  });
});
