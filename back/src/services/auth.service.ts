import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { User } from '../models/user';
import { AppError } from '../utils/AppError';
import sendEmail from '../utils/sendEmail';

export const signToken = (id: string) => {
  return jwt.sign(
    { id }, 
    process.env.JWT_SECRET as string, 
    { expiresIn: (process.env.JWT_EXPIRES_IN || '90d') as any }
  );
};

export const loginUser = async (email: string, password: string) => {
  if (!email || !password) throw new AppError('Please enter your email and password.', 400);
  const user = await User.findOne({ email }).select('+password');
  
  if (!user || !(await user.comparePassword(password, user.password as string))) {
    throw new AppError('Invalid email or password. Please try again.', 401);
  }
  const token = signToken(user._id.toString());
  const profileComplete = user.profileComplete;
  user.password = undefined;
  return { user, token, profileComplete };
};

export const registerUser = async (userData: any) => {
  // Registration Shield: Prevent malicious role injection
  if (userData.role === 'admin' || !['freelancer', 'employer'].includes(userData.role)) {
    userData.role = 'freelancer'; // Default safe fallback
  }

  const query: any[] = [{ email: userData.email }];
  if (userData.phoneNumber) {
    query.push({ phoneNumber: userData.phoneNumber });
  }

  const existingUser = await User.findOne({ $or: query });
  
  if (existingUser) {
    if (existingUser.phoneNumber === userData.phoneNumber) {
      throw new AppError('This phone number is already registered.', 400);
    }
    throw new AppError('This email is already registered.', 400);
  }
  
  try {
    const newUser = await User.create(userData);
    const token = signToken(newUser._id.toString());
    newUser.password = undefined;
    return { user: newUser, token };
  } catch (err: any) {
    // Mongoose duplicate key error (race condition)
    if (err.code === 11000) {
      if (err.keyPattern?.phoneNumber) {
        throw new AppError('This phone number is already registered.', 400);
      }
      throw new AppError('This email is already registered.', 400);
    }
    throw err;
  }
};

export const forgotPassword = async (email: string) => {
  const user = await User.findOne({ email });
  if (!user) {
    throw new AppError('No account found with that email address.', 404);
  }
  
  const resetToken = crypto.randomBytes(32).toString('hex');
  user.resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex');
  user.resetPasswordExpire = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
  await user.save({ validateBeforeSave: false });
  
  const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password/${resetToken}`;
  console.log(`\n================================`);
  console.log(`🔑 PASSWORD RESET LINK GENERATED`);
  console.log(`🔗 ${resetUrl}`);
  console.log(`================================\n`);
  
  const message = `You are receiving this email because you (or someone else) has requested the reset of a password. Please make a PUT/POST request to: \n\n ${resetUrl}`;

  const htmlMessage = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
      <h2 style="color: #7C3AED; text-align: center;">Rabta Password Reset</h2>
      <p style="color: #333; font-size: 16px;">You are receiving this email because you (or someone else) has requested a password reset for your account.</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${resetUrl}" style="background-color: #7C3AED; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">Reset Password</a>
      </div>
      <p style="color: #777; font-size: 14px; text-align: center;">If you did not request this, please ignore this email and your password will remain unchanged.</p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
      <p style="color: #aaa; font-size: 12px; text-align: center;">Or copy and paste this link into your browser:<br/> <a href="${resetUrl}" style="color: #7C3AED;">${resetUrl}</a></p>
    </div>
  `;

  try {
    await sendEmail({
      email: user.email,
      subject: 'Rabta - Password Reset Request',
      message: message,
      html: htmlMessage
    });
    
    return true;
  } catch (err) {
    console.error('Email Send Error:', err);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save({ validateBeforeSave: false });
    
    throw new AppError('There was an error sending the email. Try again later!', 500);
  }
};

export const resetPassword = async (token: string, newPassword: string) => {
  const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
  
  const user = await User.findOne({
    resetPasswordToken: hashedToken,
    resetPasswordExpire: { $gt: Date.now() }
  });
  
  if (!user) throw new AppError('Token is invalid or has expired', 400);
  
  // Hash the new password directly here to guarantee correctness.
  // Using updateOne bypasses the pre-save hook, avoiding any double-hashing risk.
  const hashedPassword = await bcrypt.hash(newPassword, 12);
  console.log(`[RESET] Hashing new password for user: ${user.email}`);
  console.log(`[RESET] New hash starts with: ${hashedPassword.substring(0, 10)}...`);
  
  await User.updateOne(
    { _id: user._id },
    {
      password: hashedPassword,
      $unset: { resetPasswordToken: '', resetPasswordExpire: '' }
    }
  );
  
  console.log('[RESET] Password updated in DB successfully.');
  const jwtToken = signToken(user._id.toString());
  return { user, token: jwtToken };
};