import { cn } from "@/lib/utils";

// The Prospect mark: three tapering lines (raw incoming requests) funnel down to
// a single diamond — the appraised gem, the opportunity surfaced from the noise.
// Pure `currentColor` + inline SVG, so it inherits text color/theme and animates.
//
// `animate` turns it into the loading indicator: each line draws on in sequence,
// the diamond pops, then the whole mark breathes while work continues. Motion is
// suppressed under prefers-reduced-motion (see index.css).
export function LogoMark({
  animate = false,
  size = 24,
  className,
}: {
  animate?: boolean;
  size?: number;
  className?: string;
}) {
  const width = Math.round((36 / 24) * size);
  return (
    <svg
      width={width}
      height={size}
      viewBox="0 0 36 24"
      fill="none"
      aria-hidden="true"
      className={cn("shrink-0", animate && "pi-logo-animate", className)}
    >
      <line
        className="pi-l1"
        x1="4"
        y1="5"
        x2="32"
        y2="5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray={animate ? 28 : undefined}
      />
      <line
        className="pi-l2"
        x1="4"
        y1="12"
        x2="25"
        y2="12"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray={animate ? 21 : undefined}
      />
      <line
        className="pi-l3"
        x1="4"
        y1="19"
        x2="17"
        y2="19"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray={animate ? 13 : undefined}
      />
      <path
        className="pi-d"
        d="M19 16 L22 19 L19 22 L16 19 Z"
        fill="currentColor"
        opacity={0.9}
      />
    </svg>
  );
}
