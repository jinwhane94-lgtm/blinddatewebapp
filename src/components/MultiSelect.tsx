interface MultiSelectProps {
  options: readonly string[]
  value: string[]
  onChange: (value: string[]) => void
  error?: string
}

export function MultiSelect({ options, value, onChange, error }: MultiSelectProps) {
  const toggle = (opt: string) => {
    if (value.includes(opt)) {
      onChange(value.filter((v) => v !== opt))
    } else if (opt === '상관없음') {
      onChange(['상관없음'])
    } else {
      onChange([...value.filter((v) => v !== '상관없음'), opt])
    }
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => toggle(opt)}
            aria-pressed={value.includes(opt)}
            className={`chip ${value.includes(opt) ? 'selected' : ''}`}
          >
            {opt}
          </button>
        ))}
      </div>
      {error && <p className="form-error mt-2">{error}</p>}
    </div>
  )
}
