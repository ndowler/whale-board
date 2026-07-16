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
lithographs: muted gouache and fine hand-inked linework, kept quiet and
understated but rich in FINE detail that rewards close inspection. Overall
brightness, contrast and palette must match the input image — dark, muted,
ambient. The water stays a deep dark navy identical to its current color —
along every coastline add two or three engraved depth-contour lines
following the shore at slightly increasing offsets like shelving on an old
Admiralty chart; each contour is a true hairline (about one pixel wide),
dim, only one shade lighter than the water, NEVER white or bright. Open
water beyond those contours stays completely clean: no dots, no stippling,
no marks. The land masses stay a dark desaturated sage green with a subtle
aged-paper grain and gouache wash texture; just inside the shorelines add
very fine, VERY SHORT engraved hatching ticks — eyelash-length, perpendicular
to the shore, fading out within a tiny distance inland — sharp and
individually distinguishable like a copperplate engraving, never long
feathery fronds. The coastline itself is a single thin, precise hand-inked
line only slightly lighter than the land, hairline weight, never a wide or
glowing band. Everything low-contrast, dark, calm — a chart in a dim study
at night, drawn with the finest nib.

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
    // Mild sharpen recovers engraved linework the resample softens — that
    // detail is what survives on screen under deep zoom.
    .sharpen({ sigma: 0.8, m1: 0.6, m2: 0.4 })
    .webp({ quality: 86 })
    .toFile('public/art/map-chart.webp');
  console.log(`public/art/map-chart.webp ${meta.width * 2}x${meta.height * 2}`);
  process.exit(0);
}
throw new Error('rate-limited after 3 tries');
