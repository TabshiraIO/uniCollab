'use strict';

// server/src/services/llm.js
// The ONLY file that talks to Gemini. Teammates can reuse generateReply().
// It rotates between several API keys when one key runs out of quota.

const COOLDOWN_MS = 60 * 1000; // a key that hit its quota rests for 60 seconds
const REQUEST_TIMEOUT_MS = 30 * 1000; // never wait for Gemini longer than 30 seconds
const DEFAULT_MODEL = 'gemini-2.5-flash'; // only a fallback value, the real one comes from .env
const DEFAULT_MAX_OUTPUT_TOKENS = 800;

const SYSTEM_INSTRUCTION =
  'You are a friendly and concise study assistant for university students. ' +
  'Explain ideas simply, use short examples, and say honestly when you are not sure.';

// Remembers which key is resting. Map key: "model|keyPosition", value: time when it may be used again.
// We store the key POSITION, never the key itself, so a key can never leak from here.
const cooldowns = new Map();

// ---------- helpers ----------

// An error that the controller understands: status 429 = quota, 502 = general failure.
function makeError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

// Read the keys at call time, so changing .env and restarting is enough.
function readKeys() {
  const raw = process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || process.env.LLM_API_KEY || '';
  return raw
    .split(',')
    .map((key) => key.trim())
    .filter(Boolean);
}

// Remove every key (and anything that looks like a Google key) from a text before logging it.
function redact(text, keys) {
  let clean = String(text || '');
  for (const key of keys) {
    clean = clean.split(key).join('[hidden]');
  }
  return clean.replace(/AIza[0-9A-Za-z_-]{20,}/g, '[hidden]');
}

// Load the SDK only when it is first needed, so a problem with the SDK does not stop the whole server.
// Try require() first, and if the package is ESM-only, fall back to import().
let sdkPromise = null;
function loadSdk() {
  if (!sdkPromise) {
    sdkPromise = (async () => {
      try {
        return require('@google/genai');
      } catch (requireError) {
        return import('@google/genai');
      }
    })();
    sdkPromise.catch(() => {
      sdkPromise = null; // allow a retry on the next request
    });
  }
  return sdkPromise;
}

// Decide what kind of error Gemini gave us.
function classify(error) {
  const status = Number(error && (error.status || error.code)) || 0;
  const message = String((error && error.message) || '');
  const isQuota = status === 429 || /RESOURCE_EXHAUSTED|quota|rate limit/i.test(message);
  const isBadKey = !isQuota && (status === 400 || status === 403);
  return { status, isQuota, isBadKey };
}

function cooldownId(model, keyIndex) {
  return `${model}|${keyIndex}`;
}

function isCooling(model, keyIndex) {
  const until = cooldowns.get(cooldownId(model, keyIndex));
  return Boolean(until && until > Date.now());
}

// Our app uses "assistant", Gemini uses "model". Gemini also wants the chat to start with a user message.
function buildContents(history, userMessage) {
  const contents = [];
  for (const item of Array.isArray(history) ? history : []) {
    if (!item || typeof item.content !== 'string') continue;
    if (item.role !== 'user' && item.role !== 'assistant') continue;
    if (contents.length === 0 && item.role === 'assistant') continue; // drop leading assistant messages
    contents.push({
      role: item.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: item.content }],
    });
  }
  contents.push({ role: 'user', parts: [{ text: userMessage }] });
  return contents;
}

// One single call to Gemini with one key. Returns the answer text or throws.
async function callGemini(sdk, apiKey, model, contents, maxOutputTokens) {
  const ai = new sdk.GoogleGenAI({ apiKey });

  // AbortController lets us cancel the request after 30 seconds.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await ai.models.generateContent({
      model,
      contents,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        maxOutputTokens,
        abortSignal: controller.signal,
      },
    });
    const text = typeof response.text === 'string' ? response.text.trim() : '';
    // An empty answer is useless, so we treat it as a failure and save nothing.
    if (!text) throw makeError(502, 'Gemini returned an empty answer.');
    return text;
  } finally {
    clearTimeout(timer);
  }
}

// Try one model with every key (each key at most once).
// Returns { text } on success, or { failure: 'quota' | 'other' } when it did not work.
async function tryModel(sdk, model, keys, contents, maxOutputTokens) {
  let sawQuota = false;

  for (let index = 0; index < keys.length; index += 1) {
    const position = index + 1; // humans count from 1, so logs say "key #1"

    if (isCooling(model, index)) {
      sawQuota = true; // it is resting because of quota
      continue;
    }

    try {
      const text = await callGemini(sdk, keys[index], model, contents, maxOutputTokens);
      return { text };
    } catch (error) {
      const info = classify(error);

      if (info.isQuota) {
        cooldowns.set(cooldownId(model, index), Date.now() + COOLDOWN_MS);
        sawQuota = true;
        console.warn(`[llm] key #${position} is out of quota for ${model}, trying the next key.`);
        continue;
      }

      if (info.isBadKey) {
        console.warn(`[llm] key #${position} was rejected (status ${info.status}), skipping it.`);
        continue;
      }

      // Any other problem (timeout, network, empty answer): stop for this model.
      console.error(
        `[llm] ${model} failed with key #${position}:`,
        redact(error && error.message, keys)
      );
      return { failure: 'other' };
    }
  }

  return { failure: sawQuota ? 'quota' : 'other' };
}

// ---------- the function other files use ----------

// history = [{ role: 'user' | 'assistant', content }], oldest first.
// Returns the answer as text. Throws an error with status 429 (quota) or 502 (anything else).
async function generateReply(history, userMessage) {
  const keys = readKeys();
  if (keys.length === 0) {
    console.error('[llm] No Gemini API key found. Set GEMINI_API_KEYS in server/.env.');
    throw makeError(502, 'No API key is configured.');
  }

  const mainModel = process.env.GEMINI_MODEL || DEFAULT_MODEL;
  const fallbackModel = process.env.GEMINI_FALLBACK_MODEL || '';
  const maxOutputTokens = Number(process.env.GEMINI_MAX_OUTPUT_TOKENS) || DEFAULT_MAX_OUTPUT_TOKENS;
  const contents = buildContents(history, userMessage);

  let sdk;
  try {
    sdk = await loadSdk();
  } catch (loadError) {
    console.error('[llm] Could not load @google/genai:', redact(loadError.message, keys));
    throw makeError(502, 'The AI library could not be loaded.');
  }

  const mainResult = await tryModel(sdk, mainModel, keys, contents, maxOutputTokens);
  if (mainResult.text) return mainResult.text;

  // The main model did not work. Try the fallback model once.
  if (fallbackModel && fallbackModel !== mainModel) {
    console.warn(`[llm] Trying the fallback model ${fallbackModel}.`);
    const fallbackResult = await tryModel(sdk, fallbackModel, keys, contents, maxOutputTokens);
    if (fallbackResult.text) return fallbackResult.text;
  }

  // Status 429 only when the MAIN model ended because of quota. The controller turns it into 503.
  throw makeError(mainResult.failure === 'quota' ? 429 : 502, 'The AI could not answer.');
}

module.exports = { generateReply };