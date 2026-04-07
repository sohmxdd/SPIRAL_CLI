"""
SPIRAL Groq LLM Client
Handles all communication with the Groq API.
Includes retry logic for rate limits and model fallback.
"""

import json
import time
from dataclasses import dataclass, field
from typing import List, Dict, Optional
from groq import Groq
import config


@dataclass
class LLMResponse:
    """Structured response from the LLM."""
    text: str
    input_tokens: int = 0
    output_tokens: int = 0
    model: str = ""
    finish_reason: str = ""


# Retry configuration
MAX_RETRIES = 3
RETRY_BASE_DELAY = 1.0  # seconds, doubles each retry


class GroqClient:
    """
    Groq API client for SPIRAL.
    Handles prompt construction, API calls, response parsing,
    automatic retries for rate limits, and model fallback.
    """

    def __init__(self, api_key: str = None, model: str = None):
        self.api_key = api_key or config.GROQ_API_KEY
        self.model = model or config.DEFAULT_MODEL
        self.fallback_model = config.FALLBACK_MODEL

        # Validate API key BEFORE creating the client
        if not self.api_key:
            raise ValueError(
                "GROQ_API_KEY not set. Add it to .env or pass directly."
            )

        self.client = Groq(api_key=self.api_key)

    def generate_response(
        self,
        prompt: str,
        system_prompt: str = "",
        context: List[Dict[str, str]] = None,
        temperature: float = None,
        max_tokens: int = None,
        json_mode: bool = False,
    ) -> LLMResponse:
        """
        Generate a response from Groq with automatic retry and fallback.

        Args:
            prompt: User/task prompt
            system_prompt: System instructions
            context: Previous message history
            temperature: Override default temperature
            max_tokens: Override default max tokens
            json_mode: Request JSON output

        Returns:
            LLMResponse with text, token counts, and metadata
        """
        messages = []

        # System prompt
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})

        # Context (conversation history)
        if context:
            messages.extend(context)

        # Current prompt
        messages.append({"role": "user", "content": prompt})

        # API call parameters
        params = {
            "messages": messages,
            "temperature": temperature if temperature is not None else config.TEMPERATURE,
            "max_tokens": max_tokens or config.MAX_TOKENS_PER_CALL,
        }

        if json_mode:
            params["response_format"] = {"type": "json_object"}

        # Try primary model, then fallback
        models_to_try = [self.model]
        if self.fallback_model and self.fallback_model != self.model:
            models_to_try.append(self.fallback_model)

        last_error = None

        for model in models_to_try:
            params["model"] = model

            for attempt in range(1, MAX_RETRIES + 1):
                try:
                    response = self.client.chat.completions.create(**params)

                    # Extract response data
                    choice = response.choices[0]
                    usage = response.usage

                    return LLMResponse(
                        text=choice.message.content or "",
                        input_tokens=usage.prompt_tokens if usage else 0,
                        output_tokens=usage.completion_tokens if usage else 0,
                        model=response.model or model,
                        finish_reason=choice.finish_reason or "",
                    )

                except Exception as e:
                    last_error = e
                    error_str = str(e).lower()

                    # Check if this is a retryable error
                    is_rate_limit = (
                        "rate_limit" in error_str
                        or "429" in error_str
                        or "too many requests" in error_str
                        or "rate limit" in error_str
                    )
                    is_server_error = any(
                        code in error_str
                        for code in ("500", "502", "503", "server error", "overloaded")
                    )
                    is_retryable = is_rate_limit or is_server_error

                    if is_retryable and attempt < MAX_RETRIES:
                        # Exponential backoff: 1s, 2s, 4s
                        delay = RETRY_BASE_DELAY * (2 ** (attempt - 1))
                        if is_rate_limit:
                            delay = max(delay, 2.0)  # Minimum 2s for rate limits
                        time.sleep(delay)
                        continue
                    else:
                        # Non-retryable error or exhausted retries — try next model
                        break

        # All models and retries exhausted
        return LLMResponse(
            text=f"[LLM_ERROR] {str(last_error)}",
            input_tokens=0,
            output_tokens=0,
            model=self.model,
            finish_reason="error",
        )

    def generate_json(
        self,
        prompt: str,
        system_prompt: str = "",
        context: List[Dict[str, str]] = None,
    ) -> tuple:
        """
        Generate a JSON response. Returns (parsed_dict, LLMResponse).
        Falls back to text extraction if JSON parsing fails.
        """
        response = self.generate_response(
            prompt=prompt,
            system_prompt=system_prompt,
            context=context,
            json_mode=True,
        )

        # If the response is an error, return it as-is
        if response.text.startswith("[LLM_ERROR]"):
            return {"raw_text": response.text}, response

        try:
            parsed = json.loads(response.text)
            return parsed, response
        except json.JSONDecodeError:
            # Try to extract JSON from the text
            text = response.text
            start = text.find('{')
            end = text.rfind('}') + 1
            if start != -1 and end > start:
                try:
                    parsed = json.loads(text[start:end])
                    return parsed, response
                except json.JSONDecodeError:
                    pass
            return {"raw_text": response.text}, response

    def test_connection(self) -> bool:
        """Quick connectivity test."""
        try:
            response = self.generate_response(
                prompt="Say 'connected' in one word.",
                max_tokens=10,
            )
            return "[LLM_ERROR]" not in response.text
        except Exception:
            return False
