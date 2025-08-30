'use strict';

const express = require('express');
const OpenAI = require('openai');
const { toolsSpec, executeToolCall } = require('../lib/tools');
const { generateId, readHistory, writeHistory } = require('../lib/chatStore');

const router = express.Router();

/**
 * @openapi
 * /v1/chat:
 *   post:
 *     summary: Chat completion with optional function calling
 *     tags:
 *       - chat
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               model:
 *                 type: string
 *                 default: gpt-4o-mini
 *               message:
 *                 type: string
 *                 description: The user's message
 *               chatId:
 *                 type: string
 *                 description: Provide to continue an existing chat. Omit to start a new chat.
 *             required: [message]
 *     responses:
 *       200:
 *         description: The assistant's final message after any tool calls
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 messages:
 *                   type: array
 *                   description: Full transcript including any tool messages
 *                 response:
 *                   type: object
 *                   description: Raw API response from the final call
 */
router.post('/', async (req, res) => {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const model = req.body?.model || 'gpt-4o-mini';
  const input = req.body?.message;
  let chatId = req.body?.chatId;

  if (!input || typeof input !== 'string') {
    return res.status(400).json({ error: 'message is required and must be a string' });
  }

  const systemPrompt = 'You are an assistant that would help people identify negotiation partners';
  let messages = [];
  if (chatId) {
    messages = readHistory(chatId);
  }
  if (messages.length === 0) {
    messages.push({ role: 'system', content: systemPrompt });
  }
  messages.push({ role: 'user', content: input });

  try {
    let completion = await openai.chat.completions.create({
      model,
      messages,
      tools: toolsSpec,
      tool_choice: 'auto',
      temperature: 0.2,
    });

    let assistantMessage = completion.choices?.[0]?.message;
    messages.push(assistantMessage);

    while (assistantMessage?.tool_calls && assistantMessage.tool_calls.length > 0) {
      const toolResults = [];
      for (const toolCall of assistantMessage.tool_calls) {
        const resultJson = await executeToolCall(toolCall);
        toolResults.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: resultJson,
        });
      }

      messages.push(...toolResults);

      completion = await openai.chat.completions.create({
        model,
        messages,
        tools: toolsSpec,
        tool_choice: 'auto',
        temperature: 0.2,
      });

      assistantMessage = completion.choices?.[0]?.message;
      messages.push(assistantMessage);
    }

    if (!chatId) chatId = generateId();
    writeHistory(chatId, messages);
    return res.json({ chatId, messages, response: completion });
  } catch (err) {
    const status = err.status || 500;
    return res.status(status).json({ error: err.message || 'Unexpected error' });
  }
});

module.exports = router;

// Context endpoint
router.post('/api/context', async (req, res) => {
  const { userId, task } = req.body;
  
  try {
    const context = await persona.getContext({
      userId,
      task: task || 'chat',
      maxTokens: 2000
    });
    
    res.json(context);
  } catch (error) {
    if (error.code === 'UNAUTHORIZED_USER') {
      res.status(401).json({ error: 'User needs to connect Gmail' });
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

// Chat endpoint with AI integration
router.post('/api/chat', async (req, res) => {
  const { userId, message } = req.body;
  
  try {
    // Get personalized context
    const context = await persona.getContext({
      userId,
      task: 'chat'
    });
    
    // Use with OpenAI (or any AI provider)
    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: context.systemPrompt },
        { role: 'user', content: message }
      ]
    });
    
    res.json({ 
      response: completion.choices[0].message.content 
    });
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ error: 'Failed to generate response' });
  }
});