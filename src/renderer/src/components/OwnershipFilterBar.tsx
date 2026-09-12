import type { ResultsOwnershipFilter } from "../results-filter";

interface Props {
  value: ResultsOwnershipFilter;
  onChange: (value: ResultsOwnershipFilter) => void;
}

const OPTIONS: Array<{
  value: ResultsOwnershipFilter;
  label: string;
  title: string;
}> = [
  { value: "all", label: "All", title: "Show every result in search order" },
  {
    value: "missing-first",
    label: "New on top",
    title: "Keep every result visible, with maps you do not have first",
  },
  {
    value: "missing-only",
    label: "Missing only",
    title: "Hide maps already installed or downloaded",
  },
];

export function OwnershipFilterBar({ value, onChange }: Props) {
  return (
    <div className="segmented" role="group" aria-label="Filter search results by ownership">
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          className={option.value === value ? "active" : undefined}
          aria-pressed={option.value === value}
          title={option.title}
          type="button"
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
