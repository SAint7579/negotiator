'use strict';

const express = require('express');
const OpenAI = require('openai');
const { toolsSpec, executeToolCall } = require('../lib/tools');

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
 *               messages:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     role:
 *                       type: string
 *                       enum: [system, user, assistant, tool]
 *                     content:
 *                       type: string
 *                   required: [role, content]
 *             required: [messages]
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
  let messages = Array.isArray(req.body?.messages) ? req.body.messages : [];

  if (messages.length === 0) {
    return res.status(400).json({ error: 'messages is required and must be an array' });
  }

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

    return res.json({ messages, response: completion });
  } catch (err) {
    const status = err.status || 500;
    return res.status(status).json({ error: err.message || 'Unexpected error' });
  }
});

module.exports = router;