const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Spotify authentication
  spotifyLogin: () => ipcRenderer.invoke('spotify-login'),
  
  // Device management
  getDevices: () => ipcRenderer.invoke('get-devices'),
  
  // Playback control
  getCurrentPlaying: () => ipcRenderer.invoke('get-current-playing'),
  pausePlayback: () => ipcRenderer.invoke('pause-playback'),
  
  // Search and play
  searchTracks: (query) => ipcRenderer.invoke('search-tracks', query),
  playTrack: (uri) => ipcRenderer.invoke('play-track', uri),
  
  // Playlist management
  getPlaylists: () => ipcRenderer.invoke('get-playlists'),
  playPlaylist: (playlistId) => ipcRenderer.invoke('play-playlist', playlistId),
  
  // Wake word control
  startWakeWord: () => ipcRenderer.invoke('start-wake-word'),
  stopWakeWord: () => ipcRenderer.invoke('stop-wake-word'),
  getWakeWordStatus: () => ipcRenderer.invoke('get-wake-word-status'),
  
  // Utility functions
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  
  // Event listeners for real-time updates
  onCurrentPlayingUpdate: (callback) => {
    ipcRenderer.on('current-playing-update', callback);
  },
  
  onDeviceUpdate: (callback) => {
    ipcRenderer.on('device-update', callback);
  },
  
  // Wake word event listeners
  onWakeWordDetected: (callback) => {
    ipcRenderer.on('wake-word-detected', callback);
  },
  
  onSTTText: (callback) => {
    ipcRenderer.on('stt-text', callback);
  },
  
  // Remove event listeners
  removeAllListeners: (channel) => {
    ipcRenderer.removeAllListeners(channel);
  }
}); 