const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const DB_URL = process.env.FIREBASE_DB_URL;
const MAIN_SITE = process.env.MAIN_SITE_URL || 'https://fren.netlify.app';

// ── QR SCAN ENDPOINT ──────────────────────────────────────────
// This is the URL printed on every flyer QR code
// When scanned → logs country/city → redirects to main site
app.get('/scan', async (req, res) => {
  try {
    const ip =
      req.headers['x-forwarded-for']?.split(',')[0].trim() ||
      req.socket.remoteAddress;

    // Get location from IP
    const geoRes = await fetch(`https://ipinfo.io/${ip}/json`);
    const geo = await geoRes.json();

    const scanData = {
      country: geo.country || 'Unknown',
      countryName: geo.country || 'Unknown',
      city: geo.city || 'Unknown',
      region: geo.region || 'Unknown',
      timestamp: new Date().toISOString(),
      ref: req.query.ref || 'flyer',
    };

    // Save to Firebase
    await fetch(`${DB_URL}/scans.json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(scanData),
    });

    // Redirect user to main site
    res.redirect(MAIN_SITE);
  } catch (err) {
    console.error('Scan error:', err);
    res.redirect(MAIN_SITE);
  }
});

// ── STATS ENDPOINT ────────────────────────────────────────────
// Frontend calls this to get scan data for the world map
app.get('/api/stats', async (req, res) => {
  try {
    const response = await fetch(`${DB_URL}/scans.json`);
    const data = await response.json();

    if (!data) return res.json({ total: 0, countries: {}, recent: [] });

    const scans = Object.values(data);
    const countries = {};

    scans.forEach((scan) => {
      const c = scan.country || 'Unknown';
      if (!countries[c]) countries[c] = { count: 0, cities: [] };
      countries[c].count++;
      if (scan.city && !countries[c].cities.includes(scan.city)) {
        countries[c].cities.push(scan.city);
      }
    });

    res.json({
      total: scans.length,
      countries,
      recent: scans.slice(-5).reverse(),
    });
  } catch (err) {
    console.error('Stats error:', err);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// ── HEALTH CHECK ──────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({ status: 'fren backend is live 🤝' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`$FREN backend running on port ${PORT}`));