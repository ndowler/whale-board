import { PLACES } from './places';

/**
 * The phone entry form served at `/`. Deliberately dependency-free inline
 * HTML: the whole flow is "saw a post in the Facebook group → 20 seconds of
 * taps → it's on the wall". The relay token and group name persist in
 * localStorage so repeat entries are species + place + submit.
 */

const SPECIES_OPTIONS = [
  'Orca',
  "Bigg's",
  'Southern Resident',
  'Humpback whale',
  'Gray whale',
  'Minke whale',
  'Fin whale',
  'Harbor porpoise',
  "Dall's porpoise",
  'Pacific white-sided dolphin',
  'Other (specify in comments)',
];

const MINUTES_AGO = [
  [0, 'Just now'],
  [15, '15 minutes ago'],
  [30, '30 minutes ago'],
  [60, '1 hour ago'],
  [120, '2 hours ago'],
  [240, '4 hours ago'],
] as const;

export const FORM_HTML = /* html */ `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex" />
<title>Whale Board — relay a report</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body {
    margin: 0; padding: 1.25rem 1rem 3rem;
    background: #0b1d26; color: #dfe9ec;
    font: 16px/1.45 system-ui, -apple-system, sans-serif;
    max-width: 30rem; margin-inline: auto;
  }
  h1 { font-size: 1.15rem; margin: 0 0 0.2rem; }
  p.sub { margin: 0 0 1.2rem; color: #8fa8b0; font-size: 0.85rem; }
  label { display: block; margin: 0.9rem 0 0.25rem; font-size: 0.8rem;
          text-transform: uppercase; letter-spacing: 0.06em; color: #9fb6bd; }
  select, input, textarea, button {
    width: 100%; padding: 0.6rem 0.7rem; font: inherit;
    background: #122b36; color: inherit;
    border: 1px solid #274653; border-radius: 8px;
  }
  textarea { min-height: 4.5rem; resize: vertical; }
  .hidden { display: none; }
  button {
    margin-top: 1.3rem; background: #1c5d74; border-color: #2b7a95;
    font-weight: 600; cursor: pointer;
  }
  button:disabled { opacity: 0.5; }
  #msg { margin-top: 1rem; font-size: 0.95rem; min-height: 1.4em; }
  #msg.ok { color: #7fd8a2; }
  #msg.err { color: #f0918d; }
  details { margin-top: 1.4rem; color: #8fa8b0; font-size: 0.85rem; }
  details input { margin-top: 0.4rem; }
</style>
</head>
<body>
<h1>🐋 Relay a Facebook report</h1>
<p class="sub">Saw a sighting posted in a Facebook group? Put it on the board.</p>

<form id="f">
  <label for="species">Species</label>
  <select id="species">${SPECIES_OPTIONS.map((s) => `<option>${s}</option>`).join('')}</select>

  <label for="place">Where</label>
  <select id="place">
    ${PLACES.map((p) => `<option value="${p.lat},${p.lng}">${p.name}</option>`).join('')}
    <option value="">Exact coordinates…</option>
  </select>
  <input id="coords" class="hidden" inputmode="decimal"
         placeholder="47.912, -122.520 (paste from a map app)" />

  <label for="when">When was it seen</label>
  <select id="when">
    ${MINUTES_AGO.map(([m, t]) => `<option value="${m}">${t}</option>`).join('')}
    <option value="">Pick a time…</option>
  </select>
  <input id="whenExact" class="hidden" type="datetime-local" />

  <label for="count">How many (optional)</label>
  <input id="count" type="number" min="1" max="500" inputmode="numeric" placeholder="e.g. 4" />

  <label for="comment">Notes (optional)</label>
  <textarea id="comment" maxlength="500"
            placeholder="Summarize the post: direction of travel, pod IDs, behavior…"></textarea>

  <label for="group">Facebook group</label>
  <input id="group" maxlength="80" placeholder="e.g. Orca Network" required />

  <details>
    <summary>Relay token</summary>
    <input id="token" type="password" autocomplete="off" placeholder="shared secret" />
  </details>

  <button id="go" type="submit">Put it on the board</button>
  <p id="msg" role="status"></p>
</form>

<script>
  var $ = function (id) { return document.getElementById(id); };
  try {
    $('token').value = localStorage.getItem('fbrelay.token') || '';
    $('group').value = localStorage.getItem('fbrelay.group') || '';
  } catch (e) {}

  $('place').addEventListener('change', function () {
    $('coords').classList.toggle('hidden', this.value !== '');
  });
  $('when').addEventListener('change', function () {
    $('whenExact').classList.toggle('hidden', this.value !== '');
  });

  $('f').addEventListener('submit', async function (ev) {
    ev.preventDefault();
    var msg = $('msg');
    msg.className = ''; msg.textContent = '';

    var lat, lng;
    if ($('place').value !== '') {
      var parts = $('place').value.split(',');
      lat = Number(parts[0]); lng = Number(parts[1]);
    } else {
      var m = $('coords').value.trim().match(/^(-?[0-9.]+)[,\\s]+(-?[0-9.]+)$/);
      if (!m) { msg.className = 'err'; msg.textContent = 'Coordinates should look like "47.912, -122.520".'; return; }
      lat = Number(m[1]); lng = Number(m[2]);
    }

    var observedAtMs;
    if ($('when').value !== '') {
      observedAtMs = Date.now() - Number($('when').value) * 60000;
    } else {
      var t = new Date($('whenExact').value).getTime();
      if (!isFinite(t)) { msg.className = 'err'; msg.textContent = 'Pick a valid time.'; return; }
      observedAtMs = t;
    }

    var body = {
      species: $('species').value,
      lat: lat, lng: lng,
      observedAtMs: observedAtMs,
      group: $('group').value.trim(),
      comment: $('comment').value.trim(),
    };
    var count = Number($('count').value);
    if ($('count').value !== '' && isFinite(count)) body.count = count;

    try {
      localStorage.setItem('fbrelay.token', $('token').value);
      localStorage.setItem('fbrelay.group', body.group);
    } catch (e) {}

    $('go').disabled = true;
    try {
      var res = await fetch('/reports', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: 'Bearer ' + $('token').value,
        },
        body: JSON.stringify(body),
      });
      if (res.status === 401) { msg.className = 'err'; msg.textContent = 'Wrong relay token.'; }
      else if (!res.ok) {
        var err = 'Rejected (' + res.status + ').';
        try { err = (await res.json()).error || err; } catch (e) {}
        msg.className = 'err'; msg.textContent = err;
      } else {
        msg.className = 'ok'; msg.textContent = 'On the board — thanks! 🐋';
        $('comment').value = ''; $('count').value = '';
      }
    } catch (e) {
      msg.className = 'err'; msg.textContent = 'Network error — try again.';
    } finally {
      $('go').disabled = false;
    }
  });
</script>
</body>
</html>`;
