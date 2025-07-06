#!/usr/bin/env python3
"""
Test script for the Spotify Voice Agent
"""

import asyncio
import os
import sys
from voice_command_processor import VoiceCommandProcessor

async def test_voice_agent():
    """Test the voice command processor with various inputs."""
    
    print("🎤 Testing Spotify Voice Agent")
    print("=" * 50)
    
    # Check for environment variables
    if not os.environ.get("GEMINI_API_KEY"):
        print("❌ Error: GEMINI_API_KEY environment variable not set")
        print("Please set your Gemini API key:")
        print("export GEMINI_API_KEY=your_api_key_here")
        return
    
    processor = VoiceCommandProcessor()
    
    # Test cases
    test_cases = [
        "pause the music",
        "play some music", 
        "search for Bohemian Rhapsody by Queen",
        "find songs by The Beatles",
        "stop playing",
        "resume playback",
        "search for rock music"
    ]
    
    for i, test_input in enumerate(test_cases, 1):
        print(f"\n{'='*60}")
        print(f"🎤 Test {i}: '{test_input}'")
        print(f"{'='*60}")
        
        try:
            result = await processor.process_voice_command(test_input)
            
            print(f"✅ Success: {result['success']}")
            print(f"💬 Response: {result['response']}")
            print(f"🔧 Action Taken: {result['action_taken']}")
            print(f"🎵 Final Action: {result.get('final_action')}")
            
            if result.get('search_results'):
                print(f"📋 Found {len(result['search_results'])} search results")
                
        except Exception as e:
            print(f"❌ Error processing command: {e}")
            import traceback
            traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_voice_agent()) 