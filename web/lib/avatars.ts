/**
 * Avatar filenames in public/avatars/. Add new files here when you add images.
 */
export const AVATAR_OPTIONS = [
  "Bishop.png",
  "Horse.png",
  "King.png",
  "Pawn.png",
  "Queen.png",
  "Tower.png",
] as const;

export type AvatarFilename = (typeof AVATAR_OPTIONS)[number];

export function isAllowedAvatar(value: unknown): value is AvatarFilename {
  return typeof value === "string" && (AVATAR_OPTIONS as readonly string[]).includes(value);
}

export function avatarUrl(filename: string | null | undefined): string {
  if (!filename) return "";
  return `/avatars/${filename}`;
}
