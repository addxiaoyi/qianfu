import React from 'react';

interface ThreeDHeadShowcaseProps {
  username?: string;
}

const imageSize = 160;
const PALETTE = [
  ['#f6c9a9', '#7c4a32', '#2d201c', '#ffffff', '#3b82f6'],
  ['#f1bfa5', '#1f2937', '#111827', '#f8fafc', '#10b981'],
  ['#d9a679', '#78350f', '#451a03', '#fef3c7', '#f97316'],
  ['#c08457', '#0f172a', '#020617', '#e0f2fe', '#06b6d4'],
];

const hashPlayer = (player: string) => {
  let hash = 0;
  for (let i = 0; i < player.length; i += 1) {
    hash = (hash * 31 + player.charCodeAt(i)) >>> 0;
  }
  return hash;
};

const PixelAvatar: React.FC<{ player: string }> = ({ player }) => {
  const hash = hashPlayer(player);
  const palette = PALETTE[hash % PALETTE.length];
  const cells = Array.from({ length: 64 }, (_, index) => {
    const row = Math.floor(index / 8);
    const col = index % 8;
    const mirrorCol = col > 3 ? 7 - col : col;
    const seed = (hash >> ((row + mirrorCol) % 16)) + row * 17 + mirrorCol * 29;
    if (row < 2) return palette[1];
    if ((row === 3 || row === 4) && (col === 2 || col === 5)) return palette[4];
    if (row === 5 && col >= 2 && col <= 5) return palette[2];
    if (row >= 6 && (col === 0 || col === 7)) return palette[1];
    return seed % 5 === 0 ? palette[0] : seed % 7 === 0 ? palette[3] : palette[0];
  });

  return (
    <div className="grid h-full w-full grid-cols-8 grid-rows-8 overflow-hidden rounded-[1rem] bg-zinc-100 [image-rendering:pixelated]" aria-hidden="true">
      {cells.map((color, index) => (
        <div key={index} style={{ backgroundColor: color }} />
      ))}
    </div>
  );
};

const ThreeDHeadShowcase: React.FC<ThreeDHeadShowcaseProps> = ({ username }) => {
  const player = username || 'Steve';
  const encodedPlayer = encodeURIComponent(player);
  const imageSrc = `https://minotar.net/helm/${encodedPlayer}/${imageSize}.png`;
  const [remoteOk, setRemoteOk] = React.useState(false);

  React.useEffect(() => {
    setRemoteOk(false);
  }, [imageSrc]);

  return (
    <div className="relative overflow-hidden rounded-[1.5rem] border border-zinc-100 bg-white p-3 shadow-[0_12px_40px_rgba(0,0,0,0.04)]">
      <div className="absolute -right-10 -top-10 w-24 h-24 rounded-full bg-black/5 blur-2xl" />
      <div className="absolute -left-10 bottom-0 w-20 h-20 rounded-full bg-zinc-100 blur-2xl" />
      <div className="relative space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="text-[9px] font-black uppercase tracking-[0.28em] text-zinc-400">Skin Showcase</div>
          <div className="px-2 py-1 rounded-full bg-black text-white text-[9px] font-black uppercase tracking-[0.24em]">{remoteOk ? 'Live' : 'Local'}</div>
        </div>

        <div className="flex items-center justify-center py-2">
          <div className="relative h-20 w-20 rounded-[1.4rem] bg-zinc-50 p-2 shadow-[0_12px_28px_rgba(0,0,0,0.08)] ring-1 ring-zinc-100">
            <PixelAvatar player={player} />
            <img
              src={imageSrc}
              alt={`${player} 头颅`}
              className={`absolute inset-2 h-[calc(100%-1rem)] w-[calc(100%-1rem)] rounded-[1rem] object-cover [image-rendering:pixelated] transition-opacity duration-300 ${remoteOk ? 'opacity-100' : 'opacity-0'}`}
              loading="lazy"
              decoding="async"
              referrerPolicy="no-referrer"
              onLoad={() => setRemoteOk(true)}
              onError={(event) => {
                setRemoteOk(false);
                event.currentTarget.removeAttribute('src');
              }}
            />
          </div>
        </div>

        <p className="text-center text-[9px] font-black uppercase tracking-[0.24em] text-zinc-400">Player: {player}</p>
      </div>
    </div>
  );
};

export default ThreeDHeadShowcase;
