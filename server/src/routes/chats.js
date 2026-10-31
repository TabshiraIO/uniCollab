'use strict';

// server/src/routes/chats.js
// Connects URLs to controller functions and handles errors in one place.

const express = require('express');
const controller = require('../controllers/chats');

const router = express.Router();

// Wraps an async handler so any error goes to the error middleware below.
function asyncHandler(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

router.get('/', asyncHandler(controller.listChats));
router.post('/', asyncHandler(controller.createChat));
router.get('/:id/messages', asyncHandler(controller.getMessages));
router.post('/:id/messages', asyncHandler(controller.sendMessage));

// Central error handler. Express knows this is an error handler because it has 4 arguments.
// Errors made with httpError() have "expose = true", so their message is safe to show.
// Anything else is a bug or a database problem: we log it and show a friendly text,
// never a stack trace and never a key.
router.use((error, req, res, next) => {
  if (res.headersSent) return next(error);

  if (error && error.expose === true && error.status) {
    return res.status(error.status).json({ error: error.message });
  }

  console.error('[chats] Unexpected error:', error && error.message ? error.message : error);
  return res.status(500).json({ error: 'Something went wrong on the server. Please try again.' });
});

module.exports = router;