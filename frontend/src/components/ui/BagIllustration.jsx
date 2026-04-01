// All illustrations: stroke only, no fills, stroke color inherits from CSS color property
// Set color via className or style={{ color: 'var(--color-text-secondary)' }} on parent

export function CarryOnIcon({ size = 1, ...props }) {
  return (
    <svg
      viewBox="0 0 80 100"
      width={80 * size}
      height={100 * size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {/* Retractable handle posts */}
      <line x1="29" y1="20" x2="29" y2="7" />
      <line x1="51" y1="20" x2="51" y2="7" />
      {/* Handle slot indicators on body top */}
      <rect x="27" y="20" width="4" height="7" rx="2" />
      <rect x="49" y="20" width="4" height="7" rx="2" />
      {/* Grip bar */}
      <line x1="29" y1="7" x2="51" y2="7" />

      {/* Main body */}
      <rect x="12" y="20" width="56" height="66" rx="5" />

      {/* Corner rivets */}
      <circle cx="18" cy="27" r="2.5" />
      <circle cx="62" cy="27" r="2.5" />
      <circle cx="18" cy="80" r="2.5" />
      <circle cx="62" cy="80" r="2.5" />

      {/* Center horizontal panel division */}
      <line x1="12" y1="53" x2="68" y2="53" />

      {/* Front zip pocket (lower section) */}
      <rect x="18" y="58" width="44" height="22" rx="2" />

      {/* Side carry handle — right wall */}
      <path d="M68 44 C76 44 76 54 68 54" />

      {/* 4 wheels at bottom */}
      <ellipse cx="22" cy="90" rx="4.5" ry="3" />
      <ellipse cx="34" cy="91" rx="3.5" ry="2.5" />
      <ellipse cx="46" cy="91" rx="3.5" ry="2.5" />
      <ellipse cx="58" cy="90" rx="4.5" ry="3" />
    </svg>
  )
}

export function CheckedBagIcon({ size = 1, ...props }) {
  return (
    <svg
      viewBox="0 0 80 120"
      width={80 * size}
      height={120 * size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {/* Retractable handle posts */}
      <line x1="29" y1="20" x2="29" y2="7" />
      <line x1="51" y1="20" x2="51" y2="7" />
      <rect x="27" y="20" width="4" height="7" rx="2" />
      <rect x="49" y="20" width="4" height="7" rx="2" />
      <line x1="29" y1="7" x2="51" y2="7" />

      {/* Main body — taller */}
      <rect x="12" y="20" width="56" height="86" rx="5" />

      {/* Corner rivets */}
      <circle cx="18" cy="27" r="2.5" />
      <circle cx="62" cy="27" r="2.5" />
      <circle cx="18" cy="100" r="2.5" />
      <circle cx="62" cy="100" r="2.5" />

      {/* Strap 1 with buckle */}
      <line x1="12" y1="52" x2="32" y2="52" />
      <rect x="32" y="48.5" width="16" height="7" rx="1.5" />
      <line x1="48" y1="52" x2="68" y2="52" />

      {/* Strap 2 with buckle */}
      <line x1="12" y1="74" x2="32" y2="74" />
      <rect x="32" y="70.5" width="16" height="7" rx="1.5" />
      <line x1="48" y1="74" x2="68" y2="74" />

      {/* 4 wheels at bottom */}
      <ellipse cx="22" cy="110" rx="4.5" ry="3" />
      <ellipse cx="34" cy="111" rx="3.5" ry="2.5" />
      <ellipse cx="46" cy="111" rx="3.5" ry="2.5" />
      <ellipse cx="58" cy="110" rx="4.5" ry="3" />
    </svg>
  )
}

export function HandbagIcon({ size = 1, ...props }) {
  return (
    <svg
      viewBox="0 0 80 80"
      width={80 * size}
      height={80 * size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {/* Left top handle */}
      <path d="M20 32 C20 14 36 14 36 32" />
      {/* Right top handle */}
      <path d="M44 32 C44 14 60 14 60 32" />

      {/* Main body */}
      <rect x="8" y="32" width="64" height="40" rx="4" />

      {/* Top edge reinforcement / zip line */}
      <line x1="8" y1="40" x2="72" y2="40" />

      {/* Center clasp / hardware */}
      <rect x="33" y="35" width="14" height="8" rx="2" />

      {/* Front pocket */}
      <rect x="16" y="46" width="48" height="20" rx="2" />
      {/* Pocket zip line */}
      <line x1="16" y1="53" x2="64" y2="53" />
    </svg>
  )
}

export function BackpackIcon({ size = 1, ...props }) {
  return (
    <svg
      viewBox="0 0 80 100"
      width={80 * size}
      height={100 * size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {/* Top grab handle */}
      <path d="M33 16 C33 8 47 8 47 16" />

      {/* Main body with rounded top */}
      <rect x="12" y="16" width="56" height="72" rx="10" />

      {/* Shoulder straps — curved lines along outer edges */}
      <path d="M12 30 C4 32 4 80 12 84" />
      <path d="M68 30 C76 32 76 80 68 84" />

      {/* Top horizontal panel division */}
      <line x1="12" y1="36" x2="68" y2="36" />

      {/* Front pocket */}
      <rect x="18" y="44" width="44" height="34" rx="6" />
      {/* Pocket zip line */}
      <path d="M18 54 Q40 57 62 54" />

      {/* Zipper pull tab */}
      <circle cx="40" cy="55.5" r="2" />
    </svg>
  )
}
