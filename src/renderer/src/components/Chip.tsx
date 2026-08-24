import type { ReactNode } from "react";

interface ChipOption<T extends string> {
  value: T;
  label: string;
  icon: ReactNode;
}

interface Props<T extends string> {
  options: ChipOption<T>[];
  value: T;
  onChange: (value: T) => void;
}

export function ChipRow<T extends string>({ options, value, onChange }: Props<T>) {
  return (
    <div className="chip-row">
      {options.map((opt) => (
        <button
          key={opt.value}
          className={`chip${opt.value === value ? " active" : ""}`}
          onClick={() => onChange(opt.value)}
          type="button"
        >
          {opt.icon}
          {opt.label}
        </button>
      ))}
    </div>
  );
}
