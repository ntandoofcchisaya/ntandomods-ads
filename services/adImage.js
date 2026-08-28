// Generates a shareable "ad card" PNG for an ad — a poster combining the
// listing photo, title, price, location, WhatsApp contact and a QR code
// linking back to the ad. Designed to look good when shared to WhatsApp
// Status, Instagram Stories/Feed, Facebook, or downloaded and sent as a
// plain image attachment.
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const QRCode = require('qrcode');

const CARD_W = 1080;
const CARD_H = 1350; // 4:5 — plays nicely on IG feed & WhatsApp Status

const BRAND_MARK_PATH = path.join(__dirname, '..', 'public', 'img', 'brand-mark-96.png');
const BRAND_MARK_SIZE = 60; // rendered size (px) in the top brand bar

function escapeXml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Wrap text into multiple <tspan> lines that fit within maxCharsPerLine.
function wrapLines(text, maxCharsPerLine, maxLines) {
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? current + ' ' + word : word;
    if (candidate.length > maxCharsPerLine && current) {
      lines.push(current);
      current = word;
      if (lines.length === maxLines) break;
    } else {
      current = candidate;
    }
  }
  if (current && lines.length < maxLines) lines.push(current);
  if (lines.length === maxLines) {
    const last = lines[maxLines - 1];
    if (last.length > maxCharsPerLine - 1) {
      lines[maxLines - 1] = last.slice(0, maxCharsPerLine - 1).trim() + '…';
    }
  }
  return lines;
}

async function generateAdImage({ ad, site, shareUrl, uploadDir }) {
  // Background: first ad photo, cropped/blurred to fill the card, or a
  // brand-colored gradient fallback when there is no photo.
  let background;
  const firstImage = (ad.images || [])[0];
  if (firstImage) {
    const imgPath = path.join(uploadDir, path.basename(firstImage));
    if (fs.existsSync(imgPath)) {
      background = await sharp(imgPath)
        .resize(CARD_W, CARD_H, { fit: 'cover' })
        .toBuffer();
    }
  }
  if (!background) {
    background = await sharp({
      create: { width: CARD_W, height: CARD_H, channels: 4, background: { r: 22, g: 163, b: 74, alpha: 1 } }
    }).png().toBuffer();
  }

  // Dark gradient overlay so text stays legible over any photo.
  const overlaySvg = `
    <svg width="${CARD_W}" height="${CARD_H}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#000000" stop-opacity="0.55"/>
          <stop offset="35%" stop-color="#000000" stop-opacity="0.05"/>
          <stop offset="62%" stop-color="#000000" stop-opacity="0.15"/>
          <stop offset="100%" stop-color="#000000" stop-opacity="0.92"/>
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#fade)"/>
    </svg>`;

  // QR code -> data URI PNG buffer for compositing.
  const qrBuffer = await QRCode.toBuffer(shareUrl, {
    width: 220,
    margin: 1,
    color: { dark: '#14181f', light: '#ffffffff' }
  });
  const qrRounded = await sharp(qrBuffer)
    .extend({ top: 14, bottom: 14, left: 14, right: 14, background: '#ffffff' })
    .toBuffer();

  // Brand mark (logo) shown in the top-left of the card, replacing the old
  // plain green circle. Falls back to no logo if the asset is missing.
  let brandMarkBuffer = null;
  if (fs.existsSync(BRAND_MARK_PATH)) {
    brandMarkBuffer = await sharp(BRAND_MARK_PATH)
      .resize(BRAND_MARK_SIZE, BRAND_MARK_SIZE)
      .toBuffer();
  }

  const priceText = ad.price ? `${ad.currency || 'USD'} ${Number(ad.price).toLocaleString()}` : '';
  const titleLines = wrapLines(ad.title, 22, 3);
  const catLabel = escapeXml(ad.category || 'Ad');
  const locLabel = escapeXml(ad.location || 'Zimbabwe');

  const TITLE_LINE_HEIGHT = 62;
  const titleTspans = titleLines
    .map((line, i) => `<tspan x="60" dy="${i === 0 ? 0 : TITLE_LINE_HEIGHT}">${escapeXml(line)}</tspan>`)
    .join('');

  // Anchor everything from the bottom CTA bar upward so extra title lines
  // push the block up instead of overlapping the price/location lines.
  const locBaselineY = CARD_H - 160;
  const priceBaselineY = priceText ? locBaselineY - 56 : locBaselineY;
  const titleLastLineY = priceBaselineY - 60;
  const titleFirstLineY = titleLastLineY - TITLE_LINE_HEIGHT * (titleLines.length - 1);

  const foregroundSvg = `
    <svg width="${CARD_W}" height="${CARD_H}" xmlns="http://www.w3.org/2000/svg">
      <style>
        .brand { font: 700 30px 'Poppins', Arial, sans-serif; fill: #ffffff; }
        .cat { font: 600 26px 'Poppins', Arial, sans-serif; fill: #ffffff; }
        .title { font: 800 54px 'Poppins', Arial, sans-serif; fill: #ffffff; }
        .price { font: 700 46px 'Poppins', Arial, sans-serif; fill: #7CFFA0; }
        .loc { font: 500 28px 'Poppins', Arial, sans-serif; fill: #e5e7eb; }
        .cta { font: 700 32px 'Poppins', Arial, sans-serif; fill: #0b1b12; }
        .qrlabel { font: 600 22px 'Poppins', Arial, sans-serif; fill: #14181f; }
      </style>

      <!-- top brand bar -->
      <rect x="0" y="0" width="${CARD_W}" height="96" fill="rgba(0,0,0,0.35)"/>
      <text x="${18 + BRAND_MARK_SIZE + 14}" y="58" class="brand">${escapeXml(site.name)}</text>
      <rect x="${CARD_W - 190}" y="26" width="140" height="44" rx="22" fill="#16a34a"/>
      <text x="${CARD_W - 120}" y="55" text-anchor="middle" class="cat" style="font-size:22px;">${catLabel}</text>

      <!-- title / price / location block -->
      <text x="60" y="${titleFirstLineY}" class="title">${titleTspans}</text>
      ${priceText ? `<text x="60" y="${priceBaselineY}" class="price">${escapeXml(priceText)}</text>` : ''}
      <circle cx="66" cy="${locBaselineY - 8}" r="7" fill="#e5e7eb"/>
      <text x="84" y="${locBaselineY}" class="loc">${locLabel}</text>

      <!-- bottom CTA bar -->
      <rect x="0" y="${CARD_H - 130}" width="${CARD_W}" height="130" fill="#16a34a"/>
      <text x="60" y="${CARD_H - 60}" class="cta">Chat on WhatsApp</text>
      <text x="60" y="${CARD_H - 24}" class="loc" style="fill:#eafff0; font-size:24px;">wa.me/${escapeXml(ad.whatsapp)}</text>

      <!-- QR card -->
      <rect x="${CARD_W - 268}" y="${CARD_H - 268}" width="220" height="220" rx="16" fill="#ffffff"/>
    </svg>`;

  const layers = [
    { input: Buffer.from(overlaySvg) },
    { input: Buffer.from(foregroundSvg) },
    { input: qrRounded, left: CARD_W - 258, top: CARD_H - 258 }
  ];
  if (brandMarkBuffer) {
    layers.push({ input: brandMarkBuffer, left: 18, top: Math.round((96 - BRAND_MARK_SIZE) / 2) });
  }

  const composite = await sharp(background)
    .composite(layers)
    .png({ quality: 90 })
    .toBuffer();

  return composite;
}

module.exports = { generateAdImage, CARD_W, CARD_H };
