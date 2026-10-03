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
      <label className="flex items-center gap-3 cursor-pointer select-none">
        <div
          onClick={() => onAnyChange(!anyValue)}
          className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${anyValue ? 'bg-brand-500' : 'bg-gray-300'}`}
        >
          <span
            className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${anyValue ? 'translate-x-5' : 'translate-x-0'}`}
          />
        </div>
        <span className="text-sm font-medium text-gray-600">상관없음</span>
      </label>

      {!anyValue && (
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <input
              type="number"
              placeholder={`최소 ${label}`}
              value={minValue ?? ''}
              onChange={(e) => onMinChange(parseNum(e.target.value))}
              className="form-input text-center"
            />
            {minError && <p className="form-error">{minError}</p>}
          </div>
          <span className="text-gray-400 font-medium shrink-0">~</span>
          <div className="flex-1">
            <input
              type="number"
              placeholder={`최대 ${label}`}
              value={maxValue ?? ''}
              onChange={(e) => onMaxChange(parseNum(e.target.value))}
              className="form-input text-center"
            />
            {maxError && <p className="form-error">{maxError}</p>}
          </div>
          <span className="text-sm text-gray-500 shrink-0">{unit}</span>
        </div>
      )}
    </div>
  )
}
