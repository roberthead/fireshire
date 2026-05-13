"""Unit tests for the shared fuzzy address-search algorithm.

Exercises run_fuzzy_search with stub fetchers — no GIS, no DB. Integration
coverage of the GIS adapter lives in test_parcels.py.
"""

import pytest

from app.services.address_search import (
    PROMOTE_THRESHOLD,
    SUGGEST_THRESHOLD,
    run_fuzzy_search,
)


def _stub_fetchers(*, primary=None, siblings=None, by_id=None):
    """Build async fetcher stubs that record their calls."""
    calls = {"primary": [], "siblings": [], "by_id": []}

    async def fetch_primary(number, street):
        calls["primary"].append((number, street))
        return list(primary or [])

    async def fetch_siblings(number):
        calls["siblings"].append(number)
        return list(siblings or [])

    async def fetch_by_id(id_value):
        calls["by_id"].append(id_value)
        return (by_id or {}).get(id_value)

    return fetch_primary, fetch_siblings, fetch_by_id, calls


@pytest.mark.asyncio
async def test_returns_primary_hits_without_fallback():
    primary, siblings, by_id, calls = _stub_fetchers(
        primary=[{"address": "570 SISKIYOU BLVD", "taxlot_id": "T1"}],
    )
    result = await run_fuzzy_search(
        "570 Siskiyou Blvd", primary, siblings, by_id, id_key="taxlot_id",
    )
    assert result == {
        "parcels": [{"address": "570 SISKIYOU BLVD", "taxlot_id": "T1"}],
        "suggestions": [],
    }
    assert calls["siblings"] == []  # no fallback when primary hits
    assert calls["by_id"] == []


@pytest.mark.asyncio
async def test_empty_street_short_circuits():
    primary, siblings, by_id, calls = _stub_fetchers()
    result = await run_fuzzy_search(
        "   ", primary, siblings, by_id, id_key="taxlot_id",
    )
    assert result == {"parcels": [], "suggestions": []}
    assert calls == {"primary": [], "siblings": [], "by_id": []}


@pytest.mark.asyncio
async def test_no_number_skips_sibling_fallback():
    primary, siblings, by_id, calls = _stub_fetchers(primary=[])
    result = await run_fuzzy_search(
        "Siskiyou", primary, siblings, by_id, id_key="taxlot_id",
    )
    assert result == {"parcels": [], "suggestions": []}
    assert calls["primary"] == [(None, "SISKIYOU")]
    assert calls["siblings"] == []


@pytest.mark.asyncio
async def test_promotes_clear_winner():
    promoted_record = {"address": "2770 DIANE ST", "taxlot_id": "T1"}
    primary, siblings, by_id, calls = _stub_fetchers(
        primary=[],
        siblings=[
            {"address": "2770 DIANE ST", "taxlot_id": "T1"},
            {"address": "2770 OTHER WAY", "taxlot_id": "T2"},
            {"address": "2770 SOMEWHERE BLVD", "taxlot_id": "T3"},
        ],
        by_id={"T1": promoted_record},
    )
    result = await run_fuzzy_search(
        "2770 Dianne St", primary, siblings, by_id, id_key="taxlot_id",
    )
    assert promoted_record in result["parcels"]
    # Promoted entry must be removed from suggestions.
    assert all(s["taxlot_id"] != "T1" for s in result["suggestions"])
    assert calls["by_id"] == ["T1"]


@pytest.mark.asyncio
async def test_returns_suggestions_when_no_clear_winner():
    # Two near-tie matches in the SUGGEST band — neither promotes.
    primary, siblings, by_id, calls = _stub_fetchers(
        primary=[],
        siblings=[
            {"address": "2770 DIANE AVE", "taxlot_id": "T1"},
            {"address": "2770 DIANE BLVD", "taxlot_id": "T2"},
        ],
    )
    result = await run_fuzzy_search(
        "2770 DIANE ST", primary, siblings, by_id, id_key="taxlot_id",
    )
    assert result["parcels"] == []
    assert len(result["suggestions"]) >= 1
    # Scores must be sorted descending.
    scores = [s["score"] for s in result["suggestions"]]
    assert scores == sorted(scores, reverse=True)
    # Top score is below the promote threshold for this case.
    assert scores[0] < PROMOTE_THRESHOLD
    assert scores[0] >= SUGGEST_THRESHOLD
    assert calls["by_id"] == []


@pytest.mark.asyncio
async def test_margin_blocks_close_promotion():
    # Two identical scores: top is at PROMOTE_THRESHOLD but margin is 0.
    primary, siblings, by_id, calls = _stub_fetchers(
        primary=[],
        siblings=[
            {"address": "100 PINE ST", "taxlot_id": "T1"},
            {"address": "100 PINE ST", "taxlot_id": "T2"},
        ],
    )
    result = await run_fuzzy_search(
        "100 Pine St", primary, siblings, by_id, id_key="taxlot_id",
    )
    assert result["parcels"] == []
    assert calls["by_id"] == []
    assert len(result["suggestions"]) >= 2


@pytest.mark.asyncio
async def test_no_siblings_returns_empty():
    primary, siblings, by_id, _ = _stub_fetchers(primary=[], siblings=[])
    result = await run_fuzzy_search(
        "9999 NOWHERE ST", primary, siblings, by_id, id_key="taxlot_id",
    )
    assert result == {"parcels": [], "suggestions": []}


@pytest.mark.asyncio
async def test_uses_custom_id_key():
    # Same shape, different id field — proves the service adapts to caller vocab.
    primary, siblings, by_id, _ = _stub_fetchers(
        primary=[],
        siblings=[
            {"address": "2770 DIANE ST", "hash_code": "abc123"},
            {"address": "2770 OTHER WAY", "hash_code": "def456"},
        ],
        by_id={"abc123": {"address": "2770 DIANE ST", "hash_code": "abc123"}},
    )
    result = await run_fuzzy_search(
        "2770 Dianne St", primary, siblings, by_id, id_key="hash_code",
    )
    assert any(p.get("hash_code") == "abc123" for p in result["parcels"])
    for s in result["suggestions"]:
        assert "hash_code" in s
        assert "taxlot_id" not in s


@pytest.mark.asyncio
async def test_suggestions_capped_at_max():
    siblings_list = [
        {"address": f"2770 STREET {i:02d}", "taxlot_id": f"T{i}"} for i in range(20)
    ]
    primary, siblings, by_id, _ = _stub_fetchers(primary=[], siblings=siblings_list)
    result = await run_fuzzy_search(
        "2770 STREET 00", primary, siblings, by_id, id_key="taxlot_id",
    )
    # MAX_SUGGESTIONS == 5 (plus possibly one promoted).
    assert len(result["suggestions"]) <= 5
