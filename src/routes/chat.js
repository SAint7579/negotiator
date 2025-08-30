'use strict';

const express = require('express');
const OpenAI = require('openai');
const { toolsSpec, executeToolCall } = require('../lib/tools');
const { generateId, readHistory, writeHistory } = require('../lib/chatStore');
const { getContext } = require('../lib/context');

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
 *               userId:
 *                 type: string
 *                 description: Optional user ID to personalize context
 *               task:
 *                 type: string
 *                 description: "Optional task label to personalize context"
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
  const userId = req.body?.userId;
  const task = req.body?.task || 'chat';

  if (!input || typeof input !== 'string') {
    return res.status(400).json({ error: 'message is required and must be a string' });
  }

  const { systemPrompt } = await getContext({ userId, task, maxTokens: 2000 });
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

/**
 * @openapi
 * /v1/chat/context:
 *   post:
 *     summary: Fetch personalized context for a user/task (Kontext)
 *     tags:
 *       - chat
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               userId:
 *                 type: string
 *                 description: User ID to fetch context for
 *               task:
 *                 type: string
 *                 description: "Optional task label (default: chat)"
 *             required: [userId]
 *     responses:
 *       200:
 *         description: Context payload
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 systemPrompt:
 *                   type: string
 *                 messages:
 *                   type: array
 *                   items:
 *                     type: object
 *                 maxTokens:
 *                   type: integer
 */
router.post('/context', async (req, res) => {
  const userId = req.body?.userId;
  const task = req.body?.task || 'chat';
  if (!userId || typeof userId !== 'string') {
    return res.status(400).json({ error: 'userId is required and must be a string' });
  }
  try {
    const ctx = await getContext({ userId, task, maxTokens: 2000 });
    return res.json(ctx);
  } catch (err) {
    const status = err.status || err.statusCode || 500;
    return res.status(status).json({ error: err.message || 'Failed to fetch context' });
  }
});