import { Routes, Route } from 'react-router-dom'
import Chat from './pages/Chat.jsx'

// Each route renders my Chat page. The ":chatId" part is read inside Chat.jsx with useParams.
export default function App() {
  return (
    <Routes>
      <Route path="/chat" element={<Chat />} />
      <Route path="/chat/:chatId" element={<Chat />} />
    </Routes>
  )
}