import { computeZoneAreas } from "../lib/computeZoneAreas";
import type { ZoneResult } from "../lib/computeZoneRings";

export interface ZoneSummaryProps {
  address: string;
  buildingCount: number;
  zones: ZoneResult;
}

export function ZoneSummary({ address, buildingCount, zones }: ZoneSummaryProps) {
  const areas = computeZoneAreas(zones);

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
