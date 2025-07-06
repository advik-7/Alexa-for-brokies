#!/usr/bin/env python3
"""
Simple test script for the Spotify Voice Agent
"""

import asyncio
import os
import sys
from voice_command_processor import VoiceCommandProcessor

async def test_ai_agent():
    """Test the AI voice agent with detailed logging."""
    
    print("Testing Spotify AI Voice Agent")
    print("=" * 60)
    
    # Check for environment variables
    gemini_key = os.environ.get("GEMINI_API_KEY")
    if not gemini_key:
        print("Error: GEMINI_API_KEY environment variable not set")
        print("Please set your Gemini API key in your .env file:")
        print("GEMINI_API_KEY=your_api_key_here")
        return
    
    print(f"GEMINI_API_KEY found: {gemini_key[:10]}...")
    
    try:
        processor = VoiceCommandProcessor()
        print("VoiceCommandProcessor initialized")
        
        # Test cases
        test_cases = [
            "pause the music",
            "start the music", 
            "play Bohemian Rhapsody",
            "search for Queen",
            "stop playing"
        ]
        
        for i, test_input in enumerate(test_cases, 1):
            print(f"\n{'='*60}")
            print(f"Test {i}: '{test_input}'")
            print(f"{'='*60}")
            
            try:
                result = await processor.process_voice_command(test_input)
                
                print(f"Success: {result['success']}")
                print(f"Response: {result['response']}")
                print(f"Action Taken: {result['action_taken']}")
                print(f"Final Action: {result.get('final_action')}")
                
                if result.get('search_results'):
                    print(f"Found {len(result['search_results'])} search results")
                    
            except Exception as e:
                print(f"Error processing command: {e}")
                import traceback
                traceback.print_exc()
                
    except Exception as e:
        print(f"Failed to initialize processor: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_ai_agent()) 