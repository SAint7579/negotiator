'use strict';

let persona;
async function getPersona() {
  if (!persona) {
    const mod = await import('@kontext.dev/kontext-sdk');
    const Persona = mod.Persona || (mod.default && mod.default.Persona) || mod.default;
    persona = new Persona({ apiKey: process.env.KONTEXT_API_KEY });
  }
  return persona;
}

async function getContext({ userId, task = 'chat', maxTokens = 2000 } = {}) {
  try {
    const client = await getPersona();
    const ctx = await client.getContext({ userId, task, maxTokens });
    return ctx;
  } catch (_e) {
    const basePrompt = 'You are an assistant that would help people identify negotiation partners';
    let personalized = '';
    if (userId) {
      personalized = ` You are conversing with user ${userId}. Task: ${task}.`;
    }
    const systemPrompt = `${basePrompt}.${personalized}`.trim();
    return { systemPrompt, messages: [], maxTokens };
  }
}

module.exports = { getContext };