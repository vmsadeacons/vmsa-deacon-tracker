export default function CopticCross({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true" style={{ flexShrink: 0 }}>
      <g fill="#7A2E3C">
        <rect x="42" y="12" width="16" height="76" rx="2" />
        <rect x="12" y="42" width="76" height="16" rx="2" />
        <circle cx="50" cy="50" r="7" />
        <g>
          <circle cx="50" cy="9" r="9" />
          <circle cx="40" cy="14" r="6" />
          <circle cx="60" cy="14" r="6" />
        </g>
        <g transform="rotate(90 50 50)">
          <circle cx="50" cy="9" r="9" />
          <circle cx="40" cy="14" r="6" />
          <circle cx="60" cy="14" r="6" />
        </g>
        <g transform="rotate(180 50 50)">
          <circle cx="50" cy="9" r="9" />
          <circle cx="40" cy="14" r="6" />
          <circle cx="60" cy="14" r="6" />
        </g>
        <g transform="rotate(270 50 50)">
          <circle cx="50" cy="9" r="9" />
          <circle cx="40" cy="14" r="6" />
          <circle cx="60" cy="14" r="6" />
        </g>
      </g>
    </svg>
  );
}
