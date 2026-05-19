import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import { User } from './src/models/user';
import bcrypt from 'bcryptjs';

dotenv.config();

async function test() {
  await mongoose.connect(process.env.MONGO_URI as string);
  console.log('Connected to DB');

  try {
    const user = await User.findOne();
    if (!user) {
      console.log('No user to test with');
      process.exit(0);
    }
    
    console.log(`Testing with user: ${user.email}`);
    user.password = 'newPassword123';
    await user.save({ validateBeforeSave: false });
    
    const checkUser = await User.findById(user._id).select('+password');
    console.log('Saved password is:', checkUser?.password);
    console.log('Is hashed?', checkUser?.password?.startsWith('$2a$'));
  } catch (err) {
    console.error('Error occurred:', err);
  } finally {
    mongoose.disconnect();
  }
}

test();
