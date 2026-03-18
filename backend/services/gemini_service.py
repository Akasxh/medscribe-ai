import google.generativeai as genai
import asyncio
import json
import os
import logging

logger = logging.getLogger(__name__)


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
        self, transcript: str, existing_note: dict = None, specialty: str = "general"
    ) -> dict:
        """Extract structured clinical data from a transcript using Gemini."""
        from prompts.clinical_extraction import USER_PROMPT_TEMPLATE, SPECIALTY_ADDENDUMS
        from services.learning_service import get_learning_examples

        user_prompt = USER_PROMPT_TEMPLATE.format(
            transcript=transcript,
            existing_note=json.dumps(existing_note, indent=2)
            if existing_note
            else "None",
        )

        # Inject few-shot learning examples from doctor corrections
        learning_context = get_learning_examples(transcript)
        if learning_context:
            user_prompt = user_prompt + "\n" + learning_context

        # Append specialty-specific extraction instructions
        addendum = SPECIALTY_ADDENDUMS.get(specialty, "")
        if addendum:
            user_prompt = user_prompt + "\n" + addendum

        try:
            # Run synchronous Gemini call in executor to avoid blocking event loop
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
            result = json.loads(response.text)
            logger.info("Gemini extraction successful")
            return result
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse Gemini JSON response: {e}")
            return None
        except Exception as e:
            logger.error(f"Gemini extraction error: {e}")
            return None
