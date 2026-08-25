require('dotenv').config();
const express = require('express');
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

const adsRouter = require('./routes/ads');
app.use('/', adsRouter);

app.use((req, res) => {
  res.status(404).render('404', {
    site: { name: process.env.SITE_NAME || 'Ntandomods Ads', developer: 'Ntandomods ZW', contact: '263771629199' }
  });
});

app.listen(PORT, () => {
  console.log(`Ntandomods Ads app running on port ${PORT}`);
});
