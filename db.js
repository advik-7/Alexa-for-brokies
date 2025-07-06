const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('.spotify_tokens.db');

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    access_token TEXT,
    refresh_token TEXT,
    expires_in INTEGER,
    created_at TEXT
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS devices (
    device_id TEXT PRIMARY KEY,
    name TEXT,
    type TEXT,
    is_active INTEGER,
    created_at TEXT
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS playlists (
    playlist_id TEXT PRIMARY KEY,
    name TEXT,
    owner TEXT,
    snapshot_id TEXT,
    total_tracks INTEGER,
    context_uri TEXT,
    created_at TEXT
  )`);
});

module.exports = db; 