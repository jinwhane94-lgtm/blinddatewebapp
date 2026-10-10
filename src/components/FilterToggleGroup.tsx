import { useId, useState } from 'react'

interface FilterToggleGroupProps {
  label: string
  options: readonly string[]
  selected: string[]
  onChange: (selected: string[]) => void
}

export function FilterToggleGroup({ label, options, selected, onChange }: FilterToggleGroupProps) {
  const [open, setOpen] = useState(false)
  const panelId = useId()
  const toggle = (option: string) => {
    onChange(selected.includes(option)
      ? selected.filter((item) => item !== option)
      : [...selected, option])
  }

  return (
    <div className="border-b border-gray-100 last:border-b-0">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
        className="flex min-h-12 w-full items-center justify-between gap-3 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
      >
        <span className="flex min-w-0 items-center gap-2">
          <strong className="text-sm text-gray-800">{label}</strong>
          {selected.length > 0 && <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-bold text-brand-600">{selected.length}</span>}
        </span>
        <span aria-hidden="true" className={`shrink-0 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}>⌄</span>
      </button>
      {open && (
        <div id={panelId} role="group" aria-label={`${label} 선택`} className="flex flex-wrap gap-2 pb-4">
          {options.map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={selected.includes(option)}
              onClick={() => toggle(option)}
              className={`chip ${selected.includes(option) ? 'selected' : ''}`}
            >
              {option}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
