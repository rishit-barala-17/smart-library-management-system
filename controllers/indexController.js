const Book = require('../models/Book')
const User = require('../models/User')
const Cart = require('../models/Cart')
const BorrowHistory = require('../models/BorrowHistory')
const { validationResult } = require('express-validator')
const path = require('path')
const fs = require('fs')

const genres = [
  'Art', 
  'Science Fiction', 
  'Fantasy',
  'Finance',
  'Biographies', 
  'Recipes', 
  'Romance', 
  'Children',
  'History',
  'Medicine',
  'Religion',
  'Mystery',
  'Music',
  'Science'
]

const removeImage = (filePath) => {
  try {
    filePath = path.join(__dirname, '../', filePath)
    fs.unlink(filePath, err => {
      if(err) throw err
    })
  } catch(err) {
    console.log(err)
    res.redirect('/profile')
  }
}

// home page
exports.home = async (req, res) => {
  try {
    // for popular books
    const sortBorrowedBooksByCount = await BorrowHistory.aggregate([
      { $sortByCount: "$borrowed_book" }
    ]).limit(10)
    const popularBooks = await Book.populate(sortBorrowedBooksByCount, { path: '_id' })

    // for recently added books
    const recentBooks = await Book.find().sort({ created_at: -1 }).limit(12)

    res.render('index', { popularBooks, recentBooks, msg: req.flash('msg') })
  } catch(err) {
    console.log(err)
    res.redirect('/')
  }
}

// all books
exports.allBooks = (req, res) => {
  let currentPage = req.params.page || 1
  let perPage = req.query.perPage || 12
  let totalBook

  Book.find()
    .countDocuments()
    .then(count => {
      totalBook = count
      return Book.find()
        .skip(parseInt(currentPage - 1) * parseInt(perPage))
        .limit(parseInt(perPage))
        .sort({ title: 1 })
    })
    .then(books => {
      res.render('customer/books', {
        books,
        msg: req.flash('msg'),
        currentPage: parseInt(currentPage),
        perPage: parseInt(perPage),
        totalBook: parseInt(totalBook),
        totalPage: Math.ceil(parseInt(totalBook) / parseInt(perPage)),
      })
    })
    .catch(err => {
      console.log(err)
      res.redirect('/')
    })
}

// search book
exports.searchBook = (req, res) => {
  Book.find({ title: { $regex: req.query.title || '', $options: 'i' } })
    .sort({ title: 1 })
    .then(books => {
      res.render('customer/search-book', { books, msg: req.flash('msg') })
    })
    .catch(err => {
      console.log(err)
      res.redirect('/admin')
    })
}

// books by genre
exports.booksByGenre = async  (req, res) => {
  try {
    const { genre } = req.params
    const genreId = genre.split('genre-').pop()
    if(genreId > genres.length || genreId < 1) {  // if user change the params from the url
      res.redirect('/')
    } else {
      const genreName = genres[genreId - 1]
      const books = await Book.find({ genre: genreName })
      res.render('customer/books-genre', { books, genreName, genreParam: genre, msg: req.flash('msg') })
    }
  } catch(err) {
    console.log(err)
    res.redirect('/')
  }
}

// user profile
exports.userProfile = (req, res) => {
  res.render('customer/profile', { msg: req.flash('msg') })
}

// edit profile
exports.editProfile = (req, res) => {
  res.render('customer/profile-edit')
}

// update profile
exports.updateProfile = async (req, res) => {
  const { name, email } = req.body
  const errors = validationResult(req)
  if(!errors.isEmpty()) {
    try {
      if(req.files.profile_picture) removeImage(req.files.profile_picture[0].path)
      const user = await User.findById(req.body.id)
      res.render('customer/profile-edit', {
        errors: errors.array(),
        user,
      })
    } catch(err) {
      console.log(err)
      res.redirect('/')
    }
  } else {
    let profile_picture
    if(req.files.profile_picture) {
      User.findById(req.body.id)
        .then(user => {
          if(user.profile_picture !== 'default_user.svg') {
            removeImage(user.profilePicturePath)
          }
        })
        .catch(err => {
          console.log(err)
          res.redirect('/')
        })
      profile_picture = req.files.profile_picture[0].filename
    } else {
      try {
        const user = await User.findById(req.body.id)
        profile_picture = user.profile_picture
      } catch (err) {
        console.log(err)
        res.redirect('/')
      }
    }
    User.updateOne(
      { _id: req.body.id },
      { $set: { name, email, profile_picture } }
    )
      .then(result => {
        req.flash('msg', `Profile has been updated!`)
        res.redirect(`/profile`)
      })
      .catch(err => {
        console.log(err)
        res.redirect('/')
      })
  }
}

// view cart
exports.cart = (req, res) => {
  Cart.find().populate('user').populate('book')
    .then(result => {
      res.render('customer/cart', { cartItems: result, msg: req.flash('msg') })
    })
    .catch(err => {
      console.log(err)
      res.redirect('/')
    })
}

// add to cart
exports.postToCart = async (req, res) => {
  const { user_id, book_id, prev_url } = req.body

  try {
    const inInventory = await BorrowHistory.findOne({
      borrowed_by: user_id,
      borrowed_book: book_id,
      status: "In Progress"
    })

    if (inInventory) {
      req.flash('msg', 'Notice: You are already borrowing a copy of this book.')
      return res.redirect(prev_url)
    }

    const inCart = await Cart.findOne({ user: user_id, book: book_id })

    if (inCart) {
      req.flash('msg', 'Notice: This book is already in your cart ready for checkout.')
      return res.redirect(prev_url)
    }

    await Cart.create({ user: user_id, book: book_id })
    req.flash('msg', 'Success: Book added to your cart!')
    res.redirect(prev_url)

  } catch(err) {
    console.log(err)
    res.redirect('/')
  }
}

// delete cart item
exports.deleteCartItem = async (req, res) => {
  try {
    const cartItem = await Cart.findById(req.body.item_id).populate({ path: 'book', select: 'title' })
    const bookTitle = cartItem.book.title
    await cartItem.remove()
    req.flash('msg', `Book '${bookTitle}' has been removed from your cart!`)
    res.redirect('/cart')
  } catch(err) {
    console.log(err)
    res.redirect('/')
  }
}

// get borrow page
exports.getBorrow = (req, res) => {
  Cart.find().populate('user').populate('book')
    .then(result => {
      res.render('customer/borrow', { cartItems: result })
    })
    .catch(err => {
      console.log(err)
      res.redirect('/')
    })
}

// process borrow
exports.postBorrow = async (req, res) => {
  const { user_id, borrowDate, returnDate } = req.body
  const errors = validationResult(req)
  if(!errors.isEmpty()) {
    try {
      const user = await User.findById(user_id)
      const cart = await Cart.find().populate('user').populate('book')
      res.render('customer/borrow', {
        errors: errors.array(),
        user,
        cartItems: cart
      })
    } catch(err) {
      console.log(err)
      res.redirect('/')
    }
  } else {
    try {
      const cartItems = await Cart.find({ user: user_id })
      cartItems.forEach(async (item) => {
        const borrow = await BorrowHistory.create({
          borrowed_by: user_id,
          borrowed_book: item.book,
          borrow_date: new Date(borrowDate),
          return_date: new Date(returnDate)
        })
        const book = await Book.updateMany(
          { _id: item.book },
          { $inc: { stock: -1 } }
        )
        const cart = await Cart.find({ user: user_id }).deleteMany()
        req.flash('msg', "Book successfully borrowed!")
        return res.redirect(`/inventory/${user_id}`)
      })
    } catch(err) {
      console.log(err)
      res.redirect('/')
    }
  }
}

// view inventory
exports.borrowedBooks = async (req, res) => {
  try {
    const userId = req.params.id;
    const { getRecommendations } = require('../utils/recommendationEngine')
    const topRecommendations = await getRecommendations(userId, 5)

    BorrowHistory.find({ status: "Returned", book_returned: false })
      .then(returnedBook => {
        returnedBook.forEach(async book => {
          const b = await Book.findById(book.borrowed_book)
          if (b && b.waitlist && b.waitlist.length > 0) {
            b.reservedFor = b.waitlist.shift()
            b.reservedUntil = new Date(Date.now() + 24 * 60 * 60 * 1000)
            await b.save()
          } else if (b) {
            b.stock += 1
            b.reservedFor = null
            b.reservedUntil = null
            await b.save()
          }
        })
        return BorrowHistory.updateMany(
          { status: "Returned", book_returned: false }, 
          { $set: { book_returned: true } }
        )
      })
      .then(result => {
        return BorrowHistory.find({
          borrowed_by: req.params.id,
          status: "In Progress"
        }).populate('borrowed_book')
      })
      .then(async borrowedBook => {
        const currentUserId = req.params.id;
        const activeReservation = await Book.findOne({ reservedFor: currentUserId, reservedUntil: { $gt: new Date() } }).select('title author reservedUntil _id')
        
        const waitlistedBooks = await Book.find({
          waitlist: currentUserId
        }).select('_id title author cover_image waitlist total_copies stock genre isbn')

        const myWaitlist = await Promise.all(
          waitlistedBooks.map(async (book) => {
            const position = book.waitlist.findIndex(
              id => id.toString() === currentUserId.toString()
            ) + 1
            const peopleAhead = position - 1

            // Real active borrows with user-chosen return dates
            const activeBorrows = await BorrowHistory.find({
              borrowed_book: book._id,
              book_returned: false,
              status: 'In Progress'
            }).select('return_date').sort({ return_date: 1 })

            // Historical average loan duration for this book
            const completedBorrows = await BorrowHistory.find({
              borrowed_book: book._id,
              book_returned: true,
              status: 'Returned'
            }).select('borrow_date return_date')

            let avgLoanDays = 14
            if (completedBorrows.length >= 3) {
              const total = completedBorrows.reduce((sum, b) => {
                const d = Math.ceil(
                  (new Date(b.return_date) - new Date(b.borrow_date))
                  / 86400000)
                return sum + Math.max(1, d)
              }, 0)
              avgLoanDays = Math.round(total / completedBorrows.length)
            }

            const today = new Date()
            const daysUntilFirst = activeBorrows.length > 0
              ? Math.max(0, Math.ceil(
                  (new Date(activeBorrows[0].return_date) - today)
                  / 86400000))
              : avgLoanDays

            const estimatedDays = Math.max(
              0, daysUntilFirst + (peopleAhead * avgLoanDays))

            let estimatedText
            if (estimatedDays === 0) {
              estimatedText = 'Could be any day now'
            } else if (estimatedDays <= 7) {
              estimatedText = `~${estimatedDays} day${estimatedDays > 1 ? 's' : ''}`
            } else if (estimatedDays <= 30) {
              const weeks = Math.round(estimatedDays / 7)
              estimatedText = `~${weeks} week${weeks > 1 ? 's' : ''}`
            } else {
              const months = Math.round(estimatedDays / 30)
              estimatedText = `~${months} month${months > 1 ? 's' : ''}`
            }

            let checkBackTip
            if (position === 1) {
              checkBackTip = 'You\'re next — watch for your reservation. You get a 24-hour window to claim.'
            } else if (estimatedDays <= 7) {
              checkBackTip = `Check back in ${estimatedText} — your turn is coming up soon.`
            } else {
              checkBackTip = `No need to check daily — come back in ${estimatedText}.`
            }

            return {
              book, position, peopleAhead, estimatedDays,
              estimatedText, avgLoanDays, checkBackTip,
              isNext: position === 1, isClose: position <= 3
            }
          })
        )
        myWaitlist.sort((a, b) => a.position - b.position)

        res.render('customer/inventory', { url: req.params.id, borrowedBook, activeReservation, myWaitlist, topRecommendations, msg: req.flash('msg') })
      })
      .catch(err => {
        console.log(err)
        res.redirect('/')
      })
  } catch(err) {
    console.log(err)
    res.redirect('/')
  }
}

// read book
exports.readBook = (req, res) => {
  res.send('read book')
}

// return book
exports.returnBook = async (req, res) => {
  const { user_id, book_id, history_id } = req.body

  try {
    const history = await BorrowHistory.findById(history_id)
    const now = new Date()
    let fine = 0
    if (history.return_date < now) {
      const daysOverdue = Math.ceil((now - history.return_date) / (1000 * 60 * 60 * 24))
      fine = daysOverdue * 5 // 5 per day
    }

    await BorrowHistory.updateOne(
      { _id: history_id },
      { $set: { status: "Returned", book_returned: true, return_date: now, fine_amount: fine } }
    )

    const book = await Book.findById(book_id)
    if (book.waitlist.length > 0) {
      const nextUserId = book.waitlist.shift()
      book.reservedFor = nextUserId
      book.reservedUntil = new Date(Date.now() + 24 * 60 * 60 * 1000)
      // Do NOT increment stock
    } else {
      book.stock += 1
      book.reservedFor = null
      book.reservedUntil = null
    }
    await book.save()

    req.flash('msg', "You just returned a book! Thank you and happy reading!")
    res.redirect(`/inventory/${user_id}`)
  } catch(err) {
    console.log(err)
    res.redirect('/')
  }
}

// view borrow history
exports.borrowHistory = async (req, res) => {
  try {
    const borrowHistory = await BorrowHistory.find({ borrowed_by: req.params.id })
      .populate('borrowed_book')
      .sort({ borrow_date: -1 })

    res.render('customer/borrow-history', { url: req.params.id, borrowHistory })
  } catch(err) {
    console.log(err)
    res.redirect('/')
  }
}

// join waitlist
exports.joinWaitlist = async (req, res) => {
  try {
    const currentUserId = res.locals.user._id

    const book = await Book.findById(req.params.bookId)
    if (!book) {
      req.flash('error_msg', 'Book not found.')
      return res.redirect('/books')
    }

    if (book.stock > 0) {
      req.flash('info_msg',
        'This book is currently available — you can borrow it directly.')
      return res.redirect('back')
    }

    if (book.reservedFor &&
        book.reservedFor.toString() === currentUserId.toString()) {
      req.flash('info_msg',
        'A copy is already reserved for you. Check your inventory.')
      return res.redirect('back')
    }

    const alreadyInList = book.waitlist.some(
      id => id.toString() === currentUserId.toString()
    )
    if (alreadyInList) {
      const position = book.waitlist.findIndex(
        id => id.toString() === currentUserId.toString()
      ) + 1
      req.flash('info_msg',
        `You are already in the waitlist at position #${position}. Check your Inventory page to see your estimated wait time.`)
      return res.redirect('back')
    }

    book.waitlist.push(currentUserId)
    await book.save()

    const position = book.waitlist.length
    req.flash('success_msg',
      `You joined the waitlist for "${book.title}". You are #${position} in line. Check your Inventory page to track your estimated wait time.`)
    res.redirect('back')

  } catch (err) {
    console.error('[WAITLIST] joinWaitlist error:', err)
    req.flash('error_msg', 'Something went wrong. Please try again.')
    res.redirect('back')
  }
}

// leave waitlist
exports.leaveWaitlist = async (req, res) => {
  try {
    const book = await Book.findById(req.params.bookId)
    const currentUserId = res.locals.user._id

    book.waitlist = book.waitlist.filter(id => id.toString() !== currentUserId.toString())
    await book.save()
    req.flash('msg', 'Removed from waitlist')
    res.redirect('back')
  } catch(err) {
    console.log(err)
    res.redirect('back')
  }
}

// claim reservation
exports.claimReservation = async (req, res) => {
  try {
    const book = await Book.findById(req.params.bookId)
    const currentUserId = res.locals.user._id

    if (!book.reservedFor || book.reservedFor.toString() !== currentUserId.toString() || book.reservedUntil < new Date()) {
      req.flash('msg', 'Reservation no longer valid')
      return res.redirect('back')
    }

    await BorrowHistory.create({
      borrowed_by: currentUserId,
      borrowed_book: book._id,
      borrow_date: new Date(),
      return_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      status: 'In Progress',
      book_returned: false,
      fine_amount: 0
    })

    book.reservedFor = null
    book.reservedUntil = null
    await book.save()

    req.flash('msg', 'Book claimed!')
    res.redirect(`/inventory/${currentUserId}`)
  } catch(err) {
    console.log(err)
    res.redirect('back')
  }
}

// get recommendations
exports.recommendationsPage = async (req, res) => {
  try {
    const { getRecommendations } = require('../utils/recommendationEngine')
    const userId = res.locals.user._id
    const recommendations = await getRecommendations(userId, 20)
    
    const strongMatch = recommendations.filter(r => Number(r.jaccardScore) > 0 && Number(r.freqWeight) >= 0.3)
    const partialMatch = recommendations.filter(r => Number(r.jaccardScore) > 0 && Number(r.freqWeight) < 0.3)
    const trending = recommendations.filter(r => Number(r.jaccardScore) === 0)
    
    res.render('customer/recommendations', { 
      title: 'Recommended For You', 
      recommendations, 
      strongMatch, 
      partialMatch, 
      trending, 
      totalFound: recommendations.length 
    })
  } catch (err) {
    console.error('[RECO] Page error:', err)
    req.flash('error_msg', 'Could not load recommendations.')
    res.redirect('/')
  }
}