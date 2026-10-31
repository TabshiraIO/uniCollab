'use strict';

// server/src/controllers/chats.js
// The functions behind each /api/chats route.
// Every query is scoped to the current user, so nobody can read another user's chat.

const poolModule = require('../db/pool');
const { generateReply } = require('../services/llm');

const MAX_CONTENT_LENGTH = 4000;
const MAX_TITLE_LENGTH = 100;
const AUTO_TITLE_LENGTH = 40;
const HISTORY_LIMIT = 10;
const MAX_ID = 2147483647; // the biggest value a Postgres INTEGER can hold
const DEFAULT_TITLE = 'New chat';
const BUSY_MESSAGE = 'The AI is busy right now. Please try again in a minute.';
const AI_FAILED_MESSAGE = 'The AI could not answer right now. Please try again.';

// ---------- helpers ----------

// Works whether pool.js does "module.exports = pool" or "module.exports = { pool }".
function getPool() {
  const candidate =
    poolModule && typeof poolModule.query === 'function' ? poolModule : poolModule && poolModule.pool;
  if (!candidate || typeof candidate.query !== 'function' || typeof candidate.connect !== 'function') {
    throw new Error('The database pool is not set up. Check server/src/db/pool.js.');
  }
  return candidate;
}

// An error that is safe to show to the user (the route's error middleware checks "expose").
function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  error.expose = true;
  return error;
}

// TEMPORARY auth placeholder. When the login feature is ready, req.user.id will be used.
// Until then, every request acts as the user in DEV_USER_ID (default 1).
function getUserId(req) {
  if (req.user && req.user.id !== undefined && req.user.id !== null) {
    const fromAuth = Number(req.user.id);
    if (Number.isInteger(fromAuth) && fromAuth > 0) return fromAuth;
  }
  const fromEnv = Number.parseInt(process.env.DEV_USER_ID, 10);
  return Number.isInteger(fromEnv) && fromEnv > 0 ? fromEnv : 1;
}

// Accept only whole numbers from 1 to 2147483647. Anything else is a 400, never a database error.
function parseChatId(raw) {
  if (typeof raw !== 'string' || !/^[0-9]+$/.test(raw)) return null;
  const id = Number(raw);
  return id >= 1 && id <= MAX_ID ? id : null;
}

// Express 5 leaves req.body undefined when no JSON was sent, so we guard for that.
function readContent(body) {
  const raw = body ? body.content : undefined;
  if (typeof raw !== 'string') throw httpError(400, 'Message content must be text.');
  const content = raw.trim();
  if (!content) throw httpError(400, 'Message cannot be empty.');
  if (content.length > MAX_CONTENT_LENGTH) {
    throw httpError(400, `Message is too long (maximum ${MAX_CONTENT_LENGTH} characters).`);
  }
  // PostgreSQL cannot store the NUL character, so we reject it with a clear 400.
  if (content.includes('\u0000')) throw httpError(400, 'Message contains invalid characters.');
  return content;
}

// One-line title. Array.from counts real characters, so emoji are not cut in half.
function toTitle(text, maxCharacters) {
  const oneLine = text.replaceAll('\u0000', '').replace(/\s+/g, ' ').trim();
  return Array.from(oneLine).slice(0, maxCharacters).join('');
}

// Returns the chat only if it exists AND belongs to this user.
async function findChat(db, chatId, userId) {
  const result = await db.query(
    'SELECT id, title, created_at FROM chats WHERE id = $1 AND user_id = $2',
    [chatId, userId]
  );
  return result.rows[0] || null;
}

// Save both messages (and the new title) in ONE transaction:
// either everything is saved, or nothing is.
async function saveExchange(db, { chat, userId, userText, assistantText, isFirstMessage }) {
  const client = await db.connect();
  let connectionBroken = false;
  try {
    await client.query('BEGIN');

    const insertSql =
      'INSERT INTO messages (chat_id, role, content) VALUES ($1, $2, $3) ' +
      'RETURNING id, role, content, created_at';
    const userResult = await client.query(insertSql, [chat.id, 'user', userText]);
    const assistantResult = await client.query(insertSql, [chat.id, 'assistant', assistantText]);

    let updatedChat = chat;
    if (isFirstMessage) {
      const title = toTitle(userText, AUTO_TITLE_LENGTH) || DEFAULT_TITLE;
      const titleResult = await client.query(
        'UPDATE chats SET title = $1 WHERE id = $2 AND user_id = $3 RETURNING id, title, created_at',
        [title, chat.id, userId]
      );
      if (titleResult.rows[0]) updatedChat = titleResult.rows[0];
    }

    await client.query('COMMIT');
    return {
      userMessage: userResult.rows[0],
      assistantMessage: assistantResult.rows[0],
      chat: updatedChat,
    };
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      connectionBroken = true;
      console.error('[chats] Rollback failed:', rollbackError.message);
    }
    throw error;
  } finally {
    // Always give the client back. If it is broken, tell the pool to throw it away.
    client.release(connectionBroken);
  }
}

// ---------- route handlers ----------

// GET /api/chats
async function listChats(req, res) {
  const db = getPool();
  const result = await db.query(
    'SELECT id, title, created_at FROM chats WHERE user_id = $1 ORDER BY created_at DESC, id DESC',
    [getUserId(req)]
  );
  res.json({ chats: result.rows });
}

// POST /api/chats   body: { title? }
async function createChat(req, res) {
  const db = getPool();
  const body = req.body || {};

  let title = DEFAULT_TITLE;
  if (body.title !== undefined && body.title !== null) {
    if (typeof body.title !== 'string') throw httpError(400, 'Title must be text.');
    title = toTitle(body.title, MAX_TITLE_LENGTH) || DEFAULT_TITLE;
  }

  const result = await db.query(
    'INSERT INTO chats (user_id, title) VALUES ($1, $2) RETURNING id, title, created_at',
    [getUserId(req), title]
  );
  res.status(201).json({ chat: result.rows[0] });
}

// GET /api/chats/:id/messages
async function getMessages(req, res) {
  const db = getPool();
  const chatId = parseChatId(req.params.id);
  if (!chatId) throw httpError(400, 'Invalid chat id.');

  const chat = await findChat(db, chatId, getUserId(req));
  // Same 404 for "does not exist" and "belongs to someone else", so ids cannot be guessed.
  if (!chat) throw httpError(404, 'Chat not found.');

  const result = await db.query(
    'SELECT id, role, content, created_at FROM messages WHERE chat_id = $1 ORDER BY created_at, id',
    [chatId]
  );
  res.json({ chat, messages: result.rows });
}

// POST /api/chats/:id/messages   body: { content }
async function sendMessage(req, res) {
  const db = getPool();

  // 1. Validate.
  const chatId = parseChatId(req.params.id);
  if (!chatId) throw httpError(400, 'Invalid chat id.');
  const content = readContent(req.body);
  const userId = getUserId(req);

  // 2. Load the chat (404 if it is not mine).
  const chat = await findChat(db, chatId, userId);
  if (!chat) throw httpError(404, 'Chat not found.');

  // 3. Load the last messages as history, oldest first.
  // (The inner query takes the newest ones, the outer query puts them back in order.)
  const historyResult = await db.query(
    `SELECT role, content
       FROM (
         SELECT id, role, content, created_at
           FROM messages
          WHERE chat_id = $1
          ORDER BY created_at DESC, id DESC
          LIMIT $2
       ) AS recent
      ORDER BY created_at ASC, id ASC`,
    [chatId, HISTORY_LIMIT]
  );
  const history = historyResult.rows;
  // No history at all means this is the first message of the chat.
  const isFirstMessage = history.length === 0;

  // 4. Call the AI FIRST. If it fails, we save nothing.
  let assistantText;
  try {
    assistantText = await generateReply(history, content);
  } catch (error) {
    const status = error && error.status === 429 ? 503 : 502;
    console.error(`[chats] The AI call failed (status ${status}).`);
    throw httpError(status, status === 503 ? BUSY_MESSAGE : AI_FAILED_MESSAGE);
  }

  // 5. Save both messages in one transaction.
  const saved = await saveExchange(db, {
    chat,
    userId,
    userText: content,
    assistantText,
    isFirstMessage,
  });

  res.status(201).json(saved);
}

module.exports = { getUserId, listChats, createChat, getMessages, sendMessage };