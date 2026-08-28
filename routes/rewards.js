const express = require('express');
const router = express.Router();
const User = require('../models/User');
const countries = require('../models/countries');

const SITE = {
  name: process.env.SITE_NAME || 'Ntandomods Ads',
  developer: 'Ntandomods ZW',
  contact: '263771629199',
};

function requireLogin(req, res, next) {
  if (!req.session.userId) return res.redirect('/login?next=' + encodeURIComponent(req.originalUrl));
  next();
}

// --- Login / "sign up" (same thing — just enter your WhatsApp number) ---

router.get('/login', (req, res) => {
  res.render('login', { site: SITE, countries, error: null, next: req.query.next || '/rewards', invite: req.query.invite || '' });
});

router.post('/login', (req, res) => {
  const { whatsapp, invite, country } = req.body;
  if (!whatsapp || !whatsapp.trim()) {
    return res.render('login', { site: SITE, countries, error: 'Enter your WhatsApp number.', next: req.body.next || '/rewards', invite: invite || '' });
  }
  const user = User.findOrCreate(whatsapp, invite, country);
  req.session.userId = user.id;
  res.redirect(req.body.next || '/rewards');
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

// --- Rewards dashboard ---

router.get('/rewards', requireLogin, (req, res) => {
  const user = User.findById(req.session.userId);
  const referralCount = User.getReferralCount(user.id);
  const inviteUrl = `${req.protocol}://${req.get('host')}/login?invite=${user.inviteCode}`;
  res.render('rewards', {
    site: SITE,
    user,
    referralCount,
    inviteUrl,
    features: User.FEATURES,
    starRules: User.STAR_RULES,
    message: req.query.msg || null,
    error: req.query.err || null,
  });
});

// --- Watch-ad-for-stars ---

router.get('/rewards/watch', requireLogin, (req, res) => {
  res.render('watch-ad', { site: SITE, user: req.session.userId && require('../models/User').findById(req.session.userId) });
});

router.post('/rewards/watch/claim', requireLogin, (req, res) => {
  const result = User.recordAdWatch(req.session.userId);
  if (!result.ok) {
    return res.redirect('/rewards?err=' + encodeURIComponent("You've hit today's ad-watch limit. Come back tomorrow for more stars."));
  }
  res.redirect('/rewards?msg=' + encodeURIComponent(`+1 star! (${result.remainingToday} more watches available today)`));
});

// --- Unlock a feature with stars ---

router.post('/rewards/unlock/:featureId', requireLogin, (req, res) => {
  const { featureId } = req.params;
  const { adId } = req.body;
  const result = User.unlockFeature(req.session.userId, featureId, adId);
  if (!result.ok) {
    return res.redirect('/rewards?err=' + encodeURIComponent(result.error));
  }
  const feature = User.FEATURES[featureId];
  res.redirect('/rewards?msg=' + encodeURIComponent(`Unlocked: ${feature.name}!`));
});

module.exports = router;
module.exports.requireLogin = requireLogin;
