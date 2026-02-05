"use client"

import React, { useState, useLayoutEffect, useRef, useCallback } from "react"

interface HeaderProps {
  activeTab: "chat" | "history"
  onTabChange: (tab: "chat" | "history") => void
  onNewChat?: () => void
  onClose?: () => void
  onGoBack?: () => void
  onSaveTranscript?: () => void
  hasActiveChat?: boolean
  hasMessages?: boolean
}

export function Header({
  activeTab,
  onTabChange,
  onClose,
  onGoBack,
  onNewChat,
  onSaveTranscript,
  hasActiveChat = false,
  hasMessages = false,
}: HeaderProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chatBtnRef = useRef<HTMLButtonElement>(null)
  const historyBtnRef = useRef<HTMLButtonElement>(null)
  const [indicatorStyle, setIndicatorStyle] = useState({ width: 0, x: 0 })
  const [ready, setReady] = useState(false)
  const measureCount = useRef(0)

  const measure = useCallback(() => {
    const container = containerRef.current
    const chatBtn = chatBtnRef.current
    const historyBtn = historyBtnRef.current

    if (!container || !chatBtn || !historyBtn) return false

    const containerRect = container.getBoundingClientRect()
    const activeBtn = activeTab === "chat" ? chatBtn : historyBtn
    const btnRect = activeBtn.getBoundingClientRect()

    if (btnRect.width > 0) {
      setIndicatorStyle({
        width: btnRect.width,
        x: btnRect.left - containerRect.left,
      })
      return true
    }
    return false
  }, [activeTab])

  useLayoutEffect(() => {
    measureCount.current = 0
    setReady(false)

    const attemptMeasure = () => {
      if (measure()) {
        measureCount.current++
        if (measureCount.current >= 3) {
          setReady(true)
        }
      }
    }

    attemptMeasure()

    const raf1 = requestAnimationFrame(attemptMeasure)
    const t1 = setTimeout(attemptMeasure, 16)
    const t2 = setTimeout(attemptMeasure, 50)
    const t3 = setTimeout(attemptMeasure, 100)
    const t4 = setTimeout(() => {
      attemptMeasure()
      setReady(true)
    }, 200)

    return () => {
      cancelAnimationFrame(raf1)
      clearTimeout(t1)
      clearTimeout(t2)
      clearTimeout(t3)
      clearTimeout(t4)
    }
  }, [activeTab, measure])

  return (
    <div className="flex items-center justify-between px-4 py-4 border-b border-gray-100/80 bg-white/80 backdrop-blur-xl shrink-0">
      <div
        ref={containerRef}
        className="relative flex items-center bg-gray-100/80 rounded-full py-0.5"
      >
        <div
          className="absolute top-1 bottom-1 bg-white rounded-full shadow-sm"
          style={{
            width: indicatorStyle.width > 0 ? indicatorStyle.width : "auto",
            transform: `translateX(${indicatorStyle.x}px)`,
            opacity: ready ? 1 : 0,
            transition: ready
              ? "transform 400ms cubic-bezier(0.34, 1.56, 0.64, 1), width 400ms cubic-bezier(0.34, 1.56, 0.64, 1), opacity 200ms ease"
              : "opacity 200ms ease",
          }}
        />

        <button
          ref={chatBtnRef}
          type="button"
          onClick={() => onTabChange("chat")}
          className={[
            "relative z-10 px-5 py-3 text-sm font-medium rounded-full transition-colors duration-300",
            activeTab === "chat"
              ? "text-gray-900"
              : "text-gray-500 hover:text-gray-700",
          ].join(" ")}
        >
          Chat
        </button>

        <button
          ref={historyBtnRef}
          type="button"
          onClick={() => onTabChange("history")}
          className={[
            "relative z-10 px-5 py-3 text-sm font-medium rounded-full transition-colors duration-300",
            activeTab === "history"
              ? "text-gray-900"
              : "text-gray-500 hover:text-gray-700",
          ].join(" ")}
        >
          Historico
        </button>
      </div>

      <div className="flex items-center gap-1">
        {activeTab === "chat" && hasActiveChat && hasMessages && (
          <button
            type="button"
            onClick={onSaveTranscript}
            className="p-2.5 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-all duration-300 ease-out active:scale-90"
            title="Salvar Transcript"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
              <path d="M14 2v6h6" />
              <path d="M16 13H8" />
              <path d="M16 17H8" />
              <path d="M10 9H8" />
            </svg>
          </button>
        )}

        {activeTab === "chat" && hasActiveChat && hasMessages && (
          <button
            type="button"
            onClick={onNewChat}
            className="p-2.5 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-all duration-300 ease-out active:scale-90"
            title="Novo Chat"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
        )}

        <button
          type="button"
          onClick={onGoBack}
          className="p-2.5 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-all duration-300 ease-out active:scale-90"
          title="Voltar ao inicio"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M19 12H5" />
            <path d="M12 19l-7-7 7-7" />
          </svg>
        </button>

        <button
          type="button"
          onClick={onClose}
          className="p-2.5 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-all duration-300 ease-out active:scale-90"
          title="Fechar"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M18 6L6 18" />
            <path d="M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  )
}
