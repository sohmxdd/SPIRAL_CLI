"""
SPIRAL Intent Analyzer
Classifies user input to route between Agent Mode and Chat Mode.
Uses LLM for accurate classification with keyword fallback.
"""

import re
from dataclasses import dataclass
from typing import Optional
from llm.groq_client import GroqClient, LLMResponse


# ─── Intent Types ──────────────────────────────────────────────

INTENT_CODING = "coding_task"
INTENT_DEBUG = "debugging_task"
INTENT_MODIFY = "modification_task"
INTENT_QUESTION = "question"
INTENT_CASUAL = "casual"

AGENT_INTENTS = {INTENT_CODING, INTENT_DEBUG, INTENT_MODIFY}
CHAT_INTENTS = {INTENT_QUESTION, INTENT_CASUAL}

ALL_INTENTS = AGENT_INTENTS | CHAT_INTENTS


@dataclass
class IntentResult:
    """Result of intent classification."""
    intent: str
    confidence: float
    reasoning: str = ""
    is_agent_mode: bool = False

    def __post_init__(self):
        self.is_agent_mode = self.intent in AGENT_INTENTS


# ─── System Prompt ─────────────────────────────────────────────

INTENT_SYSTEM_PROMPT = """You are an intent classifier for SPIRAL, an autonomous coding agent.

Classify the user's input into EXACTLY ONE category:

- "coding_task" — User explicitly wants a physical file created/generated on disk, a workspace file created, or a project/app built.
- "debugging_task" — User wants to fix a bug, resolve an error, or debug existing workspace code files.
- "modification_task" — User wants to change, update, refactor, or edit existing workspace code files.
- "question" — User is asking a question, requesting a code explanation, asking for code examples/snippets in chat, or seeking informational assistance WITHOUT asking to modify or write workspace files on disk.
- "casual" — Greetings, small talk, expressions, or non-task input.

CRITICAL RULE:
If the user asks "give me the code for...", "show me...", "how do I...", "write a snippet for...", or asks for an algorithm explanation in chat, classify it as "question" (Chat mode) UNLESS they explicitly ask to create/save a file on disk (e.g., "create main.py", "save to stack.py", "build a new project").

OUTPUT FORMAT (JSON):
{
  "intent": "question",
  "confidence": 0.95,
  "reasoning": "User wants a code snippet answer in chat, not a new workspace file"
}

Respond with ONLY valid JSON. No markdown."""


# ─── Keyword Fallback Patterns ─────────────────────────────────

_CODING_PATTERNS = [
    r'\b(create|build|make|write|generate|implement|develop|code|scaffold|setup|init)\b.*\b(file|project|app|repo|script|\.py|\.js|\.ts)\b',
    r'\b(app|program|script|function|class|api|server|website|page|component)\b',
]

_DEBUG_PATTERNS = [
    r'\b(fix|debug|error|bug|crash|broken|fail|issue|traceback|exception)\b',
    r'\b(not working|doesn\'t work|won\'t run|can\'t run)\b',
]

_MODIFY_PATTERNS = [
    r'\b(change|modify|update|refactor|improve|add|remove|rename|replace|edit|upgrade)\b.*\b(code|file|function|class|style|feature)\b',
]

_QUESTION_PATTERNS = [
    r'^(what|how|why|when|where|who|which|can you|explain|tell me|give me|show me|provide|write an? (example|snippet|solution)|code for)\b',
    r'\?$',
    r'\b(difference between|meaning of|purpose of|what is|what are|example of|snippet for|how to|code for)\b',
]

_EXPLICIT_FILE_PATTERNS = [
    r'\b(create|make|build|save to|write to|generate|scaffold)\b.*\b(file|project|app|repo|script\.py|\.js|\.ts|\.py|\.html)\b',
    r'\b(new project|new app|create file|make file)\b'
]

_CASUAL_PATTERNS = [
    r'^(hi|hey|hello|sup|yo|thanks|thank you|bye|goodbye|good morning|good night|gm|gn)\b',
    r'^(lol|haha|nice|cool|ok|okay|sure|yes|no|yeah|nah|nope)\b',
    r'^.{1,8}$',  # Very short input (likely casual)
]


class IntentAnalyzer:
    """
    Classifies user input into intents for dual-mode routing.
    Uses LLM for accurate classification, with keyword fallback.
    """

    def __init__(self, llm: GroqClient):
        self.llm = llm

    def classify(self, user_input: str) -> IntentResult:
        """
        Classify user input into an intent.
        Tries LLM first, falls back to keyword matching.

        Returns:
            IntentResult with intent, confidence, and routing info
        """
        # Quick keyword check for obvious cases (saves tokens)
        quick = self._quick_classify(user_input)
        if quick and quick.confidence >= 0.9:
            return quick

        # LLM classification
        try:
            return self._llm_classify(user_input)
        except Exception:
            # Fallback to keyword classification
            return quick or IntentResult(
                intent=INTENT_QUESTION,
                confidence=0.7,
                reasoning="Fallback: treating as question in chat mode",
            )

    def _llm_classify(self, user_input: str) -> IntentResult:
        """Classify using the LLM."""
        result, response = self.llm.generate_json(
            prompt=f"Classify this user input:\n\n\"{user_input}\"",
            system_prompt=INTENT_SYSTEM_PROMPT,
        )

        intent = result.get("intent", INTENT_QUESTION)
        confidence = result.get("confidence", 0.7)
        reasoning = result.get("reasoning", "")

        # Validate intent
        if intent not in ALL_INTENTS:
            intent = INTENT_QUESTION
            confidence = 0.5

        return IntentResult(
            intent=intent,
            confidence=confidence,
            reasoning=reasoning,
        )

    def _quick_classify(self, text: str) -> Optional[IntentResult]:
        """
        Fast keyword-based classification for obvious cases.
        Returns None if uncertain.
        """
        lower = text.lower().strip()

        # Check casual first (greetings, one-word responses)
        for pattern in _CASUAL_PATTERNS:
            if re.search(pattern, lower, re.IGNORECASE):
                return IntentResult(
                    intent=INTENT_CASUAL,
                    confidence=0.95,
                    reasoning="Keyword match: casual/greeting",
                )

        # Explicit check for questions / code inquiries WITHOUT explicit file creation
        is_question = any(re.search(p, lower, re.IGNORECASE) for p in _QUESTION_PATTERNS)
        is_file_req = any(re.search(p, lower, re.IGNORECASE) for p in _EXPLICIT_FILE_PATTERNS)

        if is_question and not is_file_req:
            return IntentResult(
                intent=INTENT_QUESTION,
                confidence=0.95,
                reasoning="Keyword match: code inquiry in chat mode (no file creation requested)",
            )

        # Check debug
        for pattern in _DEBUG_PATTERNS:
            if re.search(pattern, lower, re.IGNORECASE):
                return IntentResult(
                    intent=INTENT_DEBUG,
                    confidence=0.9,
                    reasoning="Keyword match: debug/fix pattern",
                )

        # Check modify (must check before coding — both share keywords)
        for pattern in _MODIFY_PATTERNS:
            if re.search(pattern, lower, re.IGNORECASE):
                return IntentResult(
                    intent=INTENT_MODIFY,
                    confidence=0.85,
                    reasoning="Keyword match: modification pattern",
                )

        return None
