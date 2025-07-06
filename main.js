const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const express = require('express');
const bodyParser = require('body-parser');
const authRoutes = require('./routes/authRoutes');
const playerRoutes = require('./routes/playerRoutes');
const fetch = require('node-fetch');

// Load environment variables
require('dotenv').config();

// Wake word detection imports
const { spawn } = require('child_process');
const os = require('os');

// Keep a global reference of the window object
let mainWindow;
let server;

// Wake word detection state
let wakeWordProcess = null;
let sttProcess = null;
let isWakeWordActive = false;
let isSTTActive = false;
let lastWakeWordTime = 0;
let wakeWordCooldown = 60000; // 1 minute cooldown in milliseconds

// Express app setup
const expressApp = express();
expressApp.use(bodyParser.json());
expressApp.use('/', authRoutes);
expressApp.use('/player', playerRoutes);
expressApp.use(express.static('public'));

expressApp.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

function createWindow() {
  // Check environment variables
  if (!process.env.SPOTIFY_CLIENT_ID || !process.env.SPOTIFY_CLIENT_SECRET || !process.env.SPOTIFY_REDIRECT_URI) {
    console.warn('Missing Spotify credentials in .env file');
    console.warn('Please create a .env file with:');
    console.warn('SPOTIFY_CLIENT_ID=your_spotify_client_id');
    console.warn('SPOTIFY_CLIENT_SECRET=your_spotify_client_secret');
    console.warn('SPOTIFY_REDIRECT_URI=http://localhost:8888/callback');
  }

  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, 'assets', 'icon.png'),
    title: 'Spotify Controller'
  });

  // Start the Express server
  const PORT = process.env.PORT || 8888;
  server = expressApp.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });

  // Load the app
  mainWindow.loadURL(`http://localhost:${PORT}`);

  // Open DevTools in development
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }

  // Handle window closed
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Start wake word detection
  startWakeWordDetection();
}

// Enhanced wake word detection system with 1-minute cooldown
function startWakeWordDetection() {
  console.log('Starting enhanced wake word detection system...');
  
  // Create enhanced Python script for wake word detection
  const wakeWordScript = `
import os
import sys
import time
import queue
import threading
import numpy as np
import sounddevice as sd
from collections import deque
import subprocess as sp
import openwakeword
from openwakeword.model import Model
from RealtimeSTT import AudioToTextRecorder
import json
import pyttsx3
import gc
import psutil

# Memory optimization settings
import resource
try:
    # Set memory limit (512MB)
    resource.setrlimit(resource.RLIMIT_AS, (512 * 1024 * 1024, -1))
except:
    pass  # Not available on Windows

# Force garbage collection at startup
gc.collect()

# Custom JSON encoder to handle numpy types
class NumpyEncoder(json.JSONEncoder):
    def default(self, obj):
        import numpy as np
        if isinstance(obj, np.integer):
            return int(obj)
        elif isinstance(obj, np.floating):
            return float(obj)
        elif isinstance(obj, np.ndarray):
            return obj.tolist()
        return super(NumpyEncoder, self).default(obj)

os.environ["TF_ENABLE_ONEDNN_OPTS"] = "0"

# Memory-optimized audio parameters
SR = 16000
CHUNK_DURATION_MS = 80  # Reduced for memory efficiency
CHUNK_SIZE = int(SR * CHUNK_DURATION_MS / 1000)
BLOCK_SIZE = CHUNK_SIZE

# Memory-optimized audio settings
DEVICE_INDEX = None
BUFFER_SIZE = 1024  # Reduced buffer size for memory efficiency
LATENCY = 'low'     # Low latency for real-time processing

# Optimized detection parameters
DETECTION_THRESHOLD = 0.6  # Higher threshold for better accuracy
POST_DETECT_COOLDOWN = 60.0  # 60 seconds cooldown (1 minute)
SMOOTHING_WINDOW = 5  # Reduced smoothing window for memory efficiency
VAD_THRESHOLD = 0.3   # Voice Activity Detection threshold

# Memory-optimized buffers and state
audio_queue = queue.Queue(maxsize=50)  # Reduced queue size
audio_buffer = np.zeros(0, dtype=np.float32)
last_detect_time = 0.0
last_log_time = 0.0
prediction_buffer = {}
wake_word_cooldown_active = False
cooldown_start_time = 0.0

# Speech-to-text state
stt_recorder = None
stt_active = False
tts_engine = None
stt_model_ready = False
speak_now_count = 0

# Initialize text-to-speech engine
def init_tts():
    try:
        engine = pyttsx3.init()
        engine.setProperty('rate', 150)
        engine.setProperty('volume', 0.8)
        return engine
    except Exception as e:
        print(f"Failed to initialize TTS: {e}")
        return None

# Text-to-speech function
def speak_text(text, engine=None):
    if engine is None:
        engine = init_tts()
    if engine:
        try:
            engine.say(text)
            engine.runAndWait()
        except Exception as e:
            print(f"TTS error: {e}")

# Initialize OpenWakeWord Model with memory optimization
print("Initializing memory-optimized OpenWakeWord model...")
try:
    # Check available memory
    process = psutil.Process()
    available_memory = psutil.virtual_memory().available / (1024 * 1024)
    print(f"Available memory: {available_memory:.1f} MB")
    
    if available_memory < 200:  # Less than 200MB available
        print("Warning: Low memory available. Model may fail to load.")
    
    # Force garbage collection before model initialization
    gc.collect()
    
    # Initialize without noise suppression to avoid dependency issues
    oww_model = Model(
        wakeword_models=["alexa"],
        enable_speex_noise_suppression=False,  # Disable noise suppression
        inference_framework='onnx',
        vad_threshold=VAD_THRESHOLD
    )
    print("Memory-optimized model initialized successfully")
    
    # Initialize prediction buffers for each model
    for model_name in oww_model.models:
        prediction_buffer[model_name] = deque(maxlen=SMOOTHING_WINDOW)
        print(f"   - {model_name} model ready")
    
    # Print memory usage
    memory_usage = process.memory_info().rss / 1024 / 1024
    print(f"Memory usage after model init: {memory_usage:.1f} MB")
        
except Exception as e:
    print(f"Failed to initialize model: {e}")
    print("This might be due to memory allocation issues.")
    print("Please ensure all dependencies are installed:")
    print("pip install -r requirements.txt")
    print("If the issue persists, try:")
    print("1. Close other applications to free memory")
    print("2. Restart the app")
    print("3. Check if you have enough RAM available")
    sys.exit(1)

# Enhanced print interception for better TTS timing
original_print = print
def custom_print(*args, **kwargs):
    message = ' '.join(str(arg) for arg in args)
    original_print(*args, **kwargs)
    
    global tts_engine, stt_model_ready, speak_now_count
    
    if "Model initialized" in message:
        if not stt_model_ready and tts_engine:
            stt_model_ready = True
            speak_text("Continue", tts_engine)
    elif "speak now" in message.lower():
        speak_now_count += 1
        if speak_now_count == 1 and not stt_model_ready and tts_engine:
            stt_model_ready = True
            speak_text("Continue", tts_engine)

print = custom_print

def start_speech_to_text():
    """Start real-time speech-to-text recording with enhanced settings"""
    global stt_recorder, stt_active, tts_engine, stt_model_ready, speak_now_count
    
    print("Starting enhanced speech-to-text recording...")
    stt_active = True
    stt_model_ready = False
    speak_now_count = 0
    
    # Initialize TTS if not already done
    if tts_engine is None:
        tts_engine = init_tts()
    
    # Initialize the recorder with enhanced settings
    stt_recorder = AudioToTextRecorder()
    
    def on_text(txt):
        if txt.strip():
            print(f"You said: {txt}")
            # Send to Electron via stdout
            result = {"type": "stt_text", "text": txt.strip()}
            print("ELECTRON_DATA:" + json.dumps(result, cls=NumpyEncoder))
            
            # Process voice command and provide TTS feedback
            process_voice_command_feedback_sync(txt.strip())
    
    # Start recording immediately
    stt_recorder.text(on_text)
    print("Enhanced speech-to-text started. Speak now...")

def stop_speech_to_text():
    """Stop real-time speech-to-text recording"""
    global stt_recorder, stt_active, tts_engine
    
    if stt_active and stt_recorder:
        print("Stopping speech-to-text recording...")
        try:
            stt_recorder.stop()
            stt_active = False
            stt_recorder = None
            print("Speech-to-text stopped.")
            
            if tts_engine:
                speak_text("Stopped", tts_engine)
        except Exception as e:
            print(f"Error stopping recorder: {e}")

# Enhanced voice command processing with AI agent
def process_voice_command_feedback_sync(command):
    global tts_engine
    
    print(f"Processing voice command: '{command}'")
    
    # Check for required environment variables
    gemini_key = os.environ.get("GEMINI_API_KEY")
    if not gemini_key:
        print("GEMINI_API_KEY not found in environment variables")
        print("Please set GEMINI_API_KEY in your .env file")
        return process_voice_command_fallback(command)
    
    # Try AI agent first
    try:
        import asyncio
        import sys
        import os
        
        # Add current directory to path for imports
        current_dir = os.path.dirname(os.path.abspath(__file__))
        if current_dir not in sys.path:
            sys.path.append(current_dir)
        
        # Import AI agent components
        print("Importing AI agent components...")
        from voice_command_processor import VoiceCommandProcessor
        
        print("Initializing AI voice agent...")
        processor = VoiceCommandProcessor()
        
        # Create new event loop for async operations
        try:
            loop = asyncio.get_event_loop()
        except RuntimeError:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
        
        # Process command through AI agent
        print("Executing AI agent pipeline...")
        result = loop.run_until_complete(processor.process_voice_command(command))
        
        print(f"AI Agent Result: {result}")
        
        # Provide TTS feedback based on AI result
        if tts_engine:
            if result.get("success"):
                response = result.get("response", "Command processed")
                speak_text(response, tts_engine)
                print(f"TTS Feedback: {response}")
            else:
                error_msg = result.get("response", "Sorry, I couldn't process that command")
                speak_text(error_msg, tts_engine)
                print(f"AI Agent Error: {error_msg}")
        
        return result
        
    except ImportError as e:
        print(f"AI Agent import error: {e}")
        print("Make sure all AI agent files are in the project directory")
        # Fallback to simple command processing
        return process_voice_command_fallback(command)
    except Exception as e:
        print(f"AI Agent error: {e}")
        import traceback
        traceback.print_exc()
        # Fallback to simple command processing
        return process_voice_command_fallback(command)

def process_voice_command_fallback(command):
    """Fallback voice command processing without AI agent"""
    global tts_engine
    
    print(f"Using fallback processing for: '{command}'")
    
    command_lower = command.lower()
    response = "Command received"
    
    if tts_engine:
        if any(word in command_lower for word in ['pause', 'stop']):
            response = "Pausing playback"
            speak_text(response, tts_engine)
        elif any(word in command_lower for word in ['play', 'start', 'resume']):
            response = "Playing music"
            speak_text(response, tts_engine)
        elif any(word in command_lower for word in ['next', 'skip']):
            response = "Skipping to next track"
            speak_text(response, tts_engine)
        elif any(word in command_lower for word in ['previous', 'back']):
            response = "Going to previous track"
            speak_text(response, tts_engine)
        elif 'volume' in command_lower:
            if 'up' in command_lower:
                response = "Increasing volume"
                speak_text(response, tts_engine)
            elif 'down' in command_lower:
                response = "Decreasing volume"
                speak_text(response, tts_engine)
        elif 'search' in command_lower:
            response = "Searching for music"
            speak_text(response, tts_engine)
        else:
            response = "Command received"
            speak_text(response, tts_engine)
    
    return {
        "success": True,
        "response": response,
        "action_taken": "fallback_processing",
        "tool_called": None
    }

# Enhanced worker thread for wake word detection
def worker():
    global last_detect_time, last_log_time, stt_active, wake_word_cooldown_active, cooldown_start_time
    
    while True:
        chunk = audio_queue.get()
        if chunk is None:
            break
        
        now = time.time()
        
        # Check for wake word cooldown period
        if wake_word_cooldown_active:
            if now - cooldown_start_time < POST_DETECT_COOLDOWN:
                # Still in cooldown, skip processing
                continue
            else:
                # Cooldown expired, resume detection
                wake_word_cooldown_active = False
                print("Wake word cooldown expired, resuming detection...")
        
        # Check for basic cooldown
        if now - last_detect_time < 2.0:  # 2-second basic cooldown
            continue
        
        try:
            # Enhanced audio processing
            if len(chunk) != CHUNK_SIZE:
                chunk = np.pad(chunk, (0, max(0, CHUNK_SIZE - len(chunk))), mode='constant')[:CHUNK_SIZE]
            
            audio_int16 = (chunk * 32767).astype(np.int16)
            preds = oww_model.predict(audio_int16)
            
            detected = False
            for name, score in preds.items():
                buf = prediction_buffer[name]
                buf.append(score)
                smoothed = np.mean(buf) if len(buf) >= SMOOTHING_WINDOW else score
                
                if smoothed >= DETECTION_THRESHOLD:
                    print(f"ENHANCED WAKE WORD DETECTED: '{name}' (score: {smoothed:.3f})")
                    last_detect_time = now
                    detected = True
                    
                    # Activate 1-minute cooldown
                    wake_word_cooldown_active = True
                    cooldown_start_time = now
                    print(f"1-minute cooldown activated until {time.strftime('%H:%M:%S', time.localtime(now + POST_DETECT_COOLDOWN))}")
                    
                    # Send detection to Electron
                    try:
                        result = {"type": "wake_word_detected", "word": name, "score": smoothed}
                        print("ELECTRON_DATA:" + json.dumps(result, cls=NumpyEncoder))
                    except Exception as e:
                        print(f"Error serializing wake word data: {e}")
                        result = {"type": "wake_word_detected", "word": str(name), "score": float(smoothed)}
                        print("ELECTRON_DATA:" + json.dumps(result))
                    
                    # Speak "activated" when wake word is detected
                    global tts_engine
                    if tts_engine is None:
                        tts_engine = init_tts()
                    if tts_engine:
                        speak_text("Activated", tts_engine)
                    
                    # Start speech-to-text if not already active
                    if not stt_active:
                        start_speech_to_text()
                    break
            
            # Enhanced status logging with memory cleanup
            if not detected and now - last_log_time > 10:  # Log every 10 seconds
                if preds:
                    best = max(preds, key=preds.get)
                    status = f"Listening... Best: '{best}' ({float(preds[best]):.3f})"
                    if stt_active:
                        status += " | STT Active"
                    if wake_word_cooldown_active:
                        remaining = POST_DETECT_COOLDOWN - (now - cooldown_start_time)
                        status += f" | Cooldown: {remaining:.0f}s"
                    print(status)
                else:
                    status = "Listening..."
                    if stt_active:
                        status += " | STT Active"
                    if wake_word_cooldown_active:
                        remaining = POST_DETECT_COOLDOWN - (now - cooldown_start_time)
                        status += f" | Cooldown: {remaining:.0f}s"
                    print(status)
                
                # Periodic memory cleanup
                if now % 60 < 1:  # Every minute
                    gc.collect()
                    process = psutil.Process()
                    print(f"Memory usage: {process.memory_info().rss / 1024 / 1024:.1f} MB")
                
                last_log_time = now
                
        except Exception as e:
            print(f"Error in processing: {e}")
            # Force garbage collection on error
            gc.collect()
            continue

# Start worker thread
worker_thread = threading.Thread(target=worker, daemon=True)
worker_thread.start()

# Enhanced audio callback
def audio_callback(indata, frames, time_info, status):
    global audio_buffer
    if status:
        print(f"Stream status: {status}")
    
    mono = indata[:, 0] if indata.ndim > 1 else indata
    audio_buffer = np.concatenate([audio_buffer, mono])
    
    while len(audio_buffer) >= CHUNK_SIZE:
        chunk = audio_buffer[:CHUNK_SIZE].copy()
        audio_buffer = audio_buffer[CHUNK_SIZE:]
        try:
            audio_queue.put_nowait(chunk)
        except queue.Full:
            # Drop oldest chunk if queue is full
            try:
                audio_queue.get_nowait()
                audio_queue.put_nowait(chunk)
            except:
                pass

# Enhanced main loop
def main():
    print("Starting enhanced wake word detection with 1-minute cooldown...")
    print("Instructions:")
    print("   - Say 'Alexa' to activate voice control")
    print("   - After activation, 1-minute cooldown prevents false triggers")
    print("   - Speak your command clearly")
    print("   - Press Ctrl+C to exit")
    
    try:
        # Enhanced device selection
        dev = DEVICE_INDEX if DEVICE_INDEX is not None else sd.default.device[0]
        info = sd.query_devices(dev)
        print(f"Using audio device: {info['name']}")
        
        # Enhanced stream settings
        with sd.InputStream(samplerate=SR, channels=1, blocksize=BUFFER_SIZE,
                             dtype=np.float32, device=dev,
                             callback=audio_callback, latency=LATENCY):
            print("Enhanced stream started. Say 'Alexa' to begin!")
            
            while True:
                time.sleep(0.1)
                
    except KeyboardInterrupt:
        print("\\nStopped by user.")
    except Exception as e:
        print(f"Stream error: {e}")
    finally:
        # Cleanup
        if stt_active:
            stop_speech_to_text()
        
        audio_queue.put(None)
        worker_thread.join(timeout=1.0)
        print("Enhanced shutdown complete")

if __name__ == '__main__':
    main()
`;

  // Write the Python script to a temporary file
  const fs = require('fs');
  const tempDir = os.tmpdir();
  const scriptPath = path.join(tempDir, 'wake_word_detector.py');
  
  fs.writeFileSync(scriptPath, wakeWordScript);
  console.log(`Enhanced wake word script written to: ${scriptPath}`);

  // Start the Python process with enhanced settings and memory optimization
  wakeWordProcess = spawn('python', [scriptPath], {
    stdio: ['pipe', 'pipe', 'pipe'],
    windowsHide: false,
    env: { 
      ...process.env, 
      PYTHONUNBUFFERED: '1',
      PYTHONMALLOC: 'malloc',
      PYTHONDEVMODE: '1',
      PYTHONHASHSEED: '0',
      PYTHONIOENCODING: 'utf-8'
    }
  });

  isWakeWordActive = true;

  // Enhanced process error handling
  wakeWordProcess.on('error', (error) => {
    console.error('Failed to start wake word detection:', error.message);
    console.log('This might be due to memory allocation issues.');
    console.log('Make sure Python and required packages are installed:');
    console.log('pip install -r requirements.txt');
    console.log('If the issue persists, try:');
    console.log('1. Close other applications to free memory');
    console.log('2. Restart the app');
    console.log('3. Check if you have enough RAM available');
    console.log('4. The app will continue without wake word detection');
    isWakeWordActive = false;
  });

  // Enhanced stdout handling
  wakeWordProcess.stdout.on('data', (data) => {
    const output = data.toString();
    
    const lines = output.split('\n');
    lines.forEach(line => {
      if (line.startsWith('ELECTRON_DATA:')) {
        try {
          const jsonData = line.replace('ELECTRON_DATA:', '');
          const result = JSON.parse(jsonData);
          handleWakeWordEvent(result);
        } catch (error) {
          console.error('Error parsing wake word data:', error);
        }
      } else if (line.trim()) {
        console.log(`[Wake Word] ${line.trim()}`);
      }
    });
  });

  // Enhanced stderr handling
  wakeWordProcess.stderr.on('data', (data) => {
    console.error(`[Wake Word Error] ${data.toString()}`);
  });

  // Enhanced process exit handling
  wakeWordProcess.on('close', (code) => {
    console.log(`Wake word process exited with code ${code}`);
    isWakeWordActive = false;
  });

  console.log('Enhanced wake word detection started with 1-minute cooldown');
}

function handleWakeWordEvent(event) {
  console.log('Wake word event:', event);
  
  // Check if we're in cooldown period
  const now = Date.now();
  if (now - lastWakeWordTime < wakeWordCooldown) {
    console.log(`Ignoring wake word during cooldown period (${Math.round((wakeWordCooldown - (now - lastWakeWordTime)) / 1000)}s remaining)`);
    return;
  }
  
  switch (event.type) {
    case 'wake_word_detected':
      console.log(`Wake word detected: ${event.word} (score: ${event.score})`);
      lastWakeWordTime = now;
      
      // Send to renderer process
      if (mainWindow) {
        mainWindow.webContents.send('wake-word-detected', {
          word: event.word,
          score: event.score,
          cooldownActive: true,
          cooldownEndTime: now + wakeWordCooldown
        });
      }
      break;
      
    case 'stt_text':
      console.log(`STT Text: ${event.text}`);
      // Send to renderer process
      if (mainWindow) {
        mainWindow.webContents.send('stt-text', {
          text: event.text
        });
      }
      break;
      
    default:
      console.log('Unknown wake word event type:', event.type);
  }
}

function stopWakeWordDetection() {
  if (wakeWordProcess) {
    console.log('🛑 Stopping wake word detection...');
    wakeWordProcess.kill('SIGINT');
    wakeWordProcess = null;
    isWakeWordActive = false;
  }
}

// IPC handlers for communication between main and renderer processes
ipcMain.handle('spotify-login', async () => {
  // Check if environment variables are set
  if (!process.env.SPOTIFY_CLIENT_ID || !process.env.SPOTIFY_CLIENT_SECRET || !process.env.SPOTIFY_REDIRECT_URI) {
    return { 
      success: false, 
      message: 'Missing Spotify credentials. Please create a .env file with SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET, and SPOTIFY_REDIRECT_URI' 
    };
  }

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
  
  // Open auth URL in default browser
  await shell.openExternal(authUrl);
  
  return { success: true, message: 'Opened Spotify login in browser' };
});

ipcMain.handle('get-devices', async () => {
  try {
    const response = await fetch('http://localhost:8888/player/devices');
    return await response.json();
  } catch (error) {
    return { error: 'Failed to fetch devices' };
  }
});

ipcMain.handle('get-current-playing', async () => {
  try {
    const response = await fetch('http://localhost:8888/player/current');
    return await response.json();
  } catch (error) {
    return { error: 'Failed to fetch current playing' };
  }
});

ipcMain.handle('pause-playback', async () => {
  try {
    const response = await fetch('http://localhost:8888/player/stop', {
      method: 'POST'
    });
    return { success: true };
  } catch (error) {
    return { error: 'Failed to pause playback' };
  }
});

ipcMain.handle('search-tracks', async (event, query) => {
  try {
    const response = await fetch(`http://localhost:8888/player/search?query=${encodeURIComponent(query)}`);
    return await response.json();
  } catch (error) {
    return { error: 'Failed to search tracks' };
  }
});

ipcMain.handle('play-track', async (event, uri) => {
  try {
    const response = await fetch('http://localhost:8888/player/play/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uri })
    });
    return { success: true };
  } catch (error) {
    return { error: 'Failed to play track' };
  }
});

ipcMain.handle('get-playlists', async () => {
  try {
    const response = await fetch('http://localhost:8888/player/playlists');
    return await response.json();
  } catch (error) {
    return { error: 'Failed to fetch playlists' };
  }
});

ipcMain.handle('play-playlist', async (event, playlistId) => {
  try {
    const response = await fetch('http://localhost:8888/player/play/playlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playlist_id: playlistId })
    });
    return { success: true };
  } catch (error) {
    return { error: 'Failed to play playlist' };
  }
});

// Enhanced wake word control IPC handlers
ipcMain.handle('start-wake-word', () => {
  if (!isWakeWordActive) {
    startWakeWordDetection();
    return { success: true, message: 'Enhanced wake word detection started with 1-minute cooldown' };
  }
  return { success: false, message: 'Wake word detection already active' };
});

ipcMain.handle('stop-wake-word', () => {
  stopWakeWordDetection();
  return { success: true, message: 'Wake word detection stopped' };
});

ipcMain.handle('get-wake-word-status', () => {
  const now = Date.now();
  const cooldownRemaining = Math.max(0, wakeWordCooldown - (now - lastWakeWordTime));
  
  return { 
    isActive: isWakeWordActive,
    isSTTActive: isSTTActive,
    cooldownActive: cooldownRemaining > 0,
    cooldownRemaining: Math.round(cooldownRemaining / 1000)
  };
});

// App event handlers
app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  // On macOS, keep the app running even when all windows are closed
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On macOS, re-create a window when dock icon is clicked
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on('before-quit', () => {
  // Clean up server and wake word detection when app is quitting
  if (server) {
    server.close();
  }
  stopWakeWordDetection();
});

// Security: Prevent new window creation
app.on('web-contents-created', (event, contents) => {
  contents.on('new-window', (event, navigationUrl) => {
    event.preventDefault();
    shell.openExternal(navigationUrl);
  });
});

// Add missing IPC handler for opening external URLs
ipcMain.handle('open-external', async (event, url) => {
  await shell.openExternal(url);
  return { success: true };
}); 