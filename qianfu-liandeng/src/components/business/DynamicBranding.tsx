import { useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { resolveBrandPreset, type BrandPreset } from './brandPresets';

const ensureLink = (selector: string, rel: string) => {
  let node = document.head.querySelector<HTMLLinkElement>(selector);
  if (!node) {
    node = document.createElement('link');
    node.rel = rel;
    document.head.appendChild(node);
  }
  return node;
};

const buildFaviconSvg = ({ label, bg, fg, glow }: BrandPreset) => {
  const safeLabel = label.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
      <defs>
        <filter id="g" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="${glow || bg}" flood-opacity="0.28"/>
        </filter>
      </defs>
      <rect width="64" height="64" rx="18" fill="${bg}" />
      <rect x="6" y="6" width="52" height="52" rx="15" fill="none" stroke="rgba(255,255,255,0.08)" />
      <circle cx="50" cy="14" r="4" fill="${glow || fg}" opacity="0.9" />
      <text x="32" y="40" text-anchor="middle" font-family="Geist, Inter, Arial, sans-serif" font-size="30" font-weight="900" fill="${fg}" filter="url(#g)">${safeLabel}</text>
    </svg>
  `.trim();
};

export default function DynamicBranding() {
  const location = useLocation();

  const preset = useMemo(() => {
    return resolveBrandPreset(location.pathname);
  }, [location.pathname]);

  useEffect(() => {
    const svg = buildFaviconSvg(preset);
    const encoded = `data:image/svg+xml,${encodeURIComponent(svg)}`;

    const favicon = ensureLink('link[rel="icon"]', 'icon');
    favicon.type = 'image/svg+xml';
    favicon.href = encoded;

    const apple = ensureLink('link[rel="apple-touch-icon"]', 'apple-touch-icon');
    apple.href = encoded;

    let themeMeta = document.head.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (!themeMeta) {
      themeMeta = document.createElement('meta');
      themeMeta.name = 'theme-color';
      document.head.appendChild(themeMeta);
    }
    themeMeta.content = preset.bg;
  }, [preset]);

  return null;
}
