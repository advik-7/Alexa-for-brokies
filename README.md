# Spotify Controller - Electron App

A beautiful, modern Electron desktop application for controlling Spotify playback with a sleek interface and secure IPC communication.

## ✨ Features

- 🖥️ **Desktop App** - Native desktop experience with Electron
- 🎙️ **Voice Control** - Wake word detection with "Alexa" trigger
- 🗣️ **Real-time STT** - Speech-to-text for voice commands
- 🤖 **AI Voice Agent** - Intelligent voice command processing with Gemini
- 🔧 **Tool Calling** - Smart tool selection (pause, play, search)
- 🔊 **Text-to-Speech** - Audio feedback for voice interactions
- 🔐 **Secure Authentication** - Spotify OAuth with proper security
- 🎵 **Playback Control** - Play, pause, and control your music
- 📱 **Device Management** - View and manage your Spotify devices
- 🔍 **Search & Play** - Search for songs and play them instantly
- 📋 **Playlist Management** - Fetch and play your playlists
- 🎼 **Real-time Updates** - See what's currently playing with auto-refresh
- 💾 **Local Storage** - Store playlists and tokens in SQLite database
- 🎨 **Modern UI** - Beautiful gradient design with smooth animations

## 🛠️ Tech Stack

- **Desktop Framework**: Electron
- **Backend**: Node.js, Express.js
- **Database**: SQLite3
- **Frontend**: HTML5, CSS3, Vanilla JavaScript
- **Voice Processing**: Python, OpenWakeWord, RealtimeSTT, pyttsx3
- **Authentication**: Spotify OAuth 2.0
- **API**: Spotify Web API
- **IPC**: Secure inter-process communication

## 🚀 Quick Start

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- Python 3.8 or higher
- pip (Python package manager)
- Spotify Developer Account
- Google Gemini API Key (for AI voice agent)

### Installation

1. **Clone and navigate to the project**
   ```bash
   cd sportify
   ```

2. **Install Node.js dependencies**
   ```bash
   npm install
   ```

3. **Install Python dependencies**
   ```bash
   pip install -r requirements.txt
   ```

4. **Set up Spotify App**
   - Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
   - Create a new app
   - Add `http://localhost:8888/callback` to Redirect URIs
   - Copy your Client ID and Client Secret

5. **Set up Gemini API**
   - Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
   - Create a new API key
   - Copy your Gemini API key

6. **Configure environment variables**
   Create a `.env` file in the project directory:
   ```env
   SPOTIFY_CLIENT_ID=your_spotify_client_id
   SPOTIFY_CLIENT_SECRET=your_spotify_client_secret
   SPOTIFY_REDIRECT_URI=http://localhost:8888/callback
   GEMINI_API_KEY=your_gemini_api_key
   ```
   
   **Important**: Replace `your_spotify_client_id` and `your_spotify_client_secret` with your actual Spotify app credentials from the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard).

7. **Test the AI Agent (Optional)**
   ```bash
   python test_ai_agent_simple.py
   ```

8. **Start the Electron app**
   ```bash
   npm start
   ```

9. **For development with DevTools**
   ```bash
   npm run dev
   ```

## 📦 Building the App

### Development Build
```bash
npm run pack
```

### Production Build
```bash
npm run dist
```

This will create distributable packages for your platform:
- **Windows**: `.exe` installer
- **macOS**: `.dmg` file
- **Linux**: `.AppImage` file

## 🎯 Usage

### Desktop Interface
The Electron app provides a beautiful desktop interface with:

- **Voice Control Panel**: Wake word detection and voice commands
- **Login Section**: One-click Spotify authentication
- **Devices Panel**: View and refresh your Spotify devices
- **Current Song**: See what's playing with album art and controls
- **Search Panel**: Search for songs and play them directly
- **Playlists Panel**: Browse and play your playlists

### Features
- **Auto-refresh**: Current song updates every 10 seconds
- **Error Handling**: Graceful error messages and status updates
- **Responsive Design**: Works on different window sizes
- **Modern UI**: Smooth animations and beautiful gradients

## 🔧 Architecture

### Main Process (`main.js`)
- Manages the Electron window
- Handles IPC communication
- Runs the Express server
- Manages app lifecycle

### Preload Script (`preload.js`)
- Safely exposes APIs to renderer
- Maintains security through context isolation
- Provides clean API interface

### Renderer Process (`public/index.html`)
- Beautiful UI with modern design
- Communicates with main process via IPC
- Handles user interactions
- Displays real-time data

### Backend (`app.js`, `controllers/`, `routes/`)
- Express server for Spotify API communication
- SQLite database for local storage
- OAuth authentication flow
- Playback control endpoints

## 📁 Project Structure

```
sportify/
├── main.js                 # Main Electron process
├── preload.js              # Preload script for IPC
├── app.js                  # Express server setup
├── db.js                   # SQLite database setup
├── package.json            # Dependencies and scripts
├── .env                    # Environment variables (create this)
├── .gitignore             # Git ignore file
├── README.md              # This file
├── controllers/           # Business logic
│   ├── authController.js
│   └── playerController.js
├── routes/                # Route definitions
│   ├── authRoutes.js
│   └── playerRoutes.js
├── public/               # Frontend files
│   └── index.html       # Electron renderer UI
└── assets/              # App icons and resources
    ├── icon.png
    ├── icon.ico
    └── icon.icns
```

## 🔒 Security Features

- **Context Isolation**: Renderer process cannot access Node.js APIs directly
- **Preload Script**: Safely exposes only necessary APIs
- **IPC Communication**: Secure inter-process communication
- **No Node Integration**: Renderer runs in isolated context
- **External Links**: Opens in default browser, not in app

## 🎨 UI Features

- **Modern Design**: Gradient backgrounds and glass morphism
- **Responsive Layout**: Grid-based responsive design
- **Smooth Animations**: Hover effects and transitions
- **Status Messages**: Clear feedback for all actions
- **Loading States**: Visual feedback during operations
- **Error Handling**: User-friendly error messages

## 🔧 Development

### Adding New Features
1. Add IPC handlers in `main.js`
2. Expose APIs in `preload.js`
3. Update UI in `public/index.html`
4. Add backend endpoints if needed

### Debugging
- Use `npm run dev` for development with DevTools
- Check console for errors
- Monitor IPC communication in DevTools

## 📝 API Endpoints

### Authentication
- `GET /login` - Redirect to Spotify OAuth
- `GET /callback` - Handle OAuth callback

### Player Control
- `GET /player/devices` - Get available devices
- `GET /player/current` - Get currently playing track
- `POST /player/play` - Play a specific track
- `POST /player/stop` - Pause playback
- `GET /player/search` - Search for tracks
- `POST /player/play/search` - Play a searched track

### Playlists
- `GET /player/playlists` - Get user's playlists
- `POST /player/play/playlist` - Play a playlist
- `POST /player/play/context` - Play album/artist

## 🐛 Troubleshooting

### Common Issues

1. **App won't start**
   - Check if all dependencies are installed: `npm install`
   - Verify `.env` file exists with correct credentials
   - Check console for error messages

2. **Spotify login fails**
   - Verify Spotify app credentials in `.env`
   - Check redirect URI matches Spotify app settings
   - Ensure callback URL is accessible

3. **Playback not working**
   - Check if Spotify is running on an active device
   - Verify access token is valid
   - Check network connectivity

4. **AI Agent not working**
   - Verify `GEMINI_API_KEY` is set in `.env`
   - Check Python dependencies: `pip install -r requirements.txt`
   - Test AI agent separately: `python test_ai_agent_simple.py`
   - Check console logs for detailed error messages

5. **Voice commands not working**
   - Ensure microphone permissions are granted
   - Check if wake word detection is active
   - Verify TTS is working (should hear "Activated" when wake word detected)
   - Check console for AI agent logs

6. **Build errors**
   - Run `npm run postinstall` to rebuild native dependencies
   - Check Node.js version compatibility
   - Clear `node_modules` and reinstall

### Debugging

The app includes comprehensive logging for debugging:

- **Wake Word Detection**: Logs detection scores and cooldown status
- **AI Agent**: Detailed logs of voice command processing
- **Spotify Tools**: HTTP requests and responses
- **TTS**: Text-to-speech feedback
- **Fallback Processing**: When AI agent fails

Check the console output for detailed logs with emojis for easy identification.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Spotify Web API](https://developer.spotify.com/documentation/web-api/)
- [Electron](https://www.electronjs.org/)
- [Express.js](https://expressjs.com/)
- [SQLite3](https://www.sqlite.org/) 