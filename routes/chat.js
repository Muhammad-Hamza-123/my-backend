const express = require('express');
const router = express.Router();
const axios = require('axios');
const authMiddleware = require('../middleware/authMiddleware');
const Conversation = require('../models/conversation');
require('dotenv').config();

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY; // put your key in .env file

router.post('/send', authMiddleware, async (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ message: 'Message cannot be empty' });

  try {
    const response = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: 'gpt-3.5-turbo',  // OpenRouter supports this for compatibility
        messages: [{ role: 'user', content: message }],
      },
      {
        headers: {
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
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
    console.error('OpenRouter API error:', error.response?.data || error.message);
    if (error.response?.status === 429) {
      return res.status(429).json({ message: 'OpenRouter quota exceeded. Please check your usage.' });
    }
    res.status(500).json({ message: 'Failed to get response from chatbot.' });
  }
});

module.exports = router;
