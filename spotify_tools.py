import aiohttp
import json
from typing import Dict, Any, List, Optional

class SpotifyTools:
    def __init__(self, base_url: str = "http://localhost:8888"):
        """
        Initialize Spotify Tools with the local Express server URL.
        
        Args:
            base_url: URL of the Express server (default: localhost:8888)
        """
        self.base_url = base_url
        
    async def pause_playback(self) -> Dict[str, Any]:
        """Pause current Spotify playback."""
        print(f"Pausing Spotify playback...")
        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(f"{self.base_url}/player/stop") as response:
                    print(f"HTTP Response: {response.status}")
                    if response.status == 200:
                        result = {"success": True, "message": "Playback paused successfully"}
                        print(f"Pause successful: {result}")
                        return result
                    else:
                        error_text = await response.text()
                        result = {"success": False, "error": f"Failed to pause: {error_text}"}
                        print(f"Pause failed: {result}")
                        return result
        except Exception as e:
            result = {"success": False, "error": f"Network error: {str(e)}"}
            print(f"Pause network error: {result}")
            return result

    async def resume_playback(self) -> Dict[str, Any]:
        """Resume Spotify playback."""
        print(f"Resuming Spotify playback...")
        try:
            async with aiohttp.ClientSession() as session:
                # For resume, we'll use a play command with no specific track
                async with session.post(f"{self.base_url}/player/play", 
                                     json={"uris": []}) as response:
                    print(f"HTTP Response: {response.status}")
                    if response.status == 200:
                        result = {"success": True, "message": "Playback resumed successfully"}
                        print(f"Resume successful: {result}")
                        return result
                    else:
                        error_text = await response.text()
                        result = {"success": False, "error": f"Failed to resume: {error_text}"}
                        print(f"Resume failed: {result}")
                        return result
        except Exception as e:
            result = {"success": False, "error": f"Network error: {str(e)}"}
            print(f"Resume network error: {result}")
            return result

    async def search_tracks(self, query: str) -> Dict[str, Any]:
        """
        Search for tracks using the Spotify API.
        
        Args:
            query: Search query string
            
        Returns:
            Dict containing search results or error information
        """
        print(f"Searching for tracks: '{query}'")
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(f"{self.base_url}/player/search", 
                                     params={"query": query}) as response:
                    print(f"HTTP Response: {response.status}")
                    if response.status == 200:
                        results = await response.json()
                        result = {
                            "success": True,
                            "results": results,
                            "query": query,
                            "count": len(results) if isinstance(results, list) else 0
                        }
                        print(f"Search successful: Found {result['count']} tracks")
                        return result
                    else:
                        error_text = await response.text()
                        result = {"success": False, "error": f"Search failed: {error_text}"}
                        print(f"Search failed: {result}")
                        return result
        except Exception as e:
            result = {"success": False, "error": f"Network error: {str(e)}"}
            print(f"Search network error: {result}")
            return result

    async def play_track(self, track_id: str) -> Dict[str, Any]:
        """
        Play a specific track by ID.
        
        Args:
            track_id: Spotify track ID or URI
            
        Returns:
            Dict containing play result or error information
        """
        print(f"Playing track: '{track_id}'")
        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(f"{self.base_url}/player/play/search", 
                                     json={"uri": track_id}) as response:
                    print(f"HTTP Response: {response.status}")
                    if response.status == 200:
                        result = {"success": True, "message": f"Playing track: {track_id}"}
                        print(f"Play track successful: {result}")
                        return result
                    else:
                        error_text = await response.text()
                        result = {"success": False, "error": f"Failed to play track: {error_text}"}
                        print(f"Play track failed: {result}")
                        return result
        except Exception as e:
            result = {"success": False, "error": f"Network error: {str(e)}"}
            print(f"Play track network error: {result}")
            return result

    def format_search_results(self, results: List[Dict]) -> str:
        """
        Format search results for the AI agent.
        
        Args:
            results: List of track dictionaries from Spotify API
            
        Returns:
            Formatted string with track information
        """
        if not results:
            return "No tracks found matching your search."
        
        formatted_results = []
        for i, track in enumerate(results[:5], 1):  # Limit to top 5 results
            track_info = {
                "id": track.get("id", "unknown"),
                "name": track.get("name", "Unknown Track"),
                "artist": track.get("artists", [{}])[0].get("name", "Unknown Artist") if track.get("artists") else "Unknown Artist",
                "album": track.get("album", {}).get("name", "Unknown Album") if track.get("album") else "Unknown Album",
                "uri": track.get("uri", "")
            }
            formatted_results.append(track_info)
        
        return json.dumps(formatted_results, indent=2)

# Example usage and testing
async def test_spotify_tools():
    """Test the Spotify tools with sample operations."""
    
    tools = SpotifyTools()
    
    # Test search
    print("--- Testing Search ---")
    search_result = await tools.search_tracks("Bohemian Rhapsody")
    print(f"Search result: {json.dumps(search_result, indent=2)}")
    
    if search_result["success"] and search_result["results"]:
        # Test playing first result
        first_track = search_result["results"][0]
        track_id = first_track.get("id")
        if track_id:
            print(f"\n--- Testing Play Track: {track_id} ---")
            play_result = await tools.play_track(track_id)
            print(f"Play result: {json.dumps(play_result, indent=2)}")
    
    # Test pause
    print("\n--- Testing Pause ---")
    pause_result = await tools.pause_playback()
    print(f"Pause result: {json.dumps(pause_result, indent=2)}")

if __name__ == "__main__":
    import asyncio
    asyncio.run(test_spotify_tools()) 