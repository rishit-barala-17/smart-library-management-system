/**
 * seed.js — Production-Grade ML Dataset Generator
 * 
 * Generates a realistic library dataset optimized for collaborative filtering
 * and content-based recommendation engine training.
 * 
 * Usage: node seed.js
 * Requires: npm install @faker-js/faker
 */

require('dotenv').config()
const mongoose = require('mongoose')
const bcrypt = require('bcrypt')
const { faker } = require('@faker-js/faker')

const Book = require('./models/Book')
const User = require('./models/User')
const BorrowHistory = require('./models/BorrowHistory')
const Cart = require('./models/Cart')

// ─────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────

const FIXED_GENRES = [
  'Art', 'Science Fiction', 'Fantasy', 'Finance', 'Biographies',
  'Recipes', 'Romance', 'Children', 'History', 'Medicine',
  'Religion', 'Mystery', 'Music', 'Science'
]

const SECTIONS = ['Science & Medicine', 'Fiction & Literature', 'Arts & Humanities', 'History & Biography', 'Lifestyle & General']
const SIDES = ['Front', 'Back']
const SHELVES = ['A', 'B', 'C', 'D', 'E']

const NUM_BOOKS = 1000
const NUM_USERS = 100
const FINE_PER_DAY = 5 // ₹5 per day

// Genre-aware title prefixes for realism
const GENRE_TITLE_MAP = {
  'Art': () => faker.helpers.arrayElement(['The Art of', 'Masterworks:', 'Colors of', 'Visual', 'Canvas:', 'Brushstrokes of', 'Gallery:', 'Aesthetic']) + ' ' + faker.word.adjective() + ' ' + faker.word.noun(),
  'Science Fiction': () => faker.helpers.arrayElement(['Star', 'Quantum', 'Nebula:', 'Beyond', 'The Last', 'Echo of', 'Protocol:', 'Singularity:']) + ' ' + faker.word.adjective() + ' ' + faker.word.noun(),
  'Fantasy': () => faker.helpers.arrayElement(['The Kingdom of', 'Dragon\'s', 'Sword of', 'The Enchanted', 'Realm of', 'The Dark', 'Crown of', 'Spell:']) + ' ' + faker.word.adjective() + ' ' + faker.word.noun(),
  'Finance': () => faker.helpers.arrayElement(['The Intelligent', 'Wealth', 'Money:', 'Markets:', 'Investing in', 'Capital', 'The Economics of', 'Portfolio:']) + ' ' + faker.word.adjective() + ' ' + faker.word.noun(),
  'Biographies': () => 'The Life of ' + faker.person.fullName(),
  'Recipes': () => faker.helpers.arrayElement(['The Complete', 'Essential', 'Modern', 'Classic', 'Homestyle', 'Gourmet']) + ' ' + faker.helpers.arrayElement(['Cookbook', 'Kitchen', 'Recipes', 'Baking Guide', 'Cuisine']),
  'Romance': () => faker.helpers.arrayElement(['Love in', 'Heart of', 'The Promise of', 'Whispers of', 'Forever', 'Under the', 'Moonlit']) + ' ' + faker.word.adjective() + ' ' + faker.word.noun(),
  'Children': () => faker.helpers.arrayElement(['The Little', 'Adventures of', 'Magic', 'Captain', 'The Brave', 'Tiny', 'Wonder']) + ' ' + faker.word.noun(),
  'History': () => faker.helpers.arrayElement(['The Rise of', 'Empire:', 'A History of', 'The Fall of', 'Chronicles of', 'The Age of', 'Legacy of']) + ' ' + faker.word.adjective() + ' ' + faker.word.noun(),
  'Medicine': () => faker.helpers.arrayElement(['Clinical', 'Principles of', 'Human', 'Medical', 'Pathology:', 'Anatomy of', 'Diagnosis:']) + ' ' + faker.word.adjective() + ' ' + faker.word.noun(),
  'Religion': () => faker.helpers.arrayElement(['The Path of', 'Sacred', 'Spiritual', 'Faith and', 'The Book of', 'Wisdom of', 'Teachings of']) + ' ' + faker.word.adjective() + ' ' + faker.word.noun(),
  'Mystery': () => faker.helpers.arrayElement(['The Case of', 'Shadow of', 'Silent', 'The Missing', 'Dark', 'Dead', 'The Last']) + ' ' + faker.word.adjective() + ' ' + faker.word.noun(),
  'Music': () => faker.helpers.arrayElement(['The Sound of', 'Harmony:', 'Notes on', 'Rhythm and', 'Melody of', 'The Music in', 'Chords:']) + ' ' + faker.word.adjective() + ' ' + faker.word.noun(),
  'Science': () => faker.helpers.arrayElement(['The Theory of', 'Quantum', 'Fundamentals of', 'Exploring', 'The Nature of', 'Elements of', 'Physics:']) + ' ' + faker.word.adjective() + ' ' + faker.word.noun(),
}

// ─────────────────────────────────────────────────
// UTILITY FUNCTIONS
// ─────────────────────────────────────────────────

/**
 * Generate a bell-curve popularity score (1-10).
 * Uses Box-Muller transform for normal distribution.
 * Mean=5, StdDev=1.8 → ~5% chance of 9-10
 */
function generatePopularityScore() {
  const u1 = Math.random()
  const u2 = Math.random()
  const z = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2)
  const score = Math.round(5 + z * 1.8)
  return Math.max(1, Math.min(10, score))
}

/**
 * Weighted random pick from a book pool.
 * Books with higher popularityScore are more likely to be selected.
 */
function weightedRandomPick(books) {
  if (!books || books.length === 0) return null
  const totalWeight = books.reduce((sum, b) => sum + b.popularityScore, 0)
  let rand = Math.random() * totalWeight
  for (const book of books) {
    rand -= book.popularityScore
    if (rand <= 0) return book
  }
  return books[books.length - 1]
}

/**
 * Pick N unique random items from an array.
 */
function pickUnique(arr, n) {
  const shuffled = [...arr].sort(() => 0.5 - Math.random())
  return shuffled.slice(0, n)
}

/**
 * Generate borrow dates based on reader type over the past 2 years.
 */
function generateBorrowDates(readerType, borrowIndex, totalBorrows) {
  const now = new Date()
  const twoYearsAgo = new Date(now)
  twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2)
  const rangeMs = now.getTime() - twoYearsAgo.getTime()

  let borrowDate

  if (readerType === 'Heavy') {
    // Uniform distribution across 2 years
    borrowDate = new Date(twoYearsAgo.getTime() + Math.random() * rangeMs)
  } else if (readerType === 'Casual') {
    // Cluster into 2-3 bursts (each ~2 months wide)
    const numBursts = faker.helpers.arrayElement([2, 3])
    const burstIndex = borrowIndex % numBursts
    // Place burst centers evenly across the 2-year window
    const burstCenterFraction = (burstIndex + 0.5) / numBursts
    const burstCenterMs = twoYearsAgo.getTime() + burstCenterFraction * rangeMs
    // Jitter within ~30 days of the burst center
    const jitterMs = (Math.random() - 0.5) * 60 * 24 * 60 * 60 * 1000
    borrowDate = new Date(burstCenterMs + jitterMs)
  } else {
    // Dormant: sparse, random across 2 years
    borrowDate = new Date(twoYearsAgo.getTime() + Math.random() * rangeMs)
  }

  // Clamp to valid range
  if (borrowDate > now) borrowDate = new Date(now.getTime() - 86400000)
  if (borrowDate < twoYearsAgo) borrowDate = new Date(twoYearsAgo.getTime() + 86400000)

  // Return date is 14-30 days after borrow
  const loanDays = faker.number.int({ min: 14, max: 30 })
  const returnDate = new Date(borrowDate.getTime() + loanDays * 86400000)

  return { borrowDate, returnDate }
}

/**
 * Determine if a borrow is overdue based on reader type.
 */
function isOverdue(readerType) {
  const rand = Math.random()
  if (readerType === 'Dormant') return rand < 0.25
  if (readerType === 'Casual') return rand < 0.08
  return rand < 0.03 // Heavy
}

/**
 * Generate a unique ISBN-13.
 */
const usedIsbns = new Set()
function generateIsbn() {
  let isbn
  do {
    isbn = '978' + faker.string.numeric(10)
  } while (usedIsbns.has(isbn))
  usedIsbns.add(isbn)
  return isbn
}

// ─────────────────────────────────────────────────
// MAIN SEED FUNCTION
// ─────────────────────────────────────────────────

async function seed() {
  console.log('╔══════════════════════════════════════════╗')
  console.log('║   ML Dataset Seed — Library System       ║')
  console.log('╚══════════════════════════════════════════╝')
  console.log()

  // ── Connect ──
  await mongoose.connect(process.env.DB_URL)
  console.log('✓ Connected to MongoDB')

  // ═══════════════════════════════════════════════
  // 1. SETUP & WIPE
  // ═══════════════════════════════════════════════
  console.log('\n── Step 1: Wiping existing data (preserving admin) ──')

  await Book.deleteMany({})
  console.log('  ✓ Deleted all Books')

  await BorrowHistory.deleteMany({})
  console.log('  ✓ Deleted all BorrowHistories')

  await Cart.deleteMany({})
  console.log('  ✓ Deleted all Carts')

  await User.deleteMany({ role: { $ne: 0 } })
  console.log('  ✓ Deleted all non-admin Users')

  // ═══════════════════════════════════════════════
  // 2. GENERATE 1,000 BOOKS WITH POPULARITY SCORES
  // ═══════════════════════════════════════════════
  console.log('\n── Step 2: Generating 1,000 books with popularity scores ──')

  const bookDocs = []
  const booksByGenre = {}
  FIXED_GENRES.forEach(g => { booksByGenre[g] = [] })

  for (let i = 0; i < NUM_BOOKS; i++) {
    const genre = FIXED_GENRES[i % FIXED_GENRES.length]
    const popScore = generatePopularityScore()
    const section = SECTIONS[Math.floor(Math.random() * SECTIONS.length)]

    const book = {
      isbn: generateIsbn(),
      title: GENRE_TITLE_MAP[genre](),
      author: faker.person.fullName(),
      publish_year: String(faker.number.int({ min: 1950, max: 2024 })),
      page_count: faker.number.int({ min: 80, max: 900 }),
      genre: genre,
      description: faker.lorem.sentences({ min: 2, max: 5 }),
      stock: faker.number.int({ min: 1, max: 20 }),
      cover_image: 'default_book.jpg',
      popularityScore: popScore,
      location: {
        section: section,
        side: SIDES[Math.floor(Math.random() * 2)],
        row: String(faker.number.int({ min: 1, max: 5 })),
        shelf: SHELVES[Math.floor(Math.random() * SHELVES.length)],
        column: String(faker.number.int({ min: 1, max: 35 })),
      },
    }
    bookDocs.push(book)
  }

  const insertedBooks = await Book.insertMany(bookDocs)
  console.log(`  ✓ Inserted ${insertedBooks.length} books`)

  // Map books by genre for weighted selection
  insertedBooks.forEach(book => {
    if (booksByGenre[book.genre]) {
      booksByGenre[book.genre].push(book)
    }
  })

  // Popularity distribution report
  const popDist = {}
  insertedBooks.forEach(b => { popDist[b.popularityScore] = (popDist[b.popularityScore] || 0) + 1 })
  console.log('  Popularity distribution:')
  for (let s = 1; s <= 10; s++) {
    const count = popDist[s] || 0
    const bar = '█'.repeat(Math.round(count / 5))
    console.log(`    Score ${s.toString().padStart(2)}: ${count.toString().padStart(4)} ${bar}`)
  }
  const elite = (popDist[9] || 0) + (popDist[10] || 0)
  console.log(`  → Elite books (9-10): ${elite} (${((elite / NUM_BOOKS) * 100).toFixed(1)}%)`)

  // ═══════════════════════════════════════════════
  // 3. GENERATE 100 USERS WITH CLUSTERING & LABELS
  // ═══════════════════════════════════════════════
  console.log('\n── Step 3: Generating 100 users with reader profiles ──')

  const salt = await bcrypt.genSalt()
  const hashedPassword = await bcrypt.hash('password123', salt)

  const userDocs = []
  for (let i = 0; i < NUM_USERS; i++) {
    // Assign reader type: 20% Heavy, 60% Casual, 20% Dormant
    let readerType
    if (i < 20) readerType = 'Heavy'
    else if (i < 80) readerType = 'Casual'
    else readerType = 'Dormant'

    // Assign genre preferences
    const shuffledGenres = pickUnique(FIXED_GENRES, 3)
    const primaryGenre = shuffledGenres[0]
    const secondaryGenres = [shuffledGenres[1], shuffledGenres[2]]
    const recommendedGenres = [primaryGenre, ...secondaryGenres]

    const firstName = faker.person.firstName()
    const lastName = faker.person.lastName()

    userDocs.push({
      name: `${firstName} ${lastName}`,
      email: faker.internet.email({ firstName, lastName, provider: 'library.edu' }).toLowerCase(),
      password: hashedPassword,
      profile_picture: 'default_user.svg',
      role: 1,
      readerType,
      primaryGenre,
      secondaryGenres,
      recommendedGenres,
    })
  }

  // Use insertMany and bypass the pre-save hook (password already hashed)
  const insertedUsers = await User.collection.insertMany(userDocs)
  const userIds = Object.values(insertedUsers.insertedIds)
  console.log(`  ✓ Inserted ${userIds.length} users`)

  // Reader type report
  const typeCounts = { Heavy: 0, Casual: 0, Dormant: 0 }
  userDocs.forEach(u => typeCounts[u.readerType]++)
  console.log(`  → Heavy: ${typeCounts.Heavy}, Casual: ${typeCounts.Casual}, Dormant: ${typeCounts.Dormant}`)

  // ═══════════════════════════════════════════════
  // 4. GENERATE BORROW HISTORIES
  // ═══════════════════════════════════════════════
  console.log('\n── Step 4: Generating weighted borrow histories ──')

  const allBooks = insertedBooks
  const borrowDocs = []
  let totalBorrowCount = 0
  let primaryPicks = 0, secondaryPicks = 0, randomPicks = 0
  let overdueCount = 0
  let totalFinesGenerated = 0

  for (let i = 0; i < userDocs.length; i++) {
    const userData = userDocs[i]
    const userId = userIds[i]

    // Determine borrow count based on reader type
    let borrowCount
    if (userData.readerType === 'Heavy') {
      borrowCount = faker.number.int({ min: 15, max: 30 })
    } else if (userData.readerType === 'Casual') {
      borrowCount = faker.number.int({ min: 5, max: 14 })
    } else {
      borrowCount = faker.number.int({ min: 1, max: 4 })
    }

    for (let j = 0; j < borrowCount; j++) {
      // ── Weighted Book Selection ──
      let selectedBook = null
      const roll = Math.random()

      if (roll < 0.60) {
        // 60%: Pick from primary genre
        const pool = booksByGenre[userData.primaryGenre]
        selectedBook = weightedRandomPick(pool)
        primaryPicks++
      } else if (roll < 0.85) {
        // 25%: Pick from secondary genres
        const secGenre = faker.helpers.arrayElement(userData.secondaryGenres)
        const pool = booksByGenre[secGenre]
        selectedBook = weightedRandomPick(pool)
        secondaryPicks++
      } else {
        // 15%: Pick a random book (still weighted by popularity)
        selectedBook = weightedRandomPick(allBooks)
        randomPicks++
      }

      if (!selectedBook) {
        selectedBook = weightedRandomPick(allBooks)
        randomPicks++
      }

      // ── Time-Based Trends ──
      const { borrowDate, returnDate } = generateBorrowDates(userData.readerType, j, borrowCount)

      // ── Behavioral Fine Rates ──
      const overdue = isOverdue(userData.readerType)
      let bookReturned = true
      let status = 'Completed'
      let fineAmount = 0

      if (overdue) {
        overdueCount++
        const daysLate = faker.number.int({ min: 1, max: 45 })
        fineAmount = daysLate * FINE_PER_DAY
        totalFinesGenerated += fineAmount

        // 50% of overdue books are still not returned
        if (Math.random() < 0.5) {
          bookReturned = false
          status = 'Overdue'
        } else {
          status = 'Completed (Late)'
        }
      }

      borrowDocs.push({
        borrowed_by: userId,
        borrowed_book: selectedBook._id,
        borrow_date: borrowDate,
        return_date: returnDate,
        status,
        book_returned: bookReturned,
        fine_amount: fineAmount,
      })
      totalBorrowCount++
    }
  }

  // Batch insert borrow histories
  const BATCH_SIZE = 500
  for (let i = 0; i < borrowDocs.length; i += BATCH_SIZE) {
    const batch = borrowDocs.slice(i, i + BATCH_SIZE)
    await BorrowHistory.insertMany(batch)
  }
  console.log(`  ✓ Inserted ${totalBorrowCount} borrow records`)

  // ═══════════════════════════════════════════════
  // 5. FINAL ANALYTICS REPORT
  // ═══════════════════════════════════════════════
  console.log('\n══════════════════════════════════════════')
  console.log('  DATASET ANALYTICS REPORT')
  console.log('══════════════════════════════════════════')
  console.log(`  Books:           ${insertedBooks.length}`)
  console.log(`  Users:           ${userIds.length}`)
  console.log(`  Borrow Records:  ${totalBorrowCount}`)
  console.log()
  console.log('  Borrow Source Breakdown:')
  console.log(`    Primary Genre:   ${primaryPicks} (${((primaryPicks / totalBorrowCount) * 100).toFixed(1)}%)`)
  console.log(`    Secondary Genre: ${secondaryPicks} (${((secondaryPicks / totalBorrowCount) * 100).toFixed(1)}%)`)
  console.log(`    Random:          ${randomPicks} (${((randomPicks / totalBorrowCount) * 100).toFixed(1)}%)`)
  console.log()
  console.log('  Overdue & Fines:')
  console.log(`    Overdue records: ${overdueCount} (${((overdueCount / totalBorrowCount) * 100).toFixed(1)}%)`)
  console.log(`    Total fines:     ₹${totalFinesGenerated.toLocaleString('en-IN')}`)
  console.log()
  console.log('══════════════════════════════════════════')
  console.log('  ✓ Seed complete. Database ready for ML training.')
  console.log('══════════════════════════════════════════')

  await mongoose.disconnect()
  process.exit(0)
}

seed().catch(err => {
  console.error('✗ Seed failed:', err)
  process.exit(1)
})
