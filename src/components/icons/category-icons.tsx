// SplitMate icon kit (Phase 44) — Duolingo-style flat vector money & category
// icons: chunky outlines, one highlight, consistent 64px grid. These replace
// every emoji in the app. Colors are illustration colors (fixed hex), chosen
// to read on both light and dark surfaces.

interface IconProps {
  size?: number;
  className?: string;
}

export function RentIcon({ size = 24, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={className} aria-hidden="true">
      <polygon points="32,7 59,30 5,30" fill="#5d5df0" stroke="#2b2a6e" strokeWidth="3" strokeLinejoin="round" />
      <rect x="13" y="30" width="38" height="27" rx="3" fill="#f1f0fb" stroke="#2b2a6e" strokeWidth="3" />
      <rect x="26" y="39" width="12" height="18" rx="2" fill="#eebc4a" stroke="#a87b1c" strokeWidth="2.5" />
      <circle cx="45" cy="40" r="3.5" fill="#c9cdfc" />
    </svg>
  );
}

export function GroceriesIcon({ size = 24, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={className} aria-hidden="true">
      <path d="M15 23 H49 L46 52 Q45.5 57 40 57 H24 Q18.5 57 18 52 Z" fill="#4cae72" stroke="#2c7a4c" strokeWidth="3" strokeLinejoin="round" />
      <path d="M24 23 C24 13 40 13 40 23" fill="none" stroke="#2c7a4c" strokeWidth="3.5" strokeLinecap="round" />
      <circle cx="32" cy="40" r="7" fill="#8fd6ab" />
      <text x="32" y="44" textAnchor="middle" fontFamily="system-ui, sans-serif" fontWeight="800" fontSize="10" fill="#1e5c38">₹</text>
    </svg>
  );
}

export function VegetablesIcon({ size = 24, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={className} aria-hidden="true">
      <path d="M32 17 Q27 5 17 7 Q19 17 32 17 Z" fill="#4cae72" stroke="#2c7a4c" strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M32 17 Q37 5 47 7 Q45 17 32 17 Z" fill="#6fc492" stroke="#2c7a4c" strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M26 21 C26 15 38 15 38 21 C38 34 34 48 32 54 C30 48 26 34 26 21 Z" fill="#f4913d" stroke="#c9641c" strokeWidth="3" strokeLinejoin="round" />
      <line x1="29" y1="27" x2="34" y2="27" stroke="#c9641c" strokeWidth="2" strokeLinecap="round" />
      <line x1="29.5" y1="36" x2="34" y2="36" stroke="#c9641c" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function UtilitiesIcon({ size = 24, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={className} aria-hidden="true">
      <polygon points="37,6 15,36 28,36 26,58 49,26 35,26" fill="#f2c94c" stroke="#c79c2e" strokeWidth="3" strokeLinejoin="round" />
    </svg>
  );
}

export function WifiIcon({ size = 24, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={className} aria-hidden="true">
      <path d="M12 32 A28 28 0 0 1 52 32" fill="none" stroke="#177fb3" strokeWidth="9" strokeLinecap="round" />
      <path d="M12 32 A28 28 0 0 1 52 32" fill="none" stroke="#43bdf0" strokeWidth="5.5" strokeLinecap="round" />
      <path d="M21 41 A15.5 15.5 0 0 1 43 41" fill="none" stroke="#177fb3" strokeWidth="9" strokeLinecap="round" />
      <path d="M21 41 A15.5 15.5 0 0 1 43 41" fill="none" stroke="#43bdf0" strokeWidth="5.5" strokeLinecap="round" />
      <circle cx="32" cy="51" r="6" fill="#43bdf0" stroke="#177fb3" strokeWidth="2.5" />
    </svg>
  );
}

export function OtherIcon({ size = 24, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={className} aria-hidden="true">
      <path d="M20 7 H44 V52 L40 48 L36 52 L32 48 L28 52 L24 48 L20 52 Z" fill="#f1f0fb" stroke="#6b6d8f" strokeWidth="3" strokeLinejoin="round" />
      <line x1="26" y1="17" x2="38" y2="17" stroke="#9a9cba" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="26" y1="25" x2="38" y2="25" stroke="#9a9cba" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="42" cy="42" r="9" fill="#eebc4a" stroke="#a87b1c" strokeWidth="2.5" />
      <text x="42" y="46" textAnchor="middle" fontFamily="system-ui, sans-serif" fontWeight="800" fontSize="9" fill="#7a5712">₹</text>
    </svg>
  );
}

/** Gold coin — money illustrations (settled-up moments, empty states). */
export function CoinIcon({ size = 24, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={className} aria-hidden="true">
      <circle cx="32" cy="32" r="24" fill="#eebc4a" stroke="#a87b1c" strokeWidth="3.5" />
      <circle cx="32" cy="32" r="17.5" fill="none" stroke="#a87b1c" strokeWidth="1.8" opacity=".6" />
      <text x="32" y="41" textAnchor="middle" fontFamily="system-ui, sans-serif" fontWeight="800" fontSize="22" fill="#7a5712">₹</text>
      <ellipse cx="23" cy="19" rx="8" ry="4" fill="#ffffff" opacity=".45" transform="rotate(-24 23 19)" />
    </svg>
  );
}

/** Stack of gold coins — "money grows" illustration for balances/empty states. */
export function CoinStackIcon({ size = 24, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 72 64" className={className} aria-hidden="true">
      <path d="M14 50 a18 7.5 0 0 0 36 0 v-5 a18 7.5 0 0 1 -36 0 Z" fill="#cf9a2a" stroke="#a87b1c" strokeWidth="2" />
      <ellipse cx="32" cy="45" rx="18" ry="7.5" fill="#eebc4a" stroke="#a87b1c" strokeWidth="2" />
      <path d="M22 30 a18 7.5 0 0 0 36 0 v-5 a18 7.5 0 0 1 -36 0 Z" fill="#cf9a2a" stroke="#a87b1c" strokeWidth="2" />
      <ellipse cx="40" cy="25" rx="18" ry="7.5" fill="#f9dd8d" stroke="#a87b1c" strokeWidth="2" />
      <text x="40" y="29" textAnchor="middle" fontFamily="system-ui, sans-serif" fontWeight="800" fontSize="10" fill="#7a5712">₹</text>
    </svg>
  );
}

/** Blue credit token — the credit system's icon (blue, never gold). */
export function CreditTokenIcon({ size = 24, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={className} aria-hidden="true">
      <circle cx="32" cy="32" r="24" fill="#2f6fed" stroke="#1d54c4" strokeWidth="3" />
      <path d="M32 15 C33.3 24.3 38.7 29.7 48 31 C38.7 32.3 33.3 37.7 32 47 C30.7 37.7 25.3 32.3 16 31 C25.3 29.7 30.7 24.3 32 15Z" fill="#cfe0fd" />
    </svg>
  );
}

const CATEGORY_ICON_MAP: Record<string, (props: IconProps) => React.ReactNode> = {
  RENT: RentIcon,
  GROCERIES: GroceriesIcon,
  VEGETABLES: VegetablesIcon,
  UTILITIES: UtilitiesIcon,
  WIFI: WifiIcon,
  OTHER: OtherIcon,
};

/** Icon for an expense category (falls back to OTHER). */
export function CategoryIcon({ category, size = 24, className }: IconProps & { category: string }) {
  const Icon = CATEGORY_ICON_MAP[category] ?? OtherIcon;
  return <Icon size={size} className={className} />;
}
