'use strict';

const { getAllowedVoiceIds, configError, providerFetch, rateLimit } = require('../lib/elevenlabs');

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed.' });
  }
  // Best-effort per-instance protection. Add persistent edge/serverless rate limiting before public launch.
  if (!rateLimit(req, 'tts', 20)) return res.status(429).json({ error: 'Too many voice requests. Please wait a minute and try again.' });

  const setupProblem = configError();
  if (setupProblem) return res.status(503).json({ error: 'Neural voice is not configured yet.' });

  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const text = typeof body.text === 'string' ? body.text.trim() : '';
  const voiceId = typeof body.voiceId === 'string' ? body.voiceId.trim() : '';
  const speed = Number(body.speed);
  if (!text || text.length > 1500) return res.status(400).json({ error: 'A dialogue cue of 1–1,500 characters is required.' });
  if (!getAllowedVoiceIds().includes(voiceId)) return res.status(403).json({ error: 'That voice is not enabled for this site.' });
  if (!Number.isFinite(speed) || speed < 0.7 || speed > 1.2) return res.status(400).json({ error: 'Speaking speed must be between 0.7× and 1.2×.' });

  try {
    const response = await providerFetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
        body: JSON.stringify({
          text,
          model_id: process.env.ELEVENLABS_MODEL_ID || 'eleven_multilingual_v2',
          voice_settings: {
            stability: 0.42,
            similarity_boost: 0.78,
            style: 0.22,
            use_speaker_boost: true,
            speed,
          },
        }),
        signal: AbortSignal.timeout(45_000),
      },
    );
    if (!response.ok) {
      // Keep provider details and credentials out of the browser response.
      const status = response.status === 429 ? 429 : 502;
      return res.status(status).json({ error: response.status === 429
        ? 'The voice service is rate-limited. Wait a moment and try again.'
        : 'The voice service could not generate this cue. Check the voice setup and try again.' });
    }
    const audio = Buffer.from(await response.arrayBuffer());
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Length', String(audio.length));
    res.setHeader('Content-Disposition', 'inline; filename="partner-cue.mp3"');
    return res.status(200).end(audio);
  } catch {
    return res.status(502).json({ error: 'Could not reach the neural voice service. Try again.' });
  }
};
