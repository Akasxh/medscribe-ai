import google.generativeai as genai
import asyncio
import json
import os
import logging
import time

logger = logging.getLogger(__name__)

# Maximum number of retries for Gemini extraction
_MAX_RETRIES = 2
# Minimum transcript length worth processing
_MIN_USEFUL_LENGTH = 20


class GeminiExtractionService:
    def __init__(self):
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise ValueError("GEMINI_API_KEY environment variable is not set")
        genai.configure(api_key=api_key)

        from prompts.clinical_extraction import SYSTEM_PROMPT

        self.model = genai.GenerativeModel(
            "gemini-2.5-flash",
            system_instruction=SYSTEM_PROMPT,
        )

    async def extract_clinical_data(
        self,
        transcript: str,
        specialty: str = "general",
    ) -> dict | None:
        """Extract structured clinical data from the complete transcript.

        Always receives the full conversation transcript and performs a single
        comprehensive extraction. No incremental merging.

        Returns the parsed dict on success, or None if extraction fails after
        retries.
        """
        from prompts.clinical_extraction import USER_PROMPT_TEMPLATE, SPECIALTY_ADDENDUMS
        from services.learning_service import get_learning_examples

        # --- Defensive: skip obviously useless transcripts ----
        cleaned = transcript.strip()
        if not cleaned or len(cleaned) < _MIN_USEFUL_LENGTH:
            logger.warning(
                "Transcript too short (%d chars), skipping extraction: %r",
                len(cleaned),
                cleaned[:80],
            )
            return None

        user_prompt = USER_PROMPT_TEMPLATE.format(transcript=cleaned)

        # Inject few-shot learning examples from doctor corrections
        learning_context = get_learning_examples(cleaned)
        if learning_context:
            user_prompt = user_prompt + "\n" + learning_context

        # Append specialty-specific extraction instructions
        addendum = SPECIALTY_ADDENDUMS.get(specialty, "")
        if addendum:
            user_prompt = user_prompt + "\n" + addendum

        logger.info(
            "Gemini extraction request — transcript length=%d, specialty=%s",
            len(cleaned),
            specialty,
        )
        logger.debug("Transcript being sent: %s", cleaned[:300])

        # --- Retry loop ----
        last_error: Exception | None = None
        for attempt in range(1, _MAX_RETRIES + 1):
            try:
                result = await self._call_gemini(user_prompt, attempt)
                if result is not None:
                    return result
                # result was None because of empty/invalid response — retry
                last_error = ValueError("Gemini returned empty or unparseable response")
            except Exception as exc:
                last_error = exc
                logger.warning(
                    "Gemini attempt %d/%d failed: %s",
                    attempt,
                    _MAX_RETRIES,
                    exc,
                )
                if attempt < _MAX_RETRIES:
                    await asyncio.sleep(0.5 * attempt)  # brief back-off

        logger.error(
            "Gemini extraction failed after %d attempts. Last error: %s",
            _MAX_RETRIES,
            last_error,
        )
        return None

    async def _call_gemini(self, user_prompt: str, attempt: int) -> dict | None:
        """Single Gemini API call with parsing. Returns parsed dict or None."""
        t0 = time.monotonic()
        loop = asyncio.get_event_loop()
        response = await loop.run_in_executor(
            None,
            lambda: self.model.generate_content(
                user_prompt,
                generation_config=genai.GenerationConfig(
                    response_mime_type="application/json",
                    temperature=0.1,
                ),
            ),
        )
        elapsed = time.monotonic() - t0

        # --- Guard against empty / blocked responses ----
        if response is None:
            logger.error("Gemini returned None response object (attempt %d)", attempt)
            return None

        # Check for blocked responses (safety filters)
        if hasattr(response, "prompt_feedback") and response.prompt_feedback:
            block_reason = getattr(response.prompt_feedback, "block_reason", None)
            if block_reason:
                logger.error(
                    "Gemini blocked the prompt (attempt %d): %s",
                    attempt,
                    block_reason,
                )
                return None

        raw_text: str | None = None
        try:
            raw_text = response.text
        except (ValueError, AttributeError) as exc:
            logger.error(
                "Could not read response.text (attempt %d): %s", attempt, exc
            )
            return None

        if not raw_text or not raw_text.strip():
            logger.error(
                "Gemini returned empty text (attempt %d, %.2fs)", attempt, elapsed
            )
            return None

        logger.debug(
            "Gemini raw response (attempt %d, %.2fs): %s",
            attempt,
            elapsed,
            raw_text[:500],
        )

        # --- Parse JSON ----
        try:
            result = json.loads(raw_text)
        except json.JSONDecodeError as exc:
            logger.error(
                "Failed to parse Gemini JSON (attempt %d): %s — raw: %s",
                attempt,
                exc,
                raw_text[:300],
            )
            # Try to salvage: sometimes Gemini wraps JSON in markdown fences
            result = self._try_salvage_json(raw_text)
            if result is None:
                return None

        if not isinstance(result, dict):
            logger.error(
                "Gemini returned non-dict JSON type %s (attempt %d)",
                type(result).__name__,
                attempt,
            )
            return None

        logger.info(
            "Gemini extraction successful (attempt %d, %.2fs) — keys: %s",
            attempt,
            elapsed,
            list(result.keys()),
        )
        return result

    @staticmethod
    def _try_salvage_json(raw: str) -> dict | None:
        """Attempt to extract JSON from a response wrapped in markdown fences."""
        import re

        # Match ```json ... ``` or ``` ... ```
        match = re.search(r"```(?:json)?\s*\n?(.*?)\n?\s*```", raw, re.DOTALL)
        if match:
            try:
                return json.loads(match.group(1))
            except json.JSONDecodeError:
                pass

        # Try stripping leading/trailing whitespace and non-JSON chars
        stripped = raw.strip().lstrip("`").rstrip("`").strip()
        if stripped.startswith("{"):
            try:
                return json.loads(stripped)
            except json.JSONDecodeError:
                pass

        return None
