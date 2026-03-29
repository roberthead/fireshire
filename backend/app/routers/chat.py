from __future__ import annotations

from typing import Literal

import anthropic
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.services.chat_client import AnthropicError, chat_client

router = APIRouter()


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class ChatContext(BaseModel):
    address: str | None = None
    zones: list[str] = []
    plants: list[str] = []  # common names of visible plants


class ChatRequest(BaseModel):
    message: str
    history: list[ChatMessage] = []
    context: ChatContext | None = None


STATIC_SYSTEM_PROMPT = (
    "You are a fire-resilient landscaping advisor for properties in Ashland, Oregon. "
    "You help homeowners understand defensible space based on CAL FIRE and IBHS "
    "Home Ignition Zone principles.\n\n"
    "Zone model:\n"
    "- Zone 1 (0-5 ft, red): Immediate zone — non-combustible materials, no plants.\n"
    "- Zone 2 (5-10 ft, orange): Near structure — fire-resistant ground cover, "
    "no woody plants or mulch.\n"
    "- Zone 3 (10-30 ft, yellow): Intermediate zone — well-spaced, fire-resistant "
    "plants; remove ladder fuels.\n"
    "- Zone 4 (30-100 ft, green): Extended zone — thin trees, reduce density, "
    "create fuel breaks.\n\n"
    "Be concise and practical. Focus on actionable advice."
)


def build_system_prompt(context: ChatContext | None) -> str:
    prompt = STATIC_SYSTEM_PROMPT
    if context is None:
        return prompt

    parts: list[str] = []
    if context.address:
        parts.append(f"The user's property address is: {context.address}")
    if context.zones:
        parts.append(f"Active fire zones being viewed: {', '.join(context.zones)}")
    if context.plants:
        parts.append(
            f"Plants currently visible in the panel: {', '.join(context.plants)}"
        )

    if parts:
        prompt += "\n\nCurrent context:\n" + "\n".join(parts)

    return prompt


@router.post("/chat/stream")
async def chat_stream(request: ChatRequest):
    system_prompt = build_system_prompt(request.context)

    messages: list[dict] = [
        {"role": m.role, "content": m.content} for m in request.history
    ]
    messages.append({"role": "user", "content": request.message})

    async def generate():
        try:
            async with chat_client.client.messages.stream(
                model="claude-sonnet-4-6",
                max_tokens=2048,
                system=system_prompt,
                messages=messages,
            ) as stream:
                async for text in stream.text_stream:
                    yield f"data: {text}\n\n"
            yield "data: [DONE]\n\n"
        except (anthropic.APIError, TypeError) as exc:
            yield f"data: [ERROR] {exc}\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )
