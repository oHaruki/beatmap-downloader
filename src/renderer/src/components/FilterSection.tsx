import { useState } from "react";
import type { ReactNode } from "react";
import { IconChevron } from "./icons";

interface Props {
  title: string;
  icon: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}

export function FilterSection({ title, icon, defaultOpen = true, children }: Props) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="filter-section">
      <button className="filter-section-header" onClick={() => setOpen((v) => !v)} type="button">
        {icon}
        <span>{title}</span>
        <IconChevron className={`chevron${open ? " open" : ""}`} />
      </button>
      {open && <div className="filter-section-body">{children}</div>}
    </div>
  );
}
