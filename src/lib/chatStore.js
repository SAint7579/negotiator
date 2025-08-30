'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(process.cwd(), 'data', 'chats');

function ensureDir() {
  if (!fs.existsSync(ROOT)) {
    fs.mkdirSync(ROOT, { recursive: true });
  }
}

function getFilePath(chatId) {
  return path.join(ROOT, `${chatId}.json`);
}

function generateId() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function readHistory(chatId) {
  ensureDir();
  const file = getFilePath(chatId);
  if (!fs.existsSync(file)) return [];
  try {
    const text = fs.readFileSync(file, 'utf8');
    return JSON.parse(text);
  } catch (_e) {
    return [];
  }
}

function writeHistory(chatId, messages) {
  ensureDir();
  const file = getFilePath(chatId);
  fs.writeFileSync(file, JSON.stringify(messages, null, 2), 'utf8');
}

module.exports = {
  generateId,
  readHistory,
  writeHistory,
};