'use strict';

const dotenv = require('dotenv');
dotenv.config({ override: true });

const express = require('express');
const cors = require('cors');
const swaggerUi = require('swagger-ui-express');
const { swaggerSpec } = require('./swagger');
const chatRouter = require('./routes/chat');


const app = express();

const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  'https://preview--nego-bot-buddy.lovable.app',
  'https://nego-bot-buddy.lovable.app',
  'https://chatbot-cdtmhack.ngrok.app',
];

function isNgrokOrigin(origin) {
  try {
    const url = new URL(origin);
    return url.hostname.endsWith('.ngrok.app');
  } catch (_e) {
    return false;
  }
}

app.use(cors({
  origin: function(origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin) || isNgrokOrigin(origin)) return callback(null, true);
    return callback(new Error('Not allowed by CORS'));
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

app.use(express.json({ limit: '1mb' }));

app.get('/', (_req, res) => {
  res.json({ status: 'ok', docs: '/docs', chat: '/v1/chat' });
});

app.get('/openapi.json', (_req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(JSON.stringify(swaggerSpec, null, 2));
});

app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.use('/v1/chat', chatRouter);

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});

// Context routes removed; context is handled within /v1/chat