// client/src/pages/Chat.jsx
// The chat page: sidebar on the left, conversation on the right.
// The URL decides which chat is open: /chat (empty state) or /chat/:chatId.

import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import ChatSidebar from '../components/chat/ChatSidebar.jsx';
import MessageList from '../components/chat/MessageList.jsx';
import MessageInput from '../components/chat/MessageInput.jsx';
import { createChat, getMessages, listChats, sendMessage } from '../api/chats.js';
import '../components/chat/Chat.css';

const MAX_MESSAGE_LENGTH = 4000;

export default function Chat() {
  const { chatId } = useParams(); // a string like "5", or undefined on /chat
  const navigate = useNavigate();

  const [chats, setChats] = useState([]);
  const [chatsLoading, setChatsLoading] = useState(true);
  const [messages, setMessages] = useState([]);
  // Start as "loading" when the page opens on a chat URL, to avoid a flash of "No messages".
  const [messagesLoading, setMessagesLoading] = useState(Boolean(chatId));
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Always holds the chat id currently in the URL. Async code reads it to check
  // "is the user still looking at the same chat?" after waiting for the server.
  const chatIdRef = useRef(chatId);
  // The chat whose messages are already in memory, so we do not fetch them again.
  const loadedChatIdRef = useRef(null);
  const menuButtonRef = useRef(null);

  useEffect(() => {
    chatIdRef.current = chatId;
  }, [chatId]);

  // Load the sidebar list once.
  useEffect(() => {
    let cancelled = false; // stops old requests from changing state after unmount
    async function load() {
      try {
        const data = await listChats();
        if (!cancelled) setChats(data.chats);
      } catch (loadError) {
        if (!cancelled) setError(loadError.message);
      } finally {
        if (!cancelled) setChatsLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  // Load the messages whenever the chat in the URL changes.
  useEffect(() => {
    if (!chatId) {
      loadedChatIdRef.current = null;
      setMessages([]);
      setMessagesLoading(false);
      return undefined;
    }

    // We just created or filled this chat ourselves, so the messages are already here.
    if (loadedChatIdRef.current === chatId) {
      setMessagesLoading(false);
      return undefined;
    }

    let cancelled = false; // ignore the answer if the user opened another chat meanwhile
    async function load() {
      setMessagesLoading(true);
      setMessages([]);
      try {
        const data = await getMessages(chatId);
        if (cancelled) return;
        setMessages(data.messages);
        loadedChatIdRef.current = chatId;
      } catch (loadError) {
        if (cancelled) return;
        setError(loadError.message);
        // A wrong or foreign chat id (400/404): go back to the empty state.
        if (loadError.status === 400 || loadError.status === 404) {
          navigate('/chat', { replace: true });
        }
      } finally {
        if (!cancelled) setMessagesLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [chatId, navigate]);

  // Escape closes the off-canvas sidebar on phones.
  useEffect(() => {
    if (!sidebarOpen) return undefined;
    function onKeyDown(event) {
      if (event.key === 'Escape') {
        setSidebarOpen(false);
        if (menuButtonRef.current) menuButtonRef.current.focus();
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [sidebarOpen]);

  function closeSidebar() {
    setSidebarOpen(false);
  }

  function handleNewChat() {
    setSidebarOpen(false);
    navigate('/chat');
  }

  function handleSelectChat(id) {
    setSidebarOpen(false);
    navigate(`/chat/${id}`);
  }

  async function handleSend() {
    const text = draft.trim();
    if (!text || sending || messagesLoading) return;

    setError('');
    setSending(true);
    setDraft('');

    // Optimistic message: show it right away, replace it with the saved one later.
    const tempId = `temp-${Date.now()}`;
    setMessages((previous) => [
      ...previous,
      { id: tempId, role: 'user', content: text, created_at: new Date().toISOString(), pending: true },
    ]);

    const startedOnChatId = chatId; // the chat that was open when the user pressed send
    let targetChatId = chatId;
    let createdChat = null;

    // True while the user is still looking at the chat where they pressed send.
    const stillHere = () => (chatIdRef.current || '') === (startedOnChatId || '');

    try {
      // From the empty state we must create the chat first.
      if (!targetChatId) {
        const created = await createChat();
        createdChat = created.chat;
        targetChatId = String(createdChat.id);
        setChats((previous) => [createdChat, ...previous]);
      }

      const result = await sendMessage(targetChatId, text);

      // Update the sidebar (the first message sets the title).
      setChats((previous) => {
        const exists = previous.some((chat) => chat.id === result.chat.id);
        return exists
          ? previous.map((chat) => (chat.id === result.chat.id ? result.chat : chat))
          : [result.chat, ...previous];
      });

      if (stillHere()) {
        setMessages((previous) =>
          previous
            .filter((message) => message.id !== tempId)
            .concat(result.userMessage, result.assistantMessage)
        );
        if (createdChat) {
          loadedChatIdRef.current = targetChatId; // messages are already in memory
          navigate(`/chat/${targetChatId}`);
        }
      }
    } catch (sendError) {
      setError(sendError.message);
      if (stillHere()) {
        // Remove the optimistic message and give the text back so nothing is lost.
        setMessages((previous) => previous.filter((message) => message.id !== tempId));
        setDraft(text);
        if (createdChat) {
          // The empty chat exists now. Open it so a retry does not create another one.
          loadedChatIdRef.current = targetChatId;
          navigate(`/chat/${targetChatId}`);
        }
      }
    } finally {
      setSending(false);
    }
  }

  // The title comes from the sidebar list, so we do not need a second state for it.
  let title = 'New chat';
  if (chatId) {
    const current = chats.find((chat) => String(chat.id) === chatId);
    title = current ? current.title : 'Chat';
  }

  return (
    <div className="chat-page">
      <ChatSidebar
        chats={chats}
        loading={chatsLoading}
        activeChatId={chatId}
        disabled={sending}
        isOpen={sidebarOpen}
        onNewChat={handleNewChat}
        onSelectChat={handleSelectChat}
        onClose={closeSidebar}
      />

      {sidebarOpen && <div className="chat-overlay" onClick={closeSidebar} aria-hidden="true" />}

      <section className="chat-main" aria-label="Conversation">
        <header className="chat-header">
          <button
            ref={menuButtonRef}
            type="button"
            className="chat-menu-button"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open chat list"
            aria-expanded={sidebarOpen}
            aria-controls="chat-sidebar"
          >
            ☰
          </button>
          <h1 className="chat-header__title">{title}</h1>
        </header>

        {error && (
          <div className="chat-error" role="alert">
            <span>{error}</span>
            <button
              type="button"
              className="chat-error__close"
              onClick={() => setError('')}
              aria-label="Dismiss error"
            >
              ×
            </button>
          </div>
        )}

        <MessageList
          messages={messages}
          loading={messagesLoading}
          hasChat={Boolean(chatId)}
          sending={sending}
        />

        <MessageInput
          value={draft}
          onChange={setDraft}
          onSend={handleSend}
          disabled={sending || messagesLoading}
          waiting={sending}
          maxLength={MAX_MESSAGE_LENGTH}
        />
      </section>
    </div>
  );
}