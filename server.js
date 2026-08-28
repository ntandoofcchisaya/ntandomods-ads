require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(UPLOAD_DIR));

app.use(session({
  secret: process.env.SESSION_SECRET || 'ntandomods-ads-dev-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 90 * 24 * 3600 * 1000 } // 90 days
}));

// Makes the logged-in user (if any) available to every view as `currentUser`.
const User = require('./models/User');
const { makeT, SUPPORTED, LANG_NAMES } = require('./models/i18n');
const countryList = require('./models/countries');
app.use((req, res, next) => {
  res.locals.currentUser = req.session.userId ? User.findById(req.session.userId) : null;

  // Language: ?lang=xx wins and is remembered in the session; else fall back
  // to whatever was picked before, else English.
  if (req.query.lang && SUPPORTED.includes(req.query.lang)) {
    req.session.lang = req.query.lang;
  }
  const lang = req.session.lang || 'en';
  res.locals.lang = lang;
  res.locals.t = makeT(lang);
  res.locals.SUPPORTED_LANGS = SUPPORTED;
  res.locals.LANG_NAMES = LANG_NAMES;

  // "City, Country" display helper — falls back to the old free-text
  // `location` field for ads created before country/city existed.
  res.locals.displayLocation = (ad) => {
    if (ad.city || ad.country) {
      const countryName = countryList.find(c => c.code === ad.country)?.name || ad.country || '';
      return [ad.city, countryName].filter(Boolean).join(', ');
    }
    return ad.location || '';
  };

  // "USD 12,000 (negotiable)" or "Price on request" when no price was set.
  res.locals.displayPrice = (ad) => {
    if (!ad.price) return 'Price on request';
    const amount = `${ad.currency} ${ad.price.toLocaleString()}`;
    return ad.negotiable ? `${amount} (negotiable)` : amount;
  };

  next();
});

const adsRouter = require('./routes/ads');
const rewardsRouter = require('./routes/rewards');
app.use('/', adsRouter);
app.use('/', rewardsRouter);

app.use((req, res) => {
  res.status(404).render('404', {
    site: { name: process.env.SITE_NAME || 'Ntandomods Ads', developer: 'Ntandomods ZW', contact: '263771629199' }
  });
});

const { connectDb, closeDb } = require('./models/db');

let server;
connectDb()
  .then(() => {
    server = app.listen(PORT, () => {
      console.log(`Ntandomods Ads app running on port ${PORT}`);
    });
  })
  .catch(err => {
    console.error('Failed to connect to MongoDB, server not started:', err);
    process.exit(1);
  });

// Give in-flight MongoDB writes a chance to finish before the process exits
// (Render sends SIGTERM before redeploys/restarts).
async function shutdown() {
  console.log('Shutting down, flushing pending writes...');
  try {
    await closeDb();
  } catch (err) {
    console.error('Error while closing DB:', err);
  }
  if (server) server.close(() => process.exit(0));
  else process.exit(0);
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
