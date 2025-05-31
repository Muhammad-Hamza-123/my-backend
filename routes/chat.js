const express = require('express');
const router = express.Router();
const axios = require('axios');
const rateLimit = require('express-rate-limit');
const authMiddleware = require('../middleware/authMiddleware');
const Conversation = require('../models/conversation');
require('dotenv').config();

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

const userLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 7, // limit each user to 7 requests per window
  keyGenerator: (req) => req.user._id.toString(), // rate limit per user
  handler: (req, res) => {
    console.log(`Rate limit hit by user: ${req.user?._id || 'unknown'}`);
    return res.status(429).json({ message: 'Too many requests. Please wait 15 mins and try again later.' });
  },
});

router.post('/send', authMiddleware, userLimiter, async (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ message: 'Message cannot be empty' });
  const cleanMessage = message
    .replace(/[^\w\s.,!?]/g, '')  // remove unwanted characters
    .replace(/\s+/g, ' ')         // normalize whitespace
    .trim();

  if (cleanMessage.length === 0) {
    return res.status(400).json({ message: 'Message cannot be empty after cleanup' });
  }
  try {
    const response = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: 'deepseek/deepseek-r1-0528-qwen3-8b:free',
        messages: [
          {
            role: 'system',
            content:
              'You are a compassionate and supportive mental health assistant. You help users cope with stress, anxiety, depression, and emotional issues. Always respond kindly and offer helpful, comforting advice in a concise and easy-to-understand manner. Keep your answers brief unless more detail is needed.',
          },
          {
            role: 'user',
            content: cleanMessage,
          },
        ],
        max_tokens: 300, // limits how long the reply can be
      },
      {
        headers: {
          Authorization: `Bearer ${OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log('OpenRouter API response:', JSON.stringify(response.data, null, 2));

    if (!response.data.choices || response.data.choices.length === 0) {
      console.error('OpenRouter API returned no choices:', response.data);
      return res.status(500).json({ message: 'No response from chatbot API.' });
    }

    const choice = response.data.choices[0];
    const botReply = choice.message?.content?.trim();
    const finishReason = choice.finish_reason;

    if (!botReply) {
      console.error('Bot reply is empty or undefined');
      return res.status(500).json({ message: 'Bot did not return any response.' });
    }

    if (finishReason !== 'stop') {
      console.warn(`Warning: Bot reply might be incomplete. finish_reason: ${finishReason}`);
      // Optional: you can append something here like:
      // botReply += " ... (response might be incomplete)";
    }

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
    console.error('Chatbot send error:', error.response?.status, error.response?.data || error.message);

    res.status(500).json({ message: 'Failed to get response from chatbot.' });
  }
});


// Endpoint to get chat history
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
