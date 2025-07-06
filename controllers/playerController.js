const axios = require('axios');
const db = require('../db');

function getAccessToken(cb) {
  db.get('SELECT access_token FROM tokens ORDER BY created_at DESC LIMIT 1', (err, row) => {
    if (err || !row) return cb(null);
    cb(row.access_token);
  });
}

exports.play = (req, res) => {
  const { uri } = req.body;
  if (!uri) return res.status(400).send('No track URI provided');
  getAccessToken(async token => {
    if (!token) return res.status(401).send('No access token');
    try {
      await axios.put(
        'https://api.spotify.com/v1/me/player/play',
        { uris: [uri] },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      res.send('Playback started');
    } catch (err) {
      res.status(500).send('Failed to start playback');
    }
  });
};

exports.stop = (req, res) => {
  getAccessToken(async token => {
    if (!token) return res.status(401).send('No access token');
    try {
      await axios.put(
        'https://api.spotify.com/v1/me/player/pause',
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      res.send('Playback stopped');
    } catch (err) {
      res.status(500).send('Failed to stop playback');
    }
  });
};

let devicesCache = [];

exports.getDevices = (req, res) => {
  getAccessToken(async token => {
    if (!token) return res.status(401).send('No access token');
    try {
      const response = await axios.get('https://api.spotify.com/v1/me/player/devices', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const devices = response.data.devices || [];
      devicesCache = devices; // Store in cache
      res.json(devices);
    } catch (err) {
      res.status(500).send('Failed to fetch devices');
    }
  });
};

exports.getPlaylists = (req, res) => {
  getAccessToken(async token => {
    if (!token) return res.status(401).send('No access token');
    try {
      const response = await axios.get('https://api.spotify.com/v1/me/playlists', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const playlists = response.data.items || [];
      playlists.forEach(playlist => {
        db.run(
          'INSERT OR REPLACE INTO playlists (playlist_id, name, owner, snapshot_id, total_tracks, context_uri, created_at) VALUES (?, ?, ?, ?, ?, ?, datetime("now"))',
          [playlist.id, playlist.name, playlist.owner.display_name, playlist.snapshot_id, playlist.tracks.total, playlist.uri],
          err => { /* ignore errors for now */ }
        );
      });
      res.json(playlists);
    } catch (err) {
      res.status(500).send('Failed to fetch playlists');
    }
  });
};

exports.playPlaylist = (req, res) => {
  const { playlist_id } = req.body;
  if (!playlist_id) return res.status(400).send('No playlist_id provided');
  db.get('SELECT context_uri FROM playlists WHERE playlist_id = ?', [playlist_id], (err, row) => {
    if (err || !row) return res.status(404).send('Playlist not found');
    getAccessToken(async token => {
      if (!token) return res.status(401).send('No access token');
      try {
        await axios.put(
          'https://api.spotify.com/v1/me/player/play',
          { context_uri: row.context_uri },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        res.send('Playlist playback started');
      } catch (err) {
        res.status(500).send('Failed to start playlist playback');
      }
    });
  });
};

exports.playContext = (req, res) => {
  const { context_uri } = req.body;
  if (!context_uri) return res.status(400).send('No context_uri provided');
  getAccessToken(async token => {
    if (!token) return res.status(401).send('No access token');
    try {
      await axios.put(
        'https://api.spotify.com/v1/me/player/play',
        { context_uri },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      res.send('Context playback started');
    } catch (err) {
      res.status(500).send('Failed to start context playback');
    }
  });
};

exports.getCurrentPlaying = (req, res) => {
  getAccessToken(async token => {
    if (!token) return res.status(401).send('No access token');
    try {
      const response = await axios.get('https://api.spotify.com/v1/me/player/currently-playing', {
        headers: { Authorization: `Bearer ${token}` }
      });
      res.json(response.data);
    } catch (err) {
      res.status(500).send('Failed to fetch currently playing song');
    }
  });
};

exports.searchTracks = (req, res) => {
  const { query } = req.query;
  if (!query) return res.status(400).send('No search query provided');
  getAccessToken(async token => {
    if (!token) return res.status(401).send('No access token');
    try {
      const response = await axios.get('https://api.spotify.com/v1/search', {
        headers: { Authorization: `Bearer ${token}` },
        params: { q: query, type: 'track', limit: 10 }
      });
      res.json(response.data.tracks.items);
    } catch (err) {
      res.status(500).send('Failed to search tracks');
    }
  });
};

exports.playSearchedTrack = (req, res) => {
  const { uri } = req.body;
  if (!uri) return res.status(400).send('No track URI provided');
  getAccessToken(async token => {
    if (!token) return res.status(401).send('No access token');
    try {
      await axios.put(
        'https://api.spotify.com/v1/me/player/play',
        { uris: [uri] },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      res.send('Searched track playback started');
    } catch (err) {
      res.status(500).send('Failed to start searched track playback');
    }
  });
}; 