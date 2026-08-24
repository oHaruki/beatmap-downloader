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
  const numMin = valueMin.trim() === "" ? min : Number(valueMin);
  const numMax = valueMax.trim() === "" ? max : Number(valueMax);
  const pctMin = ((numMin - min) / (max - min)) * 100;
  const pctMax = ((numMax - min) / (max - min)) * 100;

  function handleMinSlider(v: number): void {
    onChangeMin(String(Math.min(v, numMax)));
  }
  function handleMaxSlider(v: number): void {
    onChangeMax(String(Math.max(v, numMin)));
  }

  return (
    <div className="dual-slider">
      <span className="field-label">{label}</span>
      <div className="dual-slider-track">
        <div className="dual-slider-fill" style={{ left: `${pctMin}%`, right: `${100 - pctMax}%` }} />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={numMin}
          onChange={(e) => handleMinSlider(Number(e.target.value))}
        />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={numMax}
          onChange={(e) => handleMaxSlider(Number(e.target.value))}
        />
      </div>
      <div className="dual-slider-inputs">
        <input
          type="number"
          value={valueMin}
          placeholder={String(min)}
          onChange={(e) => onChangeMin(e.target.value)}
        />
        <span className="dual-slider-unit">{unit}</span>
        <span className="dual-slider-sep">to</span>
        <input
          type="number"
          value={valueMax}
          placeholder={String(max)}
          onChange={(e) => onChangeMax(e.target.value)}
        />
        <span className="dual-slider-unit">{unit}</span>
      </div>
    </div>
  );
}
