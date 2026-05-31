require('dotenv').config()
const mongoose = require('mongoose')
const Book = require('./models/Book')
const User = require('./models/User')
const BorrowHistory = require('./models/BorrowHistory')
const Cart = require('./models/Cart')
const { Faker, en_IN, en } = require('@faker-js/faker')
const faker = new Faker({ locale: [en_IN, en] })
const bcrypt = require('bcrypt')

// --- CONSTANTS ---
const GENRES = [
  'Art', 'Science Fiction', 'Fantasy', 'Finance', 'Biographies',
  'Recipes', 'Romance', 'Children', 'History', 'Medicine',
  'Religion', 'Mystery', 'Music', 'Science'
]

const GENRE_WEIGHTS = {
  'Science Fiction': 0.13,
  'Mystery':         0.11,
  'Romance':         0.10,
  'History':         0.09,
  'Biographies':     0.08,
  'Children':        0.08,
  'Fantasy':         0.07,
  'Science':         0.07,
  'Art':             0.06,
  'Medicine':        0.05,
  'Finance':         0.05,
  'Music':           0.04,
  'Recipes':         0.04,
  'Religion':        0.03
}

const SECTIONS = [
  'Science & Medicine',
  'Fiction & Literature',
  'Arts & Humanities',
  'History & Biography',
  'Lifestyle & General'
]

// --- HELPER FUNCTIONS ---
function weightedGenrePick() {
  const keys = Object.keys(GENRE_WEIGHTS)
  let sum = 0
  for (let key of keys) sum += GENRE_WEIGHTS[key]
  
  let rand = Math.random() * sum
  for (let key of keys) {
    if (rand < GENRE_WEIGHTS[key]) return key
    rand -= GENRE_WEIGHTS[key]
  }
  return keys[keys.length - 1]
}

function bellCurveScore() {
  const avg = (Math.random() + Math.random() + Math.random()) / 3
  const score = Math.round(avg * 9 + 1)
  return Math.max(1, Math.min(10, score))
}

function weightedBookPick(booksArray) {
  if (!booksArray || booksArray.length === 0) return null
  let sum = 0
  for (const b of booksArray) sum += b.popularityScore
  let rand = Math.random() * sum
  for (const b of booksArray) {
    if (rand < b.popularityScore) return b
    rand -= b.popularityScore
  }
  return booksArray[booksArray.length - 1]
}

function randomDateBetween(startDate, endDate) {
  return new Date(startDate.getTime() + Math.random() * (endDate.getTime() - startDate.getTime()))
}

function shuffle(array) {
  let currentIndex = array.length, randomIndex;
  while (currentIndex !== 0) {
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;
    [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
  }
  return array;
}

// --- MAIN EXECUTION ---
async function runSeed() {
  try {
    // --- DATABASE CONNECTION ---
    console.log('Connecting to database...')
    await mongoose.connect(process.env.DB_URL, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      useCreateIndex: true
    })
    console.log('Database connected successfully.')

    // --- WIPE LOGIC ---
    console.log('Wiping existing data...')
    await Book.deleteMany({})
    console.log('All documents from the Books collection deleted.')
    await BorrowHistory.deleteMany({})
    console.log('All documents from the BorrowHistories collection deleted.')
    await Cart.deleteMany({})
    console.log('All documents from the Carts collection deleted.')
    await User.deleteMany({ role: { $ne: 0 } })
    console.log('All Users WHERE role is not equal to 0 deleted.')

    // --- BOOK GENERATION ---
    console.log('Generating Books...')
    const bookObjects = []
    const genreCounts = {}

    for (let i = 0; i < 1000; i++) {
      const isbn = faker.string.numeric(13)
      // faker.lorem.words returns a single string of words.
      let generatedTitle = `${faker.word.adjective()} ${faker.word.noun()}`
      generatedTitle = generatedTitle.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')

      const book = {
        isbn: isbn,
        title: generatedTitle,
        author: faker.person.fullName(),
        publish_year: faker.number.int({ min: 1950, max: 2023 }).toString(),
        page_count: faker.number.int({ min: 80, max: 900 }),
        genre: weightedGenrePick(),
        description: faker.lorem.sentences(3),
        stock: faker.number.int({ min: 1, max: 25 }),
        cover_image: 'default_book.svg',
        popularityScore: bellCurveScore(),
        location_section: SECTIONS[Math.floor(Math.random() * SECTIONS.length)],
        location_side: Math.random() < 0.5 ? 'Front' : 'Back',
        location_row: ['A','B','C','D','E'][Math.floor(Math.random() * 5)],
        location_column: faker.number.int({ min: 1, max: 35 }),
        waitlist: [],
        reservedFor: null,
        reservedUntil: null
      }
      bookObjects.push(book)
    }

    const insertedBooks = await Book.insertMany(bookObjects)
    
    const booksByGenre = {}
    const allBooks = []

    for (const doc of insertedBooks) {
      genreCounts[doc.genre] = (genreCounts[doc.genre] || 0) + 1
      const mappedBook = { _id: doc._id, popularityScore: doc.popularityScore }
      
      if (!booksByGenre[doc.genre]) {
        booksByGenre[doc.genre] = []
      }
      booksByGenre[doc.genre].push(mappedBook)
      allBooks.push(mappedBook)
    }

    // --- USER GENERATION ---
    console.log('Generating Users...')
    const userObjects = []
    const generatedEmails = new Set()

    for (let i = 0; i < 100; i++) {
      let readerType;
      if (i <= 19) readerType = 'Heavy'
      else if (i <= 79) readerType = 'Casual'
      else readerType = 'Dormant'

      userObjects.push({
        readerType: readerType
      })
    }

    shuffle(userObjects)

    // Assign remaining fields
    const passwordsToHash = []
    for (let i = 0; i < 100; i++) {
      passwordsToHash.push(bcrypt.hash('password123', 10))
    }
    const hashedPasswords = await Promise.all(passwordsToHash)

    for (let i = 0; i < 100; i++) {
      const u = userObjects[i]
      const name = faker.person.fullName()
      const parts = name.split(' ')
      const firstName = parts[0].toLowerCase().replace(/[^a-z0-9]/g, '')
      const lastName = parts.length > 1 ? parts[parts.length - 1].toLowerCase().replace(/[^a-z0-9]/g, '') : ''
      let email = `${firstName}.${lastName}@gmail.com`
      
      if (generatedEmails.has(email)) {
        email = `${firstName}.${lastName}${faker.string.numeric(4)}@gmail.com`
      }
      generatedEmails.add(email)

      const primaryGenre = GENRES[Math.floor(Math.random() * GENRES.length)]
      let secondaryGenre1, secondaryGenre2
      do {
        secondaryGenre1 = GENRES[Math.floor(Math.random() * GENRES.length)]
      } while (secondaryGenre1 === primaryGenre)
      do {
        secondaryGenre2 = GENRES[Math.floor(Math.random() * GENRES.length)]
      } while (secondaryGenre2 === primaryGenre || secondaryGenre2 === secondaryGenre1)

      u.name = name
      u.email = email
      u.password = hashedPasswords[i]
      u.role = 1
      u.profile_picture = 'default_user.svg'
      u.recommendedGenres = [primaryGenre, secondaryGenre1, secondaryGenre2]
      u.primaryGenre = primaryGenre
      u.secondaryGenres = [secondaryGenre1, secondaryGenre2]
    }

    const insertedUsers = await User.insertMany(userObjects)
    const userMap = {}
    for (let i = 0; i < insertedUsers.length; i++) {
      userMap[insertedUsers[i]._id] = userObjects[i]
    }

    // --- BORROWHISTORY GENERATION ---
    console.log('Generating Borrow History...')
    const borrowDocs = []
    let totalFineGenerated = 0
    let recordsWithFine = 0

    const TODAY = new Date()
    const TWO_YEARS_AGO = new Date(TODAY.getTime() - (730 * 24 * 60 * 60 * 1000))

    for (const doc of insertedUsers) {
      const user = userMap[doc._id]
      let borrowCount = 0

      if (user.readerType === 'Heavy') {
        borrowCount = Math.floor(Math.random() * (30 - 15 + 1)) + 15
      } else if (user.readerType === 'Casual') {
        borrowCount = Math.floor(Math.random() * (14 - 5 + 1)) + 5
      } else if (user.readerType === 'Dormant') {
        borrowCount = Math.floor(Math.random() * (4 - 1 + 1)) + 1
      }

      // Generate dates upfront for the user
      const borrowDates = []
      if (user.readerType === 'Heavy' || user.readerType === 'Dormant') {
        for (let j = 0; j < borrowCount; j++) {
          borrowDates.push(randomDateBetween(TWO_YEARS_AGO, TODAY))
        }
      } else if (user.readerType === 'Casual') {
        const numWindows = Math.random() < 0.5 ? 2 : 3
        const maxStart = new Date(TODAY.getTime() - (60 * 24 * 60 * 60 * 1000))
        const windows = []
        for (let w = 0; w < numWindows; w++) {
          windows.push(randomDateBetween(TWO_YEARS_AGO, maxStart))
        }
        
        for (let j = 0; j < borrowCount; j++) {
          const windowStart = windows[Math.floor(Math.random() * windows.length)]
          const windowEnd = new Date(windowStart.getTime() + (45 * 24 * 60 * 60 * 1000))
          borrowDates.push(randomDateBetween(windowStart, windowEnd))
        }
      }

      for (let j = 0; j < borrowCount; j++) {
        // Book Selection
        let pool = []
        const r = Math.random()
        if (r < 0.60) {
          pool = booksByGenre[user.primaryGenre] || allBooks
        } else if (r < 0.85) {
          const sec = user.secondaryGenres[Math.floor(Math.random() * user.secondaryGenres.length)]
          pool = booksByGenre[sec] || allBooks
        } else {
          pool = allBooks
        }
        
        const selectedBook = weightedBookPick(pool) || allBooks[Math.floor(Math.random() * allBooks.length)]

        const borrow_date = borrowDates[j]
        const due_date = new Date(borrow_date.getTime() + (14 * 24 * 60 * 60 * 1000))

        let return_date, status, book_returned, fine_amount = 0

        const isCompleted = due_date.getTime() < TODAY.getTime()

        if (isCompleted) {
          let lateChance = 0
          if (user.readerType === 'Heavy') lateChance = 0.03
          else if (user.readerType === 'Casual') lateChance = 0.08
          else lateChance = 0.25

          const isLate = Math.random() < lateChance

          if (!isLate) {
            return_date = randomDateBetween(borrow_date, due_date)
            status = 'Returned'
            book_returned = true
            fine_amount = 0
          } else {
            const overdueDays = Math.floor(Math.random() * 30) + 1
            return_date = new Date(due_date.getTime() + (overdueDays * 24 * 60 * 60 * 1000))
            status = 'Returned'
            book_returned = true
            fine_amount = overdueDays * 5
          }
        } else {
          // Case B
          return_date = due_date
          status = 'In Progress'
          book_returned = false
          fine_amount = 0
        }

        if (fine_amount > 0) {
          recordsWithFine++
          totalFineGenerated += fine_amount
        }

        borrowDocs.push({
          borrowed_by: doc._id,
          borrowed_book: selectedBook._id,
          borrow_date: borrow_date,
          return_date: return_date,
          status: status,
          book_returned: book_returned,
          fine_amount: fine_amount
        })
      }
    }

    if (borrowDocs.length > 500) {
      for (let i = 0; i < borrowDocs.length; i += 500) {
        await BorrowHistory.insertMany(borrowDocs.slice(i, i + 500))
      }
    } else {
      await BorrowHistory.insertMany(borrowDocs)
    }

    // --- SUMMARY LOG ---
    console.log('\n--- SUMMARY ---')
    console.log(`Total books inserted: ${insertedBooks.length}`)
    console.log('Books per genre:')
    for (const [genre, count] of Object.entries(genreCounts)) {
      console.log(`  ${genre}: ${count}`)
    }
    
    let heavyCount = 0, casualCount = 0, dormantCount = 0
    for (const u of userObjects) {
      if (u.readerType === 'Heavy') heavyCount++
      else if (u.readerType === 'Casual') casualCount++
      else if (u.readerType === 'Dormant') dormantCount++
    }
    console.log(`Total users: ${insertedUsers.length} (Heavy: ${heavyCount}, Casual: ${casualCount}, Dormant: ${dormantCount})`)
    console.log(`Total borrow records: ${borrowDocs.length}`)
    console.log(`Records with fine_amount > 0: ${recordsWithFine}`)
    console.log(`Total fine amount across all records: ₹${totalFineGenerated}`)

    // --- TEARDOWN ---
    console.log('\nSeed successful.')
    await mongoose.disconnect()
    process.exit(0)
  } catch (error) {
    console.error('Error during seed:', error)
    await mongoose.disconnect()
    process.exit(1)
  }
}

runSeed()
