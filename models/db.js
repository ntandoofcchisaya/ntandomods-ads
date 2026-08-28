// Data layer, backed by MongoDB.
//
// The rest of the app (Ad.js, User.js, routes/ads.js) was written against a
// synchronous "whole blob in memory" API: readDb() returns { ads, categories,
// users } instantly, callers mutate it in place, then writeDb(db) is called.
// To avoid touching every call site, we keep that exact shape: the full
// document is cached in memory (loaded once at boot from Mongo) and every
// writeDb() call updates the cache immediately (so subsequent readDb() calls
// in the same request see the change right away) and persists to MongoDB
// in the background.
//
// This means Mongo is the durable store (survives Render redeploys/restarts)
// while the in-app behaviour stays byte-for-byte the same as the old
// JSON-file version.
const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.MONGODB_DB_NAME || 'ntandomods_ads';
const COLLECTION = 'store';
const DOC_ID = 'main';

const DEFAULT_CATEGORIES = [
  'Vehicles', 'Property', 'Electronics', 'Phones & Tablets', 'Fashion',
  'Home & Garden', 'Jobs', 'Services', 'Agriculture', 'Furniture', 'Other'
];

let cache = null;          // in-memory copy of { ads, categories, users }
let collection = null;     // MongoDB collection handle
let client = null;
let saveQueue = Promise.resolve(); // serializes writes so they land in order

function freshDoc() {
  return { ads: [], categories: DEFAULT_CATEGORIES, users: [] };
}

// Must be called once at server startup, before the app starts handling
// requests. Connects to MongoDB and loads (or creates) the single store
// document into the in-memory cache.
async function connectDb() {
  if (!MONGODB_URI) {
    throw new Error(
      'MONGODB_URI is not set. Add it as an environment variable (see .env.example).'
    );
  }
  client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db(DB_NAME);
  collection = db.collection(COLLECTION);

  const existing = await collection.findOne({ _id: DOC_ID });
  if (existing) {
    const { _id, ...data } = existing;
    cache = {
      ads: data.ads || [],
      categories: data.categories || DEFAULT_CATEGORIES,
      users: data.users || [],
    };
  } else {
    cache = freshDoc();
    await collection.insertOne({ _id: DOC_ID, ...cache });
  }

  console.log(`Connected to MongoDB (${DB_NAME}.${COLLECTION})`);
  return cache;
}

function ensureReady() {
  if (!cache) {
    throw new Error('Database not initialized yet — connectDb() must be awaited before use.');
  }
}

// Synchronous read of the in-memory cache (unchanged call sites rely on this).
function readDb() {
  ensureReady();
  return cache;
}

// Updates the in-memory cache immediately and schedules a durable save to
// MongoDB. Save calls are queued so concurrent writes can't race each other
// and overwrite one another out of order.
function writeDb(data) {
  ensureReady();
  cache = data;
  const snapshot = JSON.parse(JSON.stringify(cache));
  saveQueue = saveQueue
    .then(() => collection.replaceOne({ _id: DOC_ID }, { _id: DOC_ID, ...snapshot }, { upsert: true }))
    .catch(err => console.error('MongoDB save failed:', err));
  return saveQueue;
}

// Lets the server wait for any in-flight saves to finish before exiting
// (used on graceful shutdown).
function flush() {
  return saveQueue;
}

async function closeDb() {
  await flush();
  if (client) await client.close();
}

module.exports = { connectDb, readDb, writeDb, flush, closeDb, DEFAULT_CATEGORIES };
