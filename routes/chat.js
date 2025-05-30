const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const Conversation = require('../models/conversation');
const axios = require('axios');

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

// Send message and get response from Hugging Face API
router.post('/send', authMiddleware, async (req, res) => {
  const { message } = req.body;

  if (!message) return res.status(400).json({ message: 'Message cannot be empty' });

  try {
    // Call Hugging Face GPT-2 Inference API
    const hfResponse = await axios.post(
      'https://api-inference.huggingface.co/models/facebook/blenderbot-400M-distill'
,
      { inputs: message },
      {
        headers: {
          Authorization: `Bearer ${process.env.HUGGINGFACE_TOKEN}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      }
    );

    // Parse the generated text from the response
    const botReply = hfResponse.data[0]?.generated_text || "Sorry, I couldn't generate a response.";

    // Save conversation to MongoDB
    let convo = await Conversation.findOne({ user: req.user._id });
    if (!convo) convo = new Conversation({ user: req.user._id, messages: [] });

    convo.messages.push({ sender: 'user', message });
    convo.messages.push({ sender: 'bot', message: botReply });
    await convo.save();

    res.json({ message: botReply });

  } catch (error) {
    if (error.response) {
      console.error('Hugging Face API error data:', error.response.data);
      console.error('Hugging Face API error status:', error.response.status);
    } else {
      console.error('Error message:', error.message);
    }
    res.status(500).json({ message: 'Failed to get response from chatbot.' });
  }
});

module.exports = router;
