// client/src/api/chats.js
// All calls to the server live here, so components never write fetch() themselves.
// The base path '/api' works because vite.config.js proxies /api to the Express server.

const API_BASE = '/api';

function makeError(message, status) {
  const error = new Error(message);
  error.status = status; // 0 means "could not reach the server"
  return error;
}

async function request(path, options = {}) {
  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...options,
      // Only send a JSON header when we actually send a body.
      headers: options.body ? { 'Content-Type': 'application/json' } : undefined,
    });
  } catch (networkError) {
    throw makeError(
      'Cannot reach the server. Check your internet connection and make sure the server is running.',
      0
    );
  }

  // The body may be empty or not JSON (for example when the proxy cannot reach the server).
  let data = null;
  try {
    data = await response.json();
  } catch (parseError) {
    data = null;
  }

  if (!response.ok) {
    let message = `Something went wrong (error ${response.status}).`;
    if (data && typeof data.error === 'string') {
      message = data.error; // use the server's friendly message
    } else if (response.status >= 500) {
      message = 'The server is not responding. Please make sure it is running and try again.';
    }
    throw makeError(message, response.status);
  }

  if (data === null) {
    throw makeError('The server sent an unexpected reply.', response.status);
  }
  return data;
}

// -> { chats: [{ id, title, created_at }] }
export function listChats() {
  return request('/chats');
}

// -> { chat }
export function createChat(title) {
  return request('/chats', {
    method: 'POST',
    body: JSON.stringify(title ? { title } : {}),
  });
}

// -> { chat, messages: [{ id, role, content, created_at }] }
export function getMessages(chatId) {
  return request(`/chats/${encodeURIComponent(chatId)}/messages`);
}

// -> { userMessage, assistantMessage, chat }
export function sendMessage(chatId, content) {
  return request(`/chats/${encodeURIComponent(chatId)}/messages`, {
    method: 'POST',
    body: JSON.stringify({ content }),
  });
}