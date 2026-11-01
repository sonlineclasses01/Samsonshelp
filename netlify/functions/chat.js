// Samson's Help · Created by Samson Ekutu · Original work
// This file runs on Netlify's server. Your Gemini key stays here and is never sent to visitors.

const MODEL = 'gemini-3.5-flash-lite'; // change if AI Studio shows a different free model

const BASE_PERSONA = "You are Samson's Help, a warm, smart and practical assistant for everyone: students, workers, parents and curious people. Be clear, honest and friendly. Use simple language and short paragraphs. You may use markdown: bold, bullet lists, numbered lists and code blocks. If you are not sure about something, say so. If an image is shared, describe what you see and help with it.";
const STUDY_PERSONA = " STUDY MODE: you are also a patient teacher. Explain step by step, give a simple example, and end with one short question to check understanding.";

const json = (statusCode, body) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body)
});

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Use POST.' });

  const key = process.env.GEMINI_API_KEY;
  if (!key) return json(500, { error: 'The server key is not set up yet.' });

  let payload;
  try { payload = JSON.parse(event.body || '{}'); }
  catch (e) { return json(400, { error: 'Bad request.' }); }

  const contents = Array.isArray(payload.contents) ? payload.contents.slice(-30) : [];
  if (!contents.length) return json(400, { error: 'No message received.' });

  // Build the instructions on the server so visitors cannot change the persona.
  let system = BASE_PERSONA + (payload.mode === 'Study' ? STUDY_PERSONA : '');
  const memory = Array.isArray(payload.memory)
    ? payload.memory.slice(0, 20).map(n => String(n).slice(0, 200))
    : [];
  if (memory.length) {
    system += ' Things you know about this user (use them naturally, do not list them back): ' + memory.join('; ') + '.';
  }

  try {
    const url = 'https://generativelanguage.googleapis.com/v1beta/models/' + MODEL + ':generateContent?key=' + encodeURIComponent(key);
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ systemInstruction: { parts: [{ text: system }] }, contents })
    });

    if (res.status === 429) return json(429, { error: 'limit' });

    const data = await res.json();
    if (data.error) return json(502, { error: data.error.message || 'The AI returned an error.' });

    const parts = data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts;
    const reply = parts ? parts.map(p => p.text || '').join('') : '';
    return json(200, { reply });
  } catch (err) {
    return json(500, { error: 'Something went wrong on the server.' });
  }
};
