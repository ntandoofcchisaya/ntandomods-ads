// Simple JSON-file database. No native modules, works anywhere (incl. Render free tier).
// NOTE: Render's free/starter disks are ephemeral on redeploy unless a persistent disk
// is attached. We attach one via render.yaml so data survives restarts & deploys.
const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

function ensureDb() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify({ ads: [], categories: DEFAULT_CATEGORIES }, null, 2));
  }
}

const DEFAULT_CATEGORIES = [
  'Vehicles', 'Property', 'Electronics', 'Phones & Tablets', 'Fashion',
  'Home & Garden', 'Jobs', 'Services', 'Agriculture', 'Furniture', 'Other'
];

function readDb() {
  ensureDb();
  const raw = fs.readFileSync(DB_FILE, 'utf-8');
  try {
    return JSON.parse(raw);
  } catch (e) {
    return { ads: [], categories: DEFAULT_CATEGORIES };
  }
}

function writeDb(data) {
  ensureDb();
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

module.exports = { readDb, writeDb, DATA_DIR, DEFAULT_CATEGORIES };
