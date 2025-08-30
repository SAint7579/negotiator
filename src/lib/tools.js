'use strict';

const { z } = require('zod');
const { getContext } = require('./context');

const vendorParamsSchema = z.object({
  industry: z.string().min(1, 'industry is required'),
  location: z.string().optional(),
  count: z.number().int().min(1).max(25).default(5),
  userId: z.string().optional(),
  task: z.string().optional(),
});

const toolsSpec = [
  {
    type: 'function',
    function: {
      name: 'generate_vendor_list',
      description: 'Generate a list of vendors with email, phone, and speciality based on context.',
      parameters: {
        type: 'object',
        properties: {
          industry: { type: 'string', description: 'Target industry or niche' },
          location: { type: 'string', description: 'Optional location filter (e.g. city, state, country)' },
          count: { type: 'integer', minimum: 1, maximum: 25, default: 5 },
          userId: { type: 'string', description: 'Optional user id for personalized context' },
          task: { type: 'string', description: 'Optional task label for personalized context' },
        },
        required: ['industry'],
        additionalProperties: false,
      },
    },
  },
];

const toolExecutors = {
  async generate_vendor_list(args) {
    const { industry, location, count, userId, task } = vendorParamsSchema.parse(args || {});

    // Pull simple context if provided; currently used to influence naming only
    let systemPrompt = '';
    if (userId && typeof userId === 'string' && userId.length > 0) {
      try {
        const ctx = await getContext({ userId, task: task || 'chat' });
        systemPrompt = ctx?.systemPrompt || '';
      } catch (_e) {
        systemPrompt = '';
      }
    }

    const specialties = [
      'Enterprise procurement', 'SMB solutions', 'SaaS integrations', 'Hardware supply',
      'Logistics', 'Consulting', 'Maintenance', 'Implementation', 'Data services', 'Training'
    ];
    const area = location || 'General';

    function toSlug(words) {
      return words.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    }

    function makePhone() {
      const n = () => Math.floor(Math.random() * 10);
      return `+1-${n()}${n()}${n()}-${n()}${n()}${n()}-${n()}${n()}${n()}${n()}`;
    }

    const seed = toSlug(`${industry}-${area}-${systemPrompt || ''}`).length;
    function seededRand(i) {
      // very simple pseudo-random based on seed and index
      const x = Math.sin(seed * (i + 1)) * 10000;
      return x - Math.floor(x);
    }

    const vendors = Array.from({ length: count }).map((_, i) => {
      const r = seededRand(i);
      const spec = specialties[Math.floor(r * specialties.length)];
      const base = `${industry} ${spec}`.split(' ').slice(0, 3).join(' ');
      const name = `${base} Partners ${i + 1}`;
      const slug = toSlug(`${industry}-${spec}-${i + 1}`);
      return {
        name,
        email: `${slug}@example.com`,
        phone: makePhone(),
        speciality: spec,
        location: area,
      };
    });

    return { vendors };
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