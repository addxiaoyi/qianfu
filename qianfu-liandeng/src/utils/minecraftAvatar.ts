const MINECRAFT_USERNAME_PATTERN = /^[A-Za-z0-9_]{3,16}$/;

export const isMinecraftUsername = (value: string): boolean =>
  MINECRAFT_USERNAME_PATTERN.test(value);

export const getMinotarAvatarUrl = (
  player: string,
  enabled: boolean,
  size = 160,
): string | null => {
  if (!enabled || !isMinecraftUsername(player)) return null;
  return `https://minotar.net/helm/${encodeURIComponent(player)}/${size}.png`;
};
