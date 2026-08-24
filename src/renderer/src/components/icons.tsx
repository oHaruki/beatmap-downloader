// Small hand-drawn icons, no icon library dependency.
import type { SVGProps } from "react";

function Base(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    />
  );
}

export const IconAny = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}>
    <circle cx="8" cy="8" r="5.5" strokeDasharray="2 2" />
  </Base>
);

export const IconCheck = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}>
    <circle cx="8" cy="8" r="5.5" />
    <path d="M5.3 8.2l1.8 1.8 3.6-3.8" />
  </Base>
);

export const IconClock = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}>
    <circle cx="8" cy="8" r="5.5" />
    <path d="M8 5v3.2l2.2 1.4" />
  </Base>
);

export const IconHeart = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}>
    <path d="M8 12.5S3 9.3 3 6.2C3 4.4 4.4 3 6.1 3 7 3 7.7 3.4 8 4c.3-.6 1-.9 1.9-1C11.6 3 13 4.4 13 6.2c0 3.1-5 6.3-5 6.3z" />
  </Base>
);

export const IconGrave = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}>
    <path d="M4.5 13.5v-6a3.5 3.5 0 017 0v6" />
    <path d="M3 13.5h10" />
    <path d="M8 6v3M6.6 7.5h2.8" />
  </Base>
);

export const IconTarget = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}>
    <circle cx="8" cy="8" r="5.5" />
    <circle cx="8" cy="8" r="2" />
  </Base>
);

export const IconDrum = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}>
    <ellipse cx="8" cy="5.5" rx="5" ry="2.3" />
    <path d="M3 5.5v4c0 1.3 2.2 2.3 5 2.3s5-1 5-2.3v-4" />
  </Base>
);

export const IconDrop = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}>
    <path d="M8 2.5s4 4.6 4 7.4a4 4 0 11-8 0c0-2.8 4-7.4 4-7.4z" />
  </Base>
);

export const IconBars = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}>
    <path d="M4 11V6M8 11V3M12 11V8" />
  </Base>
);

export const IconFilter = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}>
    <path d="M2.5 3.5h11L9.5 8.3v4l-3 1.2v-5.2z" />
  </Base>
);

export const IconChevron = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}>
    <path d="M4.5 6l3.5 3.5L11.5 6" />
  </Base>
);

export const IconMinimize = (p: SVGProps<SVGSVGElement>) => (
  <Base width="10" height="10" {...p}>
    <path d="M2 8h12" />
  </Base>
);

export const IconMaximize = (p: SVGProps<SVGSVGElement>) => (
  <Base width="10" height="10" {...p}>
    <rect x="2.5" y="2.5" width="11" height="11" rx="1" />
  </Base>
);

export const IconRestore = (p: SVGProps<SVGSVGElement>) => (
  <Base width="10" height="10" {...p}>
    <rect x="2" y="4.5" width="9.5" height="9.5" rx="1" />
    <path d="M4.5 4.5V2.5a1 1 0 011-1h8a1 1 0 011 1v8a1 1 0 01-1 1h-2" />
  </Base>
);

export const IconClose = (p: SVGProps<SVGSVGElement>) => (
  <Base width="10" height="10" {...p}>
    <path d="M2.5 2.5l11 11M13.5 2.5l-11 11" />
  </Base>
);

export const IconGear = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}>
    <circle cx="8" cy="8" r="2.3" />
    <path d="M8 2.2v1.6M8 12.2v1.6M13.8 8h-1.6M3.8 8H2.2M11.9 4.1l-1.1 1.1M5.2 10.7l-1.1 1.1M11.9 11.9l-1.1-1.1M5.2 5.3L4.1 4.1" />
  </Base>
);
