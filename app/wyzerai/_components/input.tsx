"use client"

import React, { useState, useRef, useEffect } from "react"

interface AttachedFile {
  id: string
  file: File
  preview: string
}

interface InputProps {
  value: string
  onChange: (value: string) => void
  onSubmit: (files?: AttachedFile[]) => void
  disabled?: boolean
  placeholder?: string
  attachedFiles?: AttachedFile[]
  onFilesChange?: (files: AttachedFile[]) => void
}

const MAX_FILES = 2
const MAX_SIZE_MB = 20
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024

const cssAnimations = `
@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes scaleIn {
  from {
    opacity: 0;
    transform: scale(0.9);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}
`

export function Input({
  value,
  onChange,
  onSubmit,
  disabled = false,
  placeholder = "Diga como podemos ajudar?",
  attachedFiles = [],
  onFilesChange,
}: InputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isFocused, setIsFocused] = useState(false)

  useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return
    textarea.style.height = "auto"
    textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`
  }, [value])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      if ((value.trim() || attachedFiles.length > 0) && !disabled) {
        onSubmit(attachedFiles)
      }
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled) {
      if (fileInputRef.current) fileInputRef.current.value = ""
      return
    }

    const files = e.target.files
    if (!files || !onFilesChange) return

    const currentCount = attachedFiles.length
    const remainingSlots = MAX_FILES - currentCount

    if (remainingSlots <= 0) {
      alert(`Maximo de ${MAX_FILES} arquivos permitidos`)
      return
    }

    const newFiles: AttachedFile[] = []
    let totalSize = attachedFiles.reduce((acc, f) => acc + f.file.size, 0)

    for (let i = 0; i < Math.min(files.length, remainingSlots); i++) {
      const file = files[i]

      if (totalSize + file.size > MAX_SIZE_BYTES) {
        alert(`Tamanho total maximo de ${MAX_SIZE_MB}MB excedido`)
        break
      }

      totalSize += file.size

      const preview = file.type.startsWith("image/")
        ? URL.createObjectURL(file)
        : ""

      newFiles.push({
        id: Math.random().toString(36).slice(2),
        file,
        preview,
      })
    }

    onFilesChange([...attachedFiles, ...newFiles])

    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const handleRemoveFile = (id: string) => {
    if (!onFilesChange) return
    const file = attachedFiles.find((f) => f.id === id)
    if (file?.preview) {
      URL.revokeObjectURL(file.preview)
    }
    onFilesChange(attachedFiles.filter((f) => f.id !== id))
  }

  const handleAddClick = () => {
    if (disabled) return
    fileInputRef.current?.click()
  }

  const handleSubmit = () => {
    if ((value.trim() || attachedFiles.length > 0) && !disabled) {
      onSubmit(attachedFiles)
    }
  }

  return (
    <div className="px-3 pb-3 pt-2 sm:px-4 sm:pb-4 shrink-0">
      <style>{cssAnimations}</style>

      <div
        className={[
          "relative flex flex-col bg-gray-50 rounded-3xl transition-all duration-300 ease-out",
          isFocused ? "ring-2 ring-gray-200 bg-white shadow-lg" : "shadow-sm",
        ].join(" ")}
      >
        {attachedFiles.length > 0 && (
          <div className="px-4 pt-3 pb-1 flex flex-wrap gap-2">
            {attachedFiles.map((attached) => (
              <div
                key={attached.id}
                className="flex items-center gap-2 bg-white rounded-lg px-2 py-1.5 ring-1 ring-gray-200 shadow-sm"
                style={{ animation: "scaleIn 0.3s ease-out forwards" }}
              >
                {attached.preview ? (
                  <img
                    src={attached.preview || "/placeholder.svg"}
                    alt={attached.file.name}
                    className="w-6 h-6 rounded object-cover"
                  />
                ) : (
                  <div className="w-6 h-6 rounded bg-gray-100 flex items-center justify-center">
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      className="text-gray-400"
                    >
                      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                      <path d="M14 2v6h6" />
                    </svg>
                  </div>
                )}
                <span className="text-xs text-gray-600 max-w-[80px] truncate">
                  {attached.file.name}
                </span>
                <button
                  type="button"
                  onClick={() => handleRemoveFile(attached.id)}
                  className="p-0.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-all duration-200 active:scale-90"
                >
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="px-4 pt-4 pb-2">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            disabled={disabled}
            placeholder={placeholder}
            rows={1}
            className={[
              "w-full resize-none bg-transparent text-gray-900 placeholder-gray-400",
              "text-base leading-relaxed outline-none",
              "disabled:opacity-50 disabled:cursor-not-allowed",
            ].join(" ")}
            style={{ minHeight: "24px", maxHeight: "120px" }}
          />
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,.pdf,.doc,.docx,.txt"
          multiple
          onChange={handleFileSelect}
          className="hidden"
        />

        <div className="flex items-center justify-between px-2 pb-3 sm:px-3">
          <div className="flex items-center">
            <button
              type="button"
              onClick={handleAddClick}
              disabled={disabled || attachedFiles.length >= MAX_FILES}
              className={[
                "p-2 rounded-full transition-all duration-300 ease-out active:scale-90",
                disabled || attachedFiles.length >= MAX_FILES
                  ? "text-gray-300 cursor-not-allowed"
                  : "text-gray-500 hover:text-gray-700 hover:bg-gray-100",
              ].join(" ")}
              title={`Anexar arquivo (max ${MAX_FILES})`}
            >
              <svg
                width="20"
                height="20"
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
          </div>

          <div className="flex items-center">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={disabled || (!value.trim() && attachedFiles.length === 0)}
              className={[
                "p-2.5 rounded-full transition-all duration-300 ease-out active:scale-90",
                (value.trim() || attachedFiles.length > 0) && !disabled
                  ? "bg-gray-900 text-white hover:bg-gray-800 shadow-md hover:shadow-lg"
                  : "bg-gray-100 text-gray-400 cursor-not-allowed",
              ].join(" ")}
              title="Enviar"
            >
              {disabled ? (
                <svg
                  className="animate-spin"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M21 12a9 9 0 11-6.219-8.56" />
                </svg>
              ) : (
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M22 2L11 13" />
                  <path d="M22 2L15 22L11 13L2 9L22 2Z" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      <div className="px-4 pt-2 text-[11px] leading-snug text-gray-500/80 text-center">
        O Flow pode cometer erros. Confira as informações.
      </div>
    </div>
  )
}
