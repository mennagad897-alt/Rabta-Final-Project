const mongoose = require('mongoose');
require('dotenv').config({ path: './.env' });

const Community = require('./dist/models/Community').default || require('./dist/models/Community');
const Chat = require('./dist/models/chat').default || require('./dist/models/chat');

async function fixDB() {
  await mongoose.connect(process.env.DATABASE_URL || 'mongodb://localhost:27017/rabta');
  console.log('Connected to DB');

  const communities = await Community.find();
  for (const comm of communities) {
    if (comm.chatId) {
      await Chat.findByIdAndUpdate(comm.chatId, {
        $addToSet: { users: { $each: comm.members } }
      });
      console.log(`Synced members for community: ${comm.name}`);
    } else {
      console.log(`Community ${comm.name} has no chatId, skipping (or could create one)`);
    }
  }

  console.log('Done');
  process.exit(0);
}

fixDB();
