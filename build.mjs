#!/usr/bin/env node
// 634threads.com builder. Zero dependencies; this file is the whole CMS.
// chapters/NN-slug.md + site.json -> dist/ (index, chapter pages, rss, sitemap, robots, 404).

import { readFileSync, writeFileSync, mkdirSync, rmSync, readdirSync, copyFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(fileURLToPath(import.meta.url));
const DIST = join(ROOT, "dist");
const site = JSON.parse(readFileSync(join(ROOT, "site.json"), "utf8"));

const esc = (s) =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

// Full chapter HTML rides inside RSS items; CDATA so feed readers get it verbatim.
const cdata = (s) => `<![CDATA[${String(s).replace(/]]>/g, "]]]]><![CDATA[>")}]]>`;

// --- markdown, exactly the subset the manuscript uses:
// paragraphs, *em*, **strong**, ## subheads, --- section breaks.
const inline = (s) =>
  esc(s)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>");

const mdToHtml = (md) =>
  md
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean)
    .map((b) => {
      if (/^-{3,}$/.test(b)) return "<hr>";
      if (b.startsWith("## ")) return `<h2>${inline(b.slice(3))}</h2>`;
      return `<p>${inline(b.replace(/\n/g, " "))}</p>`;
    })
    .join("\n");

// about.md is optional; the page only exists once the file does.
function loadAbout() {
  let src;
  try {
    src = readFileSync(join(ROOT, "about.md"), "utf8");
  } catch {
    return null;
  }
  return mdToHtml(src);
}

function loadChapters() {
  let files = [];
  try {
    files = readdirSync(join(ROOT, "chapters"));
  } catch {}
  return files
    .filter((f) => /^\d{2}-[a-z0-9-]+\.md$/.test(f))
    .sort()
    .map((f) => {
      let src = readFileSync(join(ROOT, "chapters", f), "utf8");
      const meta = {};
      const fm = src.match(/^---\n([\s\S]*?)\n---\n/);
      if (fm) {
        for (const line of fm[1].split("\n")) {
          const m = line.match(/^([a-z]+):\s*(.+)$/);
          if (m) meta[m[1]] = m[2].trim();
        }
        src = src.slice(fm[0].length);
      }
      const head = src.match(/^#\s+(\d+)\s*·\s*([a-z0-9-]+)\s*\n/);
      if (head) src = src.slice(head[0].length);
      const n = head ? Number(head[1]) : Number(f.slice(0, 2));
      const slug = head ? head[2] : f.slice(3, -3);
      const firstPara =
        src
          .split(/\n{2,}/)
          .map((b) => b.trim())
          .find((b) => b && !/^[-#*]/.test(b)) || "";
      const teaser =
        meta.teaser ||
        firstPara.replace(/[*_]/g, "").slice(0, 152) + (firstPara.length > 152 ? "…" : "");
      return {
        n,
        slug,
        date: meta.date || null,
        teaser,
        bodyHtml: mdToHtml(src),
        path: `${slug}.html`,
        url: `${site.url}/${slug}.html`,
      };
    })
    .sort((a, b) => a.n - b.n);
}

const author = {
  "@type": "Person",
  name: site.author,
  url: site.authorUrl,
  ...(site.sameAs?.length ? { sameAs: site.sameAs } : {}),
};

// abs: root-absolute asset links, for pages served at arbitrary paths (404).
function shell({ title, desc, canonical, ogType = "website", published = null, jsonld, abs = false, body }) {
  const p = abs ? "/" : "";
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${canonical}">
<link rel="icon" href="${p}favicon.svg" type="image/svg+xml">
<link rel="alternate" type="application/rss+xml" title="${esc(site.title)}" href="${site.url}/rss.xml">
<link rel="stylesheet" href="${p}style.css">
<meta property="og:site_name" content="${esc(site.title)}">
<meta property="og:type" content="${ogType}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${canonical}">
<meta property="og:image" content="${site.url}/og.png">
<meta name="twitter:card" content="summary_large_image">${published ? `\n<meta property="article:published_time" content="${published}">` : ""}
<script type="application/ld+json">${JSON.stringify(jsonld)}</script>
</head>
<body>
${body}
</body>
</html>
`;
}

const footer = () => `<footer>
<hr class="thread">
${site.colophon.map((p) => `<p>${p}</p>`).join("\n")}
</footer>`;

function indexPage(chapters, about) {
  const items = chapters.map(
    (c) => `<li value="${c.n}"><a href="${c.path}">${c.slug}</a></li>`
  );
  // comingNext.note overrides the generic tease with the run's one dated line
  // (e.g. "Part IV: December 6"); site.complete replaces the tease at the end.
  if (site.comingNext)
    items.push(
      `<li class="soon" value="${site.comingNext.n}">${site.comingNext.slug} <em>${esc(site.comingNext.note || "coming soon")}</em></li>`
    );
  const jsonld = {
    "@context": "https://schema.org",
    "@type": "Book",
    name: site.title,
    alternativeHeadline: site.subtitle,
    author,
    url: site.url,
    inLanguage: "en",
    genre: "Autofiction",
    hasPart: chapters.map((c) => ({
      "@type": "Chapter",
      name: c.slug,
      position: c.n,
      url: c.url,
    })),
  };
  const body = `<header class="masthead">
<h1>${esc(site.title)}</h1>
<p class="subtitle">${esc(site.subtitle)}</p>
<hr class="thread">
</header>
<main>
${site.tease.map((p) => `<p class="tease">${p}</p>`).join("\n")}
<h2>Chapters</h2>
<ol class="toc">
${items.join("\n")}
</ol>${!site.comingNext && site.complete ? `\n<p class="complete">${esc(site.complete)}</p>` : ""}
<p class="rss">New chapters land here first. <a href="rss.xml">RSS</a> if you want them to find you.${about ? ` <a href="about.html">About the text</a>.` : ""}</p>
</main>
${footer()}`;
  return shell({
    title: `${site.title} · ${site.subtitle}`,
    desc: site.description,
    canonical: `${site.url}/`,
    ogType: "book",
    jsonld,
    body,
  });
}

function chapterPage(c, prev, next) {
  const pager = [`<a href="./">chapters</a>`];
  if (prev) pager.unshift(`<a href="${prev.path}" rel="prev">&larr; ${prev.n} · ${prev.slug}</a>`);
  if (next) pager.push(`<a href="${next.path}" rel="next">${next.n} · ${next.slug} &rarr;</a>`);
  else if (site.comingNext && site.comingNext.n === c.n + 1)
    pager.push(
      `<span class="soon">next: ${site.comingNext.slug} · ${esc(site.comingNext.note || "coming soon")}</span>`
    );
  const jsonld = {
    "@context": "https://schema.org",
    "@type": "Chapter",
    name: c.slug,
    position: c.n,
    url: c.url,
    author,
    isPartOf: { "@type": "Book", name: site.title, url: site.url },
    ...(c.date ? { datePublished: c.date } : {}),
  };
  const body = `<header class="masthead small">
<p class="crumb"><a href="./">${esc(site.title)}</a></p>
</header>
<main>
<h1 class="slug">${c.n} · ${c.slug}</h1>
<article>
${c.bodyHtml}
</article>
<nav class="pager">
${pager.join("\n")}
</nav>
</main>
${footer()}`;
  return shell({
    title: `${c.n} · ${c.slug} · ${site.title}`,
    desc: c.teaser,
    canonical: c.url,
    ogType: "article",
    published: c.date,
    jsonld,
    body,
  });
}

function aboutPage(html) {
  const body = `<header class="masthead small">
<p class="crumb"><a href="./">${esc(site.title)}</a></p>
</header>
<main>
<h1 class="slug">about the text</h1>
<article>
${html}
</article>
<nav class="pager">
<a href="./">chapters</a>
</nav>
</main>
${footer()}`;
  return shell({
    title: `about · ${site.title}`,
    desc: site.description,
    canonical: `${site.url}/about.html`,
    jsonld: {
      "@context": "https://schema.org",
      "@type": "AboutPage",
      name: "about the text",
      url: `${site.url}/about.html`,
      isPartOf: { "@type": "Book", name: site.title, url: site.url },
    },
    body,
  });
}

function notFoundPage() {
  const body = `<header class="masthead small">
<p class="crumb"><a href="/">${esc(site.title)}</a></p>
</header>
<main>
<h1 class="slug">404 · thread-not-found</h1>
<p>There were 634. This wasn't one of them.</p>
<p><a href="/">Back to the chapters</a></p>
<!-- 404.html is served at arbitrary paths, so its links stay root-absolute. -->
</main>
${footer()}`;
  return shell({
    title: `404 · ${site.title}`,
    desc: site.description,
    canonical: `${site.url}/404.html`,
    jsonld: { "@context": "https://schema.org", "@type": "WebPage", name: "404" },
    abs: true,
    body,
  });
}

const rfc822 = (d) => new Date(`${d}T12:00:00Z`).toUTCString();

function rss(chapters) {
  const items = [...chapters]
    .reverse()
    .map(
      (c) => `<item>
<title>${esc(`${c.n} · ${c.slug}`)}</title>
<link>${c.url}</link>
<guid>${c.url}</guid>${c.date ? `\n<pubDate>${rfc822(c.date)}</pubDate>` : ""}
<description>${esc(c.teaser)}</description>
<content:encoded>${cdata(c.bodyHtml)}</content:encoded>
</item>`
    )
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/">
<channel>
<title>${esc(site.title)}</title>
<link>${site.url}</link>
<description>${esc(site.description)}</description>
<language>en</language>
<atom:link href="${site.url}/rss.xml" rel="self" type="application/rss+xml"/>
${items}
</channel>
</rss>
`;
}

function sitemap(chapters, about) {
  const today = new Date().toISOString().slice(0, 10);
  const urls = [
    `<url><loc>${site.url}/</loc><lastmod>${today}</lastmod></url>`,
    ...(about ? [`<url><loc>${site.url}/about.html</loc></url>`] : []),
    ...chapters.map(
      (c) => `<url><loc>${c.url}</loc>${c.date ? `<lastmod>${c.date}</lastmod>` : ""}</url>`
    ),
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join("\n")}
</urlset>
`;
}

// --- build
rmSync(DIST, { recursive: true, force: true });
mkdirSync(DIST, { recursive: true });

const chapters = loadChapters();
const about = loadAbout();
writeFileSync(join(DIST, "index.html"), indexPage(chapters, about));
chapters.forEach((c, i) =>
  writeFileSync(join(DIST, c.path), chapterPage(c, chapters[i - 1], chapters[i + 1]))
);
if (about) writeFileSync(join(DIST, "about.html"), aboutPage(about));
writeFileSync(join(DIST, "404.html"), notFoundPage());
writeFileSync(join(DIST, "rss.xml"), rss(chapters));
writeFileSync(join(DIST, "sitemap.xml"), sitemap(chapters, about));
writeFileSync(join(DIST, "robots.txt"), `User-agent: *\nAllow: /\n\nSitemap: ${site.url}/sitemap.xml\n`);
copyFileSync(join(ROOT, "style.css"), join(DIST, "style.css"));
for (const f of readdirSync(join(ROOT, "static"))) {
  if (!f.endsWith(".html") && !f.startsWith(".")) copyFileSync(join(ROOT, "static", f), join(DIST, f));
}

console.log(`built ${chapters.length} chapter(s) -> dist/`);
