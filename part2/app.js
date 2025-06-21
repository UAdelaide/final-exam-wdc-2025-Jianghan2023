const express = require('express')
const path = require('path')
require('dotenv').config()
const session = require('express-session')
const app = express()

// use session
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'default-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false,
      maxAge: 36000000, // 10h
    },
  })
)

// Middleware
app.use(express.json())
app.use(express.static(path.join(__dirname, '/public')))

// Routes
const walkRoutes = require('./routes/walkRoutes')
const userRoutes = require('./routes/userRoutes')
const dogRoutes = require('./routes/dogRoutes')

app.use('/api/walks', walkRoutes)
app.use('/api/users', userRoutes)
app.use('/api/dogs', dogRoutes)

// Export the app instead of listening here
module.exports = app
