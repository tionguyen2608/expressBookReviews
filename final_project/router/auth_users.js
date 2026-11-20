const express = require('express');
const jwt = require('jsonwebtoken');
const crypto = require('node:crypto');
const books = require('./booksdb.js');
const regd_users = express.Router();
const users = [];
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');

const isValid = username => users.some(user => user.username === username);

const authenticatedUser = (username, password) => {
  const user = users.find(item => item.username === username);
  if (!user || typeof password !== 'string' || password.length > 256) {
    return false;
  }
  const hash = crypto.scryptSync(password, user.salt, 64);
  return crypto.timingSafeEqual(hash, Buffer.from(user.passwordHash, 'hex'));
};

regd_users.post('/login', (req, res, next) => {
  const { username, password } = req.body || {};
  if (!authenticatedUser(username, password)) {
    return res.status(401).json({ message: 'Invalid username or password' });
  }
  return req.session.regenerate(error => {
    if (error) return next(error);
    const accessToken = jwt.sign({ username }, JWT_SECRET, {
      algorithm: 'HS256', expiresIn: '1h'
    });
    req.session.authorization = { accessToken, username };
    return req.session.save(saveError => {
      if (saveError) return next(saveError);
      return res.status(200).json({ message: 'Customer successfully logged in' });
    });
  });
});

regd_users.put('/auth/review/:isbn', (req, res) => {
  const { isbn } = req.params;
  if (!Object.hasOwn(books, isbn)) {
    return res.status(404).json({ message: 'Book not found' });
  }
  const review = req.query.review ?? req.body?.review;
  if (typeof review !== 'string' || !review.trim()) {
    return res.status(400).json({ message: 'A review is required' });
  }
  const username = req.authenticatedUsername;
  books[isbn].reviews = { ...books[isbn].reviews, [username]: review.trim() };
  return res.status(200).json({
    message: 'Review successfully added or updated',
    reviews: books[isbn].reviews
  });
});

regd_users.delete('/auth/review/:isbn', (req, res) => {
  const { isbn } = req.params;
  if (!Object.hasOwn(books, isbn)) {
    return res.status(404).json({ message: 'Book not found' });
  }
  const username = req.authenticatedUsername;
  if (!Object.hasOwn(books[isbn].reviews, username)) {
    return res.status(404).json({ message: 'No review found for this user' });
  }
  delete books[isbn].reviews[username];
  return res.status(200).json({
    message: 'Review successfully deleted',
    reviews: books[isbn].reviews
  });
});

module.exports = {
  authenticated: regd_users, isValid, authenticatedUser, users, JWT_SECRET
};
