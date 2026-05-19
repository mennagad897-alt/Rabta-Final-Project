import { check } from 'express-validator';
import { validatorMiddleware } from '../middlewares/validatorMiddleware';

// 📝 قواعد تفتيش التسجيل (Register)
export const registerValidator = [
  check('fullName')
    .notEmpty().withMessage('Full name is required')
    .isLength({ min: 3 }).withMessage('Name must be at least 3 characters'),
  
  check('email')
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Invalid email format'),

  check('phoneNumber')
    .notEmpty().withMessage('Phone number is required')
    .isMobilePhone('ar-EG').withMessage('Invalid  phone number '), // 👈 تريكة: بيتأكد إنه رقم صح

  check('password')
    .notEmpty().withMessage('Password is required')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),

  check('role')
    .notEmpty().withMessage('Role is required')
    .isIn(['freelancer', 'employer']).withMessage('Role must be freelancer or employer'),

  // بعد ما نكتب القواعد، بنوقف الحارس على الباب
  validatorMiddleware
];

// 📝 قواعد تفتيش تسجيل الدخول (Login)
export const loginValidator = [
  check('email')
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Invalid email format'),

  check('password')
    .notEmpty().withMessage('Password is required'),

  validatorMiddleware
];