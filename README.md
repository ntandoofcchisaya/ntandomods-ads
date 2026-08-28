# Ntandomods Ads

A free classifieds/ads app. Anyone can post an ad with photos and a WhatsApp
number. Buyers view the ad and tap **Chat on WhatsApp** to message the seller
directly. Every ad has one-tap sharing to WhatsApp, Facebook, and Instagram.

Developed by **Ntandomods ZW**. Contact: **263771629199** (WhatsApp).

## Features

- Post free ads: title, description, price, category, location, photos (up to 5), WhatsApp number
- Browse & search ads by keyword and category
- Ad detail page with image gallery, "Chat on WhatsApp" button (prefilled message), and share buttons (WhatsApp / Facebook / X / Instagram / copy link / native share)
- Every ad auto-generates a shareable **image card** (photo + title + price + location + WhatsApp contact + QR code) at `/ad/:id/image.png`, cached on disk and used for Open Graph / Twitter Card link previews
- **Download Image** button and native mobile **Share** button (Web Share API) send the ad as an actual image file, not just a link — ideal for WhatsApp Status, Instagram Stories/Feed, or Facebook posts
- Instagram button copies a ready-made caption and downloads the image, since Instagram has no public web endpoint to prefill a post/story
- Zimbabwe local numbers (e.g. `0771629199`) are auto-converted to international WhatsApp format (`263771629199`)
- No database server required — stores data as JSON on a persistent disk
- 100% free to post, no accounts, no fees

## Stars & Rewards

Users can log in with just their WhatsApp number (no password) at `/login`. Logged-in users get a rewards dashboard at `/rewards` where they can:

- **Watch a house ad** (`/rewards/watch`) to earn 1 star, up to 5 stars/day per account. The ad slot is a placeholder — swap in a real network (AdMob, Facebook Audience Network) later; the timer + claim flow are already wired up.
- **Invite friends** with a personal invite link (`/login?invite=<code>`). The inviter earns 5 stars the first time their invitee posts an ad (prevents fake-signup farming).
- **Spend stars on feature unlocks**, applied automatically to the next ad the user posts while logged in:
  - Highlight Ad (badge + top-of-category, 7 days) — 20 stars
  - Extra Photos (10 instead of 5) — 10 stars
  - Top of Search Boost (48h) — 30 stars
  - Never Expire (skip auto-expiry) — 15 stars

All user/star/invite data lives in the same JSON file as ads (`db.json`, under a `users` array), so it follows the same persistence rules described below (needs a persistent disk on Render to survive redeploys).

## Local development

```bash
npm install
npm start
```

Visit http://localhost:3000

## Deploy to Render

This repo includes a `render.yaml` (Render "Blueprint"). Steps:

1. Push this repo to GitHub (already done if you're reading this on GitHub).
2. Go to https://dashboard.render.com/blueprints and click **New Blueprint Instance**.
3. Connect this repository. Render reads `render.yaml` automatically.
4. Click **Apply** — Render creates the web service on the **Free** plan.
5. Once deployed, your app is live at the `.onrender.com` URL Render gives you.

> **Free plan note:** Render's free web services don't support persistent disks,
> so posted ads and photos are stored on local disk and will be **wiped on
> every redeploy** (and possibly on restarts). This is fine for testing/demo.
> For ads to survive permanently, either:
> - Upgrade the Render service to a **paid plan** and add a persistent disk (uncomment the `disk:` block in `render.yaml`, mount at `/data`, and set `DATA_DIR=/data/db` + `UPLOAD_DIR=/data/uploads`), or
> - Point the app at an external database/storage (e.g. a free Postgres or S3-compatible bucket) instead of the local JSON file.

### Environment variables (optional)

| Variable | Default | Purpose |
|---|---|---|
| `SITE_NAME` | `Ntandomods Ads` | Site name shown in header/footer/title |
| `PORT` | `3000` | Port the app listens on (Render sets this automatically) |
| `DATA_DIR` | `./data` | Where the JSON "database" file is stored |
| `UPLOAD_DIR` | `./uploads` | Where uploaded ad photos are stored |

### Shareable ad images

Each ad has a generated PNG at `/ad/:id/image.png` (1080x1350, 4:5 — plays
well on WhatsApp Status, Instagram feed/Stories, and Facebook). It is built
with `sharp` + `qrcode` from the ad's first photo (or a branded gradient if
there is no photo), composited with the title, price, location, a
"Chat on WhatsApp" bar, and a QR code linking back to the ad. Generated
images are cached under `IMAGE_CACHE_DIR` (default `./cache/ad-images`) and
regenerated automatically if an ad is newer than its cached image.

| Variable | Default | Purpose |
|---|---|---|
| `IMAGE_CACHE_DIR` | `./cache/ad-images` | Where generated shareable ad-card PNGs are cached |

## Tech stack

- Node.js + Express
- EJS templates (server-rendered, fast, no build step)
- Multer for photo uploads
- Sharp + qrcode for generated shareable ad-card images
- Plain JSON file storage (no native DB dependencies — deploys cleanly anywhere)
