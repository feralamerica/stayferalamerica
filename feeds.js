/* =========================================================
   FERAL AMERICA: live feed loader
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
      limit: 3,
      viewAll: "https://feralamerica.substack.com/archive",
    },
  };

  // ---- YouTube: newest long-form video + two newest Shorts, auto-updating ----
  // Paste your YouTube Data API v3 key below (see the setup guide). Until it is
  // set, the section keeps the static "latest upload" embed already in the HTML.
  var YT = {
    apiKey: "AIzaSyCni-bDZNqOe71yyUePDmil6ycrIE510kQ",
    uploadsPlaylist: "UUZCMfPUFytpl1MugojZOzZQ", // Feral America uploads playlist
    target: "youtube-feed",
    shortMaxSeconds: 180, // videos this length or shorter are treated as Shorts
    scan: 25,             // how many recent uploads to scan
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
        id: vId,
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

  // rss2json returns parsed JSON (CORS-friendly) and includes thumbnails.
  function rss2jsonFetch(feed) {
    var u = "https://api.rss2json.com/v1/api.json?rss_url=" + encodeURIComponent(feed.url) + "&count=10";
    return timeout(9000, fetch(u, { cache: "no-store" }).then(function (r) { return r.json(); }))
      .then(function (j) {
        if (!j || j.status !== "ok" || !j.items) return [];
        return j.items.map(function (it) {
          var thumb = it.thumbnail || (it.enclosure && it.enclosure.link) || firstImg(it.content || it.description) || "";
          return {
            title: it.title || "",
            link: it.link || "",
            date: it.pubDate || "",
            summary: stripTags(it.description || it.content || "").slice(0, 160),
            thumb: thumb,
          };
        });
      });
  }

  function proxyFetch(feed) {
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

  function liveFetch(feed) {
    return rss2jsonFetch(feed).then(function (items) {
      if (items && items.length) return items;
      return proxyFetch(feed);
    }).catch(function () { return proxyFetch(feed); });
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

  function ytId(it) {
    if (it.id) return it.id;
    var m = (it.link || "").match(/[?&]v=([\w-]+)/) || (it.link || "").match(/youtu\.be\/([\w-]+)/);
    return m ? m[1] : "";
  }

  function render(feedKey, items) {
    var feed = FEEDS[feedKey];
    var el = document.getElementById(feed.target);
    if (!el) return;
    if (!items || !items.length) {
      el.innerHTML =
        '<div class="feed-status">Latest ' +
        (feedKey === "youtube" ? "video" : "posts") +
        ' loading on our channel. <a href="' + feed.viewAll +
        '" target="_blank" rel="noopener" style="color:var(--red-bright)">view directly →</a></div>';
      return;
    }
    items = items.slice(0, feed.limit);

    // YouTube: embed the single most recent video as a player.
    if (feedKey === "youtube") {
      var id = ytId(items[0]);
      if (id) {
        el.innerHTML =
          '<iframe src="https://www.youtube-nocookie.com/embed/' + esc(id) +
          '" title="' + esc(items[0].title || "Latest video") +
          '" loading="lazy" allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>';
      } else {
        el.innerHTML = items.map(videoCard).join("");
        if (window.__revealObserve) window.__revealObserve(el.querySelectorAll(".reveal"));
      }
      return;
    }

    el.innerHTML = items.map(articleCard).join("");
    if (window.__revealObserve) window.__revealObserve(el.querySelectorAll(".reveal"));
  }

  function load(feedKey) {
    var feed = FEEDS[feedKey];
    var best = [], settled = 0;
    // Render the cached posts the instant they arrive; upgrade to live data
    // only if it returns MORE items (fresher set, with thumbnails).
    function apply(items) {
      if (items && items.length > best.length) { best = items; render(feedKey, items); }
    }
    function settle() { settled++; if (settled >= 2 && best.length === 0) render(feedKey, []); }
    cacheFetch(feed).then(function (x) { apply(x); settle(); }, function () { settle(); });
    liveFetch(feed).then(function (x) { apply(x); settle(); }, function () { settle(); });
  }

  /* ---- YouTube loader (Data API v3) ---- */
  function iso8601ToSeconds(d) {
    var m = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/.exec(d || "");
    if (!m) return 0;
    return (+m[1] || 0) * 3600 + (+m[2] || 0) * 60 + (+m[3] || 0);
  }

  function ytEmbed(id, title, cls) {
    return '<iframe class="' + cls + '" src="https://www.youtube-nocookie.com/embed/' +
      esc(id) + '" title="' + esc(title || "Feral America video") +
      '" loading="lazy" allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>';
  }

  function renderVideos(el, longform, shorts) {
    var html = "";
    if (longform) html += '<div class="vf-main">' + ytEmbed(longform.id, longform.title, "vf-frame") + "</div>";
    if (shorts.length) {
      html += '<div class="vf-shorts">' + shorts.map(function (s) {
        return '<div class="vf-short">' + ytEmbed(s.id, s.title, "vf-frame") + "</div>";
      }).join("") + "</div>";
    }
    if (html) el.innerHTML = html;
  }

  function loadYouTube() {
    var el = document.getElementById(YT.target);
    if (!el) return;
    if (!YT.apiKey || YT.apiKey === "YOUR_YOUTUBE_API_KEY") return; // keep static fallback
    var base = "https://www.googleapis.com/youtube/v3/";
    timeout(9000, fetch(base + "playlistItems?part=contentDetails&maxResults=" + YT.scan +
      "&playlistId=" + YT.uploadsPlaylist + "&key=" + YT.apiKey).then(function (r) { return r.json(); }))
      .then(function (j) {
        var ids = (j.items || []).map(function (it) { return it.contentDetails.videoId; });
        if (!ids.length) throw new Error("no uploads");
        return fetch(base + "videos?part=snippet,contentDetails&id=" + ids.join(",") +
          "&key=" + YT.apiKey).then(function (r) { return r.json(); })
          .then(function (v) { return { order: ids, data: v }; });
      })
      .then(function (res) {
        var map = {};
        (res.data.items || []).forEach(function (v) {
          map[v.id] = { id: v.id, title: v.snippet.title, secs: iso8601ToSeconds(v.contentDetails.duration) };
        });
        var ordered = res.order.map(function (id) { return map[id]; }).filter(Boolean);
        var longform = null, shorts = [];
        ordered.forEach(function (v) {
          if (v.secs > YT.shortMaxSeconds) { if (!longform) longform = v; }
          else if (shorts.length < 3) { shorts.push(v); }
        });
        if (!longform && !shorts.length) throw new Error("nothing to show");
        renderVideos(el, longform, shorts);
      })
      .catch(function () { /* leave the static fallback embed in place */ });
  }

  document.addEventListener("DOMContentLoaded", function () {
    Object.keys(FEEDS).forEach(function (k) {
      if (document.getElementById(FEEDS[k].target)) load(k);
    });
    loadYouTube();
  });
})();
