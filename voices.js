'use strict';

const { getAllowedVoiceIds, configError, providerFetch, rateLimit } = require('../lib/elevenlabs');

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed.' });
  }
  if (!rateLimit(req, 'voices', 30)) return res.status(429).json({ error: 'Too many requests. Try again shortly.' });

  const setupProblem = configError();
  if (setupProblem) return res.status(503).json({ error: 'Neural voices are not configured yet.' });

  try {
    const ids = getAllowedVoiceIds();
    const results = await Promise.all(ids.map(async voiceId => {
      const response = await providerFetch(`https://api.elevenlabs.io/v1/voices/${encodeURIComponent(voiceId)}`);
      if (!response.ok) return null;
      const voice = await response.json();
      return {
        voice_id: voice.voice_id,
        name: voice.name || 'Neural voice',
        labels: { accent: voice.labels?.accent || '' },
      };
    }));
    const voices = results.filter(Boolean);
    if (!voices.length) return res.status(502).json({ error: 'No configured ElevenLabs voices could be loaded. Check the voice IDs.' });
    return res.status(200).json({ voices });
  } catch {
    return res.status(502).json({ error: 'Could not connect to the neural voice service.' });
  }
};
