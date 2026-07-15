# Hanging the Whale Board on the Wall

A parts guide for turning the board into an always-on "picture frame."
Every build is the same four layers — display, compute, frame, power — plus
optional niceties. Pick one option from each table; three proven combos are
at the bottom.

The app is already kiosk-hardened (fullscreen chrome-free mode, wake lock,
network-blip recovery, daily 4 am self-reload, dark low-burn-in palette), so
the hardware's only job is to show a browser and stay on.

---

## 1. Display

The board is landscape by default (map + right-hand rail); below ~820 px wide
it flips to a bottom-strip rail, which also works nicely in portrait. Matte
finishes matter more than resolution on a wall — glossy panels mirror your
windows all day.

| Option | ~Cost | Pros | Cons |
| --- | --- | --- | --- |
| **A. Recycled laptop panel + controller board** (13–17" IPS panel from eBay/parts laptop + matching eDP/LVDS driver board from Amazon/AliExpress — search the panel's model number) | $40–80 | Thinnest possible build (panel is ~3 mm); matte 1080p IPS panels are plentiful; the classic "magic mirror" approach | Requires matching the controller to the exact panel model; bare panel needs careful mounting |
| **B. Slim desktop monitor, 21–27" IPS** (e.g. any thin-bezel 1080p office monitor; used ones are ~$50) | $50–150 | Zero fiddling: HDMI in, done; VESA holes simplify mounting; big enough to read the rail from across the room | Thickest option (~35–50 mm even slim ones); power brick to hide |
| **C. Large tablet as all-in-one** (Fire HD 10 on sale, used iPad, Samsung Tab A9+) | $75–200 | Display *and* compute in one 7 mm slab; touch works with the popovers; built-in light sensor auto-dims | Smaller (10–11"); Fire OS/old iPadOS kiosk setup is clunkier; battery swelling is a real long-term concern — power-manage it (see §5) |
| **D. Portrait-mode signage/gallery look: 24" monitor rotated 90°** | $50–150 | Puget Sound is a portrait-shaped region; the bottom-rail layout suits it; striking "art piece" orientation | Vertical viewing angle of cheap TN panels is bad rotated — use IPS only |
| **E. Not recommended: e-ink** | — | Gorgeous for static art | The board is animated (arrivals, decay, reconnect states) and dark-themed; e-ink refresh and grayscale kill exactly what makes it alive |

**Panel checklist:** IPS (viewing angles), matte if possible, brightness that
goes *low* (wall displays at night want ≤80 nits; the app's palette already
avoids pure white).

## 2. Compute

Anything that runs a modern Chromium fullscreen. The app is a ~100 KB static
bundle — the hardware floor is very low.

| Option | ~Cost | Pros | Cons |
| --- | --- | --- | --- |
| **A. Raspberry Pi 5 (2–4 GB) or Pi 4** — the default | $45–70 | First-class kiosk story (`chromium --kiosk`); tiny; silent; GPIO for sensors later (Tier 2 ready); can also *serve* the app locally | Needs microSD + PSU; add a small heatsink case |
| **B. Raspberry Pi Zero 2 W** | $15 | Cheapest, invisible behind even a bare panel | Chromium at 1080p is at its limit — fine for this app's light DOM, but no headroom |
| **C. Used thin client / mini PC** (Dell Wyse 5070, HP t630, Lenovo Tiny — offices dump these on eBay) | $25–60 | x86 Chromium is effortless; often includes PSU; very reliable 24/7 | Bulkier than a Pi; slight fan noise on some models |
| **D. The tablet from display option C** | $0 extra | One device, one cable; its browser + "keep awake" developer setting is the whole stack | OS-level kiosk lockdown is the fiddly part (Fire Toolbox / Guided Access / Fully Kiosk Browser app) |
| **E. Android TV stick** (Chromecast with Google TV, onn. stick) + Fully Kiosk Browser | $20–40 | Hides behind any HDMI display; remote-controllable | Android TV browsers need sideloading; least clean of the options |

**Hosting note:** build once (`npm run build`) and either point the kiosk at a
static host (GitHub Pages / Netlify / Cloudflare Pages — free) or serve
`dist/` straight off the Pi (`python3 -m http.server` or nginx) so the frame
has zero external dependencies besides the Acartia API itself.

## 3. Frame & enclosure

| Option | ~Cost | Pros | Cons |
| --- | --- | --- | --- |
| **A. IKEA shadow-box frame mod** (RIBBA/SANNAHED deep frames) | $10–25 | The canonical magic-mirror trick: panel sits behind the mat opening, electronics in the box depth; looks like real framed art | Cutting the mat/backing to your panel's exact visible area takes patience |
| **B. Custom wood frame** (hardwood stock + rabbet cut to your stack depth) | $30–80 + tools | Made-to-measure depth for monitor builds; stain to match the room; most "gallery" result | Woodworking required |
| **C. 3D-printed bezel + French cleat** | $10 filament | Precise fit around a bare laptop panel; integrates cable channels and sensor holes; print in matte black | Print bed usually smaller than the frame — design it in sections |
| **D. Buy-it-done: VESA "picture frame" enclosures / poster frames for monitors** | $60–150 | No fabrication at all | Limited sizes; often plasticky up close |
| **E. Tablet-specific wall mounts** (flush magnetic mounts, e.g. Vidabox-style) | $20–60 | Purpose-built, removable for updates; some hide the cable in the mount | Tablet bezels still read as "tablet" unless you add a mat |

## 4. Power (the part that makes or breaks the illusion)

A dangling cord ruins it. In rough order of cleanliness:

| Option | ~Cost | Pros | Cons |
| --- | --- | --- | --- |
| **A. Recessed in-wall outlet behind the frame** (code-compliant relocation kits: Legrand/DataComm in-wall power kits) | $40–60 | Invisible; the *right* answer for a permanent piece | Requires cutting drywall and fishing cable between studs (kits are designed for DIY, no junction box wiring) |
| **B. Flat paintable cord raceway** down the wall | $10–15 | Renter-friendly; 10 minutes | Visible up close no matter how well you paint it |
| **C. PoE from your switch** + PoE splitter (USB-C PD splitter for Pi 5 / 12 V splitter for a panel controller board) | $15–30 + PoE port | One thin Ethernet run powers *and* networks it; great through-wall/attic option | Budget for the wattage: panel + Pi ≈ 15–25 W → use PoE+ (802.3at) |
| **D. USB-C PD power bank rotation** (tablet builds only) | $30 | Zero wall changes at all | You are now a person who swaps a battery weekly; swelling risk if you leave it charging instead |

## 5. Worth-it extras

| Extra | ~Cost | Why |
| --- | --- | --- |
| **Presence sensor** — PIR (HC-SR501, $3) or better, mmWave (LD2410, $8) on Pi GPIO | $3–10 | Screen off when the room is empty, instant-on when someone walks in; mmWave detects still humans, PIR doesn't |
| **Ambient light sensor** (TSL2591/BH1750 on I²C, or rely on a tablet's built-in) | $5 | Auto-dim at night — the difference between "ambient" and "glowing rectangle in a dark room" |
| **Smart plug schedule** | $10 | Zero-code alternative to both of the above: display sleeps midnight–6 am; the app reconnects on its own when power returns |
| **Small USB/I²S speaker** | $8–15 | The arrival chime is muted by default, but a whisper-quiet two-note chime when orcas show up is half the charm |
| **Temperature check** | free | Sealed frames cook electronics: leave vent slots top and bottom of the enclosure; a Pi at 60–70 °C throttles but survives — a swollen tablet battery doesn't |

---

## Three proven combos

### 🐋 "Weekend" — tablet build, ~$100
Fire HD 10 (on sale) + Fully Kiosk Browser pointed at the hosted board +
IKEA frame with a cut mat + flat cord raceway. One device, one afternoon.
Set charge limit / schedule charging via smart plug to protect the battery.

### 🐋🐋 "The right way" — Pi + recycled panel, ~$150
15.6" matte 1080p laptop panel + eDP controller ($60) + Raspberry Pi 5
($55) + RIBBA shadow-box mod + recessed in-wall outlet kit ($45). Pi
autostarts `chromium-browser --kiosk http://localhost/` serving `dist/`
locally; mmWave sensor turns the panel off when nobody's home. Thin,
silent, serviceable, and Tier-2-ready (the Pi has GPIO waiting for the
hydrophone era).

### 🐋🐋🐋 "Gallery piece" — big portrait IPS, ~$300
27" IPS monitor rotated portrait + used thin client velcroed to the VESA
mount + custom hardwood frame + PoE+ run through the wall + light sensor
auto-dim. Reads as a living nautical chart of the Sound from across the
room.

---

## Kiosk software crib sheet (Pi)

```sh
# /home/pi/kiosk.sh — run from autostart / systemd user service
chromium-browser --kiosk --noerrdialogs --disable-session-crashed-bubble \
  --disable-features=TranslateUI --check-for-update-interval=604800 \
  "http://localhost:8080/"
```

- Serve the app locally: `npx serve dist -l 8080` (or nginx).
- Hide the mouse cursor at the OS level too: `unclutter -idle 1` (the app
  already hides it in kiosk mode, but belt-and-suspenders).
- Disable screen blanking: `raspi-config` → Display → Screen Blanking → off
  (the app's wake lock covers the browser layer, not the console).
- The app reloads itself daily at 4 am; add a weekly full reboot if you like:
  `0 5 * * 1 sudo reboot` in `crontab -e`.
