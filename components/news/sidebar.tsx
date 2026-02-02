"use client"

import React from "react"
import { useState, useRef, useEffect, useCallback } from "react"
import Link from "next/link"
import Image from "next/image"
import { Menu, Search, Bell, User, MoreHorizontal, X, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"

const navLinks = [
  { label: "World", href: "/noticias/world" },
  { label: "Politics", href: "/noticias/politics" },
  { label: "Business", href: "/noticias/business" },
  { label: "Opinion", href: "/noticias/opinion" },
  { label: "Tech", href: "/noticias/tech" },
  { label: "Science", href: "/noticias/science" },
  { label: "Sports", href: "/noticias/sports" },
  { label: "Arts", href: "/noticias/arts" },
  { label: "Books", href: "/noticias/books" },
  { label: "Style", href: "/noticias/style" },
  { label: "Food", href: "/noticias/food" },
  { label: "Travel", href: "/noticias/travel" },
  { label: "Magazine", href: "/noticias/magazine" },
]

const extraNavLinks = [
  { label: "Video", href: "/noticias/video" },
  { label: "Podcasts", href: "/noticias/podcasts" },
  { label: "Games", href: "/noticias/games" },
  { label: "Weather", href: "/noticias/weather" },
  { label: "Health", href: "/noticias/health" },
  { label: "Real Estate", href: "/noticias/real-estate" },
  { label: "Obituaries", href: "/noticias/obituaries" },
  { label: "Crossword", href: "/noticias/crossword" },
  { label: "Markets", href: "/noticias/markets" },
  { label: "Graphics", href: "/noticias/graphics" },
]

function formatDate() {
  const now = new Date()
  const options: Intl.DateTimeFormatOptions = {
    weekday: "long",
    day: "numeric",
    month: "short",
    year: "numeric",
  }
  const formatted = now.toLocaleDateString("en-US", options)
  const parts = formatted.split(", ")
  return {
    weekday: parts[0],
    date: parts.slice(1).join(", "),
  }
}

export function NewsHeader() {
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false)
  const [isScrolled, setIsScrolled] = useState(false)
  const [activeNavItem, setActiveNavItem] = useState<string | null>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const searchContainerRef = useRef<HTMLDivElement>(null)
  const moreMenuRef = useRef<HTMLDivElement>(null)

  const { weekday, date } = formatDate()

  const handleScroll = useCallback(() => {
    setIsScrolled(window.scrollY > 10)
  }, [])

  useEffect(() => {
    window.addEventListener("scroll", handleScroll, { passive: true })
    return () => window.removeEventListener("scroll", handleScroll)
  }, [handleScroll])

  useEffect(() => {
    if (isSearchOpen && searchInputRef.current) {
      const timer = setTimeout(() => {
        searchInputRef.current?.focus()
      }, 150)
      return () => clearTimeout(timer)
    }
  }, [isSearchOpen])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(event.target as Node)
      ) {
        setIsSearchOpen(false)
      }
      if (
        moreMenuRef.current &&
        !moreMenuRef.current.contains(event.target as Node)
      ) {
        setIsMoreMenuOpen(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [isSearchOpen, isMoreMenuOpen])

  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsSearchOpen(false)
        setIsMobileMenuOpen(false)
        setIsMoreMenuOpen(false)
      }
    }

    document.addEventListener("keydown", handleEscape)
    return () => document.removeEventListener("keydown", handleEscape)
  }, [])

  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = ""
    }
    return () => {
      document.body.style.overflow = ""
    }
  }, [isMobileMenuOpen])

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      console.log("Searching for:", searchQuery)
    }
  }

  return (
    <>
      <header
        className={cn(
          "sticky top-0 z-40 bg-background transition-all duration-500 ease-out",
          isScrolled && "shadow-sm"
        )}
      >
        {/* Top Bar */}
        <div className="border-b border-border/40">
          <div className="flex h-14 items-center justify-between px-4 lg:px-6">
            {/* Left Section */}
            <div className="flex items-center gap-1">
              {/* Hamburger - ONLY on mobile */}
              <button
                onClick={() => setIsMobileMenuOpen(true)}
                className="lg:hidden flex h-10 w-10 items-center justify-center hover:bg-muted/60 active:bg-muted transition-all duration-300 ease-out"
                aria-label="Menu"
              >
                <Menu className="h-5 w-5" strokeWidth={1.5} />
              </button>

              <div className="h-5 w-px bg-border/40 mx-2 hidden lg:block" />

              <div ref={searchContainerRef} className="relative">
                <div
                  className={cn(
                    "flex items-center overflow-hidden transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)]",
                    isSearchOpen ? "w-64 sm:w-80 lg:w-[420px]" : "w-10"
                  )}
                >
                  {isSearchOpen ? (
                    <form
                      onSubmit={handleSearchSubmit}
                      className="flex items-center w-full bg-muted/40 border border-border/50"
                    >
                      <Search className="h-4 w-4 ml-4 text-muted-foreground/60 flex-shrink-0" strokeWidth={1.5} />
                      <input
                        ref={searchInputRef}
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search news, topics, authors..."
                        className="flex-1 bg-transparent px-3 py-2.5 text-sm outline-none placeholder:text-muted-foreground/50"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setIsSearchOpen(false)
                          setSearchQuery("")
                        }}
                        className="h-10 w-10 flex items-center justify-center hover:bg-muted/50 transition-colors duration-300"
                      >
                        <X className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
                      </button>
                    </form>
                  ) : (
                    <button
                      onClick={() => setIsSearchOpen(true)}
                      className="flex h-10 w-10 items-center justify-center hover:bg-muted/60 active:bg-muted transition-all duration-300 ease-out"
                      aria-label="Search"
                    >
                      <Search className="h-5 w-5" strokeWidth={1.5} />
                    </button>
                  )}
                </div>
              </div>

              <button
                className="hidden sm:flex h-10 w-10 items-center justify-center hover:bg-muted/60 active:bg-muted transition-all duration-300 ease-out relative"
                aria-label="Notifications"
              >
                <Bell className="h-5 w-5" strokeWidth={1.5} />
                <span className="absolute top-2 right-2 w-2 h-2 bg-lime-400 rounded-full animate-pulse" />
              </button>
            </div>

            {/* Center - Logo */}
            <div className="absolute left-1/2 -translate-x-1/2">
              <Link 
                href="/noticias" 
                className="flex items-center transition-all duration-300 hover:opacity-70 active:scale-95"
              >
                <Image
                  src="/t304t80wjg0843h08gh4380h34.svg"
                  alt="Logo"
                  width={180}
                  height={32}
                  className="h-6 lg:h-8 w-auto object-contain"
                  priority
                />
              </Link>
            </div>

            {/* Right Section */}
            <div className="flex items-center gap-2">
              <button className="hidden sm:flex items-center gap-2 px-4 py-2 text-sm font-medium hover:bg-muted/60 transition-all duration-300 ease-out">
                <User className="h-4 w-4" strokeWidth={1.5} />
                <span>Sign In</span>
              </button>
              <button className="px-4 sm:px-5 py-2 sm:py-2.5 text-xs sm:text-sm font-semibold bg-foreground text-background hover:bg-foreground/85 transition-all duration-300 ease-out active:scale-[0.97]">
                Subscribe
              </button>
            </div>
          </div>
        </div>

        {/* Navigation Bar */}
        <div className="border-b border-border/40 relative">
          
          <div className="flex h-12 items-center px-4 lg:px-6">
            {/* Left - Date */}
            <div className="flex-shrink-0 min-w-fit pr-4 lg:pr-8">
              <div className="text-xs lg:text-sm tracking-tight">
                <span className="font-semibold text-foreground">{weekday}</span>
                <br className="sm:hidden" />
                <span className="text-muted-foreground/60 sm:ml-1.5">{date}</span>
              </div>
            </div>

            {/* Center - Navigation Links (ONLY desktop) */}
            <nav className="flex-1 flex justify-center overflow-hidden mx-4">
              <ul className="hidden lg:flex items-center justify-center gap-0.5 xl:gap-1">
                {navLinks.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="relative px-2 xl:px-3 py-2 text-[13px] font-medium text-foreground/70 hover:text-foreground transition-all duration-300 ease-out whitespace-nowrap group"
                      onMouseEnter={() => setActiveNavItem(link.label)}
                      onMouseLeave={() => setActiveNavItem(null)}
                    >
                      <span className="relative z-10">{link.label}</span>
                      <span 
                        className={cn(
                          "absolute bottom-0 left-1/2 -translate-x-1/2 h-0.5 bg-lime-400 transition-all duration-300 ease-out",
                          activeNavItem === link.label ? "w-full" : "w-0"
                        )}
                      />
                    </Link>
                  </li>
                ))}
              </ul>

              {/* Mobile Nav Button */}
              <button
                onClick={() => setIsMobileMenuOpen(true)}
                className="lg:hidden flex items-center gap-2 text-sm text-muted-foreground/70 hover:text-foreground transition-all duration-300 ease-out"
              >
                <span>Browse Categories</span>
                <ChevronRight className="h-4 w-4" />
              </button>
            </nav>

            {/* Right - More Options */}
            <div className="flex-shrink-0 pl-4 relative" ref={moreMenuRef}>
              <button
                onClick={() => setIsMoreMenuOpen(!isMoreMenuOpen)}
                className={cn(
                  "flex h-9 w-9 lg:h-10 lg:w-10 items-center justify-center bg-foreground text-background hover:bg-foreground/85 transition-all duration-300 ease-out",
                  isMoreMenuOpen && "bg-foreground/75"
                )}
                aria-label="More options"
              >
                <MoreHorizontal className="h-5 w-5" strokeWidth={2} />
              </button>

              {/* More Menu Dropdown */}
              <div
                className={cn(
                  "absolute top-full right-0 mt-2 w-72 bg-background border border-border/40 shadow-xl z-50 transition-all duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] origin-top-right",
                  isMoreMenuOpen 
                    ? "opacity-100 scale-100 translate-y-0" 
                    : "opacity-0 scale-95 -translate-y-2 pointer-events-none"
                )}
              >
                <div className="p-3">
                  <div className="px-3 py-2 text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-widest">
                    More Sections
                  </div>
                  <div className="grid grid-cols-2 gap-1">
                    {extraNavLinks.map((link) => (
                      <Link
                        key={link.label}
                        href={link.href}
                        onClick={() => setIsMoreMenuOpen(false)}
                        className="px-3 py-2.5 text-sm font-medium text-foreground/80 hover:text-foreground hover:bg-muted/50 transition-all duration-300 ease-out"
                      >
                        {link.label}
                      </Link>
                    ))}
                  </div>
                </div>
                <div className="border-t border-border/40 p-3">
                  <Link
                    href="/noticias/all"
                    onClick={() => setIsMoreMenuOpen(false)}
                    className="flex items-center justify-center px-3 py-2.5 text-sm font-semibold text-foreground bg-muted/40 hover:bg-muted/60 transition-all duration-300 ease-out"
                  >
                    View All Sections
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Menu Overlay */}
      <div
        className={cn(
          "fixed inset-0 z-[9999] lg:hidden transition-all duration-300",
          isMobileMenuOpen ? "visible" : "invisible pointer-events-none"
        )}
      >
        {/* Backdrop */}
        <div
          className={cn(
            "absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300",
            isMobileMenuOpen ? "opacity-100" : "opacity-0"
          )}
          onClick={() => setIsMobileMenuOpen(false)}
        />
        
        {/* Menu Panel */}
        <div
          className={cn(
            "absolute left-0 top-0 h-full w-[85%] max-w-[340px] bg-background shadow-2xl transition-transform duration-500 ease-[cubic-bezier(0.23,1,0.32,1)]",
            isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-5 border-b border-border/40">
            <span className="text-lg font-semibold tracking-tight">Menu</span>
            <button
              onClick={() => setIsMobileMenuOpen(false)}
              className="h-10 w-10 flex items-center justify-center hover:bg-muted/60 transition-all duration-300 ease-out"
            >
              <X className="h-5 w-5" strokeWidth={1.5} />
            </button>
          </div>

          {/* Mobile Search */}
          <div className="p-5 border-b border-border/40">
            <form
              onSubmit={handleSearchSubmit}
              className="flex items-center bg-muted/40 border border-border/40"
            >
              <Search className="h-4 w-4 ml-4 text-muted-foreground/60" strokeWidth={1.5} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search news..."
                className="flex-1 bg-transparent px-3 py-3 text-sm outline-none placeholder:text-muted-foreground/50"
              />
            </form>
          </div>

          {/* Mobile Nav Links */}
          <nav className="p-4 overflow-y-auto max-h-[calc(100vh-280px)]">
            <div className="mb-6">
              <div className="px-4 py-2 text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-widest">
                Main Sections
              </div>
              <ul>
                {navLinks.map((link, index) => (
                  <li
                    key={link.label}
                    style={{
                      opacity: isMobileMenuOpen ? 1 : 0,
                      transform: isMobileMenuOpen ? "translateX(0)" : "translateX(-16px)",
                      transition: `all 400ms cubic-bezier(0.23,1,0.32,1) ${isMobileMenuOpen ? index * 30 + 100 : 0}ms`
                    }}
                  >
                    <Link
                      href={link.href}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className="flex items-center justify-between px-4 py-3.5 text-sm font-medium text-foreground hover:bg-lime-400/10 hover:text-lime-600 transition-all duration-300 ease-out group"
                    >
                      <span>{link.label}</span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-lime-500 group-hover:translate-x-1 transition-all duration-300" />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div className="border-t border-border/40 pt-4">
              <div className="px-4 py-2 text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-widest">
                More
              </div>
              <ul>
                {extraNavLinks.map((link, index) => (
                  <li
                    key={link.label}
                    style={{
                      opacity: isMobileMenuOpen ? 1 : 0,
                      transform: isMobileMenuOpen ? "translateX(0)" : "translateX(-16px)",
                      transition: `all 400ms cubic-bezier(0.23,1,0.32,1) ${isMobileMenuOpen ? (index + navLinks.length) * 30 + 100 : 0}ms`
                    }}
                  >
                    <Link
                      href={link.href}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className="flex items-center justify-between px-4 py-3.5 text-sm font-medium text-muted-foreground/80 hover:text-lime-600 hover:bg-lime-400/10 transition-all duration-300 ease-out group"
                    >
                      <span>{link.label}</span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-lime-500 group-hover:translate-x-1 transition-all duration-300" />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </nav>

          {/* Mobile Auth Buttons */}
          <div className="absolute bottom-0 left-0 right-0 p-5 border-t border-border/40 bg-background">
            <div className="flex flex-col gap-3">
              <button className="flex items-center justify-center gap-2 px-4 py-3.5 text-sm font-medium border border-border/40 hover:bg-muted/50 transition-all duration-300 ease-out">
                <User className="h-4 w-4" strokeWidth={1.5} />
                <span>Sign In</span>
              </button>
              <button className="px-4 py-3.5 text-sm font-semibold bg-foreground text-background hover:bg-foreground/85 transition-all duration-300 ease-out active:scale-[0.98]">
                Subscribe
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
