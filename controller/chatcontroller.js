const axios = require('axios');
const Conversation = require('../models/conversation');

exports.sendMessage = async (req, res) => {
  const { message } = req.body;
  const userId = req.user._id;

  if (!message || message.trim().length === 0) {
    return res.status(400).json({ error: 'Message is required' });
  }

  // Optional: Filter repeated sentences (e.g., "I feel... I feel...")
  const cleanedMessage = message.replace(/(\b.+?\b)(\s+\1)+/gi, "$1");

  try {
    const response = await axios.post('${process.env.REACT_APP_CHATBOT_MODEL_URL}/chat', {
      message: cleanedMessage,
    });

    let botResponse = response.data.response?.trim();

    // Fallback if model gives empty response
    if (!botResponse || botResponse.length < 5) {
      botResponse = "I'm having trouble understanding. Could you rephrase that or tell me more about how you feel?";
    }

    const newConvo = new Conversation({
      user: userId,
      message,
      response: botResponse,
    });

    await newConvo.save();
    res.json({ reply: botResponse });

  } catch (err) {
    console.error('Error communicating with FastAPI chatbot:', err);
    res.status(500).json({ error: 'Chatbot service error' });
  }
};
