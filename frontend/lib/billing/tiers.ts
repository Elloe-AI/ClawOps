export function displayTierName(tierName?: string | null): string {
  if (!tierName) return "Community";
  const normalized = tierName.toLowerCase().trim();
  if (normalized === "free") return "Community";
  if (normalized === "hobby") return "Pro";
  if (normalized === "pro") return "Pro";
  if (normalized === "unlimited") return "Enterprise";
  return tierName;
}

export function isPaidTier(tierName?: string | null): boolean {
  if (!tierName) return false;
  return tierName.toLowerCase().trim() !== "free";
}
