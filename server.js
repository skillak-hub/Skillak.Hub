require('dotenv').config();
const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const STATIC_DIR = __dirname;

app.use(express.json({ limit: '1mb' }));
app.use(express.static(STATIC_DIR, { extensions: ['html'] }));

// Always prefer refresh token (gives fresh token every call — never expires).
// Falls back to static access token only if no refresh credentials are configured.
async function getGoogleAccessToken() {
  const refreshToken = (process.env.GOOGLE_REFRESH_TOKEN  || '').trim();
  const clientId     = (process.env.GOOGLE_CLIENT_ID      || '').trim();
  const clientSecret = (process.env.GOOGLE_CLIENT_SECRET  || '').trim();

  if (refreshToken && clientId && clientSecret) {
    const tokenResp = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id:     clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type:    'refresh_token',
      }),
    });
    const tokenJson = await tokenResp.json();
    if (!tokenResp.ok) {
      throw new Error(tokenJson.error_description || tokenJson.error || 'Failed to refresh Google token');
    }
    console.log('[Skillak] Got fresh Google access token via refresh_token ✅');
    return tokenJson.access_token;
  }

  // Last resort: static access token (expires in ~1 hour)
  const directToken = (process.env.GOOGLE_MEET_ACCESS_TOKEN || '').trim();
  if (directToken) {
    console.warn('[Skillak] Using static GOOGLE_MEET_ACCESS_TOKEN — will expire. Set GOOGLE_REFRESH_TOKEN for auto-renewal.');
    return directToken;
  }

  throw new Error('Missing Google credentials in .env — set GOOGLE_REFRESH_TOKEN + GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET');
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'skillak-hub' });
});

app.post('/api/meet/create', async (req, res) => {
  try {
    const token = await getGoogleAccessToken();
    // Google Meet API v2 only accepts an empty body for space creation.
    // All Skillak metadata is stored in Firestore, not forwarded to Google.
    const response = await fetch('https://meet.googleapis.com/v2/spaces', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: '{}',
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error('[/api/meet/create] Google API error:', data);
      return res.status(response.status).json({
        ok: false,
        error: data?.error?.message || data?.message || 'Google Meet create failed',
        details: data,
      });
    }

    console.log('[/api/meet/create] Created:', data.meetingUri);
    res.json({
      ok: true,
      spaceName:   data.name        || '',
      meetingUri:  data.meetingUri  || '',
      meetingCode: data.meetingCode || '',
      createdAtMs: Date.now(),
      expiresAtMs: Date.now() + 60 * 60 * 1000,
      raw: data,
    });
  } catch (error) {
    console.error('[/api/meet/create]', error.message);
    res.status(500).json({ ok: false, error: error.message });
  }
});

app.post('/api/meet/end', async (req, res) => {
  try {
    const spaceName = String(req.body?.spaceName || '').trim();
    if (!spaceName) return res.status(400).json({ ok: false, error: 'spaceName is required' });

    const token = await getGoogleAccessToken();
    const response = await fetch(`https://meet.googleapis.com/v2/${spaceName}:endActiveConference`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: '{}',
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      return res.status(response.status).json({
        ok: false,
        error: data?.error?.message || data?.message || 'Google Meet end failed',
        details: data,
      });
    }

    res.json({ ok: true });
  } catch (error) {
    console.error('[/api/meet/end]', error.message);
    res.status(500).json({ ok: false, error: error.message });
  }
});


/* ── Image Proxy — forwards Google Drive / external images to avoid CORS ── */
app.get('/api/img-proxy', async (req, res) => {
  const url = String(req.query.url || '').trim();
  if (!url) return res.status(400).send('url param required');

  // Only allow safe domains
  const allowed = [
    'drive.google.com', 'lh3.googleusercontent.com', 'lh4.googleusercontent.com',
    'lh5.googleusercontent.com', 'lh6.googleusercontent.com',
    'firebasestorage.googleapis.com', 'storage.googleapis.com',
    'dropboxusercontent.com', 'dl.dropboxusercontent.com'
  ];
  let hostname = '';
  try { hostname = new URL(url).hostname; } catch(_) {}
  const ok = allowed.some(d => hostname === d || hostname.endsWith('.' + d));
  if (!ok) return res.status(403).send('domain not allowed');

  try {
    const imgRes = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://drive.google.com/',
        'Accept': 'image/*,*/*;q=0.8',
      },
      redirect: 'follow',
    });
    if (!imgRes.ok) return res.status(imgRes.status).send('upstream error');

    const ct = imgRes.headers.get('content-type') || 'image/jpeg';
    const buf = await imgRes.arrayBuffer();
    res.set({
      'Content-Type': ct,
      'Cache-Control': 'public, max-age=3600',
      'Access-Control-Allow-Origin': '*',
    });
    res.send(Buffer.from(buf));
  } catch(e) {
    res.status(502).send('proxy fetch failed: ' + e.message);
  }
});
app.get('*', (_req, res) => {
  res.sendFile(path.join(STATIC_DIR, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Skillak Hub running on http://localhost:${PORT}`);
});
