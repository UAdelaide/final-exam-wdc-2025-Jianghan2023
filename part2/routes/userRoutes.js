const express = require('express')
const router = express.Router()
const db = require('../models/db')

// GET all Users (for admin/testing)
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT user_id, username, email, role FROM Users'
    )
    res.json(rows)
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch Users' })
  }
})

// POST a new user (simple signup)
router.post('/register', async (req, res) => {
  const { username, email, password, role } = req.body

  try {
    const [result] = await db.query(
      `
      INSERT INTO Users (username, email, password_hash, role)
      VALUES (?, ?, ?, ?)
    `,
      [username, email, password, role]
    )

    res
      .status(201)
      .json({ message: 'User registered', user_id: result.insertId })
  } catch (error) {
    res.status(500).json({ error: 'Registration failed' })
  }
})

router.get('/me', (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Not logged in' })
  }
  res.json(req.session.user)
})

// POST login (dummy version)
router.post('/login', async (req, res) => {
  const { username, password } = req.body

  try {
    const [rows] = await db.query(
      `SELECT user_id, username, role 
      FROM Users 
      WHERE username = ? AND password_hash = ?`,
      [username, password]
    )

    if (rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' })
    }

    req.session.user = rows[0]
    res.json({ message: 'Login successful', user: rows[0] })
  } catch (error) {
    console.log(error)
    res.status(500).json({ error: 'Login failed' })
  }
})

// POST logout
router.post('/logout', (req, res) => {
  if (!req.session.user) {
    return res.json({ message: "Not logged in, don't need to logout." })
  }

  // remove user
  req.session.user = null
  return res.json({ message: 'Logout successful' })
})

module.exports = router
