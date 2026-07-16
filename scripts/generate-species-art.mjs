/**
 * Generate the M4 AI-restyled species illustration set via Gemini
 * (Nano Banana 2), one cohesive visual language across all 13 assets.
 *
 * Usage:  GOOGLE_AI_API_KEY=... node scripts/generate-species-art.mjs [--only id,id]
 * Output: art/species/raw/<id>.png   (2K, 16:9, flat #0A1622 background)
 *
 * Post-process to board-ready transparent PNGs with ImageMagick:
 *   node scripts/generate-species-art.mjs --post
 * writes art/species/<id>.png (background keyed out; any residual edge
 * fringe matches the board's water color so it disappears on the map).
 *
 * Collage set (square 1:1 plates for the seen-today board):
 *   node scripts/generate-species-art.mjs --collage          # generate raws
 *   node scripts/generate-species-art.mjs --collage --post   # → public/art/collage/<id>.webp
 * The navy field is NOT keyed out — it is the card background, so plates
 * blend seamlessly into the board.
 *
 * Decor (map furniture — compass rose):
 *   node scripts/generate-species-art.mjs --decor            # generate raw
 *   node scripts/generate-species-art.mjs --decor --post     # → public/art/decor/compass.png
 */
import { mkdirSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { execSync } from 'node:child_process';

const MODEL = 'gemini-3.1-flash-image-preview';
const KEY = process.env.GOOGLE_AI_API_KEY;
const RAW_DIR = 'art/species/raw';
const OUT_DIR = 'art/species';
const COLLAGE_RAW_DIR = 'art/species/collage-raw';
const COLLAGE_OUT_DIR = 'public/art/collage';
const DECOR_RAW_DIR = 'art/decor/raw';
const DECOR_OUT_DIR = 'public/art/decor';

/**
 * One shared style block — every asset is rendered in the same visual
 * language so the set reads as a single hand. Dark flat background is the
 * board's water color; it gets keyed out in post.
 */
const STYLE = `Rendered as a vintage natural-history plate illustration in
muted gouache and hand-inked linework: soft cream, slate-blue and warm sand
tones with delicate crosshatch shading, in the manner of a 19th-century
cetacean lithograph from a scientific expedition folio. The animal is shown
in complete side profile facing LEFT, full body visible nose to tail flukes,
centered, filling most of the frame. The background is a single completely
flat, uniform very dark navy (#0A1622) with absolutely nothing else in it —
no water, no waves, no bubbles, no plants, no border, no frame. NEVER include
any text, labels, numbers, or watermarks.`;

/**
 * Collage variant: same hand, composed for a large square card. The animal
 * sits smaller in the frame with breathing room, and — unlike the marker
 * plates — a whisper of environment is allowed. The navy field stays: it is
 * the card background on the seen-today board.
 */
const COLLAGE_STYLE = `Rendered as a vintage natural-history plate
illustration in muted gouache and hand-inked linework: soft cream,
slate-blue and warm sand tones with delicate crosshatch shading, in the
manner of a 19th-century cetacean lithograph from a scientific expedition
folio. The animal is shown in complete side profile facing LEFT, full body
visible nose to tail flukes, centered in a SQUARE composition, occupying
about two thirds of the frame width with generous breathing room around it.
Beneath the animal, a few faint hand-inked horizontal ripple lines in dim
slate-blue suggest a waterline. A thin, elegant double-rule plate border in
muted warm sand ink runs just inside the edges of the image, vintage
scientific-plate style. The background is otherwise a single completely
flat, uniform very dark navy (#0A1622) — no waves, no bubbles, no plants,
no clouds. NEVER include any text, labels, numbers, or watermarks.`;

const DECOR = [
  ['compass', `An elegant eight-point compass rose drawn in fine hand-inked
linework, in muted warm sand and slate-blue ink with delicate crosshatch
shading, in the manner of a 19th-century nautical chart ornament. Ornate but
restrained, perfectly centered, with a slender needle and small decorative
fleur-de-lis at north. The background is a single completely flat, uniform
very dark navy (#0A1622) with absolutely nothing else in it. NEVER include
any text, letters, labels, numbers, or watermarks.`],
];

const SPECIES = [
  ['orca_srkw', `An adult female Southern Resident killer whale (Orcinus orca), glossy black body with crisp white eye patch, white chin and belly, and a subtle grey saddle patch behind a tall gently curved falcate dorsal fin with a rounded tip`],
  ['orca_biggs', `An adult male Bigg's transient killer whale (Orcinus orca), glossy black body with a narrow slanted white eye patch, closed grey saddle patch, and a very tall straight triangular dorsal fin with a pointed tip`],
  ['orca', `An adult killer whale (Orcinus orca), glossy black body with white eye patch, white belly and grey saddle patch, prominent falcate dorsal fin`],
  ['humpback', `An adult humpback whale (Megaptera novaeangliae) swimming perfectly level and horizontal in strict flat side profile, dark slate body with knobbly tubercles on the head, one long white-edged pectoral fin held flat along the body, small stubby dorsal fin on a raised hump, broad serrated tail flukes trailing horizontally behind — the whole animal level like a specimen drawing, MUST be a straight horizontal side view`],
  ['gray_whale', `An adult gray whale (Eschrichtius robustus), mottled grey body dappled with pale barnacle patches, no dorsal fin, a low hump followed by a row of small knuckles along the tail stock, downturned arched mouth`],
  ['blue_whale', `An adult blue whale (Balaenoptera musculus), very long streamlined pale blue-grey body with lighter mottling, broad flat U-shaped head, tiny stubby dorsal fin set far back near the tail`],
  ['fin_whale', `An adult fin whale (Balaenoptera physalus), long sleek dark grey body with a paler right jaw and subtle pale chevron behind the head, prominent falcate dorsal fin set two-thirds of the way back`],
  ['minke', `An adult minke whale (Balaenoptera acutorostrata), compact dark grey body with a sharply pointed rostrum, a distinctive white band across each pectoral fin, and a tall falcate dorsal fin at mid-back`],
  ['harbor_porpoise', `An adult harbor porpoise (Phocoena phocoena), small rotund dark grey body with lighter grey flanks, blunt rounded head with no beak, and a small low triangular dorsal fin`],
  ['dalls_porpoise', `An adult Dall's porpoise (Phocoenoides dalli), a very stocky thick-bodied little porpoise with a tiny head and no beak, jet-black body with a single bold white belly-and-flank patch, and a VERY SMALL low triangle-shaped dorsal fin frosted white at its tip — the dorsal fin MUST be tiny and triangular, nothing like an orca's tall fin, and the body MUST look compact and chunky, one third the length of an orca`],
  ['pacific_white_sided_dolphin', `An adult Pacific white-sided dolphin (Lagenorhynchus obliquidens), sleek dark grey back with pale grey "suspender" stripes sweeping along the flanks, cream belly, and a tall strongly hooked bicolor dorsal fin`],
  ['unspecified', `A serene stylized whale seen mostly submerged: a smooth dark whale back and gentle dorsal fin breaking a calm waterline, with the faint suggestion of the body below rendered in soft slate silhouette — species deliberately indistinct, dignified and calm`],
  ['unknown_cetacean', `A graceful generic whale rendered as a soft slate-grey silhouette swimming level in side profile, smooth simplified body with gentle edges fading toward the tail, deliberately anonymous with no identifiable species features. The dark navy background MUST run flat and unbroken all the way to every edge of the image — absolutely NO border, NO frame, NO plate edge, NO margin of any other color`],
];

const args = process.argv.slice(2);
const post = args.includes('--post');
const collage = args.includes('--collage');
const decor = args.includes('--decor');
const onlyArg = args.find((a) => a.startsWith('--only'));
const only = onlyArg ? args[args.indexOf(onlyArg) + 1]?.split(',') : null;

if (post) {
  if (collage) {
    // Collage plates keep their navy field (it IS the card background);
    // downsample to a kiosk-friendly square webp. Uses sharp (devDependency).
    const sharp = (await import('sharp')).default;
    mkdirSync(COLLAGE_OUT_DIR, { recursive: true });
    for (const f of readdirSync(COLLAGE_RAW_DIR).filter((f) => f.endsWith('.png'))) {
      const out = f.replace(/\.png$/, '.webp');
      await sharp(`${COLLAGE_RAW_DIR}/${f}`)
        .resize(1024, 1024, { fit: 'inside' })
        .webp({ quality: 82 })
        .toFile(`${COLLAGE_OUT_DIR}/${out}`);
      console.log(`webp ${COLLAGE_OUT_DIR}/${out}`);
    }
  } else if (decor) {
    // Decor is keyed transparent like the marker plates (floats on the map).
    // sharp has no fuzz-key, so alpha is computed per pixel from the
    // distance to the navy field (#0A1622), mirroring magick's -fuzz 12%.
    const sharp = (await import('sharp')).default;
    mkdirSync(DECOR_OUT_DIR, { recursive: true });
    const [KR, KG, KB] = [0x0a, 0x16, 0x22];
    const FUZZ = 0.12 * 255 * Math.sqrt(3); // magick fuzz is % of max distance
    for (const f of readdirSync(DECOR_RAW_DIR).filter((f) => f.endsWith('.png'))) {
      const { data, info } = await sharp(`${DECOR_RAW_DIR}/${f}`)
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      for (let i = 0; i < data.length; i += 4) {
        const dist = Math.hypot(data[i] - KR, data[i + 1] - KG, data[i + 2] - KB);
        if (dist <= FUZZ) data[i + 3] = 0;
      }
      await sharp(data, {
        raw: { width: info.width, height: info.height, channels: 4 },
      })
        .trim()
        .resize(512, 512, { fit: 'inside' })
        .png()
        .toFile(`${DECOR_OUT_DIR}/${f}`);
      console.log(`keyed ${DECOR_OUT_DIR}/${f}`);
    }
  } else {
    // Key out the flat navy background; keep edges soft. Requires ImageMagick 7.
    mkdirSync(OUT_DIR, { recursive: true });
    for (const f of readdirSync(RAW_DIR).filter((f) => f.endsWith('.png'))) {
      execSync(
        `magick "${RAW_DIR}/${f}" -fuzz 12% -transparent "#0A1622" -trim +repage "${OUT_DIR}/${f}"`,
        { stdio: 'inherit' },
      );
      console.log(`keyed ${OUT_DIR}/${f}`);
    }
  }
  process.exit(0);
}

if (!KEY) {
  console.error('GOOGLE_AI_API_KEY not set');
  process.exit(1);
}

// Mode selects the subject list, style block, output dir, and aspect.
const mode = collage
  ? { rawDir: COLLAGE_RAW_DIR, style: COLLAGE_STYLE, aspect: '1:1', list: SPECIES }
  : decor
    ? { rawDir: DECOR_RAW_DIR, style: '', aspect: '1:1', list: DECOR }
    : { rawDir: RAW_DIR, style: STYLE, aspect: '16:9', list: SPECIES };

mkdirSync(mode.rawDir, { recursive: true });

const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

async function generate(id, subject) {
  const body = {
    contents: [
      { parts: [{ text: mode.style ? `${subject}. ${mode.style}` : subject }] },
    ],
    generationConfig: {
      responseModalities: ['IMAGE'],
      imageConfig: { aspectRatio: mode.aspect, imageSize: '2K' },
    },
  };
  for (let tryN = 1; tryN <= 3; tryN++) {
    const res = await fetch(`${url}?key=${KEY}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (res.status === 429) {
      console.log(`  429 — backing off ${tryN * 20}s`);
      await new Promise((r) => setTimeout(r, tryN * 20_000));
      continue;
    }
    if (!res.ok) throw new Error(`${id}: HTTP ${res.status} ${await res.text()}`);
    const json = await res.json();
    const cand = json.candidates?.[0];
    if (cand?.finishReason && cand.finishReason !== 'STOP')
      throw new Error(`${id}: finishReason ${cand.finishReason}`);
    const part = cand?.content?.parts?.find((p) => p.inlineData);
    if (!part) throw new Error(`${id}: no image in response`);
    writeFileSync(
      `${mode.rawDir}/${id}.png`,
      Buffer.from(part.inlineData.data, 'base64'),
    );
    return;
  }
  throw new Error(`${id}: rate-limited after 3 tries`);
}

for (const [id, subject] of mode.list) {
  if (only && !only.includes(id)) continue;
  if (!only && existsSync(`${mode.rawDir}/${id}.png`)) {
    console.log(`skip ${id} (exists)`);
    continue;
  }
  console.log(`generating ${id}…`);
  await generate(id, subject);
  console.log(`  saved ${mode.rawDir}/${id}.png`);
  // free-tier RPM headroom
  await new Promise((r) => setTimeout(r, 8_000));
}
console.log('done');
