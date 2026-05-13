"""Shared fuzzy address-search algorithm.

Both the GIS-backed `/parcels` router and the AllClear resolve endpoint share
the same parse → primary-query → sibling-score → promote-or-suggest routine.
This module hosts that algorithm with no GIS or database knowledge — the
caller supplies fetcher callbacks that adapt to its data source.
"""

from __future__ import annotations

from collections.abc import Awaitable, Callable
from typing import Any

from rapidfuzz import fuzz

from app.services.address_normalizer import normalize_address, parse_address


PROMOTE_THRESHOLD = 85
SUGGEST_THRESHOLD = 70
PROMOTE_MARGIN = 5
MAX_SUGGESTIONS = 5


FetchPrimary = Callable[[str | None, str], Awaitable[list[Any]]]
FetchSiblings = Callable[[str], Awaitable[list[dict]]]
FetchById = Callable[[str], Awaitable[Any | None]]


async def run_fuzzy_search(
    address: str,
    fetch_primary: FetchPrimary,
    fetch_siblings: FetchSiblings,
    fetch_by_id: FetchById,
    id_key: str = "id",
) -> dict:
    """Run the shared fuzzy search and return ``{parcels, suggestions}``.

    Callbacks abstract the data source:
      - ``fetch_primary(number, street)`` returns already-built result records.
      - ``fetch_siblings(number)`` returns dicts containing at least ``address``
        and the caller's id key, used for fuzzy scoring when the primary query
        misses.
      - ``fetch_by_id(id_value)`` returns a fully-built record (used to re-fetch
        a promoted suggestion with complete data), or ``None``.
      - ``id_key`` names the field that carries the record id in both sibling
        dicts and emitted suggestions. GIS uses ``"taxlot_id"``; AllClear will
        use ``"hash_code"``.
    """
    parsed = parse_address(address)
    normalized = normalize_address(address)

    if not parsed["street"]:
        return {"parcels": [], "suggestions": []}

    number = parsed["number"]
    street = parsed["street"]

    parcels = await fetch_primary(number, street)
    suggestions: list[dict] = []

    # Fuzzy fallback only fires when we have a number to anchor the sibling
    # query and got no direct hits.
    if not parcels and number:
        siblings = await fetch_siblings(number)

        scored: list[dict] = []
        for sib in siblings:
            sib_address = sib.get("address")
            sib_id = sib.get(id_key)
            if not sib_address or not sib_id:
                continue
            score = fuzz.WRatio(normalized, sib_address)
            if score >= SUGGEST_THRESHOLD:
                scored.append(
                    {
                        "address": sib_address,
                        id_key: sib_id,
                        "score": int(round(score)),
                    }
                )

        scored.sort(key=lambda s: s["score"], reverse=True)
        scored = scored[:MAX_SUGGESTIONS]

        # Promote when the top score clears the bar AND clearly beats the
        # runner-up — protects against ambiguous near-ties.
        if scored:
            top = scored[0]
            margin_ok = (
                len(scored) == 1
                or (top["score"] - scored[1]["score"]) >= PROMOTE_MARGIN
            )
            if top["score"] >= PROMOTE_THRESHOLD and margin_ok:
                promoted = await fetch_by_id(top[id_key])
                if promoted is not None:
                    parcels = list(parcels) + [promoted]
                    scored = [s for s in scored if s[id_key] != top[id_key]]

        suggestions = scored

    return {"parcels": parcels, "suggestions": suggestions}
