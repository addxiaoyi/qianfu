import React from 'react';

interface ThreeDHeadShowcaseProps {
  username?: string;
}

const SIZE = 64;
const DEPTH = 32;
const imageSize = 160;
const faces = [
  { rotateY: '0deg', translateZ: DEPTH },
  { rotateY: '90deg', translateZ: DEPTH },
  { rotateY: '180deg', translateZ: DEPTH },
  { rotateY: '270deg', translateZ: DEPTH },
] as const;

const ThreeDHeadShowcase: React.FC<ThreeDHeadShowcaseProps> = ({ username }) => {
  const player = username || 'Steve';
  const encodedPlayer = encodeURIComponent(player);
  const imageSrc = `https://minotar.net/helm/${encodedPlayer}/${imageSize}.png`;
  const fallbackSrc = `https://mc-heads.net/head/${encodedPlayer}/${imageSize}`;

  return (
    <div className="relative overflow-hidden rounded-[1.5rem] border border-zinc-100 bg-white p-3 shadow-[0_12px_40px_rgba(0,0,0,0.04)]">
      <style>{`
        @keyframes cubeSpin {
          0% { transform: rotateX(-10deg) rotateY(0deg); }
          100% { transform: rotateX(-10deg) rotateY(360deg); }
        }
      `}</style>
      <div className="absolute -right-10 -top-10 w-24 h-24 rounded-full bg-black/5 blur-2xl" />
      <div className="absolute -left-10 bottom-0 w-20 h-20 rounded-full bg-zinc-100 blur-2xl" />
      <div className="relative space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="text-[9px] font-black uppercase tracking-[0.28em] text-zinc-400">Skin Showcase</div>
          <div className="px-2 py-1 rounded-full bg-black text-white text-[9px] font-black uppercase tracking-[0.24em]">Live</div>
        </div>

        <div className="flex items-center justify-center py-1">
          <div className="relative" style={{ perspective: '700px', width: SIZE, height: SIZE }}>
            <div className="absolute inset-[-18px] rounded-[1.6rem] bg-black/5 blur-2xl" />
            <div className="absolute inset-[-8px] rounded-[1.4rem] ring-1 ring-zinc-100/90 shadow-[0_12px_28px_rgba(0,0,0,0.08)]" />
            <div
              className="absolute inset-0"
              style={{
                transformStyle: 'preserve-3d',
                animation: 'cubeSpin 12s linear infinite',
                transformOrigin: 'center center',
                width: SIZE,
                height: SIZE,
              }}
            >
              {faces.map((face) => (
                <div
                  key={face.rotateY}
                  className="absolute overflow-hidden rounded-[1rem] border border-zinc-100 bg-white"
                  style={{
                    width: SIZE,
                    height: SIZE,
                    transform: `rotateY(${face.rotateY}) translateZ(${face.translateZ}px)`,
                    backfaceVisibility: 'hidden',
                  }}
                >
                  <img
                    src={imageSrc}
                    alt={`${player} 头颅`}
                    className="h-full w-full object-cover"
                    onError={(event) => {
                      const img = event.currentTarget;
                      if (img.src !== fallbackSrc) img.src = fallbackSrc;
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        <p className="text-center text-[9px] font-black uppercase tracking-[0.24em] text-zinc-400">Player: {player}</p>
      </div>
    </div>
  );
};

export default ThreeDHeadShowcase;
