'use strict';

const { z } = require('zod');
const { getContext } = require('./context');
const { getSupabase } = require('./supabase');

const vendorParamsSchema = z.object({
  industry: z.string().min(1, 'industry is required'),
  location: z.string().optional(),
  count: z.number().int().min(1).max(25).default(5),
  userId: z.string().optional(),
  task: z.string().optional(),
});

const callVendorParamsSchema = z.object({
  number: z.string().min(1, 'number is required'),
  prompt: z.string().optional(),
  first_message: z.string().optional(),
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
  {
    type: 'function',
    function: {
      name: 'call_vendor',
      description: 'Initiate an outbound call with a vendor using a context-enriched prompt.',
      parameters: {
        type: 'object',
        properties: {
          number: { type: 'string', description: 'Phone number in E.164 format, e.g. +15551234567' },
          prompt: { type: 'string', description: 'Optional additional prompt instructions' },
          first_message: { type: 'string', description: 'Optional first message to open the call' },
        },
        required: ['number'],
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

    // Insert into Supabase suppliers
    try {
      const supabase = getSupabase();
      const rows = vendors.map(v => ({
        name: v.name,
        email: v.email,
        phone: v.phone,
        specialty: v.speciality,
      }));
      const { error } = await supabase.from('suppliers').insert(rows);
      if (error) {
        throw error;
      }
    } catch (_e) {
      // swallow DB errors but return vendors; optionally log
    }

    return { vendors };
  },

  async call_vendor(args) {
    const { number, prompt, first_message } = callVendorParamsSchema.parse(args || {});

    // Fetch context for the specified user/task and fold it into the prompt
    let systemPrompt = '';
    try {
      const ctx = await getContext({ userId: 'bae2add0-c999-4ce1-bb6a-987afaa7cfd9', task: 'chat', maxTokens: 2000 });
      systemPrompt = ctx?.systemPrompt || '';
    } catch (_e) {
      systemPrompt = '';
    }

    const defaultPrompt = 'Please start an outbound call about project updates.';
    const combinedPrompt = [systemPrompt, prompt || defaultPrompt].filter(Boolean).join('\n\n');
    const body = {
      prompt: combinedPrompt,
      first_message: first_message || 'Hey John, my name is Christina, I wanted to quickly chat with you about your project with Alex and potential feedback you might have.',
      number,
    };

    const url = 'https://steady-handy-sculpin.ngrok-free.app/outbound-call';
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const text = await resp.text();
    let json;
    try { json = JSON.parse(text); } catch (_e) { json = { raw: text }; }
    return { ok: resp.ok, status: resp.status, response: json };
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