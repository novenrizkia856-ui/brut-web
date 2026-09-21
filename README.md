# BRUT Web

Landing page, app and docs for BRUT, a permissionless onchain marketplace for
renting GPU compute.

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
| `js/contract-bar.js` | The token address bar at the top of the landing page. |
| `js/quote.js` | Pure pricing and sending rules, exact to the wei. Covered by `test/`. |
| `js/chain.js` | ABIs, reads over the public RPC, wallet discovery, chain switching, error messages. |
| `js/app.js` | The app: rent, provide, jobs and operator panels over the live contracts. |
| `vendor/` | ethers 6.17.0 and WalletConnect ethereum provider 2.25.0 (bundled with its QR modal, licences at the end of the file), self hosted. WalletConnect loads only when picked. |
| `tools/sync-contracts.mjs` | Copies a deployment's addresses into `config/contracts.js`. |
| `js/config.js` | Reads `config/contracts.js` and answers "is this configured?". |
| `config/contracts.js` | The only file to edit after a deployment. Stays outside any build. |
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
chrome that lived beside the stage rather than inside it, collapsed to no
height, so the brand, the section nav and the contract bar keep the rules the
export wrote for them.

| | Value |
|---|---|
| Canvas | `#f1f1f1` paper, `#fafafa` page, black stages for the dark sections |
| Ink | `#070707`, softening to `#201d1e` and `#a1a1a1` |
| Display type | BRUT Serif: Archivo held at 112% width, at the reference's sizes |
| Body type | BRUT Sans: Archivo at normal width |
| Figures | BRUT Mono: JetBrains Mono, for addresses, hashes and registry labels |
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

There are no dependencies to install. `npm run docs` regenerates `docs.html`
from `content/docs/`.

## Checks

```bash
npm run check
```

That runs all three:

- `npm run docs` regenerates the docs page, so it can never drift from the source.
- `npm run audit` fails on a dash in visible copy, on a sentence over 15 words,
  and on any wording left over from the reference build.
- `npm test` covers pricing and the funding rules.

## Connecting the contracts

The app runs entirely against the deployed contracts in `brut-contracts`:
`ProviderRegistry` for listings and stake, `ComputeMarketplace` for jobs,
escrow, verdicts and disputes. Reads use the public RPC, so anyone can browse
without a wallet. Writes go through a browser wallet, found through EIP 6963,
which the app asks to switch to the configured chain first.

### After a deploy

```bash
node tools/sync-contracts.mjs
```

This copies `ComputeMarketplace`, `ProviderRegistry`, `deployBlock` and
`chainId` from `../brut-contracts/deployments/4663.json` into
`config/contracts.js`. Pass another deployment file to point elsewhere. Until
the addresses are filled in, the app says the contracts are not configured.

| Field | Effect |
|---|---|
| `network`, `chainId`, `rpcUrl`, `explorerUrl`, `currency` | The chain every read and write targets, and how a wallet adds it. |
| `walletConnectProjectId` | Adds WalletConnect, so phone wallets connect by QR. Allow the site domain for this id at cloud.reown.com. |
| `marketAddress`, `registryAddress` | The two protocol contracts. Both are required. |
| `deployBlock` | Where the contracts start, for anyone scanning events. |
| `gpus`, `regions` | Labels a listing can name. Onchain they are `keccak256(label)`. Add freely, never rename. |
| `tokenAddress`, `tokenLaunched` | The separate token, shown in the bar at the top of the landing page. |
| `links.x` | Enables the footer social link. Empty leaves it dimmed and inert. |

### What the app does

| Panel | Who | What |
|---|---|---|
| Rent | Buyers | Hire a listed provider at its price, or post a job for bids with a budget. Escrow is funded in the same transaction. |
| Provide | Providers | Register with stake, go online, update the listing, add or withdraw free stake, bid on open jobs. |
| Jobs | Everyone | Every job with its evidence trail and exactly the actions open to the connected wallet: accept a bid, start, heartbeat, submit a result, dispute, settle, fail an expired job. |
| Operate | Role holders | Verdicts and milestone payouts (verifier), dispute rulings (arbitrator), hardware attestation (attestor), pause (pauser). Hidden from everyone else. |

Workload and result references are hashed before they go onchain. The buyer's
own browser remembers the plain reference for its jobs, and anyone handed a
reference can check it against a job's hash on the job page.

### The token bar

The token is separate from the protocol contracts, so it gets its own line at
the top of the landing page. It reads "Coming soon" until `tokenLaunched` is
true, whatever `tokenAddress` holds, so the address can be checked ahead of
time and launch is a one word edit.

## Deployment

`vercel.json` publishes the directory as it stands, with hashed assets served
immutable for a year and `config/contracts.js` set to revalidate every time, so
a deployment can be pointed at a contract by editing that one file. It also
sets the baseline security headers.
