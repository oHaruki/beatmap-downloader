import type { SearchFilters, BeatmapStatus } from "@shared/types";
import { ChipRow } from "./Chip";
import { FilterSection } from "./FilterSection";
import { DualRangeSlider } from "./DualRangeSlider";
import {
  IconAny,
  IconCheck,
  IconClock,
  IconHeart,
  IconGrave,
  IconTarget,
  IconDrum,
  IconDrop,
  IconBars,
  IconFilter,
} from "./icons";

interface Props {
  filters: SearchFilters;
  onChange: (filters: SearchFilters) => void;
  onSearch: () => void;
  onReset: () => void;
  loading: boolean;
}

const STATUS_OPTIONS: { value: BeatmapStatus; label: string; icon: React.ReactNode }[] = [
  { value: "any", label: "Any", icon: <IconAny /> },
  { value: "ranked", label: "Ranked", icon: <IconCheck /> },
  { value: "qualified", label: "Qualified", icon: <IconClock /> },
  { value: "loved", label: "Loved", icon: <IconHeart /> },
  { value: "pending", label: "Pending", icon: <IconClock /> },
  { value: "graveyard", label: "Graveyard", icon: <IconGrave /> },
];

const MODE_OPTIONS: { value: SearchFilters["mode"]; label: string; icon: React.ReactNode }[] = [
  { value: "", label: "Any", icon: <IconAny /> },
  { value: "0", label: "osu!", icon: <IconTarget /> },
  { value: "1", label: "Taiko", icon: <IconDrum /> },
  { value: "2", label: "Catch", icon: <IconDrop /> },
  { value: "3", label: "Mania", icon: <IconBars /> },
];

export function FilterForm({ filters, onChange, onSearch, onReset, loading }: Props) {
  const set = <K extends keyof SearchFilters>(key: K, value: SearchFilters[K]): void =>
    onChange({ ...filters, [key]: value });

  return (
    <div className="filter-form">
      <div className="filter-row primary">
        <input
          className="query-input"
          type="text"
          value={filters.query}
          onChange={(e) => set("query", e.target.value)}
          placeholder="Search by artist, title, or mapper"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !loading) onSearch();
          }}
        />
        <button type="button" onClick={onReset} disabled={loading}>
          Reset
        </button>
        <button className="search-button" onClick={onSearch} disabled={loading}>
          {loading ? "Searching" : "Search"}
        </button>
      </div>

      <FilterSection title="STATUS" icon={<IconCheck />}>
        <ChipRow options={STATUS_OPTIONS} value={filters.status} onChange={(v) => set("status", v)} />
      </FilterSection>

      <FilterSection title="MODE" icon={<IconTarget />}>
        <ChipRow options={MODE_OPTIONS} value={filters.mode} onChange={(v) => set("mode", v)} />
      </FilterSection>

      <FilterSection title="DIFFICULTY" icon={<IconFilter />}>
        <DualRangeSlider label="Star rating" min={0} max={12} step={0.1} unit="★" valueMin={filters.starsMin} valueMax={filters.starsMax} onChangeMin={(v) => set("starsMin", v)} onChangeMax={(v) => set("starsMax", v)} />
        <DualRangeSlider label="Approach rate" min={0} max={11} step={0.1} valueMin={filters.arMin} valueMax={filters.arMax} onChangeMin={(v) => set("arMin", v)} onChangeMax={(v) => set("arMax", v)} />
        <DualRangeSlider label="Circle size" min={0} max={10} step={0.1} valueMin={filters.csMin} valueMax={filters.csMax} onChangeMin={(v) => set("csMin", v)} onChangeMax={(v) => set("csMax", v)} />
        <DualRangeSlider label="Overall difficulty" min={0} max={11} step={0.1} valueMin={filters.odMin} valueMax={filters.odMax} onChangeMin={(v) => set("odMin", v)} onChangeMax={(v) => set("odMax", v)} />
        <DualRangeSlider label="HP drain" min={0} max={10} step={0.1} valueMin={filters.hpMin} valueMax={filters.hpMax} onChangeMin={(v) => set("hpMin", v)} onChangeMax={(v) => set("hpMax", v)} />
      </FilterSection>

      <FilterSection title="SONG" icon={<IconBars />} defaultOpen={false}>
        <DualRangeSlider label="BPM" min={0} max={400} step={1} valueMin={filters.bpmMin} valueMax={filters.bpmMax} onChangeMin={(v) => set("bpmMin", v)} onChangeMax={(v) => set("bpmMax", v)} />
        <DualRangeSlider label="Length" min={0} max={600} step={5} unit="s" valueMin={filters.lengthMin} valueMax={filters.lengthMax} onChangeMin={(v) => set("lengthMin", v)} onChangeMax={(v) => set("lengthMax", v)} />
      </FilterSection>
    </div>
  );
}
