const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const Conversation = require('../models/conversation');
const axios = require('axios');  // Make sure axios is imported

// Route to get conversation history
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

// Route to send message and get bot reply from Hugging Face
router.post('/send', authMiddleware, async (req, res) => {
  const { message } = req.body;

  if (!message) return res.status(400).json({ message: 'Message cannot be empty' });

  try {
    const hfResponse = await axios.post(
      `https://api-inference.huggingface.co/models/tiiuae/falcon-7b-instruct`,
      { inputs: message },
      {
        headers: {
          Authorization: `Bearer ${process.env.HUGGINGFACE_TOKEN}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      }
    );

    const botReply = hfResponse.data?.[0]?.generated_text || "Sorry, I couldn't generate a response.";

    let convo = await Conversation.findOne({ user: req.user._id });
    if (!convo) convo = new Conversation({ user: req.user._id, messages: [] });

    convo.messages.push({ sender: 'user', message });
    convo.messages.push({ sender: 'bot', message: botReply });
    await convo.save();

    res.json({ message: botReply });

  } catch (error) {
    console.error('Error calling Hugging Face API:', error.response?.data || error.message);
    res.status(500).json({ message: 'Failed to get response from chatbot.' });
  }
});

module.exports = router;
