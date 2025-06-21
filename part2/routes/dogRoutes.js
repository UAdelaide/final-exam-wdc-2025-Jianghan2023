const express = require('express')
const router = express.Router()
const db = require('../models/db')

// Get all dogs
router.get('/', async (req, res) => {
  try {
    const [dogs] = await db.execute(`SELECT * FROM Dogs`)
    res.json(dogs)
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch dogs' })
  }
})

// Get login user's all dogs
router.get('/user', async (req, res) => {
  try {
    if (!req.session.user) {
      return res.status(401).json({ error: 'Unauthorized' })
    }
    const userId = req.session.user.user_id
    const [dogs] = await db.execute(`SELECT * FROM Dogs WHERE owner_id = ?`, [
      userId,
    ])
    res.json(dogs)
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch dogs' })
  }
})

module.exports = router
