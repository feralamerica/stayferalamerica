# Feral America: stayferalamerica.com

Your one-stop investigative-journalism site: latest Substack posts (with thumbnails), YouTube videos, your Project 545 and Anand Jon investigations, a secure tip/request form, Venmo donations, and links to all your socials, built to match the Feral America logo.

Everything is a plain static site (HTML/CSS/JS), so it runs free on **GitHub Pages** with your custom domain.

---

## ✅ Tip form: already wired up

The tip/request form is connected to your live **Formspree** endpoint (`https://formspree.io/f/mqpzkwaq`), which delivers submissions to `localtip@proton.me`. Nothing to configure.

Just make sure of two things in your Formspree account: the form's destination email is set to **localtip@proton.me** and confirmed, and (optional) the allowed domain is set to `stayferalamerica.com` once the site is live. That's it. If you ever need to change where tips go, update the `action="..."` URL on the `<form id="tip-form" ...>` line in `index.html`.

---

## Putting it on GitHub + going live

### 1. Create the repo
- On GitHub, click **New repository**, name it anything (e.g. `stayferalamerica`), make it **Public**, and create it.
- Upload **all the files in this folder** (drag-and-drop works: select everything including the `.github`, `css`, `js`, `data`, `assets`, `scripts` folders and the `CNAME` / `.nojekyll` files). Commit.

### 2. Turn on GitHub Pages
- In the repo: **Settings → Pages**.
- Under **Build and deployment → Source**, choose **Deploy from a branch**.
- Branch: **main**, folder: **/ (root)**. Save.
- Wait ~1 minute; GitHub gives you a temporary URL like `https://yourname.github.io/stayferalamerica`.

### 3. Connect your domain (stayferalamerica.com)
The `CNAME` file is already set to `stayferalamerica.com`, so GitHub will pick it up. Now point the domain at GitHub:

At your domain registrar (wherever you bought stayferalamerica.com), add these DNS records:

| Type  | Host / Name | Value |
|-------|-------------|-------|
| A     | @           | 185.199.108.153 |
| A     | @           | 185.199.109.153 |
| A     | @           | 185.199.110.153 |
| A     | @           | 185.199.111.153 |
| CNAME | www         | `yourname.github.io` |

Then in **Settings → Pages → Custom domain**, confirm `stayferalamerica.com` is filled in, and tick **Enforce HTTPS** once it's available (can take up to an hour for the certificate).

DNS can take anywhere from a few minutes to a few hours to propagate. That's normal.

---

## How the auto-updating feeds work

Your Substack posts and YouTube videos show up **automatically**. You don't edit code when you publish.

- **In the browser:** the site fetches your latest Substack (`feralamerica.substack.com/feed`) and YouTube (`@feralamerica`) feeds live and renders cards with thumbnails.
- **As a reliable backup:** a GitHub Action (`.github/workflows/update-feeds.yml`) re-fetches both feeds **every 6 hours** and saves them to `data/substack.json` / `data/youtube.json`. This means the site stays fast and always has content even if the live fetch is blocked.

To refresh manually anytime: repo → **Actions → Update feeds → Run workflow**.

> First-time note: GitHub Actions is on by default for public repos. If prompted, enable Actions and give it **write** permission under **Settings → Actions → General → Workflow permissions → Read and write**.

---

## Changing things later

Everything you'd want to tweak is easy to find:

- **Venmo handle / QR**: currently `@bustertoks`. To change: update the two `venmo.com/u/bustertoks` links and the handle text in `index.html`, and swap `venmo-qr.png` for a new QR.
- **Social links**: in the footer of every page: YouTube `@feralamerica`, Instagram `@feral_america`, TikTok `@feralamerica`, Substack. Edit the `href`s in the `<footer>` block.
- **Colors / vibe**: all in `styles.css` at the top under `:root` (navy `#011032`, flag red, chrome).
- **Project pages**: `project545.html`, `anandjon.html`, and `epsteinsweb.html`. Edit the text freely; the big "Open the live site" buttons link out to `project545.org`, `anandjon.info`, and `epsteinsweb.com`.
- **Add a stat or section**: copy any existing `card` / `section` block in `index.html`.

---

## File map

```
index.html            Homepage (hero, mission, investigations, videos, projects, tip form, donate, socials)
project545.html       Project 545 Tracker page
anandjon.html         The Anand Jon Record page
css/styles.css        All styling / the Feral America design system
js/main.js            Nav, scroll animations, form submission
js/feeds.js           Live Substack + YouTube loader (with cache fallback)
data/*.json           Auto-refreshed feed cache
scripts/fetch-feeds.mjs   The feed baker run by GitHub Actions
.github/workflows/update-feeds.yml   Schedule that keeps feeds fresh
assets/               Logo, favicon, Venmo QR
CNAME                 stayferalamerica.com
robots.txt, sitemap.xml   SEO
```

Investigate. Educate. Activate. And stay feral, America. 🐾
