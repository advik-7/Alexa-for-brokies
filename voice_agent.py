import os
import json
import google.generativeai as genai
from datetime import datetime
from typing import Dict, Any, Optional

class SpotifyVoiceAgent:
    def __init__(self):
        """Initialize the Spotify Voice Agent with Gemini LLM."""
        self.wrapped_llm = self._initialize_llm()
        
    async def async_init(self):
        """
        Async initializer for resources that require asynchronous setup.
        Call this after instantiating the bot.
        """
        # If you need to initialize other async resources, do so here.
            
    def _initialize_llm(self):
        """Initialize a simple wrapper for the Gemini API."""
        genai.configure(api_key=os.environ["GEMINI_API_KEY"])
        
        class SimpleGeminiWrapper:
            def __init__(self, model_name="gemini-2.0-flash", temperature=0.70, max_tokens=1500):
                self.model_name = model_name
                self.temperature = temperature
                self.max_tokens = max_tokens
                self.generation_config = {
                    "temperature": temperature,
                    "max_output_tokens": max_tokens
                }
                self.model = genai.GenerativeModel(
                    model_name=model_name,
                    generation_config=self.generation_config
                )
            
            def __call__(self, prompt, **kwargs):
                response = self.model.generate_content(prompt)
                return response.text
        
        return SimpleGeminiWrapper()

    def clean_response(self, response: str) -> str:
        """Clean the LLM response to extract valid JSON."""
        # Remove any markdown formatting
        response = response.strip()
        if response.startswith('```json'):
            response = response[7:]
        if response.endswith('```'):
            response = response[:-3]
        return response.strip()

    async def process_voice_command(self, voice_input: str, tool_output: Optional[str] = None, tool_name: Optional[str] = None) -> Dict[str, Any]:
        """
        Process voice command and determine which tool to call.
        
        Args:
            voice_input: The transcribed voice command from STT
            tool_output: Output from previous tool call (if any)
            tool_name: Name of the tool that was previously called (if any)
        
        Returns:
            Dict containing tool call information and response
        """
        
        print(f"Voice Agent: Processing '{voice_input}'")
        
        now = datetime.now()
        current_year = now.year
        current_month = now.month
        current_day = now.day

        # Determine if this is a tool call or response generation
        if tool_output is None:
            # First pass: Analyze voice command and determine tool to call
            print("First pass: Analyzing voice command...")
            prompt = self._create_tool_selection_prompt(voice_input, current_year, current_month, current_day)
        else:
            # Second pass: Process tool output and generate final response
            print(f"Second pass: Processing tool output from {tool_name}...")
            prompt = self._create_response_generation_prompt(voice_input, tool_output, tool_name, current_year, current_month, current_day)

        try:
            # Get LLM response
            print("Calling Gemini LLM...")
            response = self.wrapped_llm(prompt)
            response_cleaned = self.clean_response(response)
            
            print(f"Raw LLM response: {response_cleaned}")
            
            json_response = json.loads(response_cleaned)
            print(f"Parsed JSON response: {json_response}")
            return json_response
            
        except json.JSONDecodeError as e:
            print(f"Failed to parse JSON response: {e}")
            print(f"Raw response: {response_cleaned}")
            # Return fallback response
            return {
                "tool_call": False,
                "tool_name": None,
                "tool_input": None,
                "response": f"I understood: '{voice_input}'. Let me help you with that.",
                "error": "Failed to parse LLM response"
            }
        except Exception as e:
            print(f"LLM call error: {e}")
            return {
                "tool_call": False,
                "tool_name": None,
                "tool_input": None,
                "response": f"Sorry, I encountered an error processing your request.",
                "error": f"LLM error: {str(e)}"
            }

    def _create_tool_selection_prompt(self, voice_input: str, current_year: int, current_month: int, current_day: int) -> str:
        """Create prompt for tool selection phase."""
        
        return f"""
You are a Spotify Voice Assistant that helps users control their music through voice commands.

AVAILABLE TOOLS:
1. "pause" - Pause current playback
2. "play" - Resume playback
3. "search" - Search for songs/artists/albums

USER VOICE INPUT: "{voice_input}"

TASK: Analyze the voice input and determine which tool to call.

INSTRUCTIONS:
- If user wants to pause/stop music → call "pause" tool
- If user wants to play/resume music → call "play" tool  
- If user wants to search for something → call "search" tool with the search query
- For search queries, extract the search term from the voice input
- Be smart about understanding user intent even with casual language

EXAMPLES:
- "pause the music" → pause tool
- "stop playing" → pause tool
- "play music" → play tool
- "resume" → play tool
- "search for Bohemian Rhapsody" → search tool with "Bohemian Rhapsody"
- "find songs by Queen" → search tool with "Queen"
- "play some rock music" → search tool with "rock music"

RESPONSE FORMAT:
Return ONLY a valid JSON object with this exact structure:
{{
    "tool_call": true/false,
    "tool_name": "pause" | "play" | "search" | null,
    "tool_input": "search query if search tool, otherwise null",
    "response": "brief explanation of what you're doing",
    "user_intent": "what the user wants to do"
}}

Current date: {current_year}/{current_month}/{current_day}

Only output the JSON - no explanations or additional text.
"""

    def _create_response_generation_prompt(self, original_voice_input: str, tool_output: str, tool_name: str, current_year: int, current_month: int, current_day: int) -> str:
        """Create prompt for response generation after tool execution."""
        
        return f"""
You are a Spotify Voice Assistant that provides helpful responses after executing voice commands.

ORIGINAL USER REQUEST: "{original_voice_input}"
TOOL CALLED: {tool_name}
TOOL OUTPUT: {tool_output}

TASK: Generate a natural, helpful response to the user based on the tool output.

INSTRUCTIONS:
- If search returned results → suggest playing a specific song from the results
- If search returned no results → apologize and suggest alternatives
- If pause/play was successful → confirm the action
- Keep responses conversational and helpful
- If search found songs, recommend playing one of them

RESPONSE FORMAT:
Return ONLY a valid JSON object with this exact structure:
{{
    "tool_call": true/false,
    "tool_name": "play" | null,
    "tool_input": "song_id to play (if recommending a song)", 
    "response": "natural response to user",
    "recommendation": "what you're recommending to the user"
}}

EXAMPLES:
- If search found "Bohemian Rhapsody" → recommend playing it with song_id
- If search found multiple songs → recommend the best match
- If pause was successful → "I've paused your music"
- If play was successful → "I've resumed your music"

Current date: {current_year}/{current_month}/{current_day}

Only output the JSON - no explanations or additional text.
"""

    def extract_tool_info(self, response: Dict[str, Any]) -> tuple:
        """
        Extract tool information from the response.
        
        Returns:
            tuple: (tool_call, tool_name, tool_input, response_text)
        """
        tool_call = response.get("tool_call", False)
        tool_name = response.get("tool_name")
        tool_input = response.get("tool_input")
        response_text = response.get("response", "")
        
        return tool_call, tool_name, tool_input, response_text

# Example usage and testing
async def test_voice_agent():
    """Test the voice agent with sample inputs."""
    
    agent = SpotifyVoiceAgent()
    await agent.async_init()
    
    # Test cases
    test_cases = [
        "pause the music",
        "play some music", 
        "search for Bohemian Rhapsody",
        "find songs by Queen",
        "stop playing"
    ]
    
    for test_input in test_cases:
        print(f"\n--- Testing: '{test_input}' ---")
        result = await agent.process_voice_command(test_input)
        print(f"Result: {json.dumps(result, indent=2)}")

if __name__ == "__main__":
    import asyncio
    asyncio.run(test_voice_agent()) 