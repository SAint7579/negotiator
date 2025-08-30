'use strict';

const swaggerJsdoc = require('swagger-jsdoc');

const swaggerDefinition = {
  openapi: '3.0.3',
  info: {
    title: 'Negotiator API',
    version: '1.0.0',
    description: 'Chat Completions with function calling via OpenAI',
  },
  servers: [
    { url: 'http://localhost:3000', description: 'Local dev' },
  ],
};

const options = {
  definition: swaggerDefinition,
  apis: ['./src/routes/*.js'],
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = { swaggerSpec };