// Builds docs.html from the markdown in content/docs/.
//
// The BRUT doc set is the source of truth for the product concept; the page
// is generated from it so the two can never drift.
//
// The site has no bundler, so the docs ship as one prerendered page: a sticky
// table of contents on the left, every document stacked as a section on the
// right. Order and titles come from content/docs/SUMMARY.md, so adding a page
// there is the only edit needed. The markdown stays out of the web root so it
// cannot collide with the published /docs URL.
//
// Usage: node tools/build-docs.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const docsDir = join(root, "content", "docs");

const esc = (s) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const slugOf = (file) => (file === "README.md" ? "introduction" : file.replace(/\.md$/, ""));

// Inline markdown. Code spans are lifted out first so their contents are never
// read as emphasis or a link, then put back at the end.
function inline(text) {
  const spans = [];
  let out = text.replace(/`([^`]+)`/g, (_, code) => {
    spans.push(`<code>${esc(code)}</code>`);
    return `@@code${spans.length - 1}@@`;
  });
  out = esc(out);
  out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, href) => {
    const local = href.match(/^([\w.-]+)\.md(#.*)?$/);
    const target = local ? `#${slugOf(`${local[1]}.md`)}` : href;
    const external = /^https?:/.test(target);
    const attrs = external ? ' target="_blank" rel="noopener noreferrer"' : "";
    return `<a href="${esc(target)}"${attrs}>${label}</a>`;
  });
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/(^|[^*])\*([^*]+)\*/g, "$1<em>$2</em>");
  return out.replace(/@@code(\d+)@@/g, (_, i) => spans[Number(i)]);
}

// A mermaid flowchart, drawn without mermaid. Nodes become steps in the order
// they are declared, and any edge pointing backwards is listed underneath.
function mermaid(src) {
  const labels = new Map();
  const edges = [];
  for (const line of src.split("\n")) {
    const edge = line.trim().match(/^(\w+)(?:\[([^\]]+)\])?\s*-->\s*(\w+)(?:\[([^\]]+)\])?$/);
    if (!edge) continue;
    if (edge[2]) labels.set(edge[1], edge[2]);
    if (edge[4]) labels.set(edge[3], edge[4]);
    edges.push([edge[1], edge[3]]);
  }
  if (!labels.size) return `<pre class="doc-pre"><code>${esc(src)}</code></pre>`;

  const order = [...labels.keys()];
  const steps = order.map((id) => `<li class="doc-flow__step">${esc(labels.get(id))}</li>`).join("");
  const loops = edges
    .filter(([a, b]) => order.indexOf(b) <= order.indexOf(a))
    .map(([a, b]) => `${esc(labels.get(a))} back to ${esc(labels.get(b))}`);
  const note = loops.length ? `<p class="doc-flow__note">Loops back: ${loops.join(", ")}.</p>` : "";
  return `<div class="doc-flow"><ol class="doc-flow__list">${steps}</ol>${note}</div>`;
}

function render(md) {
  const lines = md.split("\n");
  const html = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) {
      i += 1;
      continue;
    }

    // Fenced code, including the one mermaid diagram.
    if (line.startsWith("```")) {
      const lang = line.slice(3).trim();
      const body = [];
      i += 1;
      while (i < lines.length && !lines[i].startsWith("```")) body.push(lines[i++]);
      i += 1;
      const src = body.join("\n");
      html.push(
        lang === "mermaid" ? mermaid(src) : `<pre class="doc-pre"><code>${esc(src)}</code></pre>`
      );
      continue;
    }

    const heading = line.match(/^(#{1,4})\s+(.*)$/);
    if (heading) {
      // The h1 is the document title and is emitted by the caller.
      if (heading[1].length > 1) {
        const level = heading[1].length;
        html.push(`<h${level}>${inline(heading[2])}</h${level}>`);
      }
      i += 1;
      continue;
    }

    // Blockquote: the doc set uses it for the one line summaries.
    if (line.startsWith(">")) {
      const quote = [];
      while (i < lines.length && lines[i].startsWith(">")) {
        quote.push(lines[i].replace(/^>\s?/, "").trim());
        i += 1;
      }
      html.push(`<blockquote class="doc-quote">${inline(quote.join(" "))}</blockquote>`);
      continue;
    }

    if (/^[-*]\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i])) {
        items.push(`<li>${inline(lines[i].replace(/^[-*]\s+/, ""))}</li>`);
        i += 1;
      }
      html.push(`<ul class="doc-list">${items.join("")}</ul>`);
      continue;
    }

    if (/^\d+\.\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) {
        items.push(`<li>${inline(lines[i].replace(/^\d+\.\s+/, ""))}</li>`);
        i += 1;
      }
      html.push(`<ol class="doc-list doc-list--num">${items.join("")}</ol>`);
      continue;
    }

    // Pipe table: header row, separator, then body rows.
    if (line.startsWith("|") && (lines[i + 1] || "").includes("---")) {
      const cells = (row) =>
        row
          .trim()
          .replace(/^\||\|$/g, "")
          .split("|")
          .map((c) => c.trim());
      const head = cells(line)
        .map((c) => `<th>${inline(c)}</th>`)
        .join("");
      i += 2;
      const body = [];
      while (i < lines.length && lines[i].startsWith("|")) {
        body.push(
          `<tr>${cells(lines[i])
            .map((c) => `<td>${inline(c)}</td>`)
            .join("")}</tr>`
        );
        i += 1;
      }
      html.push(
        `<div class="doc-table"><table><thead><tr>${head}</tr></thead><tbody>${body.join(
          ""
        )}</tbody></table></div>`
      );
      continue;
    }

    const para = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^(#{1,4}\s|[-*]\s|\d+\.\s|\||```|>)/.test(lines[i])
    ) {
      para.push(lines[i].trim());
      i += 1;
    }
    html.push(`<p>${inline(para.join(" "))}</p>`);
  }

  return html.join("\n            ");
}

// ---- the table of contents drives the page order
const summary = readFileSync(join(docsDir, "SUMMARY.md"), "utf8");
const pages = [...summary.matchAll(/^\*\s+\[([^\]]+)\]\(([^)]+)\)/gm)].map(([, title, file]) => ({
  title,
  file,
  slug: slugOf(file),
}));
if (!pages.length) throw new Error("content/docs/SUMMARY.md listed no pages");

const nav = pages
  .map((p) => `<li><a href="#${p.slug}" data-doc-link>${esc(p.title)}</a></li>`)
  .join("\n            ");

const sections = pages
  .map((p) => {
    const body = render(readFileSync(join(docsDir, p.file), "utf8"));
    return `<section class="doc" id="${p.slug}" aria-labelledby="${p.slug}-title">
            <h2 class="doc__title" id="${p.slug}-title">${esc(p.title)}</h2>
            ${body}
          </section>`;
  })
  .join("\n\n          ");

// The shell matches app.html: same fonts, same tokens, same quiet canvas.
const page = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>BRUT Docs | Onchain GPU Compute</title>
<meta name="description" content="The concept, mechanics, state model and trust model behind the BRUT GPU compute marketplace.">
<meta name="robots" content="index, follow">
<meta property="og:type" content="article">
<meta property="og:site_name" content="BRUT">
<meta property="og:title" content="BRUT Docs | Onchain GPU Compute">
<meta property="og:description" content="The concept, mechanics, state model and trust model behind the BRUT GPU compute marketplace.">
<link rel="icon" href="assets/brand/mark.svg" type="image/svg+xml">
<link rel="stylesheet" href="css/brut.css">
<link rel="stylesheet" href="css/base.css">
<link rel="stylesheet" href="css/docs.css">
</head>
<body>
<a class="skip-link" href="#doc-main">Skip to content</a>

<div class="page">
  <header class="masthead">
    <div class="container masthead__inner">
      <a class="brand" href="index.html" aria-label="BRUT home">
        <img src="assets/brand/mark.svg" width="15" height="21.5" alt="">
        <span>BRUT</span>
      </a>
      <nav class="pill-nav" aria-label="Primary">
        <a href="index.html">Overview</a>
        <a href="app.html">App</a>
        <a href="docs.html" aria-current="page">Docs</a>
      </nav>
    </div>
  </header>

  <div class="container docs-shell">
    <details class="docs-side" id="docs-toc" open>
      <summary class="docs-side__label">Contents</summary>
      <ol class="docs-side__list">
            ${nav}
      </ol>
    </details>

    <main class="docs-main" id="doc-main">
      <div class="docs-intro">
        <p class="label">Documentation</p>
        <h1>Idle GPUs. Real jobs. Paid onchain.</h1>
        <p class="lede">How BRUT coordinates a compute job between a buyer and a provider it has never met.</p>
      </div>

      ${sections}
    </main>
  </div>

  <footer class="page__footer">
    <div class="container">
      <span>BRUT coordinates the agreement. Compute runs on provider hardware.</span>
      <a href="index.html">Back to the overview</a>
    </div>
  </footer>
</div>

<script>
  /* The contents list is a sidebar on a wide screen and a disclosure on a
     narrow one, where leaving it open would fill the whole first screen. */
  (function () {
    var toc = document.getElementById("docs-toc");
    var narrow = window.matchMedia("(max-width: 959px)");
    var sync = function () { toc.open = !narrow.matches; };
    sync();
    if (narrow.addEventListener) narrow.addEventListener("change", sync);
    toc.addEventListener("click", function (event) {
      if (narrow.matches && event.target.closest("a")) toc.open = false;
    });
  })();

  /* Mark whichever section the reader is in, in the sidebar. */
  (function () {
    var links = Array.prototype.slice.call(document.querySelectorAll("[data-doc-link]"));
    var sections = Array.prototype.slice.call(document.querySelectorAll(".doc"));
    if (!("IntersectionObserver" in window) || !sections.length) return;

    var byId = {};
    links.forEach(function (link) { byId[link.getAttribute("href").slice(1)] = link; });

    var seen = {};
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) { seen[entry.target.id] = entry.isIntersecting; });
      var current = null;
      sections.forEach(function (section) { if (!current && seen[section.id]) current = section.id; });
      links.forEach(function (link) { link.classList.remove("is-current"); });
      if (current && byId[current]) byId[current].classList.add("is-current");
    }, { rootMargin: "-96px 0px -70% 0px" });

    sections.forEach(function (section) { observer.observe(section); });
  })();
</script>
</body>
</html>
`;

writeFileSync(join(root, "docs.html"), page);
console.log(`wrote docs.html from ${pages.length} pages`);
