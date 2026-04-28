"""Address normalization helpers for ArcGIS Taxlot lookups.

Provides three pieces of public surface:

- ``normalize_address(raw)`` — uppercase + whitespace-collapse only. Preserves
  the historical contract used by callers that just want cleaned-up input
  (e.g. for fuzzy scoring against ``SITEADD``).
- ``parse_address(raw)`` — splits a leading numeric token (if any) off from
  the remaining street tokens, normalizing USPS suffixes and directionals.
- ``escape_sql_literal(value)`` — doubles single quotes so values can be
  safely interpolated into ArcGIS ``where`` clauses.
"""

from __future__ import annotations

import re
from typing import TypedDict


class ParsedAddress(TypedDict):
    number: str | None
    street: str


# USPS Publication 28 — common suffix abbreviations.
# Applied per token after stripping a trailing "." so "ST." also matches.
SUFFIX_MAP: dict[str, str] = {
    "STREET": "ST",
    "STR": "ST",
    "ST": "ST",
    "AVENUE": "AVE",
    "AVE": "AVE",
    "BOULEVARD": "BLVD",
    "BLVD": "BLVD",
    "ROAD": "RD",
    "RD": "RD",
    "DRIVE": "DR",
    "DR": "DR",
    "LANE": "LN",
    "LN": "LN",
    "COURT": "CT",
    "CT": "CT",
    "PLACE": "PL",
    "PL": "PL",
    "CIRCLE": "CIR",
    "CIR": "CIR",
    "TERRACE": "TER",
    "TER": "TER",
    "PARKWAY": "PKWY",
    "PKWY": "PKWY",
    "HIGHWAY": "HWY",
    "HWY": "HWY",
    "WAY": "WAY",
    "TRAIL": "TRL",
    "TRL": "TRL",
    "SQUARE": "SQ",
    "SQ": "SQ",
}

DIRECTIONAL_MAP: dict[str, str] = {
    "NORTH": "N",
    "SOUTH": "S",
    "EAST": "E",
    "WEST": "W",
    "NORTHEAST": "NE",
    "NORTHWEST": "NW",
    "SOUTHEAST": "SE",
    "SOUTHWEST": "SW",
    "N": "N",
    "S": "S",
    "E": "E",
    "W": "W",
    "NE": "NE",
    "NW": "NW",
    "SE": "SE",
    "SW": "SW",
}


_NUMBER_RE = re.compile(r"^\d+$")


def normalize_address(raw: str) -> str:
    """Uppercase and collapse whitespace. No suffix/directional rewriting."""
    return " ".join(raw.upper().split())


def _normalize_token(token: str) -> str:
    """Strip a trailing period and apply directional/suffix maps."""
    bare = token.rstrip(".")
    if bare in DIRECTIONAL_MAP:
        return DIRECTIONAL_MAP[bare]
    if bare in SUFFIX_MAP:
        return SUFFIX_MAP[bare]
    return bare


def parse_address(raw: str) -> ParsedAddress:
    """Split number from street and canonicalize remaining tokens."""
    cleaned = normalize_address(raw)
    if not cleaned:
        return {"number": None, "street": ""}

    tokens = [_normalize_token(tok) for tok in cleaned.split()]
    # Filter empty tokens (e.g. a stray "." that became "")
    tokens = [tok for tok in tokens if tok]

    if not tokens:
        return {"number": None, "street": ""}

    if _NUMBER_RE.match(tokens[0]):
        number = tokens[0]
        street_tokens = tokens[1:]
    else:
        number = None
        street_tokens = tokens

    return {"number": number, "street": " ".join(street_tokens)}


def escape_sql_literal(value: str) -> str:
    """Double any single quotes so the value is safe inside ArcGIS where clauses."""
    return value.replace("'", "''")
