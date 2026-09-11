import type { SearchFilters, BeatmapStatus } from "@shared/types";
import { useEffect, useState } from "react";
import type { SearchPreset } from "@shared/types";
import { validateSearchFilters } from "@shared/search-filters";
import { ChipRow } from "./Chip";
import { FilterSection } from "./FilterSection";
import { DualRangeSlider } from "./DualRangeSlider";
import {
  IconAny,
  IconCheck,
  IconClock,
  IconHeart,
  IconGrave,
  IconPencil,
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
  // Separate osu! category, not covered by "pending".
  { value: "wip", label: "WIP", icon: <IconPencil /> },
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
  const [presets, setPresets] = useState<SearchPreset[]>([]);
  const [presetName, setPresetName] = useState("");
  const [presetError, setPresetError] = useState("");
  const [savingPreset, setSavingPreset] = useState(false);
  useEffect(() => { void window.api.getSearchPresets().then(setPresets).catch(() => setPresetError("Could not load presets.")); }, []);
  async function savePreset(remove = false): Promise<void> {
    const name = presetName.trim();
    if (!name) return;
    const error = remove ? null : validateSearchFilters(filters);
    if (error) { setPresetError(error); return; }
    setSavingPreset(true);
    try {
      const next = presets.filter((preset) => preset.name !== name);
      if (!remove) next.push({ name, filters: { ...filters, cursorString: null } });
      setPresets(await window.api.saveSearchPresets(next));
      setPresetError("");
      if (remove) setPresetName("");
    } catch (error) { setPresetError(error instanceof Error ? error.message : "Could not save preset."); }
    finally { setSavingPreset(false); }
  }
  const set = <K extends keyof SearchFilters>(key: K, value: SearchFilters[K]): void =>
    onChange({ ...filters, [key]: value, ...(key === "mode" && value !== "3" ? { keys: "" } : {}) });

  return (
    <div className="filter-form">
      <details className="preset-controls">
        <summary>Saved searches</summary>
        <label>Load search
          <select aria-label="Load saved search" value="" disabled={loading} onChange={(e) => {
            const preset = presets.find((preset) => preset.name === e.target.value);
            if (preset) { onChange({ ...preset.filters }); setPresetName(preset.name); }
          }}>
            <option value="">Load a preset…</option>
            {presets.map((preset) => <option key={preset.name} value={preset.name}>{preset.name}</option>)}
          </select>
        </label>
        <input aria-label="Preset name" placeholder="Name this search" maxLength={80} value={presetName} onChange={(e) => setPresetName(e.target.value)} />
        <div className="preset-actions">
          <button onClick={() => void savePreset()} disabled={savingPreset || !presetName.trim()}>{presets.some((preset) => preset.name === presetName.trim()) ? "Update preset" : "Save preset"}</button>
          <button onClick={() => void savePreset(true)} disabled={savingPreset || !presets.some((preset) => preset.name === presetName.trim())}>Delete</button>
        </div>
        {presetError && <p className="error-text" role="alert">{presetError}</p>}
      </details>
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
        {filters.mode === "3" && <label className="extra-filter">Keys
          <select value={filters.keys ?? ""} onChange={(e) => set("keys", e.target.value)}><option value="">Any</option><option value="4">4K</option><option value="7">7K</option></select>
        </label>}
      </FilterSection>
      <FilterSection title="ORDER & DATE" icon={<IconClock />} defaultOpen={false}>
        <label className="extra-filter">Sort by
          <select value={filters.sort ?? ""} onChange={(e) => set("sort", e.target.value)}>
            <option value="">Default</option><option value="relevance_desc">Relevance</option>
            <option value="ranked_desc">Newest ranked</option><option value="ranked_asc">Oldest ranked</option>
            <option value="difficulty_asc">Easiest first</option><option value="difficulty_desc">Hardest first</option>
            <option value="plays_desc">Most played</option><option value="favourites_desc">Most favourited</option>
            <option value="title_asc">Title A–Z</option><option value="artist_asc">Artist A–Z</option>
          </select>
        </label>
        <label className="extra-filter">Ranked from <input type="date" value={filters.rankedFrom ?? ""} onChange={(e) => set("rankedFrom", e.target.value)} /></label>
        <label className="extra-filter">Ranked through <input type="date" value={filters.rankedTo ?? ""} onChange={(e) => set("rankedTo", e.target.value)} /></label>
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
