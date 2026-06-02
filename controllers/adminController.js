const Book = require('../models/Book')
const BorrowHistory = require('../models/BorrowHistory')
const User = require('../models/User')
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
    res.redirect('/admin')
  }
}

// admin dashboard
exports.admin_dashboard = async (req, res) => {
  try {
    // --- Metric Cards ---
    const totalBooks = await Book.countDocuments() || 0
    const registeredMembers = await User.countDocuments({ role: 1 }) || 0

    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    const issuedToday = await BorrowHistory.countDocuments({
      borrow_date: { $gte: todayStart }
    }) || 0

    const overdueReturns = await BorrowHistory.countDocuments({
      book_returned: false,
      return_date: { $lt: new Date() }
    }) || 0

    const finePerDay = 5
    const overdueRecords = await BorrowHistory.find({
      book_returned: false,
      return_date: { $lt: new Date() }
    }).select('return_date')
    let totalFines = 0
    overdueRecords.forEach(record => {
      const daysOverdue = Math.ceil((new Date() - record.return_date) / (1000 * 60 * 60 * 24))
      totalFines += daysOverdue * finePerDay
    })

    const collectedFinesAgg = await BorrowHistory.aggregate([
      { $match: { book_returned: true } },
      { $group: { _id: null, total: { $sum: "$fine_amount" } } }
    ])
    if (collectedFinesAgg.length > 0) {
      totalFines += collectedFinesAgg[0].total
    }

    // --- Doughnut Chart: Genre Distribution ---
    const allBooks = await Book.find().select('genre')
    const genreCount = {}
    allBooks.forEach(book => {
      if(book.genre) {
        genreCount[book.genre] = (genreCount[book.genre] || 0) + 1
      }
    })
    const genreAgg = Object.keys(genreCount).map(genre => ({ _id: genre, count: genreCount[genre] })).sort((a, b) => b.count - a.count)
    const genreLabels = genreAgg.map(g => g._id) || []
    const genreData = genreAgg.map(g => g.count) || []

    // --- Line Chart: Issued vs Returned (Last 7 Days) ---
    const dayLabels = []
    const chartIssued = []
    const chartReturned = []
    for (let i = 6; i >= 0; i--) {
      const dayStart = new Date()
      dayStart.setDate(dayStart.getDate() - i)
      dayStart.setHours(0, 0, 0, 0)
      const dayEnd = new Date(dayStart)
      dayEnd.setHours(23, 59, 59, 999)

      dayLabels.push(dayStart.toLocaleDateString('en-IN', { weekday: 'short' }))

      const issued = await BorrowHistory.countDocuments({
        borrow_date: { $gte: dayStart, $lte: dayEnd }
      })
      chartIssued.push(issued || 0)

      const returned = await BorrowHistory.countDocuments({
        book_returned: true,
        updated_at: { $gte: dayStart, $lte: dayEnd }
      })
      chartReturned.push(returned || 0)
    }

    // --- Most Borrowed Books ---
    const allBorrows = await BorrowHistory.find().populate('borrowed_book', 'title')
    const borrowCount = {}
    const bookTitles = {}
    allBorrows.forEach(record => {
      if (record.borrowed_book && record.borrowed_book._id) {
        const bookId = record.borrowed_book._id.toString()
        borrowCount[bookId] = (borrowCount[bookId] || 0) + 1
        bookTitles[bookId] = record.borrowed_book.title
      }
    })
    let borrowedAgg = Object.keys(borrowCount).map(id => ({ title: bookTitles[id], count: borrowCount[id] }))
    borrowedAgg.sort((a, b) => b.count - a.count)
    borrowedAgg = borrowedAgg.slice(0, 5)

    const maxBorrowCount = borrowedAgg.length > 0 ? borrowedAgg[0].count : 1
    const mostBorrowed = borrowedAgg.map(item => ({
      title: item.title,
      count: item.count,
      popularity: Math.round((item.count / maxBorrowCount) * 100)
    }))

    // --- Recent Activity Feed ---
    const recentBorrows = await BorrowHistory.find()
      .sort({ created_at: -1 })
      .limit(10)
      .populate('borrowed_by', 'name')
      .populate('borrowed_book', 'title')

    const recentActivity = recentBorrows.map(record => {
      const userName = record.borrowed_by ? record.borrowed_by.name : 'Unknown'
      const bookTitle = record.borrowed_book ? record.borrowed_book.title : 'Unknown'
      const isOverdue = !record.book_returned && record.return_date < new Date()

      let type, message
      if (record.book_returned) {
        type = 'return'
        message = `${userName} returned "${bookTitle}"`
      } else if (isOverdue) {
        type = 'overdue'
        message = `Overdue alert: "${bookTitle}" — ${userName}`
      } else {
        type = 'issue'
        message = `${userName} issued "${bookTitle}"`
      }

      const diffMs = Date.now() - new Date(record.created_at).getTime()
      const diffMins = Math.floor(diffMs / 60000)
      let time
      if (diffMins < 1) time = 'Just now'
      else if (diffMins < 60) time = `${diffMins} min ago`
      else if (diffMins < 1440) time = `${Math.floor(diffMins / 60)} hours ago`
      else time = `${Math.floor(diffMins / 1440)} days ago`

      return { type, message, time }
    })

    res.render('admin/index', {
      totalBooks,
      registeredMembers,
      issuedToday,
      overdueReturns,
      totalFines,
      genreLabels,
      genreData,
      chartLabels: dayLabels,
      chartIssued,
      chartReturned,
      mostBorrowed,
      recentActivity
    })
  } catch (err) {
    console.log(err)
    res.render('admin/index', {
      totalBooks: 0,
      registeredMembers: 0,
      issuedToday: 0,
      overdueReturns: 0,
      totalFines: 0,
      genreLabels: [],
      genreData: [],
      chartLabels: [],
      chartIssued: [],
      chartReturned: [],
      mostBorrowed: [],
      recentActivity: []
    })
  }
}

// manage books
exports.books = (req, res) => {
  let currentPage = req.params.page || 1
  let perPage = req.query.perPage || 10
  let totalBook
  let query = Book.find()

  if(req.query.search) {
    query = Book.find( { $or: [{ title: { $regex: req.query.search, $options: 'i' } }, { isbn: { $regex: req.query.search, $options: 'i' }}] } )
  }

  query
    .countDocuments()
    .then(count => {
      totalBook = count
      return Book.find({ $or: [{ title: { $regex: req.query.search || '', $options: 'i' } }, { isbn: { $regex: req.query.search || '', $options: 'i' }}] })
        .skip(parseInt(currentPage - 1) * parseInt(perPage))
        .limit(parseInt(perPage))
        .sort({ title: 1 })
    })
    .then(books => {
      res.render('admin/books', {
        books,
        searchOption: req.query,
        currentPage: parseInt(currentPage),
        perPage: parseInt(perPage),
        totalBook: parseInt(totalBook),
        totalPage: Math.ceil(parseInt(totalBook) / parseInt(perPage)),
        msg: req.flash('msg')
      })
    })
    .catch(err => {
      console.log(err)
      res.redirect('/admin')
    })
}

// add book view
exports.add_book_view = (req, res) => {
  res.render('admin/book-add', { genres })
}

// process add book
exports.add_book = (req, res) => {
  const { isbn, title, author, publish_year, page_count, genre, description, stock,
          location_section, location_side, location_row, location_column } = req.body
  const errors = validationResult(req)
  if(!errors.isEmpty()) {
    removeImage(req.files.cover_image[0].path)
    res.render('admin/book-add', { 
      genres,
      errors: errors.array(),
      isbn: isbn || '',
      title: title || '',
      author: author || '',
      publish_year: publish_year || '',
      page_count: page_count || '',
      description: description || '',
      stock: stock || ''
    })
  } else {
    const cover_image = req.files.cover_image[0].filename
    Book.create({ isbn, title, author, publish_year, page_count, genre, description, stock, cover_image,
                  location_section, location_side, location_row, location_column, total_copies: stock })
      .then(result => {
        req.flash('msg', 'New book has been added!')
        res.redirect('/admin/book')
      })
      .catch(err => {
        console.log(err)
        res.redirect('/admin')
      })
  }
}

// view book detail
exports.detail_book = async (req, res) => {
  try {
    const book = await Book.findById(req.params.id)
    res.render('admin/book-detail', { book, msg: req.flash('msg') })
  } catch (err) {
    console.log(err)
    res.redirect('/admin')
  }
}

// update book view
exports.update_book_view = async (req, res) => {
  try {
    const book = await Book.findById(req.params.id)
    res.render('admin/book-update', { book, genres })
  } catch(err) {
    console.log(err)
    res.redirect('/admin')
  }
}

// process update book
exports.update_book = async (req, res) => {
  const { isbn, title, author, publish_year, page_count, genre, description, stock,
          location_section, location_side, location_row, location_column } = req.body
  const errors = validationResult(req)
  if(!errors.isEmpty()) {
    try {
      if(req.files.cover_image) removeImage(req.files.cover_image[0].path)
      const book = await Book.findById(req.body.id)
      res.render('admin/book-update', {
        genres,
        errors: errors.array(),
        book,
      })
    } catch(err) {
      console.log(err)
      res.redirect('/admin')
    }
  } else {
    let cover_image
    if(req.files.cover_image) {
      Book.findById(req.body.id)
        .then(book => {
          removeImage(book.coverImagePath)
        })
        .catch(err => {
          console.log(err)
          res.redirect('/admin')
        })
      cover_image = req.files.cover_image[0].filename
    } else {
      try {
        const book = await Book.findById(req.body.id)
        cover_image = book.cover_image
      } catch (err) {
        console.log(err)
        res.redirect('/admin')
      }
    }
    Book.updateOne(
      { _id: req.body.id },
      { $set: {
          isbn, title, author, publish_year, page_count, genre, description, stock, cover_image,
          location_section, location_side, location_row, location_column
        }
      })
      .then(result => {
        req.flash('msg', `Book has been updated!`)
        res.redirect(`/admin/book/detail/${req.body.id}`)
      })
      .catch(err => {
        console.log(err)
        res.redirect('/admin')
      })
  }
}

// delete book
exports.delete_book = async (req, res) => {
  try {
    const book = await Book.findById(req.body.book_id)
    const bookTitle = book.title
    removeImage(book.coverImagePath)
    await book.remove()
    req.flash('msg', `Book '${bookTitle}' has been deleted!`)
    res.redirect(`/admin/book`)
  } catch(err) {
    console.log(err)
    res.redirect('/admin')
  }
}

// view orders
exports.view_orders = async (req, res) => {
  try {
    BorrowHistory.find({ status: "Returned", book_returned: false })
      .then(returnedBook => {
        returnedBook.forEach(async book => {
          await Book.updateMany(
            { _id: book.borrowed_book },
            { $inc: { stock: 1 } }
          )
        })
        return BorrowHistory.updateMany(
          { status: "Returned", book_returned: false }, 
          { $set: { book_returned: true } }
        )
      })
      .then(result => {
        return BorrowHistory.find()
          .populate({ path: 'borrowed_by', select: 'name' })
          .populate({ path: 'borrowed_book', select: 'title' })
          .sort({ created_at: -1 })
      })
      .then(borrowHistory => {
        res.render('admin/orders', { borrowHistory })
      })
      .catch(err => {
        console.log(err)
        res.redirect('/admin')
      })
  } catch(err) {
    console.log(err)
    res.redirect('/admin')
  }
}

// view users
exports.view_users = async (req, res) => {
  try {
    const users = await User.find()
    res.render('admin/view-users', { users })
  } catch(err) {
    console.log(err)
    res.redirect('/admin')
  }
}

// demand analytics
exports.demandAnalytics = async (req, res) => {
  try {
    const books = await Book.find().select('title isbn stock total_copies waitlist popularityScore genre')
    const analytics = books.filter(b => b.waitlist && b.waitlist.length > 0).map(b => {
      const ratio = b.total_copies > 0 ? b.waitlist.length / b.total_copies : b.waitlist.length
      return {
        _id: b._id,
        title: b.title,
        isbn: b.isbn,
        genre: b.genre,
        totalCopies: b.total_copies,
        availableCopies: b.stock,
        borrowedCopies: b.total_copies - b.stock,
        waitlistSize: b.waitlist.length,
        demandRatio: parseFloat(ratio.toFixed(2)),
        popularityScore: b.popularityScore
      }
    }).sort((a, b) => b.demandRatio - a.demandRatio)

    const summary = {
      totalWithWaitlist: analytics.length,
      totalWaitlistSlots: analytics.reduce((s, b) => s + b.waitlistSize, 0),
      criticalCount: analytics.filter(b => b.demandRatio > 2).length,
      highCount: analytics.filter(b => b.demandRatio > 1).length,
      actionRequired: analytics.some(b => b.demandRatio > 1)
    }

    res.render('admin/analytics-demand', { title: 'Procurement Analytics', analytics, summary })
  } catch(err) {
    console.log(err)
    res.redirect('/admin')
  }
}