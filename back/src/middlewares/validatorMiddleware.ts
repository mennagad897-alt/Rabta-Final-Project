import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';

export const validatorMiddleware = (req: Request | any, res: Response, next: NextFunction) => {
  // بنجمع كل الأخطاء اللي مكتبة التفتيش طلعتها
  const errors = validationResult(req);
  
  // لو المصفوفة مش فاضية (يعني فيه أخطاء)
  if (!errors.isEmpty()) {
    return res.status(400).json({
      status: 'error',
      errors: errors.array() // هيرجع للفرونت إند مصفوفة شيك فيها كل خطأ ومكانه فين
    });
  }
  
  // لو مفيش أخطاء، افتح الباب للريكويست يكمل للـ Controller
  next();
};