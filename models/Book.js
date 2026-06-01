const mongoose = require('mongoose')
const path = require('path')

const coverImageBasePath = 'public/images'

const bookSchema = new mongoose.Schema({
  isbn: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  title: {
    type: String,
    required: true,
    trim: true,
  },
  author: {
    type: String,
    required: true,
  },
  publish_year: {
    type: String,
    required: true,
    minlength: 3,
    maxlength: 4
  },
  page_count: {
    type: Number,
    required: true,
  },
  genre: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  stock: {
    type: Number,
    required: true,
  },
  total_copies: {
    type: Number,
    default: 0
  },
  cover_image: {
    type: String,
    required: true,
  },
  popularityScore: {
    type: Number,
    default: 5,
    min: 1,
    max: 10
  },
  location_section: { type: String, default: '' },
  location_side:    { type: String, enum: ['Front', 'Back'] },
  location_row:     { type: String, enum: ['A', 'B', 'C', 'D', 'E'] },
  location_column:  { type: Number, min: 1, max: 35 },
  waitlist: { type: [mongoose.Schema.Types.ObjectId], ref: 'user', default: [] },
  reservedFor: { type: mongoose.Schema.Types.ObjectId, ref: 'user', default: null },
  reservedUntil: { type: Date, default: null }
},
{
  strict: false,
  timestamps: {
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  }
})

bookSchema.virtual('coverImagePath').get(function() {
  if (this.cover_image !== null) {
    return path.join('/', coverImageBasePath, this.cover_image)
  }
})

module.exports = mongoose.model('book', bookSchema)