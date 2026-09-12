interface Props {
  label: string;
  min: number;
  max: number;
  step: number;
  valueMin: string;
  valueMax: string;
  unit?: string;
  onChangeMin: (v: string) => void;
  onChangeMax: (v: string) => void;
}

export function DualRangeSlider({ label, min, max, step, valueMin, valueMax, unit = "", onChangeMin, onChangeMax }: Props) {
  const clamp = (value: number, fallback: number): number =>
    Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
  const rawMin = clamp(valueMin.trim() === "" ? min : Number(valueMin), min);
  const rawMax = clamp(valueMax.trim() === "" ? max : Number(valueMax), max);
  const numMin = Math.min(rawMin, rawMax);
  const numMax = Math.max(rawMin, rawMax);
  const pctMin = ((numMin - min) / (max - min)) * 100;
  const pctMax = ((numMax - min) / (max - min)) * 100;
  const active = valueMin.trim() !== "" || valueMax.trim() !== "";

  function handleMinSlider(v: number): void {
    onChangeMin(String(Math.min(v, numMax)));
  }
  function handleMaxSlider(v: number): void {
    onChangeMax(String(Math.max(v, numMin)));
  }

  return (
    <div className={`dual-slider${active ? " active" : ""}`}>
      <div className="dual-slider-head">
        <span className="slider-label">{label}</span>
        <span className="dual-slider-inputs">
          <input
            type="number"
            min={min}
            max={max}
            step={step}
            value={valueMin}
            placeholder={String(min)}
            aria-label={`${label} minimum`}
            onChange={(e) => onChangeMin(e.target.value)}
          />
          <span className="dual-slider-sep">–</span>
          <input
            type="number"
            min={min}
            max={max}
            step={step}
            value={valueMax}
            placeholder={String(max)}
            aria-label={`${label} maximum`}
            onChange={(e) => onChangeMax(e.target.value)}
          />
          <span className="dual-slider-unit">{unit}</span>
        </span>
      </div>
      <div className="dual-slider-track">
        <div className="dual-slider-fill" style={{ left: `${pctMin}%`, right: `${100 - pctMax}%` }} />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={numMin}
          aria-label={`${label} minimum`}
          onChange={(e) => handleMinSlider(Number(e.target.value))}
        />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={numMax}
          aria-label={`${label} maximum`}
          onChange={(e) => handleMaxSlider(Number(e.target.value))}
        />
      </div>
    </div>
  );
}
