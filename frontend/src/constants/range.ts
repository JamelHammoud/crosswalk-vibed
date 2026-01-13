export const DROP_RANGES = {
  close: { label: "Close", meters: 15, description: "Within 15 meters" },
  far: { label: "Far", meters: 100, description: "Within 100 meters" },
  anywhere: { label: "Anywhere", meters: Infinity, description: "No limit" },
} as const;

export type DropRangeType = keyof typeof DROP_RANGES;

export const DROP_RANGE_OPTIONS: DropRangeType[] = ["close", "far", "anywhere"];

export function getRangeMeters(range: DropRangeType): number {
  return DROP_RANGES[range].meters;
}

export function getRangeLabel(range: DropRangeType): string {
  return DROP_RANGES[range].label;
}

export function isWithinDropRange(
  range: DropRangeType,
  distanceMeters: number,
  isOwnDrop: boolean = false
): boolean {
  if (isOwnDrop) return true;
  return distanceMeters <= DROP_RANGES[range].meters;
}
