/* =========================================================
   FERAL AMERICA — live feed loader
   Pulls latest Substack posts + YouTube videos.
   Strategy per feed:
     1) baked cache at ./data/<name>.json (refreshed by GitHub Action)
     2) live fetch via CORS proxy (allorigins → corsproxy.io)
     3) rss2json fallback
   Whichever returns the most/newest items wins. Fully static-safe.
   ========================================================= */
(function () {
  "use strict";

  var FEEDS = {
    substack: {
      url: "https://feralamerica.substack.com/feed",
      cache: "./substack.json",
      target: "substack-feed",
      limit: 6,
      viewAll: "https://feralamerica.substack.com/archive",
    },
    youtube: {
      url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCZCMfPUFytpl1MugojZOzZQ",
      cache: "./youtube.json",
      target: "youtube-feed",
      limit: 6,
      viewAll: "https://www.youtube.com/@feralamerica/videos",
    },
  };

  var PROXIES = [
    function (u) { return "https://api.allorigins.win/raw?url=" + encodeURIComponent(u); },
    function (u) { return "https://corsproxy.io/?url=" + encodeURIComponent(u); },
    function (u) { return "https://thingproxy.freeboard.io/fetch/" + u; },
  ];

  function timeout(ms, p) {
    return Promise.race([
      p,
      new Promise(function (_, rej) { setTimeout(function () { rej(new Error("timeout")); }, ms); }),
    ]);
  }

  function esc(s) {
    return (s || "").replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function stripTags(html) {
    var d = document.createElement("div");
    d.innerHTML = html || "";
    return (d.textContent || d.innerText || "").replace(/\s+/g, " ").trim();
  }

  function firstImg(html) {
    if (!html) return "";
    var m = html.match(/<img[^>]+src=["']([^"']+)["']/i);
    return m ? m[1] : "";
  }

  function fmtDate(d) {
    if (!d) return "";
    var dt = new Date(d);
    if (isNaN(dt)) return "";
    return dt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }

  /* ---- RSS/Atom parsing (handles Substack RSS + YouTube Atom) ---- */
  function parseFeed(xmlText) {
    var doc = new DOMParser().parseFromString(xmlText, "text/xml");
    if (doc.querySelector("parsererror")) return [];
    var out = [];

    var items = doc.getElementsByTagName("item"); // RSS
    if (items.length) {
      for (var i = 0; i < items.length; i++) {
        var it = items[i];
        var get = function (t) { var e = it.getElementsByTagName(t)[0]; return e ? e.textContent : ""; };
        var content = get("content:encoded") || get("description");
        var thumb = "";
        var enc = it.getElementsByTagName("enclosure")[0];
        if (enc && enc.getAttribute("url")) thumb = enc.getAttribute("url");
        var mt = it.getElementsByTagName("media:thumbnail")[0] || it.getElementsByTagName("media:content")[0];
        if (!thumb && mt && mt.getAttribute("url")) thumb = mt.getAttribute("url");
        if (!thumb) thumb = firstImg(content);
        out.push({
          title: stripTags(get("title")),
          link: get("link"),
          date: get("pubDate") || get("dc:date"),
          summary: stripTags(content).slice(0, 160),
          thumb: thumb,
        });
      }
      return out;
    }

    var entries = doc.getElementsByTagName("entry"); // Atom (YouTube)
    for (var j = 0; j < entries.length; j++) {
      var en = entries[j];
      var vId = (en.getElementsByTagName("yt:videoId")[0] || {}).textContent || "";
      var linkEl = en.getElementsByTagName("link")[0];
      var link = linkEl ? linkEl.getAttribute("href") : (vId ? "https://www.youtube.com/watch?v=" + vId : "");
      var th = en.getElementsByTagName("media:thumbnail")[0];
      var thumbUrl = th ? th.getAttribute("url") : (vId ? "https://i.ytimg.com/vi/" + vId + "/hqdefault.jpg" : "");
      var descEl = en.getElementsByTagName("media:description")[0];
      out.push({
        title: (en.getElementsByTagName("title")[0] || {}).textContent || "",
        link: link,
        date: (en.getElementsByTagName("published")[0] || {}).textContent || "",
        summary: stripTags(descEl ? descEl.textContent : "").slice(0, 140),
        thumb: thumbUrl,
        video: true,
      });
    }
    return out;
  }

  function fetchText(url) {
    return timeout(9000, fetch(url, { cache: "no-store" }).then(function (r) {
      if (!r.ok) throw new Error("bad status " + r.status);
      return r.text();
    }));
  }

  function liveFetch(feed) {
    var i = 0;
    function tryNext() {
      if (i >= PROXIES.length) return Promise.reject(new Error("all proxies failed"));
      var pu = PROXIES[i++](feed.url);
      return fetchText(pu).then(parseFeed).then(function (items) {
        if (items && items.length) return items;
        return tryNext();
      }).catch(tryNext);
    }
    return tryNext();
  }

  function cacheFetch(feed) {
    return timeout(6000, fetch(feed.cache, { cache: "no-store" })
      .then(function (r) { if (!r.ok) throw 0; return r.json(); })
      .then(function (j) { return (j && j.items) ? j.items : []; }));
  }

  /* ---- rendering ---- */
  function articleCard(it) {
    var thumb = it.thumb
      ? '<div class="thumb" style="background-image:url(\'' + esc(it.thumb) + "')\"></div>"
      : '<div class="thumb ph"><img src="feral-logo.png" alt=""></div>';
    return (
      '<a class="card reveal" href="' + esc(it.link) + '" target="_blank" rel="noopener">' +
      thumb +
      '<div class="body">' +
      '<span class="kicker">Investigation</span>' +
      "<h3>" + esc(it.title) + "</h3>" +
      (it.summary ? "<p>" + esc(it.summary) + "…</p>" : "<p></p>") +
      '<div class="meta">' + esc(fmtDate(it.date)) + "</div>" +
      '<span class="go">Read the report →</span>' +
      "</div></a>"
    );
  }

  function videoCard(it) {
    var thumb = it.thumb
      ? '<div class="thumb" style="background-image:url(\'' + esc(it.thumb) + "')\">" +
        '<span class="play"><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg></span></div>'
      : '<div class="thumb ph"><img src="feral-logo.png" alt=""></div>';
    return (
      '<a class="card reveal" href="' + esc(it.link) + '" target="_blank" rel="noopener">' +
      thumb +
      '<div class="body">' +
      '<span class="kicker">Watch</span>' +
      "<h3>" + esc(it.title) + "</h3>" +
      '<div class="meta">' + esc(fmtDate(it.date)) + "</div>" +
      '<span class="go">Play on YouTube →</span>' +
      "</div></a>"
    );
  }

  function render(feedKey, items) {
    var feed = FEEDS[feedKey];
    var el = document.getElementById(feed.target);
    if (!el) return;
    if (!items || !items.length) {
      el.innerHTML =
        '<div class="feed-status">Latest ' +
        (feedKey === "youtube" ? "videos" : "posts") +
        ' are loading on our channel — <a href="' + feed.viewAll +
        '" target="_blank" rel="noopener" style="color:var(--red-bright)">view them directly →</a></div>';
      return;
    }
    items = items.slice(0, feed.limit);
    var maker = feedKey === "youtube" ? videoCard : articleCard;
    el.innerHTML = items.map(maker).join("");
    if (window.__revealObserve) window.__revealObserve(el.querySelectorAll(".reveal"));
  }

  function load(feedKey) {
    var feed = FEEDS[feedKey];
    // Race cache and live; prefer whichever yields items, favor the larger set.
    var cacheP = cacheFetch(feed).catch(function () { return []; });
    var liveP = liveFetch(feed).catch(function () { return []; });
    Promise.all([cacheP, liveP]).then(function (res) {
      var cache = res[0] || [], live = res[1] || [];
      var chosen = live.length >= cache.length ? live : cache;
      render(feedKey, chosen);
    }).catch(function () { render(feedKey, []); });
  }

  document.addEventListener("DOMContentLoaded", function () {
    Object.keys(FEEDS).forEach(function (k) {
      if (document.getElementById(FEEDS[k].target)) load(k);
    });
  });
})();
