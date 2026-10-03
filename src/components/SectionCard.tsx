import { type ReactNode } from 'react'

interface SectionCardProps {
  title: string
  subtitle?: string
  children: ReactNode
  icon?: string
}

export function SectionCard({ title, subtitle, children, icon }: SectionCardProps) {
  return (
    <div className="section-card animate-fade-in">
      <div className="mb-5">
        <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
          {icon && <span className="text-2xl">{icon}</span>}
          {title}
        </h2>
        {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
      </div>
      {children}
    </div>
  )
}
