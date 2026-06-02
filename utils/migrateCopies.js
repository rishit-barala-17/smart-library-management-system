require('dotenv').config();
const mongoose = require('mongoose');
const Book = require('../models/Book');

// DB connect
mongoose.connect(process.env.DB_URL, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  useCreateIndex: true,
}).then(async () => {
  try {
    // fetch books
    const books = await Book.find({
      $or: [
        { total_copies: 0 },
        { total_copies: { $exists: false } },
        { total_copies: null }
      ]
    });
    
    let count = 0;
    for (const book of books) {
      book.total_copies = book.stock;
      await book.save();
      count++;
    }
    
    console.log(`Migrated ${count} books`);
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    // DB disconnect
    mongoose.disconnect();
    process.exit(0);
  }
}).catch((err) => {
  console.error('DB Connection Error:', err);
  process.exit(1);
});
