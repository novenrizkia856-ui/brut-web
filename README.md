# BRUT Web

Landing page, app and docs for BRUT, a permissionless onchain marketplace for
renting GPU compute, built on Solana.

Providers list idle GPU capacity. Buyers post a compute job, lock payment in
escrow before any work starts, and settlement follows a release rule that is
known in advance. BRUT owns no hardware: the compute runs offchain on provider
machines, and BRUT coordinates the economic agreement around it.

> Idle GPUs. Real jobs. Paid onchain.

## Layout

| Path | What it is |
|---|---|
| `index.html` | The landing page. All copy lives here, nothing is injected at runtime. |
| `app.html` | The app: choose a provider, describe a job, fund escrow, follow it to settlement. |
| `docs.html` | Generated. Do not edit by hand, see `tools/build-docs.mjs`. |
| `css/export.css` | The reference layout, type scale and motion, carried over intact. |
| `css/brut.css` | The BRUT layer: names the palette `export.css` already uses, nothing moves. |
| `css/base.css` | Shared foundation for `app.html` and `docs.html`: the two faces, the reset, the shell. |
| `css/app.css` | The app only. |
| `css/docs.css` | The docs page only. |
| `js/scale.js` | Puts back the stage scaling the export froze at one window size. |
| `js/motion.js` | The job card folding away as the reader leaves the landing. |
| `js/live.js` | The card's running trace and count up, the live scorecard, the first build checklist. |
| `js/enter.js` | Plays the entrances the export authored but never switched on. |
| `js/core.js` | The dithered GPU, its links and the orbiting nodes, on one clock. |
| `js/dither.js` | The GPU model, a small z buffered rasteriser, Bayer dither and part outlines. Covered by `test/`. |
| `js/geometry.js` | Rotation, face normals and lighting, shared by the above. |
| `js/accordion.js` | The four proof points and their progress rails. |
| `js/nav-tone.js` | Recolours the fixed header over light and dark sections. |
| `js/token-bar.js` | The token mint line beneath the landing heading. |
| `js/quote.js` | Pure pricing and job rules, exact to the lamport. Covered by `test/`. |
| `js/codec.js` | Base58 keys, SHA-256 and lamport formatting, without a library. Covered by `test/`. |
| `js/chain.js` | Solana JSON RPC reads and Wallet Standard discovery. Never signs or sends. |
| `js/app.js` | The app: rent, provide, jobs and operator panels, previewing every action. |
| `tools/write-config.mjs` | Writes environment variables into `config/solana.js`, see `.env.example`. |
| `js/config.js` | Reads `config/solana.js`, validates keys and builds Solana Explorer links. |
| `config/solana.js` | Network, RPC, program id, token mint and treasury. Stays outside any build. |
| `content/docs/` | The documentation source, ordered by `SUMMARY.md`. |
| `assets/` | Artwork, named by a hash of its own contents. |
| `assets/fonts/` | Archivo and JetBrains Mono, Latin and Latin Extended subsets. |
| `assets/brand/` | The BRUT mark, in ink and inverse. |
| `assets/art/` | The hero chart, see `tools/make-hero-chart.py`. |
| `reference-assets/` | The original export, kept only for diffing. Not shipped. |

There is no bundler. The site is static files, served as they are.

## Design

The landing page is the supplied reference build, adapted rather than
redesigned. Spacing, type scale, colour, motion language and section order are
the reference's; the product inside them is BRUT.

The one structural change the client asked for: the reference hero is gone and
the overview section opens the page. What is left of `.brut-hero` is the fixed
chrome that lived beside the stage, collapsed to no height. The brand and
section nav keep the export's rules; token state sits beneath the landing
heading as a compact subheading.

| | Value |
|---|---|
| Canvas | `#f1f1f1` paper, `#fafafa` page, black stages for the dark sections |
| Ink | `#070707`, softening to `#201d1e` and `#a1a1a1` |
| Display type | BRUT Serif: Archivo held at 112% width, at the reference's sizes |
| Body type | BRUT Sans: Archivo at normal width |
| Figures | BRUT Mono: JetBrains Mono, for public keys, hashes and registry labels |
| Stage | Drawn at 1440 x 841 and scaled to the viewport, see `js/scale.js` |
| Card | 887 x 479, 30px radius, `inset 0 0 0 4px #000` |

The three accents were already in the export and keep their hues. What changed
is what they mean, which is the same scheme the verification model uses:

| Accent | Meaning |
|---|---|
| `#17de8e` green | Verified onchain |
| `#ab55ff` violet | Verified via attestation |
| `#ff4c4f` red | Reported, unverified |

`css/brut.css` is the only place those names live, so the app and the docs
reach for the same values instead of repeating hex codes.

### What was replaced

The reference sells a trading product, so everything that said so is gone:

- The brand mark, wordmark, favicon and share images are BRUT's.
- The hero candlestick chart is now a GPU rack occupancy chart,
  `tools/make-hero-chart.py`, in the same box and the same palette.
- The job card's candles are now a heartbeat trace: bars on a baseline, with
  the two missed beats that match the 99.4% uptime beside them.
- Every class name and custom property carrying the old brand was renamed.
- The Gilroy face the export embedded is a commercial font, all rights
  reserved. It was only the `:root` fallback, so it was dropped rather than
  shipped.
- The client asked for new type, so Bitter and DM Sans gave way to Archivo, a
  grotesque with a width axis, and JetBrains Mono. Both are under the SIL Open
  Font License. The export's family names were kept, so nothing in the export
  had to change: `BRUT Serif` now points at Archivo declared at a fixed 112%
  width, and a variable font's axis is clamped to what its face declares, so
  every display line gets the expanded cut. `BRUT Sans` is the same file at
  normal width. One family, two widths, where there used to be a serif and a
  sans.
- The export shipped `maximum-scale=1, user-scalable=no`, which blocks pinch
  zoom. That is an accessibility defect rather than a design decision, so it
  was removed.

### Motion

The export kept the markup and the stylesheet but lost the script that drove
them, so several blocks arrived frozen mid animation. They were rebuilt to the
values the reference itself was holding:

| Element | Behaviour |
|---|---|
| Landing | Headline, then its sub header, clear of the fixed chrome by a measured gap |
| Job card | Holds flat until fully seen, then folds back edge on, shrinking and blurring |
| Card contents | Bars breathe out of phase, a scan line sweeps, missed beats flash, pills float, figures count up |
| Scorecard | A light turns around the frame, a highlight walks the rows, figures tick and flash |
| First build | A light turns around the frame, the fan spins, the four rows check off in turn |
| Evidence core | A GPU package turning slowly, rendered as dithered square dots with part outlines |
| Evidence nodes | Ride one tilted ring around the core; each beat the die flashes and a pixel flies to a node |
| Scorecard rows | Enter staggered, on the delays the export already declared |
| Trace cards | Cards, dots and connectors enter in sequence, same delays |
| Boundaries cloud | Two dither layers drifting and panning against each other |

The fold holds until the whole card has been seen. On a short laptop screen
the card's figures sit below the fold, so closing it straight away would hide
them; the hold stretches to cover that and is barely there on a tall screen.
The card stays opaque for most of the fold and fades only at the end, since
fading early would hide the movement itself.

The scorecard figures are illustrative, as the section says, and stay near
their printed values: jobs only climb, uptime wanders a tenth either way inside
a fixed band, and the score follows the other two.

The core and the nodes share one clock. Every beat the die flashes and sends
a single square pixel down a hairline link, and the node it reaches picks up a
hard white outline, so the constellation reads as one system.

The core used to be a lit glass crystal with a violet glow. The client's note
was that it felt machine made, and it did: a glowing solid with a halo is the
stock picture. The page's own visual language is dither (the cloud behind the
boundaries, the dot grid on the run cards, the dotted closing), so the core now
speaks it. It is a GPU package, the thing BRUT actually rents, modelled as a
dozen boxes, rasterised with a depth buffer, reduced to one bit per pixel with
a 4 x 4 Bayer matrix and outlined where one face meets another. The dither is
fixed to the pixel grid, so as the chip turns its tones crawl through the dots
the way the cloud does. Nothing on it glows.

The scorecard, trace and first build entrances were already fully authored in
the export, keyframes and per element delays and all. What it had lost was the
script that switched them on, so the markup shipped frozen in the finished
state. `js/enter.js` adds the class each one waits for. That mattered beyond
polish for the first build panel, whose start state is opacity 0: without the
class the whole section was invisible.

`prefers-reduced-motion` places every element at its finished state and
attaches no scroll listener.

The canvases in the export were rendered by three.js. SingleFile captured
their last frame as a background image, so the dither and dot textures survive
as stills and now drift under their own CSS animation. The crystal canvas was
captured empty, so `js/core.js` draws the evidence core itself.

The browser preview often runs as a hidden document, where
`requestAnimationFrame` never fires. `js/core.js` exports `activeField()` so the
field can be stepped by hand with `frame(now)`, and `test/dither.test.mjs`
covers the picture itself: boxes closed and wound outward, the nearest surface
winning, faces turned away being dropped, the dither keeping each tone as the
right share of dots, the die heartbeat touching only the die, and the chip
staying inside its frame at every angle it turns through.

## Local development

```bash
npm run docs
python -m http.server 5250
```

There are no dependencies to install, and no library for Solana either: reads
are plain JSON RPC calls and wallets are found through the Wallet Standard.
`npm run docs` regenerates `docs.html` from `content/docs/`.

## Checks

```bash
npm run check
```

That runs all three:

- `npm run docs` regenerates the docs page, so it can never drift from the source.
- `npm run audit` fails on a dash in visible copy, on a sentence over 15 words,
  on any wording left over from the reference build, and on EVM wording
  (Ethereum, ETH, MetaMask and the like) in the copy or the docs source.
- `npm test` covers pricing, the job rules and the Solana encodings.

## Solana

BRUT runs on Solana. No BRUT program is deployed yet, and this repository
deploys none: it is the frontend only. Until a program exists the app keeps
every screen, form and check, but execution is not live.

| | Status |
|---|---|
| Wallets | Live. Phantom, Solflare, Backpack and any Wallet Standard wallet connect, disconnect and switch accounts. |
| Reads | Live. The cluster slot, and the connected wallet's SOL balance and BRUT token balance. |
| Listings and jobs | Empty. There is no program to read them from, so the app shows none. |
| Actions | Preview only. Every form validates and says what it would do, then that nothing was signed or sent. |

The app never asks a wallet to sign anything and never builds or broadcasts a
transaction. `js/chain.js` has no signing code at all, and `send` in
`js/app.js` stops at a preview while `EXECUTION_LIVE` is false. Turning
execution on takes a deployed program and a client for it, not a flag.

On a phone with no wallet extension, the wallet menu offers to open the page
inside Phantom or Solflare, whose in app browsers provide the wallet.

### Configuration

`config/solana.js` is the only file the browser reads for chain settings. Edit
it directly, or set environment variables and run:

```bash
npm run config -- .env
```

| Field | Variable | Effect |
|---|---|---|
| `network` | `SOLANA_NETWORK` | `mainnet-beta`, `devnet` or `testnet`. Explorer links carry the cluster. |
| `rpcUrl` | `SOLANA_RPC_URL` | JSON RPC for every read. It must allow browser requests. |
| `explorerUrl` | `EXPLORER_BASE_URL` | Solana Explorer root for every account link. |
| `programId` | `BRUT_PROGRAM_ID` | The BRUT program. Empty: none is deployed. |
| `tokenMint` | `BRUT_TOKEN_MINT` | The BRUT SPL token mint. Empty until the token exists. |
| `treasuryAddress` | `TREASURY_ADDRESS` | Linked from the app footer once set. |
| `tokenLaunched` | | Reveals the token mint on the landing page. |
| `gpus`, `regions` | | Labels a listing can name. A listing stores their SHA-256. Add freely, never rename. |
| `links.x` | | Enables the footer social link. Empty leaves it dimmed and inert. |

Every address is checked as a 32 byte base58 key; anything else is ignored, so
a typo leaves a link inert rather than pointing somewhere wrong. None of these
values is a secret, and no placeholder address is shipped.

The default RPC is PublicNode, which is free and allows browser requests. The
Solana Foundation endpoint, `api.mainnet-beta.solana.com`, refuses requests
from browsers, and PublicNode does not answer token balance lookups, so use a
dedicated provider for production. Reads are light: the slot, plus one or two
balance calls for a connected wallet, every 20 seconds while the tab is open.

### The token subheading

The token is separate from the program, so its state sits beneath the landing
heading. It reads "Coming soon" until `tokenLaunched` is true, whatever
`tokenMint` holds. That lets the mint be checked ahead of time, and launch
stays a one word edit. Once live it shows the mint, shortened on phones, with
a copy button and a Solana Explorer link.

## Deployment

`vercel.json` publishes the directory as it stands, with hashed assets served
immutable for a year and `config/solana.js` set to revalidate every time, so
a deployment can be pointed at a program or a mint by editing that one file. It also
sets the baseline security headers.
