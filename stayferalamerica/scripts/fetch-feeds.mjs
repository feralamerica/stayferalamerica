#!/usr/bin/env node
/**
 * Feral America — feed baker (dependency-free).
 * Fetches the Substack RSS + YouTube Atom feeds and writes
 * data/substack.json and data/youtube.json. Run by GitHub Actions
 * on a schedule so the live site always has a fresh, reliable cache
 * even if a browser-side proxy is unavailable.
 */
import { writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

const SOURCES = {
  substack: {
    url: "https://feralamerica.substack.com/feed",
    out: "data/substack.json",
    limit: 12,
  },
  youtube: {
    url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCZCMfPUFytpl1MugojZOzZQ",
    out: "data/youtube.json",
    limit: 12,
  },
};

const tag = (xml, name) => {
  const m = xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i"));
  return m ? m[1] : "";
};
const attr = (xml, name, a) => {
  const m = xml.match(new RegExp(`<${name}[^>]*\\b${a}=["']([^"']+)["']`, "i"));
  return m ? m[1] : "";
};
const clean = (s) =>
  (s || "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ").trim();
const firstImg = (html) => {
  const m = (html || "").match(/<img[^>]+src=["']([^"']+)["']/i);
  return m ? m[1] : "";
};

function parse(xml, kind) {
  const items = [];
  const blocks = kind === "youtube"
    ? xml.split(/<entry>/).slice(1).map((b) => b.split("</entry>")[0])
    : xml.split(/<item>/).slice(1).map((b) => b.split("</item>")[0]);

  for (const b of blocks) {
    if (kind === "youtube") {
      const vid = tag(b, "yt:videoId");
      const link = attr(b, "link", "href") || (vid ? `https://www.youtube.com/watch?v=${vid}` : "");
      const thumb = attr(b, "media:thumbnail", "url") || (vid ? `https://i.ytimg.com/vi/${vid}/hqdefault.jpg` : "");
      items.push({
        title: clean(tag(b, "title")),
        link,
        date: clean(tag(b, "published")),
        summary: clean(tag(b, "media:description")).slice(0, 160),
        thumb,
        video: true,
      });
    } else {
      const content = tag(b, "content:encoded") || tag(b, "description");
      const thumb = attr(b, "enclosure", "url") || attr(b, "media:thumbnail", "url") || firstImg(content);
      items.push({
        title: clean(tag(b, "title")),
        link: clean(tag(b, "link")),
        date: clean(tag(b, "pubDate")),
        summary: clean(content).slice(0, 180),
        thumb,
      });
    }
  }
  return items;
}

async function run() {
  await mkdir(`${ROOT}/data`, { recursive: true });
  for (const [key, src] of Object.entries(SOURCES)) {
    try {
      const res = await fetch(src.url, {
        headers: { "User-Agent": "FeralAmericaFeedBot/1.0 (+https://stayferalamerica.com)" },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const xml = await res.text();
      const items = parse(xml, key).slice(0, src.limit);
      if (items.length) {
        await writeFile(
          `${ROOT}/${src.out}`,
          JSON.stringify({ updated: new Date().toISOString(), source: src.url, items }, null, 2)
        );
        console.log(`✓ ${key}: wrote ${items.length} items`);
      } else {
        console.log(`• ${key}: 0 items parsed — leaving existing cache untouched`);
      }
    } catch (e) {
      console.log(`✗ ${key}: ${e.message} — leaving existing cache untouched`);
    }
  }
}
run();
