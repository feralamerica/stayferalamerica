# Feral America — stayferalamerica.com

Your one-stop investigative-journalism site: latest Substack posts (with thumbnails), YouTube videos, your Project 545 and Anand Jon investigations, a secure tip/request form, Venmo donations, and links to all your socials — built to match the Feral America logo.

Everything is a plain static site (HTML/CSS/JS), so it runs free on **GitHub Pages** with your custom domain.

---

## ⭐ The ONE thing you must do before it's fully live

The tip/request form needs a free **Formspree** endpoint so submissions email to `localtip@proton.me`. Takes 3 minutes:

1. Go to **https://formspree.io** and sign up (free plan is fine).
2. Create a **New Form**. For the destination email, use **localtip@proton.me** and confirm it (Formspree sends a verification email there).
3. Formspree gives you an endpoint that looks like `https://formspree.io/f/abcdwxyz`.
4. Open **`index.html`**, find this line (around the tip form):

   ```html
   <form id="tip-form" action="https://formspree.io/f/YOUR_FORM_ID" method="POST">
   ```

   Replace `YOUR_FORM_ID` with your real ID, e.g. `action="https://formspree.io/f/abcdwxyz"`.
5. Save. Done — the form now emails you securely and never exposes your address to bots.

> Until you do this, the form shows a friendly error and points people to email `localtip@proton.me` directly, so nothing breaks.

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

Your Substack posts and YouTube videos show up **automatically** — you don't edit code when you publish.

- **In the browser:** the site fetches your latest Substack (`feralamerica.substack.com/feed`) and YouTube (`@feralamerica`) feeds live and renders cards with thumbnails.
- **As a reliable backup:** a GitHub Action (`.github/workflows/update-feeds.yml`) re-fetches both feeds **every 6 hours** and saves them to `data/substack.json` / `data/youtube.json`. This means the site stays fast and always has content even if the live fetch is blocked.

To refresh manually anytime: repo → **Actions → Update feeds → Run workflow**.

> First-time note: GitHub Actions is on by default for public repos. If prompted, enable Actions and give it **write** permission under **Settings → Actions → General → Workflow permissions → Read and write**.

---

## Changing things later

Everything you'd want to tweak is easy to find:

- **Venmo handle / QR** — currently `@bustertoks`. To change: update the two `venmo.com/u/bustertoks` links and the handle text in `index.html`, and swap `assets/venmo-qr.png` for a new QR.
- **Social links** — in the footer of every page: YouTube `@feralamerica`, Instagram `@feral_america`, TikTok `@feralamerica`, Substack. Edit the `href`s in the `<footer>` block.
- **Colors / vibe** — all in `css/styles.css` at the top under `:root` (navy `#011032`, flag red, chrome).
- **Project pages** — `project545.html` and `anandjon.html`. Edit the text freely; the big "Open the live tracker" buttons link out to `project545.org` and `anandjon.info`.
- **Add a stat or section** — copy any existing `card` / `section` block in `index.html`.

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
