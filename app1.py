import os
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

os.environ["TF_ENABLE_ONEDNN_OPTS"] = "0"

_orig_popen = sp.Popen

def _patched_popen(*args, **kwargs):
    kwargs.setdefault("stdin", sp.DEVNULL)
    return _orig_popen(*args, **kwargs)
sp.Popen = _patched_popen

# === Ensure pretrained ONNX models are present ===
print("🔄 Checking and downloading OpenWakeWord models if needed...")
try:
    # This will download models into resources/models if missing
    openwakeword.utils.download_models()
    print("✅ Model files are in place.")
except Exception as e:
    print(f"⚠️ download_models() warning: {e}")

# === Initialize OpenWakeWord Model ===
print("🔄 Initializing OpenWakeWord model...")
try:
    oww_model = Model(
        wakeword_models=["alexa"],
        enable_speex_noise_suppression=False,
        inference_framework='onnx',
        vad_threshold=0.2
    )
    print("✅ Model initialized. Available wake words:")
    for name in oww_model.models:
        print(f"   - {name}")
except Exception as e:
    print(f"❌ Failed to initialize model: {e}")
    print("💡 Please ensure openwakeword v0.6.0+ and onnxruntime are installed.")
    exit(1)

# === Audio parameters ===
SR = 16000
CHUNK_DURATION_MS = 80
CHUNK_SIZE = int(SR * CHUNK_DURATION_MS / 1000)
BLOCK_SIZE = CHUNK_SIZE
DEVICE_INDEX = None

# Detection parameters
DETECTION_THRESHOLD = 0.5
POST_DETECT_COOLDOWN = 2.0
SMOOTHING_WINDOW = 5

# Buffers
audio_queue = queue.Queue()
audio_buffer = np.zeros(0, dtype=np.float32)
last_detect_time = 0.0
last_log_time = 0.0
prediction_buffer = {m: deque(maxlen=SMOOTHING_WINDOW) for m in oww_model.models}

# Speech-to-text state
stt_recorder = None
stt_active = False

def start_speech_to_text():
    """Start real-time speech-to-text recording immediately"""
    global stt_recorder, stt_active
    
    print("🎤 Starting speech-to-text recording IMMEDIATELY...")
    stt_active = True
    
    # Initialize the recorder
    stt_recorder = AudioToTextRecorder()
    
    def on_text(txt):
        if txt.strip():  # Only print non-empty text
            print(f"🗣️ You said: {txt}")
    
    # Start recording immediately
    stt_recorder.text(on_text)
    print("✅ Speech-to-text started. Speak now...")

def stop_speech_to_text():
    """Stop real-time speech-to-text recording"""
    global stt_recorder, stt_active
    
    if stt_active and stt_recorder:
        print("🛑 Stopping speech-to-text recording...")
        try:
            stt_recorder.stop()
            stt_active = False
            stt_recorder = None
            print("✅ Speech-to-text stopped.")
        except Exception as e:
            print(f"⚠️ Error stopping recorder: {e}")

# Worker thread for wake word detection
def worker():
    global last_detect_time, last_log_time, stt_active
    
    while True:
        chunk = audio_queue.get()
        if chunk is None:
            break
        
        now = time.time()
        
        # Check for wake word detection
        if now - last_detect_time < POST_DETECT_COOLDOWN:
            continue
        
        try:
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
                    print(f"🎯 WAKE WORD DETECTED: '{name}' (score: {smoothed:.3f})")
                    last_detect_time = now
                    detected = True
                    
                    # Start speech-to-text IMMEDIATELY if not already active
                    if not stt_active:
                        start_speech_to_text()
                    break
            
            # Log status if not detected and enough time has passed
            if not detected and now - last_log_time > 5:
                if preds:
                    best = max(preds, key=preds.get)
                    status = f"👂 Listening... Best: '{best}' ({preds[best]:.3f})"
                    if stt_active:
                        status += " | 🎤 STT Active"
                    print(status)
                else:
                    status = "👂 Listening..."
                    if stt_active:
                        status += " | 🎤 STT Active"
                    print(status)
                last_log_time = now
                
        except Exception as e:
            print(f"⚠️ Error in processing: {e}")
            continue

# Start worker thread
worker_thread = threading.Thread(target=worker, daemon=True)
worker_thread.start()

# Audio callback
def audio_callback(indata, frames, time_info, status):
    global audio_buffer
    if status:
        print(f"⚠️ Stream status: {status}")
    
    mono = indata[:, 0] if indata.ndim > 1 else indata
    audio_buffer = np.concatenate([audio_buffer, mono])
    
    while len(audio_buffer) >= CHUNK_SIZE:
        chunk = audio_buffer[:CHUNK_SIZE].copy()
        audio_buffer = audio_buffer[CHUNK_SIZE:]
        try:
            audio_queue.put_nowait(chunk)
        except queue.Full:
            pass

# Main loop
def main():
    print("🎙️ Starting wake word detection with IMMEDIATE speech-to-text...")
    print(f"📋 Instructions:")
    print(f"   - Say 'Alexa' to start speech-to-text IMMEDIATELY")
    print(f"   - Speak your command")
    print(f"   - NO AUTO-STOP - will record until manually stopped")
    print(f"   - Press Ctrl+C to exit")
    
    try:
        dev = DEVICE_INDEX if DEVICE_INDEX is not None else sd.default.device[0]
        info = sd.query_devices(dev)
        print(f"🎛️ Using device: {info['name']}")
        
        with sd.InputStream(samplerate=SR, channels=1, blocksize=BLOCK_SIZE,
                             dtype=np.float32, device=dev,
                             callback=audio_callback):
            print("✅ Stream started. Say 'Alexa' to begin IMMEDIATELY!")
            
            while True:
                time.sleep(0.1)
                
    except KeyboardInterrupt:
        print("\n🛑 Stopped by user.")
    except Exception as e:
        print(f"❌ Stream error: {e}")
    finally:
        # Stop speech-to-text if active
        if stt_active:
            stop_speech_to_text()
        
        # Stop worker thread
        audio_queue.put(None)
        worker_thread.join(timeout=1.0)
        print("✅ Shutdown complete")

if __name__ == '__main__':
    main()
