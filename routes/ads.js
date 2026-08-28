const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const router = express.Router();
const Ad = require('../models/Ad');
const { readDb } = require('../models/db');
const { generateAdImage } = require('../services/adImage');

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// Where generated shareable ad-card images are cached. Cheap to regenerate,
// so this can live on ephemeral disk even on Render's free tier.
const IMAGE_CACHE_DIR = process.env.IMAGE_CACHE_DIR || path.join(__dirname, '..', 'cache', 'ad-images');
if (!fs.existsSync(IMAGE_CACHE_DIR)) fs.mkdirSync(IMAGE_CACHE_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, Date.now() + '-' + Math.round(Math.random() * 1e9) + ext);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024, files: 5 },
  fileFilter: (req, file, cb) => {
    if (/^image\/(jpeg|png|webp|gif)$/.test(file.mimetype)) cb(null, true);
    else cb(new Error('Only image files are allowed'));
  }
});

const SITE = {
  name: process.env.SITE_NAME || 'Ntandomods Ads',
  developer: 'Ntandomods ZW',
  contact: '263771629199',
};

router.get('/', (req, res) => {
  const { category, search } = req.query;
  const ads = Ad.getAllAds({ category, search });
  const { categories } = readDb();
  res.render('index', { ads, categories, category: category || 'All', search: search || '', site: SITE });
});

router.get('/post', (req, res) => {
  const { categories } = readDb();
  res.render('post', { categories, site: SITE, error: null });
});

router.post('/post', upload.array('images', 5), (req, res) => {
  const { categories } = readDb();
  try {
    const { title, description, price, currency, category, location, whatsapp } = req.body;
    if (!title || !description || !whatsapp) {
      return res.render('post', { categories, site: SITE, error: 'Title, description and WhatsApp number are required.' });
    }
    const images = (req.files || []).map(f => '/uploads/' + f.filename);
    const ad = Ad.createAd({ title, description, price, currency, category, location, whatsapp, images });
    res.redirect('/ad/' + ad.id + '?posted=1');
  } catch (err) {
    res.render('post', { categories, site: SITE, error: err.message });
  }
});

router.get('/ad/:id', (req, res) => {
  const ad = Ad.getAdById(req.params.id);
  if (!ad) return res.status(404).render('404', { site: SITE });
  Ad.incrementViews(ad.id);
  const shareUrl = `${req.protocol}://${req.get('host')}/ad/${ad.id}`;
  res.render('ad', { ad, site: SITE, shareUrl, posted: req.query.posted === '1' });
});

// Serves (and lazily caches) a shareable PNG "ad card" for the given ad.
// This is what the Share/Download Image button, native mobile share sheet,
// and Instagram fallback flow all point at.
router.get('/ad/:id/image.png', async (req, res) => {
  const ad = Ad.getAdById(req.params.id);
  if (!ad) return res.status(404).send('Not found');

  const cacheFile = path.join(IMAGE_CACHE_DIR, `${ad.id}.png`);
  try {
    const fresh = fs.existsSync(cacheFile) &&
      fs.statSync(cacheFile).mtimeMs > new Date(ad.createdAt).getTime();
    if (!fresh) {
      const shareUrl = `${req.protocol}://${req.get('host')}/ad/${ad.id}`;
      const buffer = await generateAdImage({ ad, site: SITE, shareUrl, uploadDir: UPLOAD_DIR });
      fs.writeFileSync(cacheFile, buffer);
    }
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.setHeader('Content-Disposition', `inline; filename="${ad.id}.png"`);
    fs.createReadStream(cacheFile).pipe(res);
  } catch (err) {
    console.error('Failed to generate ad image:', err);
    res.status(500).send('Could not generate image');
  }
});

router.post('/ad/:id/delete', (req, res) => {
  // Simple owner-less delete via secret query param could be added later; for now admin-only via contact.
  Ad.deleteAd(req.params.id);
  res.redirect('/');
});

module.exports = router;
