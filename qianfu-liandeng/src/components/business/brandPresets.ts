export type BrandPreset = {
  label: string;
  bg: string;
  fg: string;
  glow?: string;
};

type BrandRule = {
  match?: (path: string) => boolean;
  preset: BrandPreset;
};

export type RuntimeBrandRule = {
  match?: unknown;
  preset: BrandPreset;
};

const PRESETS: BrandRule[] = [
  {
    match: (path) => path.startsWith('/admin'),
    preset: { label: 'A', bg: '#111111', fg: '#ffffff', glow: '#6366f1' },
  },
  {
    match: (path) => path.includes('/tickets'),
    preset: { label: 'T', bg: '#111111', fg: '#fbbf24', glow: '#f59e0b' },
  },
  {
    match: (path) => path.includes('/servers') || path.includes('/server/'),
    preset: { label: 'S', bg: '#111111', fg: '#60a5fa', glow: '#3b82f6' },
  },
  {
    match: (path) => path.includes('/dashboard') || path.includes('/me'),
    preset: { label: 'D', bg: '#111111', fg: '#ffffff', glow: '#8b5cf6' },
  },
  {
    preset: { label: 'Q', bg: '#111111', fg: '#ffffff', glow: '#6366f1' },
  },
];

export function resolveBrandPreset(path: string): BrandPreset {
  return resolveBrandPresetFromRules(PRESETS, path);
}

export function resolveBrandPresetFromRules(
  rules: readonly RuntimeBrandRule[],
  path: string,
): BrandPreset {
  const normalizedPath = path || '/';
  return rules.find(({ match }) => {
    if (match === undefined) return true;
    return typeof match === 'function' && match(normalizedPath);
  })?.preset ?? PRESETS[PRESETS.length - 1].preset;
}
