const ZONE_TO_DISPLAY: Record<string, string> = {
  zone1: '0-5',
  zone2: '5-10',
  zone3: '10-30',
  zone4: '30-100',
}

export function activeZoneDisplayNames(
  visibility: Record<string, boolean>,
): string[] {
  return Object.entries(visibility)
    .filter(([, visible]) => visible)
    .map(([id]) => ZONE_TO_DISPLAY[id])
    .filter((name): name is string => name !== undefined)
}
