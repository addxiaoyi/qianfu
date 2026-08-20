import React from 'react';
import { describe, expect, it } from 'vitest';

import GeometricLantern, {
  type LanternVariant,
} from '../../qianfu-liandeng/src/components/ui/GeometricLantern';

const expectedIcons: Record<LanternVariant, string> = {
  spark: 'lamp-desk',
  security: 'shield-check',
  user: 'user-round',
  data: 'database',
  settings: 'settings-2',
  terminal: 'square-terminal',
  network: 'network',
  payment: 'credit-card',
  activity: 'activity',
  alert: 'triangle-alert',
  server: 'server',
  menu: 'menu',
  close: 'x',
  chevron: 'chevron-down',
  check: 'check',
  mail: 'mail',
  bell: 'bell',
  logout: 'log-out',
  message: 'message-square',
  gift: 'gift',
  award: 'award',
  search: 'search',
  heart: 'heart',
  tag: 'tag',
};

describe('GeometricLantern', () => {
  it('renders a distinct semantic icon for every functional variant', () => {
    const renderedIcons = Object.entries(expectedIcons).map(([variant, icon]) => {
      const element = GeometricLantern({
        variant: variant as LanternVariant,
        'aria-label': variant,
      }) as React.ReactElement<{ 'data-lucide': string }>;

      expect(element.props['data-lucide']).toBe(icon);
      return icon;
    });

    expect(new Set(renderedIcons).size).toBe(renderedIcons.length);
  });
});
