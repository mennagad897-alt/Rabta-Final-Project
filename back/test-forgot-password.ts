import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import { User } from './src/models/user';
import * as authService from './src/services/auth.service';

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
    
    console.log(`Testing with email: ${user.email}`);
    await authService.forgotPassword(user.email);
    console.log('Success!');
  } catch (err) {
    console.error('Error occurred:', err);
  } finally {
    mongoose.disconnect();
  }
}

test();
