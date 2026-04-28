from app.services.address_normalizer import (
    escape_sql_literal,
    normalize_address,
    parse_address,
)


# --- parse_address ---------------------------------------------------------


def test_parse_address_basic_st():
    assert parse_address("2770 Diane St") == {"number": "2770", "street": "DIANE ST"}


def test_parse_address_street_to_st():
    assert parse_address("2770 Diane Street") == {
        "number": "2770",
        "street": "DIANE ST",
    }


def test_parse_address_trailing_period():
    assert parse_address("2770 DIANE ST.") == {"number": "2770", "street": "DIANE ST"}


def test_parse_address_avenue_with_directional():
    assert parse_address("100 N Main Avenue") == {
        "number": "100",
        "street": "N MAIN AVE",
    }


def test_parse_address_full_directional():
    assert parse_address("100 North Main Ave") == {
        "number": "100",
        "street": "N MAIN AVE",
    }


def test_parse_address_no_number():
    assert parse_address("Diane St") == {"number": None, "street": "DIANE ST"}


def test_parse_address_collapses_whitespace():
    assert parse_address("  570  siskiyou  ") == {
        "number": "570",
        "street": "SISKIYOU",
    }


# --- escape_sql_literal ----------------------------------------------------


def test_escape_single_quote():
    assert escape_sql_literal("O'Brien") == "O''Brien"


def test_escape_no_quote():
    assert escape_sql_literal("plain") == "plain"


def test_escape_already_doubled():
    # Naive doubling: prior `''` becomes `''''`. Acceptable for our use.
    assert escape_sql_literal("a''b") == "a''''b"


# --- normalize_address (sanity) -------------------------------------------


def test_normalize_address_uppercases_and_collapses():
    assert normalize_address("  570  siskiyou  ") == "570 SISKIYOU"
