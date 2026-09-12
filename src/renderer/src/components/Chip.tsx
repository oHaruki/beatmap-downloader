interface ChipOption<T extends string> {
  value: T;
  label: string;
}

interface Props<T extends string> {
  label: string;
  options: ChipOption<T>[];
  value: T;
  onChange: (value: T) => void;
}

export function ChipRow<T extends string>({ label, options, value, onChange }: Props<T>) {
  return (
    <div className="chip-row" role="group" aria-label={label}>
      {options.map((opt) => (
        <button
          key={opt.value}
          className={`chip${opt.value === value ? " active" : ""}`}
          aria-pressed={opt.value === value}
          onClick={() => onChange(opt.value)}
          type="button"
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
