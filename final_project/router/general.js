const express = require('express');
const axios = require('axios');
const crypto = require('node:crypto');
let books = require("./booksdb.js");
let isValid = require("./auth_users.js").isValid;
let users = require("./auth_users.js").users;
const public_users = express.Router();


public_users.post("/register", (req,res) => {
  const { username, password } = req.body || {};
  if (typeof username !== 'string' || !/^[A-Za-z0-9_]{3,64}$/.test(username)
      || ['__proto__', 'constructor', 'prototype'].includes(username)
      || typeof password !== 'string' || !password.length || password.length > 256) {
    return res.status(400).json({message: 'A valid username and password are required'});
  }
  if (isValid(username)) {
    return res.status(409).json({message: 'User already exists'});
  }
  const salt = crypto.randomBytes(16).toString('hex');
  const passwordHash = crypto.scryptSync(password, salt, 64).toString('hex');
  users.push({ username, salt, passwordHash });
  return res.status(201).json({message: 'User successfully registered. Now you can login.'});
});

// Get the book list available in the shop
public_users.get('/',function (req, res) {
  return res.status(200).json(books);
});

// Get book details based on ISBN
public_users.get('/isbn/:isbn',function (req, res) {
  const book = Object.hasOwn(books, req.params.isbn) ? books[req.params.isbn] : undefined;
  if (!book) {
    return res.status(404).json({message: "Book not found"});
  }
  return res.status(200).json(book);
 });
  
// Get book details based on author
public_users.get('/author/:author',function (req, res) {
  const author = req.params.author.trim().toLowerCase();
  const matches = Object.fromEntries(
    Object.entries(books).filter(([isbn, book]) =>
      book.author.toLowerCase() === author
    )
  );
  if (Object.keys(matches).length === 0) {
    return res.status(404).json({message: "No books found for this author"});
  }
  return res.status(200).json(matches);
});

// Get all books based on title
public_users.get('/title/:title',function (req, res) {
  const title = req.params.title.trim().toLowerCase();
  const matches = Object.fromEntries(
    Object.entries(books).filter(([isbn, book]) =>
      book.title.toLowerCase() === title
    )
  );
  if (Object.keys(matches).length === 0) {
    return res.status(404).json({message: "No books found for this title"});
  }
  return res.status(200).json(matches);
});

//  Get book review
public_users.get('/review/:isbn',function (req, res) {
  const book = Object.hasOwn(books, req.params.isbn) ? books[req.params.isbn] : undefined;
  if (!book) {
    return res.status(404).json({message: "Book not found"});
  }
  return res.status(200).json(book.reviews);
});

const bookClient = axios.create({
  baseURL: process.env.BOOK_API_BASE_URL || 'http://127.0.0.1:5000',
  timeout: 5000,
  proxy: false
});

function getAllBooks() {
  return bookClient.get('/').then(response => response.data);
}

async function getBookByISBN(isbn) {
  const response = await bookClient.get(`/isbn/${encodeURIComponent(isbn)}`);
  return response.data;
}

async function getBooksByAuthor(author) {
  const response = await bookClient.get(`/author/${encodeURIComponent(author)}`);
  return response.data;
}

async function getBooksByTitle(title) {
  const response = await bookClient.get(`/title/${encodeURIComponent(title)}`);
  return response.data;
}

function asyncResponse(handler) {
  return async (req, res) => {
    try {
      return res.status(200).json(await handler(req));
    } catch (error) {
      return res.status(error.response?.status || 502).json(
        error.response?.data || { message: 'Unable to retrieve books' }
      );
    }
  };
}

public_users.get('/async/books', asyncResponse(() => getAllBooks()));
public_users.get('/async/books/isbn/:isbn', asyncResponse(req => getBookByISBN(req.params.isbn)));
public_users.get('/async/books/author/:author', asyncResponse(req => getBooksByAuthor(req.params.author)));
public_users.get('/async/books/title/:title', asyncResponse(req => getBooksByTitle(req.params.title)));

module.exports = {
  general: public_users, getAllBooks, getBookByISBN, getBooksByAuthor, getBooksByTitle
};
