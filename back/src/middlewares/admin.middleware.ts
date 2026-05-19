import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/AppError';

export const isAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (req.user && req.user.role === 'admin') {
    return next();
  }
  return res.status(403).json({
    status: 'error',
    message: 'Forbidden. Admin access required.'
  });
};
