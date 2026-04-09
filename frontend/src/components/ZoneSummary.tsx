import { useState } from "react";
import { computeZoneAreas } from "../lib/computeZoneAreas";
import type { ZoneResult } from "../lib/computeZoneRings";
import { searchParcels, saveMapResult } from "../lib/allclearApi";

export interface ZoneSummaryProps {
  address: string;
  buildingCount: number;
  zones: ZoneResult;
}

export function ZoneSummary({ address, buildingCount, zones }: ZoneSummaryProps) {
  const areas = computeZoneAreas(zones);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      // Match address to an AllClear parcel
      const parcels = await searchParcels(address);
      if (parcels.length === 0) {
        setError("Property not found in our database.");
        setSaving(false);
        return;
      }
      const parcel = parcels[0];

      // Save map result and mark map_complete
      const result = await saveMapResult(parcel.hash_code, {
        buildings_count: buildingCount,
      });

      setSaved(true);

      // Check if survey is done — if not, redirect
      if (!result.survey_complete) {
        window.location.href = `/survey/${parcel.hash_code}`;
      } else {
        window.location.href = `/complete/${parcel.hash_code}`;
      }
    } catch {
      setError("Could not save. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section
      aria-labelledby="zone-summary-heading"
      style={{
        background: "rgba(0, 0, 0, 0.55)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        border: "1px solid rgba(255,255,255,0.2)",
        borderRadius: 8,
        padding: "0.75rem",
        maxHeight: "40vh",
        overflowY: "auto",
        minWidth: 220,
      }}
    >
      <h2
        id="zone-summary-heading"
        style={{
          fontSize: "0.85rem",
          color: "#fff",
          margin: "0 0 0.5rem 0",
        }}
      >
        Zone Summary
      </h2>

      <p style={{ fontSize: "0.8rem", color: "#e2e8f0", margin: "0 0 0.25rem 0" }}>
        Property: {address}
      </p>
      <p style={{ fontSize: "0.8rem", color: "#e2e8f0", margin: "0 0 0.5rem 0" }}>
        Buildings detected: {buildingCount}
      </p>

      <dl style={{ margin: 0 }}>
        {areas.map((z) => (
          <div key={z.zoneLabel} style={{ padding: "0.2rem 0" }}>
            <dt
              style={{
                fontSize: "0.8rem",
                color: "#e2e8f0",
                fontWeight: 500,
              }}
            >
              {z.zoneLabel} ({z.distanceBand})
            </dt>
            <dd
              style={{
                fontSize: "0.7rem",
                color: "#94a3b8",
                margin: "0 0 0 0.5rem",
              }}
            >
              ~{z.areaSqFt.toLocaleString()} sq ft
            </dd>
          </div>
        ))}
      </dl>

      <button
        type="button"
        onClick={handleSave}
        disabled={saving || saved}
        style={{
          marginTop: "0.75rem",
          width: "100%",
          padding: "0.5rem",
          border: "none",
          borderRadius: 6,
          background: saved ? "#22c55e" : "#4CAF50",
          color: "#fff",
          fontWeight: 600,
          fontSize: "0.8rem",
          cursor: saving || saved ? "default" : "pointer",
          opacity: saving ? 0.6 : 1,
          minHeight: 44,
          transition: "opacity 150ms ease",
        }}
      >
        {saving ? "Saving..." : saved ? "Saved!" : "Save My Results"}
      </button>

      {error && (
        <p style={{ fontSize: "0.75rem", color: "#fca5a5", marginTop: "0.25rem" }}>
          {error}
        </p>
      )}

      <div
        aria-live="polite"
        style={{
          position: "absolute",
          width: 1,
          height: 1,
          overflow: "hidden",
          clip: "rect(0,0,0,0)",
        }}
      >
        Zone analysis complete for {address}. 4 zones identified.
      </div>
    </section>
  );
}
