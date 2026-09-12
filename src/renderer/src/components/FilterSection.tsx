import { useState } from "react";
import type { ReactNode } from "react";
import { IconChevron } from "./icons";

interface Props {
  title: string;
  /** Marks a section whose filters differ from the defaults, so collapsed ones are not forgotten. */
  active?: boolean;
  defaultOpen?: boolean;
  children: ReactNode;
}

export function FilterSection({ title, active = false, defaultOpen = true, children }: Props) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="filter-section">
      <button className="filter-section-header" onClick={() => setOpen((v) => !v)} type="button" aria-expanded={open}>
        {title}
        {active && (
          <span className="filter-active-dot" title="Filters set">
            <span className="sr-only">(filters set)</span>
          </span>
        )}
        <IconChevron className={`chevron${open ? " open" : ""}`} />
      </button>
      {open && <div className="filter-section-body">{children}</div>}
    </section>
  );
}
