const { v4: uuidv4 } = require('uuid');
const { readDb, writeDb } = require('./db');
const { parsePhoneNumberFromString } = require('libphonenumber-js');

// Turns a number + an explicit ISO country (e.g. "ZW", "KE", "GB") into
// WhatsApp's required international format (digits only, no +).
// Falls back to a Zimbabwe-shaped guess ONLY if no country was given at all,
// to avoid breaking any old data/links created before country selection existed.
function normalizeWhatsapp(number, country) {
  let raw = (number || '').trim();
  if (country) {
    const parsed = parsePhoneNumberFromString(raw, country);
    if (parsed && parsed.isValid()) {
      return parsed.number.replace('+', '');
    }
  }
  // No country given, or parsing failed — best-effort cleanup of what we got.
  let n = raw.replace(/[^\d+]/g, '');
  if (n.startsWith('+')) return n.slice(1);
  if (n.startsWith('0')) {
    // Old behaviour, kept only as a last-resort fallback.
    return '263' + n.slice(1);
  }
  return n;
}

function createAd(data) {
  const db = readDb();
  const ad = {
    id: uuidv4(),
    title: data.title.trim(),
    description: data.description.trim(),
    price: data.price ? Number(data.price) : null,
    currency: data.currency || 'USD',
    negotiable: !!data.negotiable,
    category: data.category || 'Other',
    country: data.country || '',            // ISO 3166-1 alpha-2, e.g. "ZW", "KE", "GB"
    city: data.city ? data.city.trim() : '',
    location: data.location ? data.location.trim() : '', // legacy free-text, kept for old ads
    whatsapp: normalizeWhatsapp(data.whatsapp, data.country),
    images: data.images || [],
    createdAt: new Date().toISOString(),
    views: 0,
    status: 'active',
    // Reward-unlocked perks (all optional, set when the poster spent stars on them):
    highlighted: data.highlighted || false,          // badge + top-of-category
    boostedUntil: data.boostedUntil || null,          // ISO timestamp, top-of-search while active
    neverExpires: data.neverExpires || false          // skips any future auto-expiry logic
  };
  db.ads.unshift(ad);
  writeDb(db);
  return ad;
}

function getAllAds({ category, search, country } = {}) {
  const db = readDb();
  let ads = db.ads.filter(a => a.status === 'active');
  if (category && category !== 'All') {
    ads = ads.filter(a => a.category === category);
  }
  if (country && country !== 'All') {
    ads = ads.filter(a => a.country === country);
  }
  if (search) {
    const q = search.toLowerCase();
    ads = ads.filter(a =>
      a.title.toLowerCase().includes(q) ||
      a.description.toLowerCase().includes(q) ||
      a.location.toLowerCase().includes(q)
    );
  }
  // Boosted (top_boost, while active) and highlighted ads float to the top,
  // most-recent first within each tier.
  const now = Date.now();
  const rank = (a) => {
    const boosted = a.boostedUntil && new Date(a.boostedUntil).getTime() > now;
    if (boosted) return 0;
    if (a.highlighted) return 1;
    return 2;
  };
  ads = ads.slice().sort((a, b) => {
    const ra = rank(a), rb = rank(b);
    if (ra !== rb) return ra - rb;
    return new Date(b.createdAt) - new Date(a.createdAt);
  });
  return ads;
}

function getAdById(id) {
  const db = readDb();
  return db.ads.find(a => a.id === id);
}

function incrementViews(id) {
  const db = readDb();
  const ad = db.ads.find(a => a.id === id);
  if (ad) {
    ad.views = (ad.views || 0) + 1;
    writeDb(db);
  }
}

function deleteAd(id) {
  const db = readDb();
  db.ads = db.ads.filter(a => a.id !== id);
  writeDb(db);
}

module.exports = { createAd, getAllAds, getAdById, incrementViews, deleteAd, normalizeWhatsapp };
