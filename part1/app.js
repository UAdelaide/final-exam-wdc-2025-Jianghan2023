var express = require('express')
var path = require('path')
var cookieParser = require('cookie-parser')
var logger = require('morgan')
var mysql = require('mysql2/promise')

var app = express()

app.use(logger('dev'))
app.use(express.json())
app.use(express.urlencoded({ extended: false }))
app.use(cookieParser())

let db
;(async () => {
  try {
    const hostName = 'localhost'
    const userName = 'root'
    const password = 'root'
    const dbName = 'DogWalkService'

    const connection = await mysql.createConnection({
      host: hostName,
      user: userName,
      password: password,
    })

    await connection.query(`CREATE DATABASE IF NOT EXISTS ${dbName}`)
    await connection.end()

    db = await mysql.createConnection({
      host: hostName,
      user: userName,
      password: password,
      database: dbName,
    })

    // Create tables
    await db.execute(`
      CREATE TABLE IF NOT EXISTS Users (
          user_id INT AUTO_INCREMENT PRIMARY KEY,
          username VARCHAR(50) UNIQUE NOT NULL,
          email VARCHAR(100) UNIQUE NOT NULL,
          password_hash VARCHAR(255) NOT NULL,
          role ENUM('owner', 'walker') NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)
    await db.execute(`
      CREATE TABLE IF NOT EXISTS Dogs (
          dog_id INT AUTO_INCREMENT PRIMARY KEY,
          owner_id INT NOT NULL,
          name VARCHAR(50) NOT NULL,
          size ENUM('small', 'medium', 'large') NOT NULL,
          FOREIGN KEY (owner_id) REFERENCES Users(user_id)
      )
    `)
    await db.execute(`
      CREATE TABLE IF NOT EXISTS WalkRequests (
          request_id INT AUTO_INCREMENT PRIMARY KEY,
          dog_id INT NOT NULL,
          requested_time DATETIME NOT NULL,
          duration_minutes INT NOT NULL,
          location VARCHAR(255) NOT NULL,
          status ENUM('open', 'accepted', 'completed', 'cancelled') DEFAULT 'open',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (dog_id) REFERENCES Dogs(dog_id)
      )
    `)
    await db.execute(`
      CREATE TABLE IF NOT EXISTS WalkApplications (
          application_id INT AUTO_INCREMENT PRIMARY KEY,
          request_id INT NOT NULL,
          walker_id INT NOT NULL,
          applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          status ENUM('pending', 'accepted', 'rejected') DEFAULT 'pending',
          FOREIGN KEY (request_id) REFERENCES WalkRequests(request_id),
          FOREIGN KEY (walker_id) REFERENCES Users(user_id),
          CONSTRAINT unique_application UNIQUE (request_id, walker_id)
      )
    `)
    await db.execute(`
      CREATE TABLE IF NOT EXISTS WalkRatings (
          rating_id INT AUTO_INCREMENT PRIMARY KEY,
          request_id INT NOT NULL,
          walker_id INT NOT NULL,
          owner_id INT NOT NULL,
          rating INT CHECK (rating BETWEEN 1 AND 5),
          comments TEXT,
          rated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (request_id) REFERENCES WalkRequests(request_id),
          FOREIGN KEY (walker_id) REFERENCES Users(user_id),
          FOREIGN KEY (owner_id) REFERENCES Users(user_id),
          CONSTRAINT unique_rating_per_walk UNIQUE (request_id)
      )
    `)

    // Insert test data
    let [rows] = await db.execute('SELECT COUNT(*) AS count FROM Users')
    if (rows[0].count === 0) {
      await db.execute(`
        INSERT INTO Users (username, email, password_hash, role) 
        VALUES 
        ('alice123', 'alice@example.com', 'hashed123', 'owner'), 
        ('bobwalker', 'bob@example.com', 'hashed456', 'walker'),
        ('carol123', 'carol@example.com', 'hashed789', 'owner'),
        ('aaawalker', 'aaa@example.com', 'hashed101112', 'walker'),
        ('bbbwalker', 'bbb@example.com', 'hashed131415', 'walker')

      `)
    }

    // 5 dogs
    ;[rows] = await db.execute('SELECT COUNT(*) AS count FROM Dogs')
    if (rows[0].count === 0) {
      await db.execute(`
        INSERT INTO Dogs (owner_id, name, size) 
        VALUES 
        ((SELECT user_id FROM Users WHERE username = 'alice123'), 'Max', 'medium'),
        ((SELECT user_id FROM Users WHERE username = 'carol123'), 'Bella', 'small'),
        ((SELECT user_id FROM Users WHERE username = 'alice123'), 'AAA', 'large'),
        ((SELECT user_id FROM Users WHERE username = 'carol123'), 'BBB', 'large'),
        ((SELECT user_id FROM Users WHERE username = 'alice123'), 'CCC', 'large')

      `)
    }

    // Insert following data for testing
    ;[rows] = await db.execute('SELECT COUNT(*) AS count FROM WalkRequests')
    if (rows[0].count === 0) {
      await db.execute(`
        INSERT INTO WalkRequests (dog_id, requested_time, duration_minutes, location, status) 
        VALUES 
        ((SELECT dog_id FROM Dogs WHERE name = 'Max'), '2025-06-10 08:00:00', '30', 'Parklands', 'open'),
        ((SELECT dog_id FROM Dogs WHERE name = 'Max'), '2025-06-10 09:30:00', '45', 'Beachside Ave', 'open'),
        ((SELECT dog_id FROM Dogs WHERE name = 'Bella'), '2025-06-11 12:00:00', '100', 'Street A', 'open'),
        ((SELECT dog_id FROM Dogs WHERE name = 'Bella'), '2025-06-12 12:00:00', '20', 'Road B', 'open'),
        ((SELECT dog_id FROM Dogs WHERE name = 'Bella'), '2025-06-13 12:00:00', '50', 'Park C', 'open'),
        ((SELECT dog_id FROM Dogs WHERE name = 'Bella'), '2025-06-14 12:00:00', '50', 'Park D', 'completed'),
        ((SELECT dog_id FROM Dogs WHERE name = 'Bella'), '2025-06-15 12:00:00', '50', 'Park E', 'completed'),
        ((SELECT dog_id FROM Dogs WHERE name = 'Bella'), '2025-06-16 12:00:00', '50', 'Park F', 'completed'),
        ((SELECT dog_id FROM Dogs WHERE name = 'Bella'), '2025-06-17 12:00:00', '50', 'Park G', 'accepted'),
        ((SELECT dog_id FROM Dogs WHERE name = 'Bella'), '2025-06-18 12:00:00', '50', 'Park H', 'cancelled')
      `)
    }

    ;[rows] = await db.execute('SELECT COUNT(*) AS count FROM WalkApplications')
    if (rows[0].count === 0) {
      await db.execute(`
        INSERT INTO WalkApplications (request_id, walker_id, status) 
        VALUES
        ((SELECT request_id FROM WalkRequests WHERE location = 'Park D'), (SELECT user_id FROM Users WHERE username = 'bobwalker'), 'accepted'),
        ((SELECT request_id FROM WalkRequests WHERE location = 'Park E'), (SELECT user_id FROM Users WHERE username = 'bobwalker'), 'accepted'),
        ((SELECT request_id FROM WalkRequests WHERE location = 'Park F'), (SELECT user_id FROM Users WHERE username = 'bobwalker'), 'accepted'),
        ((SELECT request_id FROM WalkRequests WHERE location = 'Park G'), (SELECT user_id FROM Users WHERE username = 'bobwalker'), 'accepted'),
        ((SELECT request_id FROM WalkRequests WHERE location = 'Park H'), (SELECT user_id FROM Users WHERE username = 'bobwalker'), 'accepted')
      `)
    }

    ;[rows] = await db.execute('SELECT COUNT(*) AS count FROM WalkRatings')
    if (rows[0].count === 0) {
      await db.execute(`
        INSERT INTO WalkRatings (request_id, walker_id, owner_id, rating, comments) 
        SELECT WalkApplications.request_id, WalkApplications.walker_id, Dogs.owner_id, 1, 'So so' 
        FROM WalkApplications 
        LEFT JOIN WalkRequests ON WalkApplications.request_id = WalkRequests.request_id 
        LEFT JOIN Dogs ON WalkRequests.dog_id = Dogs.dog_id 
        WHERE location = 'Park D'
        `)
      await db.execute(`
        INSERT INTO WalkRatings (request_id, walker_id, owner_id, rating, comments) 
        SELECT WalkApplications.request_id, WalkApplications.walker_id, Dogs.owner_id, 5, 'Wow' 
        FROM WalkApplications 
        LEFT JOIN WalkRequests ON WalkApplications.request_id = WalkRequests.request_id 
        LEFT JOIN Dogs ON WalkRequests.dog_id = Dogs.dog_id 
        WHERE location = 'Park E'
        
        `)
      await db.execute(`
        INSERT INTO WalkRatings (request_id, walker_id, owner_id, rating, comments) 
        SELECT WalkApplications.request_id, WalkApplications.walker_id, Dogs.owner_id, 3, 'Not good.' 
        FROM WalkApplications 
        LEFT JOIN WalkRequests ON WalkApplications.request_id = WalkRequests.request_id 
        LEFT JOIN Dogs ON WalkRequests.dog_id = Dogs.dog_id 
        WHERE location = 'Park F'
        `)

      await db.execute(`
        INSERT INTO WalkRatings (request_id, walker_id, owner_id, rating, comments) 
        SELECT WalkApplications.request_id, WalkApplications.walker_id, Dogs.owner_id, 2, 'Could be better.' 
        FROM WalkApplications 
        LEFT JOIN WalkRequests ON WalkApplications.request_id = WalkRequests.request_id 
        LEFT JOIN Dogs ON WalkRequests.dog_id = Dogs.dog_id 
        WHERE location = 'Park G'
        
        `)

      await db.execute(`
        INSERT INTO WalkRatings (request_id, walker_id, owner_id, rating, comments) 
        SELECT WalkApplications.request_id, WalkApplications.walker_id, Dogs.owner_id, 5, 'Nice' 
        FROM WalkApplications 
        LEFT JOIN WalkRequests ON WalkApplications.request_id = WalkRequests.request_id 
        LEFT JOIN Dogs ON WalkRequests.dog_id = Dogs.dog_id
        WHERE location = 'Park H'
        
        `)
    }
  } catch (err) {
    console.error(
      'Error setting up database. Ensure Mysql is running: service mysql start',
      err
    )
  }
})()

// Q6
// GET all Dogs
app.get('/api/dogs', async (req, res) => {
  try {
    const [dogs] = await db.execute(
      `SELECT Dogs.name AS dog_name, 
        size AS size, 
        Users.username AS owner_username 
      FROM Dogs
      JOIN Users ON Dogs.owner_id = Users.user_id`
    )
    res.json(dogs)
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch dogs' })
  }
})

// Q7
// Fetch open requests
app.get('/api/walkrequests/open', async (req, res) => {
  try {
    const [requests] = await db.execute(
      `SELECT WalkRequests.request_id, 
        Dogs.name AS dog_name, 
        requested_time, 
        duration_minutes, 
        location, 
        Users.username AS owner_username 
      FROM WalkRequests 
      LEFT JOIN Dogs on Dogs.dog_id = WalkRequests.dog_id 
      LEFT JOIN Users on Dogs.owner_id = Users.user_id 
      WHERE WalkRequests.status = "open"`
    )

    res.json(requests)
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch open requests' })
  }
})

// Q8
// Get walker summary
app.get('/api/walkers/summary', async (req, res) => {
  try {
    const [summary] = await db.execute(
      `SELECT username AS walker_username, 
        IFNULL(total_ratings, 0) AS total_ratings,
        IFNULL(CAST(average_rating AS DECIMAL(10,2)), 0) AS average_rating,
        IFNULL(completed_walks, 0) AS completed_walks
      FROM Users 
      LEFT JOIN (
        SELECT walker_id, 
          COUNT(*) AS total_ratings, 
          AVG(rating) AS average_rating
        FROM WalkRatings
        WHERE walker_id IS NOT NULL 
        GROUP BY walker_id
      ) AS ratings ON ratings.walker_id = Users.user_id 
      LEFT JOIN (
        SELECT walker_id,
          COUNT(*) AS completed_walks 
        FROM WalkRequests 
        LEFT JOIN WalkApplications ON WalkRequests.request_id = WalkApplications.request_id 
        WHERE WalkRequests.status = "completed" 
          AND WalkApplications.walker_id IS NOT NULL 
          AND WalkApplications.status = "accepted" 
        GROUP BY walker_id
      ) AS r ON r.walker_id = Users.user_id 
      WHERE Users.role = "walker"`
    )

    res.json(summary)
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch walker summary' })
  }
})

app.use(express.static(path.join(__dirname, 'public')))

module.exports = app
