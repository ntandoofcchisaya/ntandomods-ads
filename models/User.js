// User accounts, keyed by WhatsApp number. No password — the number itself
// is the login (matches the rest of the app, which is WhatsApp-first).
const { v4: uuidv4 } = require('uuid');
const { readDb, writeDb } = require('./db');
const { normalizeWhatsapp } = require('./Ad');

const STAR_RULES = {
  DAILY_AD_WATCH_CAP: 5,     // max stars/day from watching ads
  STARS_PER_AD_WATCH: 1,
  STARS_PER_REFERRAL: 5,     // paid out to inviter once invitee posts their first ad
};

// Feature catalog: id -> { name, cost, description }
const FEATURES = {
  highlight: { name: 'Highlight Ad', cost: 20, description: 'Badge + top-of-category placement for 7 days.' },
  extra_photos: { name: 'Extra Photos (10 total)', cost: 10, description: 'Allows up to 10 photos instead of 5 on your next ad.' },
  top_boost: { name: 'Top of Search Boost (48h)', cost: 30, description: 'Ad appears at the very top of search & browse for 48 hours.' },
  no_expiry: { name: 'Never Expire', cost: 15, description: 'Removes auto-expiry from one ad — stays listed indefinitely.' },
};

function ensureUsersDb() {
  const db = readDb();
  if (!db.users) db.users = [];
  return db;
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function generateInviteCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function findByWhatsapp(number) {
  const wa = normalizeWhatsapp(number);
  const db = ensureUsersDb();
  return db.users.find(u => u.whatsapp === wa);
}

function findByInviteCode(code) {
  const db = ensureUsersDb();
  return db.users.find(u => u.inviteCode === code);
}

function findById(id) {
  const db = ensureUsersDb();
  return db.users.find(u => u.id === id);
}

// Creates the account if it doesn't exist yet, or returns the existing one.
// `invitedByCode` is the referrer's invite code, only recorded on first creation.
function findOrCreate(number, invitedByCode) {
  const wa = normalizeWhatsapp(number);
  let user = findByWhatsapp(wa);
  if (user) return user;

  const db = ensureUsersDb();
  const referrer = invitedByCode ? db.users.find(u => u.inviteCode === invitedByCode) : null;

  user = {
    id: uuidv4(),
    whatsapp: wa,
    inviteCode: generateInviteCode(),
    stars: 0,
    invitedBy: referrer ? referrer.id : null,
    referralRewarded: false, // flips true once referrer is paid for this user's first ad
    unlockedFeatures: [],    // [{ featureId, adId|null, unlockedAt, expiresAt|null }]
    adWatch: { date: todayStr(), count: 0 },
    createdAt: new Date().toISOString(),
  };
  db.users.push(user);
  writeDb(db);
  return user;
}

function saveUser(user) {
  const db = ensureUsersDb();
  const idx = db.users.findIndex(u => u.id === user.id);
  if (idx >= 0) db.users[idx] = user;
  else db.users.push(user);
  writeDb(db);
  return user;
}

function addStars(userId, amount) {
  const db = ensureUsersDb();
  const user = db.users.find(u => u.id === userId);
  if (!user) return null;
  user.stars = (user.stars || 0) + amount;
  writeDb(db);
  return user;
}

// Returns { ok, remainingToday } — enforces the daily ad-watch cap.
function recordAdWatch(userId) {
  const db = ensureUsersDb();
  const user = db.users.find(u => u.id === userId);
  if (!user) return { ok: false, remainingToday: 0 };

  const today = todayStr();
  if (!user.adWatch || user.adWatch.date !== today) {
    user.adWatch = { date: today, count: 0 };
  }
  if (user.adWatch.count >= STAR_RULES.DAILY_AD_WATCH_CAP) {
    writeDb(db);
    return { ok: false, remainingToday: 0 };
  }
  user.adWatch.count += 1;
  user.stars = (user.stars || 0) + STAR_RULES.STARS_PER_AD_WATCH;
  writeDb(db);
  return { ok: true, remainingToday: STAR_RULES.DAILY_AD_WATCH_CAP - user.adWatch.count };
}

// Called the first time an invited user posts an ad. Pays the referrer once.
function rewardReferrerIfEligible(userId) {
  const db = ensureUsersDb();
  const user = db.users.find(u => u.id === userId);
  if (!user || !user.invitedBy || user.referralRewarded) return;
  const referrer = db.users.find(u => u.id === user.invitedBy);
  if (!referrer) return;
  referrer.stars = (referrer.stars || 0) + STAR_RULES.STARS_PER_REFERRAL;
  user.referralRewarded = true;
  writeDb(db);
}

function unlockFeature(userId, featureId, adId) {
  const feature = FEATURES[featureId];
  if (!feature) return { ok: false, error: 'Unknown feature.' };
  const db = ensureUsersDb();
  const user = db.users.find(u => u.id === userId);
  if (!user) return { ok: false, error: 'User not found.' };
  if ((user.stars || 0) < feature.cost) {
    return { ok: false, error: `Not enough stars. Need ${feature.cost}, you have ${user.stars || 0}.` };
  }
  user.stars -= feature.cost;
  const unlock = {
    featureId,
    adId: adId || null,
    unlockedAt: new Date().toISOString(),
    expiresAt: featureId === 'top_boost'
      ? new Date(Date.now() + 48 * 3600 * 1000).toISOString()
      : (featureId === 'highlight' ? new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString() : null),
  };
  user.unlockedFeatures.push(unlock);
  writeDb(db);
  return { ok: true, user, unlock };
}

function hasActiveFeature(user, featureId, adId) {
  if (!user || !user.unlockedFeatures) return false;
  const now = Date.now();
  return user.unlockedFeatures.some(u =>
    u.featureId === featureId &&
    (adId ? u.adId === adId : true) &&
    (!u.expiresAt || new Date(u.expiresAt).getTime() > now)
  );
}

function getReferralCount(userId) {
  const db = ensureUsersDb();
  return db.users.filter(u => u.invitedBy === userId).length;
}

module.exports = {
  FEATURES,
  STAR_RULES,
  findByWhatsapp,
  findByInviteCode,
  findById,
  findOrCreate,
  saveUser,
  addStars,
  recordAdWatch,
  rewardReferrerIfEligible,
  unlockFeature,
  hasActiveFeature,
  getReferralCount,
};
