/**
 * Layered dusk skyline: three depths of apartment blocks with a few warm, gold-lit windows.
 * Purely decorative; deterministic so server and client render the same markup.
 */
type Block = { x: number; w: number; h: number; cols: number };

const back: Block[] = [
  { x: -10, w: 70, h: 190, cols: 3 }, { x: 52, w: 54, h: 240, cols: 2 }, { x: 98, w: 80, h: 175, cols: 3 },
  { x: 170, w: 60, h: 260, cols: 2 }, { x: 222, w: 90, h: 205, cols: 4 }, { x: 305, w: 58, h: 250, cols: 2 }, { x: 356, w: 70, h: 185, cols: 3 },
];
const mid: Block[] = [
  { x: -6, w: 88, h: 150, cols: 4 }, { x: 76, w: 66, h: 205, cols: 3 }, { x: 136, w: 96, h: 160, cols: 4 },
  { x: 226, w: 70, h: 215, cols: 3 }, { x: 290, w: 116, h: 165, cols: 5 },
];
const front: Block[] = [
  { x: -4, w: 120, h: 112, cols: 5 }, { x: 110, w: 84, h: 150, cols: 3 }, { x: 188, w: 128, h: 104, cols: 5 }, { x: 310, w: 96, h: 138, cols: 4 },
];

// tiny deterministic PRNG
function rng(seed: number) {
  let s = seed;
  return () => ((s = (s * 9301 + 49297) % 233280) / 233280);
}

function Layer({ blocks, base, fill, win, lit, litRate, seed, size }: { blocks: Block[]; base: number; fill: string; win: string; lit: string; litRate: number; seed: number; size: number }) {
  const r = rng(seed);
  return (
    <g>
      {blocks.map((b, i) => {
        const top = base - b.h;
        const gap = (b.w - b.cols * size) / (b.cols + 1);
        const rows = Math.floor((b.h - 18) / (size * 1.9));
        return (
          <g key={i}>
            <rect x={b.x} y={top} width={b.w} height={b.h} fill={fill} />
            <rect x={b.x} y={top} width={b.w} height={3} fill={win} opacity={0.6} />
            {Array.from({ length: rows }).flatMap((_, row) =>
              Array.from({ length: b.cols }).map((__, c) => {
                const on = r() < litRate;
                return <rect key={`${row}-${c}`} x={b.x + gap + c * (size + gap)} y={top + 12 + row * size * 1.9} width={size} height={size * 1.2} rx={0.8} fill={on ? lit : win} opacity={on ? 0.95 : 0.55} />;
              }),
            )}
          </g>
        );
      })}
    </g>
  );
}

export function CityScene({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMax slice" className={className} aria-hidden>
      <defs>
        <linearGradient id="cv-ground" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#0e3628" stopOpacity="0" />
          <stop offset="1" stopColor="#061a13" stopOpacity="0.95" />
        </linearGradient>
        <radialGradient id="cv-glow" cx="0.5" cy="1" r="0.8">
          <stop offset="0" stopColor="#d2a84a" stopOpacity="0.22" />
          <stop offset="1" stopColor="#d2a84a" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect x="0" y="0" width="400" height="300" fill="url(#cv-glow)" />
      <Layer blocks={back} base={300} fill="#124331" win="#1d6146" lit="#e9d397" litRate={0.08} seed={7} size={6} />
      <Layer blocks={mid} base={300} fill="#0e3628" win="#17523b" lit="#ddbb66" litRate={0.12} seed={21} size={8} />
      <Layer blocks={front} base={300} fill="#09251b" win="#124331" lit="#d2a84a" litRate={0.18} seed={42} size={10} />
      <rect x="0" y="200" width="400" height="100" fill="url(#cv-ground)" />
    </svg>
  );
}
