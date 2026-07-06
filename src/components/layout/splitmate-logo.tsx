// The "Cut Badge" brand mark (Phase 44) — same geometry as src/app/icon.svg,
// sized for inline UI use. Pure SVG, no font dependency.
export function SplitMateLogo({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 96 96" aria-hidden="true" className="shrink-0 rounded-[22%]">
      <defs>
        <linearGradient id="sm-logo-tile" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#1a1b3e" />
          <stop offset="1" stopColor="#0d0e22" />
        </linearGradient>
        <linearGradient id="sm-logo-badge" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#5d5df0" />
          <stop offset="1" stopColor="#33299f" />
        </linearGradient>
        <linearGradient id="sm-logo-cut" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f3d878" />
          <stop offset="1" stopColor="#c79c2e" />
        </linearGradient>
        <clipPath id="sm-logo-upper"><polygon points="0,0 96,0 96,34 0,62" /></clipPath>
        <clipPath id="sm-logo-lower"><polygon points="0,64 96,36 96,96 0,96" /></clipPath>
      </defs>
      <rect width="96" height="96" rx="22" fill="url(#sm-logo-tile)" />
      <line x1="16" y1="59" x2="80" y2="40" stroke="url(#sm-logo-cut)" strokeWidth="2.5" />
      <g clipPath="url(#sm-logo-upper)" transform="translate(-2 -1.5)">
        <rect x="15" y="15" width="66" height="66" rx="17" fill="url(#sm-logo-badge)" />
        <g fill="none" stroke="#f6f6ff" strokeWidth="6.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M40 41.5 C40 37.5 36.5 35.5 32 35.5 C27.5 35.5 24 38 24 41.5 C24 49 40 47 40 54.5 C40 58 36.5 60.5 32 60.5 C27.5 60.5 24 58.5 24 54.5" />
          <path d="M50 60.5 V35.5 L61 51 L72 35.5 V60.5" />
        </g>
      </g>
      <g clipPath="url(#sm-logo-lower)" transform="translate(2 1.5)">
        <rect x="15" y="15" width="66" height="66" rx="17" fill="url(#sm-logo-badge)" />
        <g fill="none" stroke="#dcdff9" strokeWidth="6.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M40 41.5 C40 37.5 36.5 35.5 32 35.5 C27.5 35.5 24 38 24 41.5 C24 49 40 47 40 54.5 C40 58 36.5 60.5 32 60.5 C27.5 60.5 24 58.5 24 54.5" />
          <path d="M50 60.5 V35.5 L61 51 L72 35.5 V60.5" />
        </g>
      </g>
    </svg>
  );
}
