const cron = require('node-cron');
const Book = require('../models/Book');

const startReservationCron = () => {
  cron.schedule('*/30 * * * *', async () => {
    try {
      const expiredBooks = await Book.find({
        reservedUntil: { $lt: new Date() },
        reservedFor: { $ne: null }
      });

      for (let book of expiredBooks) {
        if (book.waitlist && book.waitlist.length > 0) {
          const nextUser = book.waitlist.shift();
          book.reservedFor = nextUser;
          book.reservedUntil = new Date(Date.now() + 24 * 60 * 60 * 1000);
          console.log('[CRON] Reservation passed to next user');
        } else {
          book.stock += 1;
          book.reservedFor = null;
          book.reservedUntil = null;
          console.log('[CRON] No waitlist. Stock restored.');
        }
        await book.save();
      }
    } catch (err) {
      console.error(err);
    }
  });
};

module.exports = { startReservationCron };
