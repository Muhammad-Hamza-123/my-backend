const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const Conversation = require('../models/conversation');
const OpenAI = require('openai');
require('dotenv').config();


// Init OpenAI with the new version
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY, // ensure this is in Railway environment variables
});

// Get chat history
router.get('/history', authMiddleware, async (req, res) => {
  try {
    const convo = await Conversation.findOne({ user: req.user._id });
    if (!convo) return res.json({ history: [] });

    const formatted = convo.messages.map(msg => ({
      sender: msg.sender,
      text: msg.message
    }));

    res.json({ history: formatted });
  } catch (err) {
    console.error('History error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Send message and get response from OpenAI
router.post('/send', authMiddleware, async (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ message: 'Message cannot be empty' });

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo', // or 'gpt-4'
      messages: [{ role: 'user', content: message }],
      temperature: 0.7,
    });

    const botReply = completion.choices[0].message.content.trim();

    // Save to DB
    let convo = await Conversation.findOne({ user: req.user._id });
    if (!convo) convo = new Conversation({ user: req.user._id, messages: [] });

    convo.messages.push({ sender: 'user', message });
    convo.messages.push({ sender: 'bot', message: botReply });
    await convo.save();

    res.json({ message: botReply });

  } catch (error) {
    console.error('OpenAI API error:', error.message);
    res.status(500).json({ message: 'Failed to get response from chatbot.' });
  }
});

module.exports = router;
