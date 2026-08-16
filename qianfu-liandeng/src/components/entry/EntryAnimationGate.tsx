import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Player, type PlayerRef } from '@remotion/player';
import MinecraftFlightComposition, { durationInFrames, fps } from './MinecraftFlightComposition';
import {
  markEntryAnimationPlayed,
  readEntryAnimationStorage,
  shouldPlayEntryAnimation,
} from './entryAnimationState';

const getPrefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

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

const EntryAnimationGate: React.FC<EntryAnimationGateProps> = ({ children, playerComponent: PlayerComponent }) => {
  const [isVisible, setIsVisible] = useState(false);
  const playerRef = useRef<PlayerRef>(null);
  const finish = useCallback(() => {
    markEntryAnimationPlayed(readEntryAnimationStorage());
    setIsVisible(false);
  }, []);

  useEffect(() => {
    const storage = readEntryAnimationStorage();
    if (!shouldPlayEntryAnimation(storage, getPrefersReducedMotion())) return;

    setIsVisible(true);
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') finish();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [finish]);

  useEffect(() => {
    if (!isVisible || PlayerComponent) return;

    const player = playerRef.current;
    if (!player) return;

    player.addEventListener('ended', finish);
    player.addEventListener('error', finish);
    // Remotion's own autoplay runs too; this starts muted timelines that a browser paused.
    const startTimer = window.setTimeout(() => player.play(), 0);

    return () => {
      window.clearTimeout(startTimer);
      player.removeEventListener('ended', finish);
      player.removeEventListener('error', finish);
    };
  }, [PlayerComponent, finish, isVisible]);

  const renderPlayer = (props: EntryAnimationPlayerProps) => {
    if (PlayerComponent) return <PlayerComponent {...props} />;
    return (
      <Player
        ref={playerRef}
        component={props.component}
        durationInFrames={props.durationInFrames}
        compositionWidth={props.compositionWidth}
        compositionHeight={props.compositionHeight}
        fps={props.fps}
        autoPlay={props.autoPlay}
        initiallyMuted={props.initiallyMuted}
        controls={props.controls}
        style={props.style}
      />
    );
  };

  return (
    <>
      {children}
      {isVisible && (
        <>
          <div
            data-testid="entry-animation"
            aria-hidden="true"
            className="fixed inset-0 z-[100] overflow-hidden bg-[#0b1220]"
          >
            {renderPlayer({
              component: MinecraftFlightComposition,
              durationInFrames,
              compositionWidth: 1440,
              compositionHeight: 900,
              fps,
              autoPlay: true,
              initiallyMuted: true,
              controls: false,
              style: { width: '100%', height: '100%' },
              onEnded: finish,
              onError: finish,
            })}
          </div>
          <button
            type="button"
            aria-label="跳过入场动画"
            onClick={finish}
            className="fixed right-5 top-5 z-[101] rounded-full border border-white/30 bg-black/35 px-4 py-2 text-xs font-semibold text-white backdrop-blur-sm transition-colors hover:bg-black/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            跳过
          </button>
        </>
      )}
    </>
  );
};

export default EntryAnimationGate;
