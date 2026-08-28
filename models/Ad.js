const { v4: uuidv4 } = require('uuid');
const { readDb, writeDb } = require('./db');

function normalizeWhatsapp(number) {
  // Strip anything that isn't a digit or leading +
  let n = (number || '').trim().replace(/[^\d+]/g, '');
  if (n.startsWith('+')) n = n.slice(1);
  if (n.startsWith('0')) {
    // Assume Zimbabwe local format 0771234567 -> 263771234567
    n = '263' + n.slice(1);
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
    category: data.category || 'Other',
    location: data.location ? data.location.trim() : '',
    whatsapp: normalizeWhatsapp(data.whatsapp),
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

function getAllAds({ category, search } = {}) {
  const db = readDb();
  let ads = db.ads.filter(a => a.status === 'active');
  if (category && category !== 'All') {
    ads = ads.filter(a => a.category === category);
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
