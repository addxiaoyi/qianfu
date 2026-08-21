import React from 'react';

export type EntryAnimationPlayerProps = {
  component: React.ComponentType;
  durationInFrames: number;
  compositionWidth: number;
  compositionHeight: number;
  fps: number;
  autoPlay: boolean;
  initiallyMuted: boolean;
  controls: boolean;
  style: React.CSSProperties;
  onEnded: () => void;
  onError: () => void;
};

type EntryAnimationGateProps = {
  children: React.ReactNode;
  playerComponent?: React.ComponentType<EntryAnimationPlayerProps>;
};

const EntryAnimationGate: React.FC<EntryAnimationGateProps> = ({ children }) => <>{children}</>;

export default EntryAnimationGate;
