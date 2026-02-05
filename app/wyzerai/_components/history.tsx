"use client"

import React from "react"

interface HistoryItem {
  id: string
  preview: string
  timestamp: string
  isOnline?: boolean
}

interface HistoryProps {
  items?: HistoryItem[]
  onItemClick?: (item: HistoryItem) => void
}

const cssAnimations = `
@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
`

// ✅ Formatar preview do motivo para exibição amigável
function formatPreview(preview: string): string {
  if (!preview || preview.trim() === "") return "Atendimento em andamento"
  if (preview === "Novo atendimento") return "Atendimento iniciado"
  if (preview.toLowerCase().includes("sem motivo")) return "Atendimento geral"
  return preview
}

export function History({ items = [], onItemClick }: HistoryProps) {
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <style>{cssAnimations}</style>

      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        <div className="py-2">
          {items.map((item, index) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onItemClick?.(item)}
              className="w-full flex items-start gap-3 px-4 py-4 text-left transition-all duration-300 ease-out hover:bg-gray-50 active:bg-gray-100 border-b border-gray-100 last:border-b-0"
              style={{
                animation: "fadeInUp 0.5s ease-out forwards",
                animationDelay: `${index * 60}ms`,
                opacity: 0,
              }}
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-900 truncate leading-relaxed">
                  {formatPreview(item.preview)}
                </p>
                <div className="flex items-center gap-2 mt-1.5">
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    className="text-blue-500 flex-shrink-0"
                  >
                    <path
                      d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5L12 2Z"
                      fill="currentColor"
                    />
                  </svg>
                  <span className="text-xs text-gray-400">{item.timestamp}</span>
                </div>
              </div>

              {item.isOnline && (
                <div className="flex-shrink-0 mt-1">
                  <div className="w-2.5 h-2.5 rounded-full bg-green-500 ring-2 ring-green-500/20" />
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {items.length === 0 && (
        <div
          className="flex-1 flex flex-col items-center justify-center px-6 py-12 mb-70"
          style={{ animation: "fadeIn 0.5s ease-out forwards" }}
        >
          <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-gray-400"
            >
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
            </svg>
          </div>
          <p className="text-gray-500 text-sm text-center">
            Nenhuma conversa ainda
          </p>
          <p className="text-gray-400 text-xs text-center mt-1">
            Comece uma nova conversa
          </p>
        </div>
      )}
    </div>
  )
}
