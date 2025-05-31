const express = require('express');
const router = express.Router();
const axios = require('axios');
const authMiddleware = require('../middleware/authMiddleware');
const Conversation = require('../models/conversation');
require('dotenv').config();

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

router.post('/send', authMiddleware, async (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ message: 'Message cannot be empty' });

  try {
    const response = await axios.post(
  'https://openrouter.ai/api/v1/chat/completions',
  {
    model: 'deepseek/deepseek-r1-0528-qwen3-8b:free',
    messages: [
      {
        role: 'system',
        content: 'You are a compassionate and supportive mental health assistant. You help users cope with stress, anxiety, depression, and emotional issues. Always respond kindly and offer helpful, comforting advice in a concise and easy-to-understand manner. Keep your answers brief unless more detail is needed.',
      },
      {
        role: 'user',
        content: message,
      },
    ],
    max_tokens: 300  // ⬅️ limits how long the reply can be
  },
  {
    headers: {
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
    },
  }
);


    const botReply = response.data.choices[0].message.content.trim();

    // Save conversation
    let convo = await Conversation.findOne({ user: req.user._id });
    if (!convo) convo = new Conversation({ user: req.user._id, messages: [] });

    convo.messages.push({ sender: 'user', message });
    convo.messages.push({ sender: 'bot', message: botReply });
    await convo.save();

    res.json({ message: botReply });

  } catch (error) {
    if (error.response) {
      console.error('OpenRouter API response error:', error.response.status, error.response.data);
    } else {
      console.error('OpenRouter API error:', error.message);
    }
    res.status(500).json({ message: 'Failed to get response from chatbot.' });
  }
});

// ✅ Endpoint to get chat history
router.get('/history', authMiddleware, async (req, res) => {
  try {
    const convo = await Conversation.findOne({ user: req.user._id });
    if (!convo) return res.json({ history: [] });
    res.json({ history: convo.messages });
  } catch (err) {
    console.error('Error fetching chat history:', err);
    res.status(500).json({ message: 'Failed to fetch chat history' });
  }
});

module.exports = router;
