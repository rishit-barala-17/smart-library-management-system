const cron = require('node-cron');
const Book = require('../models/Book');

// NOTE: Demand ratios in analytics will be incorrect if the migration script 
// has not been run (node utils/migrateCopies.js). Make sure to run it once!

const startReservationCron = () => {
  // Run every 30 minutes
  cron.schedule('*/30 * * * *', async () => {
    try {
      console.log('Running reservation cron job...');
      const now = new Date();
      // Find books where the reservation has expired
      const expiredBooks = await Book.find({
        reservedUntil: { $lt: now },
        reservedFor: { $ne: null }
      });

      for (let book of expiredBooks) {
        if (book.waitlist && book.waitlist.length > 0) {
          // Pass reservation to the next user in the waitlist
          const nextUserId = book.waitlist.shift();
          book.reservedFor = nextUserId;
          book.reservedUntil = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours from now
        } else {
          // No one in waitlist, return to general stock
          book.stock += 1;
          book.reservedFor = null;
          book.reservedUntil = null;
        }
        await book.save();
      }
      if (expiredBooks.length > 0) {
        console.log(`Processed ${expiredBooks.length} expired reservations.`);
      }
    } catch (err) {
      console.error('Error in reservation cron job:', err);
    }
  });
};

module.exports = startReservationCron;
