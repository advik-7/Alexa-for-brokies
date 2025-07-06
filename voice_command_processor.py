import asyncio
import json
from typing import Dict, Any, Optional
from voice_agent import SpotifyVoiceAgent
from spotify_tools import SpotifyTools

class VoiceCommandProcessor:
    def __init__(self):
        """Initialize the voice command processor with AI agent and Spotify tools."""
        self.voice_agent = SpotifyVoiceAgent()
        self.spotify_tools = SpotifyTools()
        self.initialized = False
        
    async def initialize(self):
        """Initialize the processor asynchronously."""
        if not self.initialized:
            await self.voice_agent.async_init()
            self.initialized = True
    
    async def process_voice_command(self, voice_input: str) -> Dict[str, Any]:
        """
        Process a voice command through the complete pipeline.
        
        Args:
            voice_input: The transcribed voice command from STT
            
        Returns:
            Dict containing the final response and any actions taken
        """
        await self.initialize()
        
        print(f"Processing voice command: '{voice_input}'")
        
        # Step 1: Analyze voice command and determine tool to call
        print("Step 1: Analyzing voice command...")
        first_response = await self.voice_agent.process_voice_command(voice_input)
        
        tool_call, tool_name, tool_input, response_text = self.voice_agent.extract_tool_info(first_response)
        
        print(f"Analysis result: Tool call={tool_call}, Tool={tool_name}, Input={tool_input}")
        print(f"Response: {response_text}")
        
        if not tool_call:
            # No tool call needed, return the response directly
            print("No tool call needed, returning direct response")
            return {
                "success": True,
                "response": response_text,
                "action_taken": "none",
                "tool_called": None
            }
        
        # Step 2: Execute the tool
        print(f"Step 2: Executing tool '{tool_name}' with input '{tool_input}'...")
        tool_result = await self._execute_tool(tool_name, tool_input)
        
        print(f"Tool execution result: {tool_result}")
        
        if not tool_result["success"]:
            error_msg = f"Sorry, I couldn't {tool_name}. {tool_result.get('error', 'Unknown error')}"
            print(f"Tool execution failed: {error_msg}")
            return {
                "success": False,
                "response": error_msg,
                "action_taken": tool_name,
                "tool_called": tool_name,
                "error": tool_result.get("error")
            }
        
        # Step 3: Process tool output and generate final response
        print("Step 3: Processing tool output...")
        final_response = await self.voice_agent.process_voice_command(
            voice_input=voice_input,
            tool_output=tool_result.get("formatted_output", str(tool_result)),
            tool_name=tool_name
        )
        
        final_tool_call, final_tool_name, final_tool_input, final_response_text = self.voice_agent.extract_tool_info(final_response)
        
        print(f"Final response analysis: Tool call={final_tool_call}, Tool={final_tool_name}, Input={final_tool_input}")
        print(f"Final response text: {final_response_text}")
        
        # Step 4: Execute final tool if needed (e.g., play a specific song)
        if final_tool_call and final_tool_name == "play" and final_tool_input:
            print(f"Step 4: Playing track '{final_tool_input}'...")
            play_result = await self.spotify_tools.play_track(final_tool_input)
            
            if play_result["success"]:
                final_response_text = f"{final_response_text} I'm now playing the track for you!"
                print("Track playback successful")
            else:
                final_response_text = f"{final_response_text} However, I couldn't play the track: {play_result.get('error', 'Unknown error')}"
                print(f"Track playback failed: {play_result.get('error')}")
        
        final_result = {
            "success": True,
            "response": final_response_text,
            "action_taken": tool_name,
            "tool_called": tool_name,
            "final_action": final_tool_name if final_tool_call else None,
            "search_results": tool_result.get("results") if tool_name == "search" else None
        }
        
        print(f"Final result: {final_result}")
        return final_result
    
    async def _execute_tool(self, tool_name: str, tool_input: Optional[str]) -> Dict[str, Any]:
        """
        Execute a specific Spotify tool.
        
        Args:
            tool_name: Name of the tool to execute
            tool_input: Input for the tool (e.g., search query)
            
        Returns:
            Dict containing tool execution result
        """
        print(f"Executing tool: {tool_name} with input: {tool_input}")
        
        try:
            if tool_name == "pause":
                print("Calling pause_playback...")
                result = await self.spotify_tools.pause_playback()
                result["formatted_output"] = "Playback paused successfully"
                print(f"Pause tool result: {result}")
                return result
                
            elif tool_name == "start":
                print("Calling resume_playback...")
                result = await self.spotify_tools.resume_playback()
                result["formatted_output"] = "Playback resumed successfully"
                print(f"Start tool result: {result}")
                return result
                
            elif tool_name == "play":
                if not tool_input:
                    error_result = {
                        "success": False,
                        "error": "No song name provided for play tool",
                        "formatted_output": "No song name provided for play tool"
                    }
                    print(f"Play tool error: {error_result}")
                    return error_result
                
                print(f"Calling play_track with song: '{tool_input}'")
                result = await self.spotify_tools.play_track(tool_input)
                if result["success"]:
                    result["formatted_output"] = f"Playing song: {tool_input}"
                    print(f"Play tool successful: Playing {tool_input}")
                else:
                    result["formatted_output"] = f"Failed to play: {result.get('error', 'Unknown error')}"
                    print(f"Play tool failed: {result}")
                return result
                
            elif tool_name == "search":
                if not tool_input:
                    error_result = {
                        "success": False,
                        "error": "No search query provided",
                        "formatted_output": "No search query provided"
                    }
                    print(f"Search tool error: {error_result}")
                    return error_result
                
                print(f"Calling search_tracks with query: '{tool_input}'")
                result = await self.spotify_tools.search_tracks(tool_input)
                if result["success"]:
                    formatted_results = self.spotify_tools.format_search_results(result["results"])
                    result["formatted_output"] = f"Search results for '{tool_input}':\n{formatted_results}"
                    print(f"Search tool successful: Found {len(result['results'])} results")
                else:
                    result["formatted_output"] = f"Search failed: {result.get('error', 'Unknown error')}"
                    print(f"Search tool failed: {result}")
                return result
                
            else:
                error_result = {
                    "success": False,
                    "error": f"Unknown tool: {tool_name}",
                    "formatted_output": f"Unknown tool: {tool_name}"
                }
                print(f"Unknown tool: {error_result}")
                return error_result
                
        except Exception as e:
            error_result = {
                "success": False,
                "error": f"Tool execution error: {str(e)}",
                "formatted_output": f"Tool execution error: {str(e)}"
            }
            print(f"Tool execution exception: {error_result}")
            import traceback
            traceback.print_exc()
            return error_result

# Example usage and testing
async def test_voice_processor():
    """Test the voice command processor with sample inputs."""
    
    processor = VoiceCommandProcessor()
    
    # Test cases
    test_cases = [
        "pause the music",
        "play some music",
        "search for Bohemian Rhapsody by Queen",
        "find songs by The Beatles",
        "stop playing"
    ]
    
    for test_input in test_cases:
        print(f"\n{'='*50}")
        print(f"🎤 Testing: '{test_input}'")
        print(f"{'='*50}")
        
        result = await processor.process_voice_command(test_input)
        
        print(f"✅ Success: {result['success']}")
        print(f"💬 Response: {result['response']}")
        print(f"🔧 Action: {result['action_taken']}")
        print(f"🎵 Final Action: {result.get('final_action')}")
        
        if result.get('search_results'):
            print(f"📋 Found {len(result['search_results'])} search results")

if __name__ == "__main__":
    asyncio.run(test_voice_processor()) 