// client/src/components/chat/MessageInput.jsx
// The text box at the bottom. Enter sends, Shift+Enter adds a new line.

import { useEffect, useLayoutEffect, useRef } from 'react';

// Show the character counter only when the student gets close to the limit.
const SHOW_COUNTER_FROM = 3500;

export default function MessageInput({ value, onChange, onSend, disabled, waiting, maxLength }) {
  const textareaRef = useRef(null);
  const wasWaitingRef = useRef(waiting);

  // Auto-grow: reset the height first, then set it to the real content height.
  // CSS max-height stops it from growing forever, and then it scrolls.
  useLayoutEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    const borders = textarea.offsetHeight - textarea.clientHeight;
    textarea.style.height = `${textarea.scrollHeight + borders}px`;
  }, [value]);

  // A disabled textarea loses focus. When the AI has answered, give focus back.
  useEffect(() => {
    if (wasWaitingRef.current && !waiting && textareaRef.current) {
      textareaRef.current.focus();
    }
    wasWaitingRef.current = waiting;
  }, [waiting]);

  function handleKeyDown(event) {
    // While an IME (for example a Bangla or Chinese keyboard) is composing text,
    // Enter confirms the word and must NOT send the message. keyCode 229 covers Safari.
    if (event.nativeEvent.isComposing || event.keyCode === 229) return;

    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault(); // stop the new line
      onSend();
    }
  }

  function handleSubmit(event) {
    event.preventDefault(); // stop the browser from reloading the page
    onSend();
  }

  const length = value.length;
  const showCounter = length >= SHOW_COUNTER_FROM;
  const nearLimit = length >= maxLength - 100;

  return (
    <form className="chat-input" onSubmit={handleSubmit}>
      <div className="chat-input__inner">
        <label className="chat-visually-hidden" htmlFor="chat-message">
          Your message
        </label>
        <div className="chat-input__row">
          <textarea
            id="chat-message"
            ref={textareaRef}
            className="chat-input__textarea"
            rows={1}
            value={value}
            maxLength={maxLength}
            disabled={disabled}
            placeholder={waiting ? 'Thinking...' : 'Ask a question...'}
            aria-describedby="chat-input-help"
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={handleKeyDown}
          />
          <button
            type="submit"
            className="chat-input__send"
            disabled={disabled || !value.trim()}
          >
            Send
          </button>
        </div>
        <p id="chat-input-help" className="chat-input__help">
          {showCounter ? (
            <span className={nearLimit ? 'chat-input__counter is-near-limit' : 'chat-input__counter'}>
              {length} / {maxLength}
            </span>
          ) : (
            <span className="chat-input__hint">Enter to send, Shift+Enter for a new line</span>
          )}
        </p>
      </div>
    </form>
  );
}