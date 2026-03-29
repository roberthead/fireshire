from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import anthropic
import pytest


class FakeTextStream:
    """Async iterator that yields text chunks."""

    def __init__(self, chunks: list[str]):
        self._chunks = chunks

    def __aiter__(self):
        return self

    async def __anext__(self):
        if not self._chunks:
            raise StopAsyncIteration
        return self._chunks.pop(0)


class FakeStreamContext:
    """Fake async context manager for client.messages.stream()."""

    def __init__(self, chunks: list[str]):
        self.text_stream = FakeTextStream(chunks)

    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        pass


class FakeStreamContextError:
    """Fake stream context that raises an APIError during streaming."""

    async def __aenter__(self):
        raise anthropic.APIError(
            message="rate limit exceeded",
            request=MagicMock(),
            body=None,
        )

    async def __aexit__(self, *args):
        pass


def _patch_chat_client(fake_context):
    """Patch chat_client.client.messages.stream to return fake_context."""
    mock_messages = MagicMock()
    mock_messages.stream = MagicMock(return_value=fake_context)
    mock_client = MagicMock()
    mock_client.messages = mock_messages
    return patch(
        "app.routers.chat.chat_client",
        MagicMock(client=mock_client),
    )


class FakeStreamContextCreationError:
    """Fake stream context that raises APIError in __aenter__ (auth failure)."""

    async def __aenter__(self):
        raise anthropic.APIError(
            message="invalid api key",
            request=MagicMock(),
            body=None,
        )

    async def __aexit__(self, *args):
        pass


@pytest.mark.asyncio
async def test_chat_stream_success(client):
    fake_ctx = FakeStreamContext(["Hello", " world", "!"])
    with _patch_chat_client(fake_ctx):
        response = await client.post(
            "/chat/stream",
            json={"message": "What plants are fire-resistant?"},
        )
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/event-stream")

    body = response.text
    assert "data: Hello\n\n" in body
    assert "data:  world\n\n" in body
    assert "data: !\n\n" in body
    assert "data: [DONE]\n\n" in body


@pytest.mark.asyncio
async def test_chat_stream_api_error_at_creation_yields_error_event(client):
    fake_ctx = FakeStreamContextCreationError()
    with _patch_chat_client(fake_ctx):
        response = await client.post(
            "/chat/stream",
            json={"message": "Hello"},
        )
    assert response.status_code == 200
    assert "data: [ERROR]" in response.text
    assert "invalid api key" in response.text


@pytest.mark.asyncio
async def test_chat_stream_api_error_during_stream_yields_error_event(client):
    fake_ctx = FakeStreamContextError()
    with _patch_chat_client(fake_ctx):
        response = await client.post(
            "/chat/stream",
            json={"message": "Hello"},
        )
    assert response.status_code == 200
    assert "data: [ERROR]" in response.text


@pytest.mark.asyncio
async def test_chat_stream_context_in_system_prompt(client):
    fake_ctx = FakeStreamContext(["ok"])
    with _patch_chat_client(fake_ctx) as mock_patch:
        response = await client.post(
            "/chat/stream",
            json={
                "message": "Help me with zone 3",
                "context": {
                    "address": "123 Main St, Ashland",
                    "zones": ["Zone 3"],
                    "plants": ["Glossy abelia", "Oregon grape"],
                },
            },
        )
    assert response.status_code == 200

    # Verify the system prompt was built with context
    call_kwargs = mock_patch.client.messages.stream.call_args
    system_prompt = call_kwargs.kwargs.get("system") or call_kwargs[1].get("system")
    assert "123 Main St, Ashland" in system_prompt
    assert "Zone 3" in system_prompt
    assert "Glossy abelia" in system_prompt
    assert "Oregon grape" in system_prompt


@pytest.mark.asyncio
async def test_chat_stream_history_forwarded(client):
    fake_ctx = FakeStreamContext(["response"])
    with _patch_chat_client(fake_ctx) as mock_patch:
        response = await client.post(
            "/chat/stream",
            json={
                "message": "Follow-up question",
                "history": [
                    {"role": "user", "content": "First question"},
                    {"role": "assistant", "content": "First answer"},
                ],
            },
        )
    assert response.status_code == 200

    call_kwargs = mock_patch.client.messages.stream.call_args
    messages = call_kwargs.kwargs.get("messages") or call_kwargs[1].get("messages")
    assert len(messages) == 3
    assert messages[0] == {"role": "user", "content": "First question"}
    assert messages[1] == {"role": "assistant", "content": "First answer"}
    assert messages[2] == {"role": "user", "content": "Follow-up question"}
