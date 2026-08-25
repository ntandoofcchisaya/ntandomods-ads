# Ntandomods Ads

A free classifieds/ads app. Anyone can post an ad with photos and a WhatsApp
number. Buyers view the ad and tap **Chat on WhatsApp** to message the seller
directly. Every ad has one-tap sharing to WhatsApp, Facebook, and Instagram.

Developed by **Ntandomods ZW**. Contact: **263771629199** (WhatsApp).

## Features

- Post free ads: title, description, price, category, location, photos (up to 5), WhatsApp number
- Browse & search ads by keyword and category
- Ad detail page with image gallery, "Chat on WhatsApp" button (prefilled message), and share buttons (WhatsApp / Facebook / Instagram / copy link)
- Zimbabwe local numbers (e.g. `0771629199`) are auto-converted to international WhatsApp format (`263771629199`)
- No database server required — stores data as JSON on a persistent disk
- 100% free to post, no accounts, no fees

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

## Tech stack

- Node.js + Express
- EJS templates (server-rendered, fast, no build step)
- Multer for photo uploads
- Plain JSON file storage (no native DB dependencies — deploys cleanly anywhere)
