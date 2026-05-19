import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import { User } from './src/models/user';

dotenv.config();

async function testHashAndCompare() {
  await mongoose.connect(process.env.MONGO_URI as string);
  console.log('\n✅ Connected to DB');

  const testEmail = process.argv[2];
  const testPassword = process.argv[3] || 'TestPassword123';

  if (!testEmail) {
    console.log('Usage: npx ts-node test-hash.ts <email> <password>');
    process.exit(1);
  }

  const user = await User.findOne({ email: testEmail }).select('+password');
  if (!user) {
    console.log(`❌ No user found with email: ${testEmail}`);
    process.exit(1);
  }

  console.log(`\n📧 Found user: ${user.email} (ID: ${user._id})`);
  console.log(`🔒 Current stored hash: ${user.password}`);

  // Step 1: Hash the password
  const newHash = await bcrypt.hash(testPassword, 12);
  console.log(`\n🔑 New hash for "${testPassword}": ${newHash}`);

  // Step 2: Update directly in DB
  await User.updateOne({ _id: user._id }, { password: newHash });
  console.log('\n💾 Updated in DB via updateOne');

  // Step 3: Read back and verify
  const verifiedUser = await User.findById(user._id).select('+password');
  console.log(`📖 Read-back hash from DB: ${verifiedUser?.password}`);
  
  const matches = verifiedUser?.password === newHash;
  console.log(`🔍 Hash in DB matches what we saved: ${matches}`);

  const compareResult = await bcrypt.compare(testPassword, verifiedUser?.password as string);
  console.log(`✅ bcrypt.compare("${testPassword}", <hash>) = ${compareResult}`);

  if (compareResult) {
    console.log('\n🎉 SUCCESS: Password hashing and comparison works correctly!');
    console.log(`👉 You can now log in with: ${testEmail} / ${testPassword}`);
  } else {
    console.log('\n❌ FAILED: Something is wrong with hashing or DB storage!');
  }

  mongoose.disconnect();
}

testHashAndCompare().catch(console.error);
