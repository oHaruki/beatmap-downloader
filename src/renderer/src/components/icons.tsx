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
      aria-hidden="true"
      {...props}
    />
  );
}

export const IconClock = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}>
    <circle cx="8" cy="8" r="5.5" />
    <path d="M8 5v3.2l2.2 1.4" />
  </Base>
);

export const IconLink = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}>
    <path d="M6.8 9.2a2.6 2.6 0 0 0 3.7 0l2.2-2.2a2.6 2.6 0 0 0-3.7-3.7l-.9.9" />
    <path d="M9.2 6.8a2.6 2.6 0 0 0-3.7 0L3.3 9a2.6 2.6 0 0 0 3.7 3.7l.9-.9" />
  </Base>
);

export const IconPlay = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}>
    <path d="M5.5 3.8v8.4L12 8z" fill="currentColor" />
  </Base>
);

export const IconStop = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}>
    <rect x="4.5" y="4.5" width="7" height="7" rx="1" fill="currentColor" />
  </Base>
);

export const IconExternal = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}>
    <path d="M9.5 2.5h4v4M13.5 2.5 8 8M11.5 9.5v3a1 1 0 0 1-1 1h-7a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1h3" />
  </Base>
);

export const IconFolder = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}>
    <path d="M2.5 4.5a1 1 0 0 1 1-1h3l1.5 1.5h4.5a1 1 0 0 1 1 1v5.5a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1z" />
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
