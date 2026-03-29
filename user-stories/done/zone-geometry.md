# Zone geometry

AS a user
WITH an address selected
WHEN I look at just Zone 2, 3, or 4
I WANT to see an area that is the appropriate distance from any/all structures

## Notes

Zone 1 areas need to be punched out of zone 2 areas
Zone 1 and zone 2 areas need to be punched out of zone 3 areas
Zones 1, 2, and 3 areas need to be punched out of zone 4 areas

Put another way:
Zone 2 needs to be 5-10 feet from a structure and not less than 5 feet from any other structure.
Zone 3 needs to be 10-30 feet from a structure and not less than 10 feet from any other structure.
Zone 3 needs to be 30-100 feet from a structure and not less than 30 feet from any other structure.

## Implementation Plan

### Problem

The current code (`computeZoneRings.ts`) does per-building ring differencing:
- For each building independently: zone2 = buffer(10ft) - buffer(5ft)
- Then unions same-zone rings across buildings

This means when two buildings are close together, Zone 3 of building A can overlap Zone 1 of building B. The user story requires that **any point in Zone 2 must be ≥5ft from ALL structures**, not just the structure that generated it.

### Fix — Cross-building differencing after union

After the existing per-building loop and same-zone union (which stays the same), add a **cross-building subtraction pass**:

```
zone1_final = zone1_unioned                                    (unchanged)
zone2_final = zone2_unioned - zone1_final
zone3_final = zone3_unioned - zone1_final - zone2_final
zone4_final = zone4_unioned - zone1_final - zone2_final - zone3_final
```

This is a small change — ~10 lines added after line 101, before the return.

### Steps

1. **Update `computeZoneRings.ts`** — Add cross-building subtraction pass after the union step. For each zone index `i > 0`, subtract all zones `0..i-1` using `turf.difference()`.

2. **Update `computeZoneRings.test.ts`** — Add a test with two nearby buildings (buffers overlap) that asserts:
   - Zone 2 does not intersect Zone 1 (use `turf.intersect` — expect null)
   - Zone 3 does not intersect Zone 1 or Zone 2
   - Zone 4 does not intersect Zone 1, 2, or 3

3. **Run full validation** (`./scripts/validate.sh`) — existing tests should still pass since the subtraction is a no-op for single isolated buildings.
