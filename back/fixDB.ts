import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config({ path: './.env' });
import Community from './src/models/Community';
import Chat from './src/models/chat';

async function run() {
  await mongoose.connect(process.env.MONGO_URI as string);
  const communities = await Community.find();
  for (const comm of communities) {
    if (comm.chatId) {
      await Chat.findByIdAndUpdate(comm.chatId, {
        $addToSet: { users: { $each: comm.members } }
      });
      console.log('Fixed', comm.name);
    }
  }
  console.log('Done');
  process.exit(0);
}
run();
