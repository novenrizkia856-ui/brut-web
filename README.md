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
| `js/motion.js` | The job card laying back as the reader leaves the landing. |
| `js/enter.js` | Plays the entrances the export authored but never switched on. |
| `js/core.js` | Draws the evidence core. Geometry lives in `js/wireframe.js`. |
| `js/wireframe.js` | Pure solids, rotation and projection. Covered by `test/`. |
| `js/accordion.js` | The four proof points and their progress rails. |
| `js/nav-tone.js` | Recolours the fixed header over light and dark sections. |
| `js/contract-bar.js` | The token address bar at the top of the landing page. |
| `js/quote.js` | Pure pricing and funding rules. Covered by `test/`. |
| `js/app.js` | The app: provider list, job form, escrow, the run. |
| `js/sample-registry.js` | Providers the app reads until a market contract exists. |
| `js/wallet.js` | Injected wallet only. Hides itself when no wallet is present. |
| `js/config.js` | Reads `config/contracts.js` and answers "is this configured?". |
| `config/contracts.js` | The only file to edit after a deployment. Stays outside any build. |
| `content/docs/` | The documentation source, ordered by `SUMMARY.md`. |
| `assets/` | Fonts and artwork, named by a hash of their own contents. |
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
| Display type | BRUT Serif, the Bitter variable face, at the reference's clamps |
| Body type | BRUT Sans, the DM Sans variable face |
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
  shipped. The two faces that do the work are Bitter and DM Sans, both under
  the SIL Open Font License.
- The export shipped `maximum-scale=1, user-scalable=no`, which blocks pinch
  zoom. That is an accessibility defect rather than a design decision, so it
  was removed.

### Motion

The export kept the markup and the stylesheet but lost the script that drove
them, so several blocks arrived frozen mid animation. They were rebuilt to the
values the reference itself was holding:

| Element | Behaviour |
|---|---|
| Job card | Opens flat, then lies back to `rotateX(72deg) scale(0.62)` as the reader scrolls on |
| State pills | Go with the card face they belong to |
| Proof points | Advance every 7 seconds, with the rail as the progress bar |
| Evidence core | Turning icosahedron, counter turning octahedron, one light walking an edge at a time |
| Scorecard rows | Enter staggered, on the delays the export already declared |
| Trace cards | Cards, dots and connectors enter in sequence, same delays |
| First build panel | Slides in with its four rows staggered behind it |
| Boundaries cloud | Two dither layers drifting and panning against each other |

The card runs the reference transform backwards. The reference tilted a card
up into place as its section arrived; here the card is the first thing on
screen, so it starts flat and closes itself as the reader moves on.

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

The browser preview runs as a hidden document, where `requestAnimationFrame`
never fires, so the core cannot be verified on screen. `test/wireframe.test.mjs`
covers it instead: the solids, that rotation moves the points, that the
projection stays inside the canvas at every angle, and that the travelling
light only ever walks edges that meet.

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

Nothing in the site assumes a deployment. Every value degrades to static copy
or to the sample registry, so the site is publishable today and becomes live
the moment the addresses are filled in.

### 1. Fill in `config/contracts.js`

```js
window.CONTRACT_CONFIG = {
  network: "Example Chain",
  chainId: 1234,
  rpcUrl: "https://rpc.example",
  explorerUrl: "https://explorer.example",
  marketAddress: "0x...",
  tokenAddress: "",
  tokenLaunched: false,
  links: { docs: "docs.html", x: "" },
  reads: [],
};
```

What each field turns on:

| Field | Effect |
|---|---|
| `network` | The name in the app's network strip. Empty reads "No contract configured". |
| `chainId` | Shown beside the network name, and used for wallet sanity checks. |
| `rpcUrl` | Required before any live read runs. |
| `marketAddress` | The provider registry, job records and escrow. Enables live reads. |
| `tokenAddress` | The token contract, shown in the bar at the top of the landing page. |
| `tokenLaunched` | What reveals that address. False keeps the bar reading "Coming soon". |
| `explorerUrl` | Makes provider addresses and the job record clickable. |
| `links.x` | Enables the footer social link. Empty leaves it dimmed and inert. |

### 2. The provider list

`js/app.js` calls `readProviders()`. While `marketAddress` and `rpcUrl` are
empty it returns `js/sample-registry.js` and the app says so on screen. When
the market contract exists, its provider read goes in that one function and
nothing above it changes.

Until then, funding runs as a local walkthrough: the app steps a job from
funded escrow through the heartbeat and the output hash to settlement, with
each line carrying the label that says how strongly it is backed. It never
builds, signs or sends a transaction.

### 3. The token bar

The token is separate from the protocol contracts, so it gets its own line at
the top of the landing page rather than a slot in the footer. It reads
"Coming soon" until `tokenLaunched` is true, whatever `tokenAddress` holds.
That split exists so the address can be filled in and checked ahead of time,
and launch is then a one word edit on the deployed site with no rebuild.

Once live the bar shows the address, shortened under 768px with the full value
on hover, a copy button, and a link to the explorer when `explorerUrl` is set.

### 4. Contracts still to build

`brut-contracts` does not exist yet. The two day scope in
`content/docs/two-day-mvp-scope.md` is the shortest path to a live site:
provider registration with optional stake, job posting, funded escrow with
final release, heartbeat and output hash verification, and the
`Queued -> Running -> Completed | Failed` state flow.

## Deployment

`vercel.json` publishes the directory as it stands, with hashed assets served
immutable for a year and `config/contracts.js` set to revalidate every time, so
a deployment can be pointed at a contract by editing that one file. It also
sets the baseline security headers.
