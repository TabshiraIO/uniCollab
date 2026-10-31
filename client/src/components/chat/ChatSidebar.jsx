// client/src/components/chat/ChatSidebar.jsx
// The left panel: "New chat" button and the list of the user's chats.
// On phones it slides in from the left (the CSS in Chat.css does the sliding).

// Show a short, readable date like "31 Oct 2026". An invalid date shows nothing.
function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function ChatSidebar({
  chats,
  loading,
  activeChatId,
  disabled,
  isOpen,
  onNewChat,
  onSelectChat,
  onClose,
}) {
  return (
    // Chat.jsx points its menu button to this id with aria-controls, so the id must stay the same.
    <aside id="chat-sidebar" className={isOpen ? 'chat-sidebar is-open' : 'chat-sidebar'}>
      <div className="chat-sidebar__top">
        <button type="button" className="chat-new-button" onClick={onNewChat} disabled={disabled}>
          + New chat
        </button>
        {/* This close button is visible on phones only (see Chat.css). */}
        <button
          type="button"
          className="chat-sidebar__close"
          onClick={onClose}
          aria-label="Close chat list"
        >
          ×
        </button>
      </div>

      <nav className="chat-sidebar__nav" aria-label="Your chats">
        {loading ? (
          <p className="chat-sidebar__note" role="status">
            Loading chats...
          </p>
        ) : chats.length === 0 ? (
          <p className="chat-sidebar__note">No chats yet. Start your first one!</p>
        ) : (
          <ul className="chat-list">
            {chats.map((chat) => {
              // The URL gives chatId as a string, the database gives id as a number.
              const isActive = String(chat.id) === activeChatId;
              return (
                <li key={chat.id}>
                  <button
                    type="button"
                    className={isActive ? 'chat-list__button is-active' : 'chat-list__button'}
                    onClick={() => onSelectChat(chat.id)}
                    disabled={disabled}
                    aria-current={isActive ? 'page' : undefined}
                  >
                    <span className="chat-list__title">{chat.title}</span>
                    <span className="chat-list__date">{formatDate(chat.created_at)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </nav>
    </aside>
  );
}