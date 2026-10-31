// client/src/components/chat/MessageList.jsx
// The scrolling list of messages, plus the loading, empty and "Thinking..." states.

import { useEffect, useRef } from 'react';
import MessageBubble from './MessageBubble.jsx';

export default function MessageList({ messages, loading, hasChat, sending }) {
  const containerRef = useRef(null);

  // Always show the newest message. We set scrollTop on the container itself,
  // so only this list scrolls and not the whole page.
  useEffect(() => {
    const container = containerRef.current;
    if (container) container.scrollTop = container.scrollHeight;
  }, [messages, sending, loading]);

  let body;
  if (loading) {
    body = (
      <p className="chat-state" role="status">
        Loading messages...
      </p>
    );
  } else if (messages.length === 0 && !sending) {
    body = hasChat ? (
      <p className="chat-state">No messages yet. Type your first message below.</p>
    ) : (
      <div className="chat-state">
        <h2 className="chat-state__title">Start a new chat</h2>
        <p>Ask anything about your studies. Your chats are saved in the list on the left.</p>
      </div>
    );
  } else {
    body = (
      <ul className="chat-messages__list">
        {messages.map((message) => (
          <MessageBubble
            key={message.id}
            role={message.role}
            content={message.content}
            pending={Boolean(message.pending)}
          />
        ))}
        {sending && (
          <li className="chat-message chat-message--assistant chat-message--thinking" role="status">
            Thinking...
          </li>
        )}
      </ul>
    );
  }

  return (
    <div className="chat-messages" ref={containerRef} role="log" aria-live="polite">
      {body}
    </div>
  );
}