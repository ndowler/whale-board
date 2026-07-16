/**
 * Send art/map/base.png to Gemini image editing and get back the same
 * geography restyled as a vintage nautical chart matching the species
 * plates. Output resampled to the exact base dimensions so the app's
 * geo-anchoring stays pixel-true.
 *
 * Usage: GOOGLE_AI_API_KEY=... node scripts/restyle-chart.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const sharp = require(process.env.SHARP_DIR ?? 'sharp');

const MODEL = 'gemini-3.1-flash-image-preview';
const KEY = process.env.GOOGLE_AI_API_KEY;
if (!KEY) {
  console.error('GOOGLE_AI_API_KEY not set');
  process.exit(1);
}

const PROMPT = `Restyle this map of Puget Sound as a 19th-century hand-drawn
nautical chart, in the same visual language as vintage natural-history
lithographs: muted gouache and fine hand-inked linework, kept VERY quiet and
understated. The water stays a deep dark navy almost identical to its
current color — add only an extremely faint, sparse engraved depth-contour
line or two hugging the coastlines, barely lighter than the water, and
nothing at all in open water: no dots, no stippling, no marks. The land
masses become a dark desaturated sage green with a whisper of aged-paper
grain and very fine, short engraved hatching just inside the shorelines;
the coastline itself is a thin, subdued hand-inked line only slightly
lighter than the land. Everything low-contrast, dark, calm and ambient — a
chart barely visible in a dim study at night.

CRITICAL: preserve the exact shapes, positions, sizes and scale of every
landmass, island and waterway from the input image pixel-for-pixel — do NOT
move, add, remove, straighten or reshape any coastline. The image MUST run
edge to edge with NO border, NO frame, NO margin. NEVER include any text,
letters, digits, numerals, soundings, labels, place names, compass rose,
scale bar, or watermarks — the water must contain NO symbols of any kind.`;

const base = readFileSync('art/map/base.png');
const meta = await sharp(base).metadata();

const body = {
  contents: [
    {
      parts: [
        { text: PROMPT },
        { inlineData: { mimeType: 'image/png', data: base.toString('base64') } },
      ],
    },
  ],
  generationConfig: {
    responseModalities: ['IMAGE'],
    imageConfig: { imageSize: '4K' },
  },
};

const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
for (let tryN = 1; tryN <= 3; tryN++) {
  const res = await fetch(`${url}?key=${KEY}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (res.status === 429) {
    console.log(`429 — backing off ${tryN * 20}s`);
    await new Promise((r) => setTimeout(r, tryN * 20_000));
    continue;
  }
  if (!res.ok) throw new Error(`HTTP ${res.status} ${(await res.text()).slice(0, 400)}`);
  const json = await res.json();
  const cand = json.candidates?.[0];
  if (cand?.finishReason && cand.finishReason !== 'STOP')
    throw new Error(`finishReason ${cand.finishReason}`);
  const part = cand?.content?.parts?.find((p) => p.inlineData);
  if (!part) throw new Error('no image in response');
  const raw = Buffer.from(part.inlineData.data, 'base64');
  writeFileSync('art/map/raw-chart.png', raw);
  // Force back to exactly 2× base dimensions (same aspect, sharper under
  // zoom) — geo anchoring only needs the aspect to match the base frame.
  await sharp(raw)
    .resize(meta.width * 2, meta.height * 2, { fit: 'fill' })
    .webp({ quality: 82 })
    .toFile('public/art/map-chart.webp');
  console.log(`public/art/map-chart.webp ${meta.width * 2}x${meta.height * 2}`);
  process.exit(0);
}
throw new Error('rate-limited after 3 tries');
