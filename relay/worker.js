/**
 * Strobilus Atlas: photo identification relay (Cloudflare Worker).
 *
 * The page posts { prompt, images: [{ media_type, data(base64) }] }. This worker adds your Anthropic API key,
 * asks Claude, and returns { text }. The key never reaches the browser.
 *
 * Settings (Worker > Settings > Variables and Secrets):
 *   ANTHROPIC_API_KEY  secret, required   your key from console.anthropic.com
 *   ALLOWED_ORIGINS    text, recommended  comma-separated sites allowed to call this, e.g.
 *                                         https://rexgw.github.io,http://localhost:8000
 *   MODEL              text, optional     default claude-haiku-5-5 (cheapest); a Sonnet model is more accurate
 *   MAX_PER_10_MIN     text, optional     requests allowed per visitor per 10 minutes (default 30)
 */

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const MAX_IMAGES = 3;
const MAX_IMAGE_B64 = 2_000_000;   // about 1.5 MB per image; the page sends ~1 MP JPEGs, far smaller
const MAX_PROMPT = 20_000;         // characters
const MAX_BODY = 6_500_000;        // bytes

// best-effort limit per visitor; it resets when Cloudflare recycles the worker, so also set a spend limit
const hits = new Map();
function allow(ip, perWindow) {
  const now = Date.now(), win = 10 * 60 * 1000;
  const list = (hits.get(ip) || []).filter(t => now - t < win);
  if (list.length >= perWindow) { hits.set(ip, list); return false; }
  list.push(now); hits.set(ip, list);
  if (hits.size > 5000) hits.clear();
  return true;
}

function reply(obj, status, cors) {
  return new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json', ...cors } });
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const allowed = String(env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim().replace(/\/$/, '')).filter(Boolean);
    const originOk = allowed.length === 0 || allowed.includes(origin);
    const cors = {
      'Access-Control-Allow-Origin': originOk ? (origin || '*') : 'null',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'content-type',
      'Access-Control-Max-Age': '86400',
      'Vary': 'Origin'
    };

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (request.method !== 'POST') return reply({ error: 'Send a POST request.' }, 405, cors);
    if (!originOk) return reply({ error: 'This site is not allowed to use the relay.' }, 403, cors);
    if (!env.ANTHROPIC_API_KEY) return reply({ error: 'The relay has no API key set.' }, 500, cors);

    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    if (!allow(ip, Math.max(1, parseInt(env.MAX_PER_10_MIN || '30', 10) || 30))) {
      return reply({ error: 'Too many requests. Try again in a few minutes.' }, 429, cors);
    }
    if ((parseInt(request.headers.get('content-length') || '0', 10) || 0) > MAX_BODY) {
      return reply({ error: 'Request too large.' }, 413, cors);
    }

    let body;
    try { body = await request.json(); } catch { return reply({ error: 'Body must be JSON.' }, 400, cors); }
    const prompt = typeof body.prompt === 'string' ? body.prompt : '';
    if (!prompt || prompt.length > MAX_PROMPT) return reply({ error: 'Missing or oversized prompt.' }, 400, cors);
    const images = Array.isArray(body.images) ? body.images.slice(0, MAX_IMAGES) : [];
    if (!images.length) return reply({ error: 'At least one photo is needed.' }, 400, cors);
    for (const im of images) {
      if (!im || !IMAGE_TYPES.has(im.media_type) || typeof im.data !== 'string' || im.data.length > MAX_IMAGE_B64 || /[^A-Za-z0-9+/=]/.test(im.data)) {
        return reply({ error: 'Unsupported or oversized image.' }, 400, cors);
      }
    }

    const content = images.map(im => ({ type: 'image', source: { type: 'base64', media_type: im.media_type, data: im.data } }));
    content.push({ type: 'text', text: prompt });

    let upstream;
    try {
      upstream = await fetch(ANTHROPIC_URL, {
        method: 'POST',
        headers: { 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({ model: env.MODEL || 'claude-haiku-5-5', max_tokens: 1500, messages: [{ role: 'user', content }] })
      });
    } catch {
      return reply({ error: 'Could not reach the analysis service.' }, 502, cors);
    }
    if (!upstream.ok) {
      const status = upstream.status === 429 ? 429 : 502;
      return reply({ error: 'The analysis service returned an error.', upstream: upstream.status }, status, cors);
    }
    const data = await upstream.json().catch(() => ({}));
    const text = (Array.isArray(data.content) ? data.content : []).filter(c => c && c.type === 'text').map(c => c.text).join('');
    return reply({ text }, 200, cors);
  }
};
