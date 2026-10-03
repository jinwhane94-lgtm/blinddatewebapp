interface SingleSelectProps {
  options: readonly string[]
  value: string
  onChange: (value: string) => void
  error?: string
}

export function SingleSelect({ options, value, onChange, error }: SingleSelectProps) {
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            className={`chip ${value === opt ? 'selected' : ''}`}
          >
            {opt}
          </button>
        ))}
      </div>
      {error && <p className="form-error mt-2">{error}</p>}
    </div>
  )
}
