require('dotenv').config({ path: __dirname + '/../.env' });
const mongoose = require('mongoose');
const Book = require('../models/Book');
const User = require('../models/User');

const DB_URL = process.env.DB_URL || 'mongodb://127.0.0.1:27017/library-management-system';

// DB connect
mongoose.connect(DB_URL, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  useCreateIndex: true,
}).then(async () => {
  console.log('Connected to DB');

  try {
    await Book.updateMany({}, {
      waitlist: [],
      reservedFor: null,
      reservedUntil: null
    });
    console.log('Reset all book waitlists');

    const users = await User.find({ role: { $ne: 0 } }).limit(50);
    const userIds = users.map(u => u._id);
    if (userIds.length === 0) {
      console.log('No users found.');
      process.exit(1);
    }

    // fetch books
    const books = await Book.find();
    if (books.length === 0) {
      console.log('No books found.');
      process.exit(1);
    }

    const shuffledBooks = books.sort(() => 0.5 - Math.random());
    
    const tier1 = shuffledBooks.slice(0, 15);
    const tier2 = shuffledBooks.slice(15, 50);
    const tier3 = shuffledBooks.slice(50, 100);

    const getRandomWaitlist = (min, max) => {
      const size = Math.floor(Math.random() * (max - min + 1)) + min;
      const shuffledUsers = [...userIds].sort(() => 0.5 - Math.random());
      return shuffledUsers.slice(0, size);
    };

    let processedCount = 0;

    // Tier 1
    for (let i = 0; i < tier1.length; i++) {
      const b = tier1[i];
      b.stock = 0;
      b.waitlist = getRandomWaitlist(8, 15);
      
      if (i < 5 && b.waitlist.length > 0) {
        b.reservedFor = b.waitlist.shift();
        b.reservedUntil = new Date(Date.now() + 20 * 60 * 60 * 1000); // +20 hrs
      }
      await b.save();
      processedCount++;
    }

    // Tier 2
    for (let b of tier2) {
      b.stock = 0;
      b.waitlist = getRandomWaitlist(3, 7);
      await b.save();
      processedCount++;
    }

    // Tier 3
    for (let b of tier3) {
      b.stock = 0;
      b.waitlist = getRandomWaitlist(1, 2);
      await b.save();
      processedCount++;
    }

    console.log(`Simulation complete. Simulated waitlists for ${processedCount} books.`);
  } catch (error) {
    console.error('Simulation error:', error);
  } finally {
    // DB disconnect
    mongoose.connection.close();
    process.exit(0);
  }
}).catch(err => {
  console.error('DB Connection error:', err);
});
