'use strict';

const { z } = require('zod');

const weatherParamsSchema = z.object({
  location: z.string(),
  unit: z.enum(['c', 'f']).default('c'),
});

const timeParamsSchema = z.object({
  timezone: z.string().optional(),
});

const toolsSpec = [
  {
    type: 'function',
    function: {
      name: 'get_current_weather',
      description: 'Get current weather for a location (mocked data).',
      parameters: {
        type: 'object',
        properties: {
          location: { type: 'string', description: 'City and country, e.g. "San Francisco, US"' },
          unit: { type: 'string', enum: ['c', 'f'], default: 'c' },
        },
        required: ['location'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_current_time',
      description: 'Get the current time (ISO string). Optionally specify a timezone label (not applied).',
      parameters: {
        type: 'object',
        properties: {
          timezone: { type: 'string', description: 'IANA or label (for display only).' },
        },
        required: [],
        additionalProperties: false,
      },
    },
  },
];

const toolExecutors = {
  async get_current_weather(args) {
    const { location, unit } = weatherParamsSchema.parse(args || {});
    const celsius = 22;
    const fahrenheit = Math.round((celsius * 9) / 5 + 32);
    const temperature = unit === 'f' ? fahrenheit : celsius;
    return {
      location,
      unit,
      temperature,
      condition: 'sunny',
      source: 'mock',
    };
  },

  async get_current_time(args) {
    const { timezone } = timeParamsSchema.parse(args || {});
    const now = new Date();
    return {
      iso: now.toISOString(),
      timezone: timezone || 'UTC',
    };
  },
};

async function executeToolCall(toolCall) {
  const { name, arguments: stringifiedArgs } = toolCall.function || {};
  if (!name) throw new Error('Tool call missing function name');

  let args = {};
  try {
    args = stringifiedArgs ? JSON.parse(stringifiedArgs) : {};
  } catch (_e) {
    args = {};
  }

  const fn = toolExecutors[name];
  if (!fn) {
    throw new Error(`Unknown tool: ${name}`);
  }
  const result = await fn(args);
  return JSON.stringify(result);
}

module.exports = {
  toolsSpec,
  executeToolCall,
};