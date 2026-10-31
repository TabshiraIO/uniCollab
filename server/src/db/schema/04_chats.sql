-- 04_chats.sql
-- Tables for the AI chat feature.
-- Safe to run many times because every statement uses IF NOT EXISTS.

CREATE TABLE IF NOT EXISTS chats (
  id         SERIAL PRIMARY KEY,
  -- No foreign key yet, because the users table does not exist at the moment.
  -- When the users table exists, run this once to add the foreign key:
  --   ALTER TABLE chats
  --     ADD CONSTRAINT chats_user_id_fkey
  --     FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  user_id    INTEGER NOT NULL,
  title      TEXT NOT NULL DEFAULT 'New chat',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS messages (
  id         SERIAL PRIMARY KEY,
  -- ON DELETE CASCADE: when a chat is deleted, its messages are deleted too.
  chat_id    INTEGER NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  role       TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content    TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Speeds up "show my chats, newest first".
CREATE INDEX IF NOT EXISTS idx_chats_user_created
  ON chats (user_id, created_at DESC);

-- Speeds up "show the messages of one chat in order".
CREATE INDEX IF NOT EXISTS idx_messages_chat_created
  ON messages (chat_id, created_at);