const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const Conversation = require('../models/conversation');
const { spawn } = require('child_process');
const path = require('path');

router.get('/history', authMiddleware, async (req, res) => {
  try {
    const convo = await Conversation.findOne({ user: req.user._id });
    if (!convo) return res.json({ history: [] }); // wrap in { history: [...] }

    const formatted = convo.messages.map(msg => ({
      sender: msg.sender,
      text: msg.message
    }));

    res.json({ history: formatted }); // wrap in { history: [...] }
  } catch (err) {
    console.error('History error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});


router.post('/send', authMiddleware, async (req, res) => {
  const { message } = req.body;

  if (!message) return res.status(400).json({ message: 'Message cannot be empty' });

  let botReply = '';

  const pythonProcess = spawn('python', [
    path.join(__dirname, '../../ml-model/mental-health-chatbot/chatbot.py'),
    message
  ]);

  pythonProcess.stdout.on('data', data => {
    botReply += data.toString();
  });

  pythonProcess.stderr.on('data', data => {
    console.error(`Python stderr: ${data}`);
  });

  pythonProcess.on('close', async () => {
    try {
      botReply = botReply.trim() || "I'm having trouble understanding. Can you rephrase?";

      let convo = await Conversation.findOne({ user: req.user._id });
      if (!convo) {
        convo = new Conversation({ user: req.user._id, messages: [] });
      }

      convo.messages.push({ sender: 'user', message });
      convo.messages.push({ sender: 'bot', message: botReply });
      await convo.save();

      res.json({ message: botReply });
    } catch (err) {
      console.error('Chat error:', err);
      res.status(500).json({ message: 'Failed to respond' });
    }
  });
});

module.exports = router;
