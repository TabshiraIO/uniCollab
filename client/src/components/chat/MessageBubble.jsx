// client/src/components/chat/MessageBubble.jsx
// One message. Assistant answers are shown as Markdown, user messages as plain text.

import ReactMarkdown from 'react-markdown';

export default function MessageBubble({ role, content, pending }) {
  if (role === 'assistant') {
    return (
      <li className="chat-message chat-message--assistant">
        {/* react-markdown does not run raw HTML from the AI, so this is safe by default. */}
        <div className="chat-markdown">
          <ReactMarkdown>{content}</ReactMarkdown>
        </div>
      </li>
    );
  }

  // User text is shown as plain text (never as HTML). The CSS keeps the new lines.
  return (
    <li className={pending ? 'chat-message chat-message--user is-pending' : 'chat-message chat-message--user'}>
      <p className="chat-message__text">{content}</p>
    </li>
  );
}