export type ExpiryUnit = "hours" | "days" | "months" | "forever";

export interface ExpiryOption {
  label: string;
  unit: ExpiryUnit;
  values?: number[];
}

export const EXPIRY_OPTIONS: ExpiryOption[] = [
  { label: "Forever", unit: "forever" },
  { label: "Hours", unit: "hours", values: [1, 2, 3, 6, 12, 24] },
  { label: "Days", unit: "days", values: [1, 2, 3, 7, 14, 21] },
  { label: "Months", unit: "months", values: [1, 2, 3, 6, 12, 24] },
];

export function calculateExpiresAt(
  unit: ExpiryUnit,
  value?: number
): string | null {
  if (unit === "forever" || !value) return null;

  const now = new Date();

  switch (unit) {
    case "hours":
      now.setHours(now.getHours() + value);
      break;
    case "days":
      now.setDate(now.getDate() + value);
      break;
    case "months":
      now.setMonth(now.getMonth() + value);
      break;
  }

  return now.toISOString();
}

export function formatExpiry(expiresAt: string | null): string {
  if (!expiresAt) return "Never";

  const expires = new Date(expiresAt);
  const now = new Date();
  const diff = expires.getTime() - now.getTime();

  if (diff <= 0) return "Expired";

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);
  const months = Math.floor(days / 30);

  if (months > 0) return `${months}mo left`;
  if (days > 0) return `${days}d left`;
  if (hours > 0) return `${hours}h left`;
  return "< 1h left";
}
