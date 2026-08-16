import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';

export const durationInFrames = 72;
export const fps = 60;

const stars = [
  [8, 14, 3], [17, 26, 2], [28, 11, 2], [39, 21, 4], [52, 9, 2],
  [64, 31, 3], [73, 17, 2], [84, 12, 3], [91, 28, 2], [46, 38, 2],
] as const;

const terrainBlocks = [
  { x: 2, y: 58, width: 14, height: 15, color: '#34485a', delay: 0 },
  { x: 13, y: 50, width: 17, height: 23, color: '#52636e', delay: 3 },
  { x: 27, y: 61, width: 13, height: 12, color: '#3e5660', delay: 6 },
  { x: 38, y: 45, width: 20, height: 28, color: '#657c7b', delay: 2 },
  { x: 55, y: 57, width: 16, height: 16, color: '#42565f', delay: 5 },
  { x: 68, y: 48, width: 20, height: 25, color: '#516a68', delay: 1 },
  { x: 84, y: 60, width: 15, height: 13, color: '#344a58', delay: 7 },
] as const;

const foregroundBlocks = [
  { x: 7, y: 76, width: 18, height: 18, color: '#536e5e', delay: 10 },
  { x: 25, y: 82, width: 20, height: 12, color: '#6e865f', delay: 14 },
  { x: 48, y: 75, width: 25, height: 19, color: '#415c53', delay: 8 },
  { x: 74, y: 80, width: 22, height: 14, color: '#65805e', delay: 12 },
] as const;

const clamp = { extrapolateLeft: 'clamp' as const, extrapolateRight: 'clamp' as const };

const MinecraftFlightComposition: React.FC = () => {
  const frame = useCurrentFrame();
  const video = useVideoConfig();
  const cameraScale = interpolate(frame, [0, 15, 54, 72], [1.02, 1.04, 1.16, 1.2], clamp);
  const cameraY = interpolate(frame, [0, 54, 72], [5, 0, -5], clamp);
  const sceneOpacity = interpolate(frame, [0, 10, 64, 72], [0, 1, 1, 0], clamp);
  const brandingProgress = spring({
    frame: Math.max(0, frame - 34),
    fps: video.fps,
    config: { damping: 18, stiffness: 130, mass: 0.7 },
  });
  const brandingOpacity = interpolate(brandingProgress, [0, 1], [0, 1], clamp);
  const brandingY = interpolate(brandingProgress, [0, 1], [18, 0], clamp);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#0b1220',
        color: '#f4f0e8',
        overflow: 'hidden',
        opacity: sceneOpacity,
        fontFamily: 'ui-sans-serif, system-ui, sans-serif',
      }}
    >
      <AbsoluteFill
        style={{
          transform: `translate3d(0, ${cameraY}%, 0) scale(${cameraScale})`,
          transformOrigin: 'center center',
        }}
      >
        <AbsoluteFill style={{ backgroundColor: '#111d31' }} />

        {stars.map(([left, top, size], index) => {
          const starOpacity = interpolate(frame, [index, index + 10], [0, 0.85], clamp);
          const driftX = interpolate(frame, [0, durationInFrames], [0, index % 2 === 0 ? -12 : 12], clamp);
          return (
            <div
              key={`${left}-${top}`}
              style={{
                position: 'absolute',
                left: `${left}%`,
                top: `${top}%`,
                width: size,
                height: size,
                backgroundColor: index % 3 === 0 ? '#d6b56b' : '#d7e1e5',
                opacity: starOpacity,
                transform: `translateX(${driftX}px)`,
              }}
            />
          );
        })}

        <div
          style={{
            position: 'absolute',
            right: 0,
            bottom: '22%',
            left: 0,
            height: '10%',
            backgroundColor: '#213345',
            boxShadow: '0 -22px 0 #293b4c, 0 -44px 0 #344b5b',
          }}
        />

        {terrainBlocks.map((block) => {
          const progress = interpolate(frame, [block.delay, block.delay + 18], [0, 1], clamp);
          const lift = interpolate(progress, [0, 1], [26, 0], clamp);
          return (
            <div
              key={`terrain-${block.x}`}
              style={{
                position: 'absolute',
                left: `${block.x}%`,
                bottom: `${block.y}%`,
                width: `${block.width}%`,
                height: `${block.height}%`,
                backgroundColor: block.color,
                border: '4px solid rgba(11, 18, 32, .45)',
                boxShadow: 'inset -10px -10px rgba(8, 13, 19, .25)',
                opacity: progress,
                transform: `translateY(${lift}px)`,
              }}
            />
          );
        })}

        {foregroundBlocks.map((block) => {
          const progress = interpolate(frame, [block.delay, block.delay + 20], [0, 1], clamp);
          const lift = interpolate(progress, [0, 1], [42, 0], clamp);
          const drift = interpolate(frame, [0, durationInFrames], [0, block.x < 50 ? -24 : 24], clamp);
          return (
            <div
              key={`foreground-${block.x}`}
              style={{
                position: 'absolute',
                left: `${block.x}%`,
                bottom: `${block.y}%`,
                width: `${block.width}%`,
                height: `${block.height}%`,
                backgroundColor: block.color,
                border: '5px solid rgba(11, 18, 32, .55)',
                boxShadow: 'inset -12px -12px rgba(8, 13, 19, .24)',
                opacity: progress,
                transform: `translate3d(${drift}px, ${lift}px, 0)`,
              }}
            />
          );
        })}

        <div
          style={{
            position: 'absolute',
            top: '38%',
            right: 0,
            left: 0,
            textAlign: 'center',
            opacity: brandingOpacity,
            transform: `translateY(${brandingY}px)`,
          }}
        >
          <div style={{ fontSize: 'clamp(30px, 5vw, 72px)', fontWeight: 800, letterSpacing: '-.06em', textShadow: '5px 5px #0b1220' }}>
            千服联灯
          </div>
          <div style={{ marginTop: 16, color: '#d6b56b', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 'clamp(10px, 1.2vw, 16px)', fontWeight: 700, letterSpacing: '.24em' }}>
            SERVER DISCOVERY
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export default MinecraftFlightComposition;
