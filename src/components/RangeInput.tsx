interface RangeInputProps {
  label: string
  unit: string
  minValue: number | null | undefined
  maxValue: number | null | undefined
  anyValue: boolean
  onMinChange: (v: number | null) => void
  onMaxChange: (v: number | null) => void
  onAnyChange: (v: boolean) => void
  minError?: string
  maxError?: string
}

export function RangeInput({
  label,
  unit,
  minValue,
  maxValue,
  anyValue,
  onMinChange,
  onMaxChange,
  onAnyChange,
  minError,
  maxError,
}: RangeInputProps) {
  const parseNum = (s: string) => {
    const n = parseInt(s, 10)
    return isNaN(n) ? null : n
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 select-none">
        <button
          type="button"
          role="switch"
          aria-checked={anyValue}
          aria-label={`${label} 범위 상관없음`}
          onClick={() => onAnyChange(!anyValue)}
          className="relative flex h-11 w-11 shrink-0 items-center rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2"
        >
          <span className={`relative h-6 w-11 rounded-full transition-colors duration-200 ${anyValue ? 'bg-brand-500' : 'bg-gray-300'}`}>
            <span
              className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${anyValue ? 'translate-x-5' : 'translate-x-0'}`}
            />
          </span>
        </button>
        <span className="text-sm font-medium text-gray-600">상관없음</span>
      </div>

      {!anyValue && (
        <div className="flex items-start gap-2 sm:gap-3">
          <div className="min-w-0 flex-1">
            <input
              type="number"
              min="1"
              inputMode="numeric"
              placeholder={`최소 ${label}`}
              value={minValue ?? ''}
              onChange={(e) => onMinChange(parseNum(e.target.value))}
              className="form-input text-center"
            />
            {minError && <p className="form-error">{minError}</p>}
          </div>
          <span className="shrink-0 pt-3 text-gray-400 font-medium">~</span>
          <div className="min-w-0 flex-1">
            <input
              type="number"
              min="1"
              inputMode="numeric"
              placeholder={`최대 ${label}`}
              value={maxValue ?? ''}
              onChange={(e) => onMaxChange(parseNum(e.target.value))}
              className="form-input text-center"
            />
            {maxError && <p className="form-error">{maxError}</p>}
          </div>
          <span className="shrink-0 pt-3 text-sm text-gray-500">{unit}</span>
        </div>
      )}
    </div>
  )
}
