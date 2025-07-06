const express = require('express');
const router = express.Router();
const playerController = require('../controllers/playerController');

router.post('/play', playerController.play);
router.post('/stop', playerController.stop);
router.get('/devices', playerController.getDevices);
router.get('/playlists', playerController.getPlaylists);
router.post('/play/playlist', playerController.playPlaylist);
router.post('/play/context', playerController.playContext);
router.get('/current', playerController.getCurrentPlaying);
router.get('/search', playerController.searchTracks);
router.post('/play/search', playerController.playSearchedTrack);

module.exports = router; 