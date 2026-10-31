require('dotenv').config();
const express = require('express');
const cors = require('cors');
const chatsRouter = require('./routes/chats');


const app = express();
app.use(cors());
app.use(express.json());
app.use('/api/chats', chatsRouter);

app.get('/api/health', (req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));