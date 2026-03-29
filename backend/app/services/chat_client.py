import os
from pathlib import Path

import anthropic
from dotenv import load_dotenv

# Ensure .env is loaded even if uvicorn hasn't done it yet.
_env_path = Path(__file__).resolve().parents[2] / ".env"
load_dotenv(_env_path)


class AnthropicError(Exception):
    def __init__(self, detail: str):
        self.detail = detail
        super().__init__(detail)


class ChatClient:
    def __init__(self) -> None:
        api_key = os.environ.get("ANTHROPIC_API_KEY")
        if api_key:
            self._client = anthropic.AsyncAnthropic(api_key=api_key)
        else:
            # Allow startup without key; will fail at request time.
            self._client = anthropic.AsyncAnthropic(api_key="not-set")

    async def close(self) -> None:
        await self._client.close()

    @property
    def client(self) -> anthropic.AsyncAnthropic:
        return self._client


chat_client = ChatClient()
