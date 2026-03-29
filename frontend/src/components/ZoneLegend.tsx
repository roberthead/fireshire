import { useState, useEffect } from "react";
import { useMapContext } from "../hooks/useMapContext";

const ZONES = [
  {
    id: "zone1",
    label: "Zone 1",
    range: "0–5 ft",
    color: "#e53e3e",
    strategy: "Non-combustible zone",
  },
  {
    id: "zone2",
    label: "Zone 2",
    range: "5–10 ft",
    color: "#ed8936",
    strategy: "Ember catch zone",
  },
  {
    id: "zone3",
    label: "Zone 3",
    range: "10–30 ft",
    color: "#ecc94b",
    strategy: "Lean, clean, green planting",
  },
  {
    id: "zone4",
    label: "Zone 4",
    range: "30–100 ft",
    color: "#48bb78",
    strategy: "Reduce fuel continuity",
  },
] as const;

export function ZoneLegend() {
  const { zoneVisibility, toggleZoneVisibility, zonesReady } = useMapContext();
  const mql =
    typeof window !== "undefined"
      ? window.matchMedia("(max-width: 479px)")
      : null;
  const [expanded, setExpanded] = useState(() => !mql?.matches);
  const [isMobile, setIsMobile] = useState(() => mql?.matches ?? false);

  useEffect(() => {
    if (!mql) return;
    const handler = (e: MediaQueryListEvent) => {
      setIsMobile(e.matches);
      if (e.matches) setExpanded(false);
      else setExpanded(true);
    };
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, [mql]);

  if (isMobile && !expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        aria-label="Show zone legend"
        style={{
          width: 44,
          height: 44,
          borderRadius: 8,
          border: "1px solid rgba(255,255,255,0.25)",
          background: "rgba(0,0,0,0.5)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          color: "#fff",
          fontSize: "1.2rem",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        ◧
      </button>
    );
  }

  return (
    <div
      style={{
        background: "rgba(0, 0, 0, 0.55)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        border: "1px solid rgba(255,255,255,0.2)",
        borderRadius: 8,
        padding: "0.75rem",
        boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
        minWidth: 200,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "0.5rem",
        }}
      >
        <strong style={{ fontSize: "0.85rem", color: "#fff" }}>
          Fire Zones
        </strong>
        {isMobile && (
          <button
            onClick={() => setExpanded(false)}
            aria-label="Hide zone legend"
            style={{
              background: "none",
              border: "none",
              color: "#94a3b8",
              cursor: "pointer",
              fontSize: "1rem",
              padding: 0,
            }}
          >
            ✕
          </button>
        )}
      </div>
      {ZONES.map((z) => {
        const visible = zoneVisibility[z.id] ?? true;
        return (
          <button
            key={z.id}
            type="button"
            onClick={() => toggleZoneVisibility(z.id)}
            disabled={!zonesReady}
            aria-pressed={visible}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              width: "100%",
              padding: "0.3rem 0",
              background: "none",
              border: "none",
              cursor: zonesReady ? "pointer" : "default",
              opacity: visible ? 1 : 0.4,
              transition: "opacity 150ms ease",
              textAlign: "left",
            }}
          >
            <span
              style={{
                width: 14,
                height: 14,
                background: z.color,
                borderRadius: 2,
                display: "inline-block",
                flexShrink: 0,
                filter: visible ? "none" : "grayscale(100%)",
                transition: "filter 150ms ease",
              }}
            />
            <span
              style={{ fontSize: "0.8rem", color: "#e2e8f0", lineHeight: 1.3 }}
            >
              <span style={{ fontWeight: 500 }}>
                {z.label} ({z.range})
              </span>
              <br />
              <span style={{ fontSize: "0.7rem", color: "#94a3b8" }}>
                {z.strategy}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
