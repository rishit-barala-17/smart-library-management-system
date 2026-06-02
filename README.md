# Smart Library Management System

> **A data-driven library platform that predicts demand, handles automated waitlists, and guides readers to their next favourite book using Machine Learning.**

![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18-success)
![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-47A248?logo=mongodb)
![Express](https://img.shields.io/badge/Express.js-Framework-000000?logo=express)
![License](https://img.shields.io/badge/License-MIT-blue.svg)
![Status](https://img.shields.io/badge/Status-Production_Ready-brightgreen)
![ML](https://img.shields.io/badge/ML-Powered-8A2BE2)

---

## 📸 Screenshots & Demo

> 📸 Add screenshots here — suggested: Home, Books page (waitlist buttons), Admin Analytics, Recommendations page, Inventory with Your Waitlist section, 2D Shelf Locator

When visitors first open the app, they are greeted by a sleek, modern dashboard showcasing trending books and personalised recommendations, immediately drawing them into a rich browsing experience.

---

## 📑 Table of Contents
- [Project Overview](#project-overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [System Architecture](#system-architecture)
- [Database Schema](#database-schema)
- [Dataset and Seeding Strategy](#dataset-and-seeding-strategy)
- [Getting Started](#getting-started)
- [Usage Guide](#usage-guide)
- [API Routes](#api-routes)
- [Key Scripts](#key-scripts)
- [Project Structure](#project-structure)
- [Challenges & Learnings](#challenges--learnings)
- [Future Enhancements](#future-enhancements)
- [Author](#author)
- [License](#license)

---

## 🚀 Project Overview

Traditional library systems often struggle with predicting demand, managing lengthy waitlists effectively, or guiding readers toward books they will actually enjoy. Without a data-driven approach, books sit unread on shelves while patrons wait blindly for popular titles, leading to an inefficient allocation of resources and a frustrating user experience. This Smart Library Management System solves all three problems by injecting intelligent tracking, automated queue cascades, and machine-learning-based recommendations directly into the core borrowing loop.

Technically, the application shines through its robust backend architecture. It features a custom Jaccard Similarity recommendation engine, a predictive waitlist system that calculates real return-date estimations using historical loan averages, and an advanced procurement analytics dashboard that calculates dynamic demand ratios. Supplemented by a massive seeded ML training dataset, the system offers both intelligent user-facing features and powerful insights for library administrators.

---

## ✨ Features

### 📖 Reader Experience
- **Browsing & Discovery**: Browse the entire library catalog, filter by specific genres, and use text-based search to find exact titles.
- **Cart & Checkout**: Add available books to a digital cart and seamlessly check them out for borrowing.
- **Waitlist Tracking**: Join waitlists for out-of-stock books, view your exact queue position, and see real-time estimated wait times derived from actual active return dates.
- **Physical Shelf Locator**: View exactly where a book is located in the library through detailed physical indicators (section, side, row, column) and an integrated 2D grid locator.
- **Inventory Management**: View currently borrowed books, past borrow history, and return books with a single click.

### 🧠 ML Recommendation Engine
- **Jaccard Similarity Algorithm**: Computes similarity between a user's historical borrow set and candidate book genres.
- **Frequency-Weighted Scoring**: Boosts recommendations based on how frequently a user has historically borrowed a specific genre.
- **Popularity Nudges**: Factors in a normalized `popularityScore` to bubble up high-quality, widely-read books.
- **Cold-Start Fallback**: Uses a user's declared `recommendedGenres` as an artificial borrow vector if they have fewer than 3 historical borrows.
- **Three-Tier Display**: Segregates suggestions into 'Strong Match', 'Partial Match / You Might Like', and generic 'Trending' fallback recommendations.

### ⏱️ Predictive Demand Waitlist
- **Auto-Reservation**: Instantly reserves an incoming returned book for the next user in the queue.
- **24-Hour Claim Window**: Gives the reserved user exactly 24 hours to claim their book before the system re-assigns it.
- **Cron-based Expiry Cascade**: An automated background worker (running every 30 minutes) that expires missed reservations and cascades the book to the next person in line.
- **Estimated Wait Times**: Calculates dynamic estimations using the `return_date` of the current borrower plus the historical average loan duration for that specific book.

### 📊 Admin Intelligence
- **Procurement Analytics**: Visualizes supply and demand with calculated Demand Ratios (`waitlist length / total copies`).
- **Priority Tiers**: Color-coded action tiers highlighting critical stock shortages (Critical >2 ratio, High >1 ratio).
- **Dashboard Metrics**: Provides deep insights into daily borrow rates, overdue fines, and a 7-day trailing activity line chart.
- **Book & User Management**: Full CRUD capabilities for managing the entire library catalog, user access, and viewing global order histories.
- **Waitlist Simulation**: Includes specialized scripts to artificially generate waitlists for UI testing and demand load simulations.

---

## 🛠️ Tech Stack

| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| **Runtime** | Node.js | Fast, asynchronous backend environment |
| **Framework** | Express.js | Web routing, middleware, and request handling |
| **Database** | MongoDB Atlas | NoSQL document storage for flexible schema design |
| **ODM** | Mongoose | Object Data Modeling, schema validation, and queries |
| **View Engine** | EJS | Dynamic HTML rendering and templating |
| **Authentication** | express-session + bcrypt | Managing user state and securely hashing passwords |
| **Data Generation** | @faker-js/faker | Generating realistic, localized (en_IN) ML datasets |
| **Scheduling** | node-cron | Running the 30-minute reservation expiry cascade |
| **Notifications** | connect-flash | Passing temporary success/error messages to the UI |
| **Styling** | Custom CSS | Clean, dependency-free bespoke frontend styling |

---

## ⚙️ System Architecture

### How It Works

#### Subsection A — Data Layer
The system relies on a tightly integrated NoSQL document structure with five primary collections:

```text
User ──< BorrowHistory >── Book
Book ──< waitlist (User[])
Book ──  reservedFor (User)
Cart ── User, Book
```

- **User**: Stores authentication details, reader behavior types, and ML genre preferences.
- **Book**: Represents the physical item, including its catalog details, physical location, demand metrics, and waitlist queues.
- **BorrowHistory**: Acts as the central ledger for all active and historical loans, fine tracking, and ML source data.
- **Cart**: A temporary holding area for books a user intends to borrow.

#### Subsection B — ML Recommendation Algorithm
The recommendation engine uses a custom implementation of Jaccard Similarity to match users with books.

```text
J(A, B) = |A ∩ B| / |A ∪ B|
```
Where:
- **A** = set of unique genres in the user's borrow history
- **B** = {genre of the candidate book}

The final recommendation score aggregates three signals:
- **`jaccardScore`**: Base genre overlap (ranges from 0 to 1/|A|).
- **`freqWeight`**: Measures how intensely the user favors this genre (`genre_count / total_borrows × 0.5`).
- **`popularityNudge`**: A global book quality signal (`popularityScore / 200`).
- **Final Score**: `jaccardScore + freqWeight + popularityNudge`

**Cold-start**: When a user has fewer than 3 borrows, their declared `recommendedGenres` array supplements Vector A to ensure immediate, accurate recommendations.

#### Subsection C — Waitlist Engine
The waitlist uses a sophisticated state machine governed by user actions and an automated cron job.

```text
Stock > 0 ──→ [AVAILABLE] ──→ Borrow ──→ [BORROWED]
                                            │
                            Return ←────────┘
                              │
                  waitlist.length > 0?
                     │              │
                    Yes             No
                     │              │
             [RESERVED 24h]    [AVAILABLE]
                     │
             User claims?
                │        │
               Yes       No (expiry)
                │        │
           [BORROWED]  Next in queue
                        or stock += 1
```
The background cron job runs every 30 minutes, automatically finding reservations that have outlived their 24-hour window and cascading the book to the next person in line. 

The estimated wait time is mathematically derived from actual ledger data:
`estimatedDays = daysUntilSoonestReturn + (position - 1) × avgLoanDays`
Where `daysUntilSoonestReturn` uses the actual `return_date` of the current holder, and `avgLoanDays` averages the time past users held this specific book.

---

## 🗄️ Database Schema

#### Book
```javascript
{
  isbn: String,             // Unique identifier
  title: String,            // Book title
  genre: String,            // Primary category
  stock: Number,            // Currently available copies
  total_copies: Number,     // Total copies owned by library
  popularityScore: Number,  // 1-10 scale for ML nudges
  waitlist: [ObjectId],     // Array of users waiting
  reservedFor: ObjectId,    // User who has 24h to claim
  reservedUntil: Date       // Expiry time for reservation
}
```
Represents the library catalog, housing both static metadata and highly volatile queue states.

#### User
```javascript
{
  name: String,             // User's full name
  email: String,            // Unique login
  password: String,         // Bcrypt hash
  role: Number,             // 0 for Admin, 1 for Customer
  readerType: String,       // 'Heavy', 'Casual', 'Dormant'
  primaryGenre: String,     // ML hint
  recommendedGenres: [String] // Fallback ML vector
}
```
Manages authentication boundaries and stores behavioral archetypes to aid the cold-start recommendation engine.

#### BorrowHistory
```javascript
{
  borrowed_by: ObjectId,    // The borrower
  borrowed_book: ObjectId,  // The item
  borrow_date: Date,        // Issue date
  return_date: Date,        // Expected return date
  book_returned: Boolean,   // Is the book back?
  fine_amount: Number       // Overdue penalties
}
```
The central immutable ledger tracking all active inventory and providing the fundamental dataset for recommendation algorithms.

#### Cart
```javascript
{
  user: ObjectId,           // The shopper
  book: ObjectId            // The queued item
}
```
A lightweight intermediary collection managing the pre-checkout phase.

---

## 🧬 Dataset and Seeding Strategy

To properly train and demonstrate the ML engine and Procurement Analytics, the database is pre-seeded with a massive, highly realistic dataset.

- **1000 Unique Books**: Generated using `@faker-js/faker` with an `en_IN` locale to reflect a diverse, localized collection.
- **Zipf-Weighted Genres**: Distributes the 14 available genres realistically (e.g., Science Fiction ~130 books, Religion ~25 books) because uniform distributions break ML algorithms and don't reflect reality.
- **Bell-Curve Popularity**: Approximates a normal distribution for `popularityScore` by averaging random floats, resulting in most books sitting at 3-7, while preserving rare 9-10 scores for high-tier recommendations.
- **Clustered Reader Archetypes**: 100 users generated and segmented into Heavy (20%), Casual (60%), and Dormant (20%) readers.
- **Weighted Borrow Generation**: Borrow histories are artificially skewed: 60% align with a user's primary genre, 25% secondary, and 15% random, weighted heavily by the book's `popularityScore`. 
- **Behavioral Late Returns**: Realistic fine simulation where late returns correlate to user type (Heavy readers are late 3% of the time, Casual 8%, Dormant 25%).

---

## 🏁 Getting Started

```bash
# Prerequisites
Node.js >= 18
MongoDB Atlas account (or local MongoDB daemon)
Git
```

1. **Clone the repository**
```bash
git clone https://github.com/yourusername/library-management-system.git
cd library-management-system
```

2. **Install dependencies**
```bash
npm install
```

3. **Create the environment file**
Create a `.env` file in the root directory:
```env
DB_URL=mongodb+srv://<username>:<password>@cluster...
SESSION_SECRET=your_super_secret_session_key
JWT_PRIVATE_KEY=your_jwt_signing_key
PORT=3000
```

4. **Run the seed script (Optional but recommended)**
```bash
node seed.js
```

5. **Run the migration script (Required if migrating old data)**
```bash
node utils/migrateCopies.js
```

6. **Start the server**
```bash
npm start
```

7. **Open the application**
Navigate to `http://localhost:3000` in your web browser.

#### Default Credentials (if seeded)
- **Admin**: `admin@test.com` / `password123`
- **Test User**: Any generated user email from the seed output / `password123`

---

## 🧭 Usage Guide

| Role | Action | How To |
| :--- | :--- | :--- |
| User | Browse books | Navigate to `/books` via the top navigation |
| User | Search by genre | Use the sidebar links pointing to `/books/genre/[genre]` |
| User | Join a waitlist | Click "Join Waitlist" on any out-of-stock book |
| User | Check waitlist pos. | Go to `/inventory/:id` and check "Your Waitlist" section |
| User | Get recommendations | Click "✨ For You" in the navbar (`/recommendations`) |
| Admin | View analytics | Click "Procurement Analytics" in the admin dashboard (`/admin/analytics/demand`) |
| Admin | Manage books | Use the sidebar to go to `/admin/book` to Add/Edit/Delete |
| Admin | View all orders | Navigate to `/admin/orders` to view global ledgers |
| Admin | Simulate waitlists | Run `node utils/simulateWaitlists.js` from the terminal |

---

## 🛣️ API Routes

#### Authentication Routes
| Method | Path | Auth Required | Description |
| :--- | :--- | :--- | :--- |
| GET | `/register` | No | Renders the registration form |
| POST | `/register` | No | Creates a new user and signs JWT |
| GET | `/login` | No | Renders the login form |
| POST | `/login` | No | Validates credentials and signs JWT |
| GET | `/logout` | Yes | Clears JWT cookie |

#### Book Routes (User-Facing)
| Method | Path | Auth Required | Description |
| :--- | :--- | :--- | :--- |
| GET | `/` | No | Home dashboard (Trending & Popular) |
| GET | `/books` | No | Paginated library catalog |
| GET | `/search-book` | No | Text-based title/ISBN search |
| GET | `/books/genre/:genre` | No | Filter catalog by genre parameter |

#### Waitlist Routes
| Method | Path | Auth Required | Description |
| :--- | :--- | :--- | :--- |
| POST | `/waitlist/join/:bookId` | Yes | Appends user to book's waitlist |
| POST | `/waitlist/leave/:bookId` | Yes | Removes user from waitlist |
| POST | `/waitlist/claim/:bookId` | Yes | Claims a 24h reservation into active borrow |

#### Cart & Borrow Routes
| Method | Path | Auth Required | Description |
| :--- | :--- | :--- | :--- |
| GET | `/cart` | Yes | View current cart items |
| POST | `/cart` | Yes | Add a book to the cart |
| DELETE | `/cart` | Yes | Remove a book from the cart |
| GET | `/borrow` | Yes | Checkout confirmation page |
| POST | `/borrow` | Yes | Finalizes checkout, decrements stock |
| POST | `/return-book` | Yes | Returns book, calculates fines, triggers queue |
| GET | `/inventory/:id` | Yes | View active borrows and waitlist status |
| GET | `/history/:id` | Yes | View historical ledgers |

#### Recommendation Routes
| Method | Path | Auth Required | Description |
| :--- | :--- | :--- | :--- |
| GET | `/recommendations` | Yes | Renders the Jaccard-scored ML discovery page |

#### Admin Routes
| Method | Path | Auth Required | Description |
| :--- | :--- | :--- | :--- |
| GET | `/admin` | Yes (Admin) | Primary metrics dashboard |
| GET | `/admin/book` | Yes (Admin) | Paginated book management list |
| POST | `/admin/book/add` | Yes (Admin) | Creates new catalog item |
| PUT | `/admin/book/update` | Yes (Admin) | Edits existing catalog item |
| DELETE | `/admin/book/delete` | Yes (Admin) | Destroys catalog item |
| GET | `/admin/orders` | Yes (Admin) | Views global borrow ledgers |
| GET | `/admin/view-users`| Yes (Admin) | Lists all registered members |
| GET | `/admin/analytics/demand`| Yes (Admin) | Displays Waitlist Demand Ratios |

---

## 📜 Key Scripts

| Script | Command | Purpose |
| :--- | :--- | :--- |
| Seed Database | `node seed.js` | Generates 1000 books, 100 users, and historical ML ledgers |
| Migrate total_copies | `node utils/migrateCopies.js` | Database migration copying `stock` fields to new `total_copies` fields |
| Simulate waitlists | `node utils/simulateWaitlists.js` | Artificial load generator for waitlist queue testing |
| Start server | `npm start` | Boots the Express server |

---

## 📂 Project Structure

```text
├── app.js
├── package.json
├── seed.js
├── controllers/
│   ├── adminController.js
│   ├── authController.js
│   └── indexController.js
├── middlewares/
│   ├── authMiddleware.js
│   └── userMiddleware.js
├── models/
│   ├── Book.js
│   ├── BorrowHistory.js
│   ├── Cart.js
│   └── User.js
├── public/
│   ├── css/
│   ├── images/
│   └── user_images/
├── routes/
│   ├── adminRoutes.js
│   ├── authRoutes.js
│   └── indexRoutes.js
├── utils/
│   ├── migrateCopies.js
│   ├── recommendationEngine.js
│   ├── reservationCron.js
│   └── simulateWaitlists.js
└── views/
    ├── admin/
    ├── auth/
    ├── customer/
    ├── layouts/
    └── partials/
```

---

## 🐛 Challenges & Learnings

**Waitlist Capacity Tracking Blind Spot**
Originally, the database only tracked active `stock`, meaning once all copies of a book were borrowed, the system forgot how many total copies the library actually owned and could not calculate demand ratios. I wrote a migration script in `utils/migrateCopies.js` to backfill a new `total_copies` field, learning that static baseline metrics must be separated from highly volatile availability states.

**ML Cold-Start Flatlining**
Pure Jaccard similarity returned flat zeroes for new users who hadn't borrowed any books, resulting in completely broken and empty recommendation feeds. I implemented a fallback mechanism in `recommendationEngine.js` that detects users with fewer than three borrows and temporarily injects their onboarding `recommendedGenres` into the algorithm's base vector.

**Jaccard Set Limitations for Power Readers**
Because Jaccard similarity relies on sets of unique items, a user who read one fantasy book received the exact same base score as a user who read fifty fantasy books. I solved this by patching a `freqWeight` multiplier into the final score calculation, learning that raw frequency tracking is essential to supplement set-based similarity for heavy readers.

**Missing Metadata Crashing the Engine**
Legacy book records missing a `cover_image` or `genre` field caused fatal rendering crashes and `undefined` mapping errors during the vector construction loop. I bulletproofed the engine by adding strict fallback overrides directly to the candidate mapping phase, ensuring dirty data defaults to generic values rather than breaking the UI.

**Race Conditions on Expired Reservations**
A user could theoretically execute a checkout if they clicked "Claim Now" after their 24-hour window expired but before the 30-minute cron job swept the database. I hardened the EJS conditional in `_book_card.ejs` to explicitly verify `book.reservedUntil > new Date()` on the frontend, ensuring the claim button vanishes the exact second the window closes.

**Seed Email Validation Failures**
Generating artificial user emails directly from Faker's full names caused MongoDB validation crashes because the names frequently included spaces, apostrophes, or prefixes. I added an aggressive Regex sanitization step in `seed.js` to strip out all non-alphanumeric characters before constructing the email strings, reminding me that generated mock data is inherently messy.

---

## 🔮 Future Enhancements

1. **Email Notifications (Nodemailer)**: Automatically alert users via email the second their 24-hour reservation window activates, rather than relying solely on dashboard checks.
2. **Collaborative Filtering**: Implement a user-to-user cosine distance matrix to supplement the item-to-item Jaccard Similarity, providing "Users who read this also read..." functionality.
3. **Real-time Stock Updates**: Integrate Socket.io to push real-time availability changes and queue pops directly to the client without requiring page refreshes.
4. **Automated Catalog Intake**: Implement OCR via Tesseract.js in the admin panel to automatically parse ISBNs and book covers via a physical webcam scan.
5. **PDF Procurement Exports**: Enable administrators to download the Waitlist Demand Analytics table as a cleanly formatted PDF to provide direct action lists to purchasing departments.

---

## 👤 Author

Built by Alvin Martin Djong. Course project — Smart Library Management System.

---

## 📄 License

MIT License.