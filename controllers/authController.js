const axios = require('axios');
const db = require('../db');

exports.login = (req, res) => {
  const scopes = [
    'user-read-playback-state',
    'user-modify-playback-state',
    'user-read-currently-playing',
    'streaming'
  ];
  const authUrl =
    'https://accounts.spotify.com/authorize' +
    '?response_type=code' +
    `&client_id=${process.env.SPOTIFY_CLIENT_ID}` +
    `&scope=${encodeURIComponent(scopes.join(' '))}` +
    `&redirect_uri=${encodeURIComponent(process.env.SPOTIFY_REDIRECT_URI)}`;
  res.redirect(authUrl);
};

exports.callback = async (req, res) => {
  const code = req.query.code || null;
  if (!code) return res.status(400).send('No code provided');

  try {
    const tokenRes = await axios.post(
      'https://accounts.spotify.com/api/token',
      new URLSearchParams({
        code,
        redirect_uri: process.env.SPOTIFY_REDIRECT_URI,
        grant_type: 'authorization_code',
        client_id: process.env.SPOTIFY_CLIENT_ID,
        client_secret: process.env.SPOTIFY_CLIENT_SECRET
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );
    const { access_token, refresh_token, expires_in } = tokenRes.data;
    db.run(
      'INSERT INTO tokens (access_token, refresh_token, expires_in, created_at) VALUES (?, ?, ?, datetime("now"))',
      [access_token, refresh_token, expires_in],
      err => {
        if (err) return res.status(500).send('DB error');
        res.send('Authentication successful! You can close this window.');
      }
    );
  } catch (err) {
    res.status(500).send('Token exchange failed');
  }
}; 