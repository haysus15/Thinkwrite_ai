const AVATAR_COLORS = [
  "#5B6EAE",
  "#7E5BAE",
  "#AE5B8A",
  "#5BAE8A",
  "#AE8A5B",
  "#5B9AAE",
  "#8AAE5B",
  "#AE5B5B",
] as const;

export function deriveAvatarColor(name: string): string {
  if (!name) return AVATAR_COLORS[0];
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash += name.charCodeAt(i);
  }
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

export function getInitials(name: string): string {
  if (!name?.trim()) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].substring(0, 2).toUpperCase();
  }
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}
