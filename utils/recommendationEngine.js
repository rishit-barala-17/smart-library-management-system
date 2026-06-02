const User = require('../models/User');
const Book = require('../models/Book');
const BorrowHistory = require('../models/BorrowHistory');

module.exports = { getRecommendations };

async function getRecommendations(userId, limit = 10) {
  // PHASE A — FETCH USER DATA
  const user = await User.findById(userId).select('recommendedGenres primaryGenre readerType');
  if (!user) return [];

  const borrowHistory = await BorrowHistory.find({ borrowed_by: userId }).populate('borrowed_book', 'genre _id');
  const borrowedBookIds = new Set();
  const genreFrequency = {};

  for (let record of borrowHistory) {
    if (record.borrowed_book && record.borrowed_book._id) {
      borrowedBookIds.add(record.borrowed_book._id.toString());
      const genre = record.borrowed_book.genre;
      if (genre) {
        genreFrequency[genre] = (genreFrequency[genre] || 0) + 1;
      }
    }
  }

  let totalBorrows = Object.values(genreFrequency).reduce((s, v) => s + v, 0);
  let vectorA = new Set(Object.keys(genreFrequency));

  // PHASE B — COLD START HANDLING
  if (totalBorrows < 3 && user.recommendedGenres) {
    for (let genre of user.recommendedGenres) {
      if (!vectorA.has(genre)) {
        vectorA.add(genre);
        genreFrequency[genre] = 1;
      }
    }
    totalBorrows = Object.values(genreFrequency).reduce((s, v) => s + v, 0);
  }

  if (vectorA.size === 0) {
    const topPopular = await Book.find({ _id: { $nin: [...borrowedBookIds] } })
      .sort({ popularityScore: -1 })
      .select('_id title author genre cover_image popularityScore isbn description stock total_copies waitlist reservedFor reservedUntil');
    
    return topPopular.slice(0, limit).map(book => {
      book.cover_image = book.cover_image || 'default_book.svg';
      book.genre = book.genre || 'General';
      return {
        book,
      jaccardScore: 0,
      finalScore: (book.popularityScore || 0) / 10,
      matchPercent: 0,
      reason: 'Trending in the library'
      };
    });
  }

  // PHASE C — FETCH CANDIDATES
  const candidates = await Book.find({ _id: { $nin: [...borrowedBookIds] } })
    .select('_id title author genre cover_image popularityScore isbn description stock total_copies waitlist reservedFor reservedUntil');

  if (candidates.length === 0) return [];

  // PHASE D — JACCARD SCORING
  const scored = candidates.map(book => {
    book.cover_image = book.cover_image || 'default_book.svg';
    book.genre = book.genre || 'General';
    const vectorB = new Set([book.genre]);
    
    let intersectionSize = 0;
    for (let genre of vectorB) {
      if (vectorA.has(genre)) {
        intersectionSize++;
      }
    }
    
    const unionSize = new Set([...vectorA, ...vectorB]).size;
    const jaccardScore = unionSize > 0 ? intersectionSize / unionSize : 0;
    const freqWeight = genreFrequency[book.genre] ? genreFrequency[book.genre] / totalBorrows : 0;
    const popularityNudge = (book.popularityScore || 0) / 200;
    const finalScore = jaccardScore + (freqWeight * 0.5) + popularityNudge;

    let reason = 'Recommended for you';
    if (jaccardScore >= 1) {
      reason = 'Strong Match';
    } else if (freqWeight >= 0.5) {
      reason = 'Because you read this genre often';
    } else if (popularityNudge > 0.04) {
      reason = 'Trending in the library';
    }

    return {
      book,
      jaccardScore: jaccardScore.toFixed(4),
      freqWeight: freqWeight.toFixed(4),
      finalScore: finalScore.toFixed(4),
      matchPercent: Math.round(jaccardScore * 100),
      reason
    };
  });

  // PHASE E — SORT AND RETURN
  scored.sort((a, b) => {
    const scoreDiff = parseFloat(b.finalScore) - parseFloat(a.finalScore);
    if (scoreDiff !== 0) return scoreDiff;
    return (b.book.popularityScore || 0) - (a.book.popularityScore || 0);
  });

  return scored.slice(0, limit);
}
