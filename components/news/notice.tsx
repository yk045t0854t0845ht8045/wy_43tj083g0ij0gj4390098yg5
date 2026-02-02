"use client"

import React from "react"
import { useState, useRef, useEffect } from "react"
import Image from "next/image"
import Link from "next/link"
import { Facebook, MessageCircle, Share2, Play, Pause, ChevronLeft, ChevronRight, ArrowUpRight, Clock, Bookmark, Volume2, VolumeX, Twitter } from "lucide-react"
import { cn } from "@/lib/utils"

// TODAS AS IMAGENS USANDO PLACEHOLDER
const galleryImages = [
  { src: "https://v0.app/placeholder.svg?height=600&width=800", caption: "Lady Gaga vence melhor album pop vocal no Grammy 2026", credit: "Foto: Chris Pizzello/AP" },
  { src: "https://v0.app/placeholder.svg?height=600&width=800", caption: "Kendrick Lamar se torna o rapper mais premiado da historia", credit: "Foto: Kevin Winter/Getty Images" },
  { src: "https://v0.app/placeholder.svg?height=600&width=800", caption: "Bad Bunny faz discurso emocionante sobre imigracao", credit: "Foto: Matt Sayles/Invision/AP" },
  { src: "https://v0.app/placeholder.svg?height=600&width=800", caption: "Billie Eilish e Finneas recebem Grammy de Musica do Ano", credit: "Foto: Chris Pizzello/Invision/AP" },
  { src: "https://v0.app/placeholder.svg?height=600&width=800", caption: "Caetano Veloso e Maria Bethania vencem Melhor Album de Musica Global", credit: "Foto: Kevin Winter/Getty Images" },
  { src: "https://v0.app/placeholder.svg?height=600&width=800", caption: "Sabrina Carpenter no tapete vermelho do Grammy 2026", credit: "Foto: Jordan Strauss/Invision/AP" },
]

const maisLidas = [
  { title: "Veja como foi Corinthians 2 x 3 Arsenal pela final da Copa das Campeas", image: "https://v0.app/placeholder.svg?height=600&width=800" },
  { title: "Pedro Turra e transferido para carceragem da Policia Civil apos prisao", image: "https://v0.app/placeholder.svg?height=600&width=800" },
  { title: "Cao Orelha: Policia ouve adolescente e descarta desafio de redes sociais", image: "https://v0.app/placeholder.svg?height=600&width=800" },
  { title: "Apos quase um mes, entenda hipoteses sobre desaparecimento de irmaos no MA", image: "https://v0.app/placeholder.svg?height=600&width=800" },
  { title: "Defesa de Turra pede cela privativa apos ameaca de morte", image: "https://v0.app/placeholder.svg?height=600&width=800" },
]

const conteudoParceiros = [
  { source: "Omelete", title: "Michael | Novo teaser mostra cenas ineditas; assista", image: "https://v0.app/placeholder.svg?height=600&width=800" },
  { source: "Omelete", title: "O Diabo Veste Prada 2 | Assista ao novo trailer do filme", image: "https://v0.app/placeholder.svg?height=600&width=800" },
  { source: "TechTudo", title: "iPhone 17 Pro: vazamento revela design revolucionario", image: "https://v0.app/placeholder.svg?height=600&width=800" },
]

const relatedArticles = [
  { title: "Grammy 2026: confira looks das celebridades no tapete vermelho", image: "https://v0.app/placeholder.svg?height=600&width=800" },
  { title: "Grammy Awards: o que esperar do 'Oscar da musica'?", image: "https://v0.app/placeholder.svg?height=600&width=800" },
  { title: "Grammy Latino 2025: veja os vencedores das principais categorias", image: "https://v0.app/placeholder.svg?height=600&width=800" },
]

export function NewsArticle() {
  const [currentImage, setCurrentImage] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [audioProgress, setAudioProgress] = useState(0)
  const [playbackSpeed, setPlaybackSpeed] = useState(1)
  const [isMuted, setIsMuted] = useState(false)
  const [isBookmarked, setIsBookmarked] = useState(false)
  const [showShareTooltip, setShowShareTooltip] = useState(false)
  const [isVideoPlaying, setIsVideoPlaying] = useState(false)
  const progressRef = useRef<HTMLDivElement>(null)
  const [waveHeights, setWaveHeights] = useState<number[]>([])

  // Generate wave heights on mount
  useEffect(() => {
    setWaveHeights(Array.from({ length: 60 }, () => Math.random() * 60 + 20))
  }, [])

  const nextImage = () => {
    setCurrentImage((prev) => (prev + 1) % galleryImages.length)
  }

  const prevImage = () => {
    setCurrentImage((prev) => (prev - 1 + galleryImages.length) % galleryImages.length)
  }

  const toggleAudio = () => {
    setIsPlaying(!isPlaying)
  }

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (progressRef.current) {
      const rect = progressRef.current.getBoundingClientRect()
      const x = e.clientX - rect.left
      const percentage = (x / rect.width) * 100
      setAudioProgress(Math.min(100, Math.max(0, percentage)))
    }
  }

  const cycleSpeed = () => {
    const speeds = [1, 1.25, 1.5, 1.75, 2]
    const currentIndex = speeds.indexOf(playbackSpeed)
    setPlaybackSpeed(speeds[(currentIndex + 1) % speeds.length])
  }

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Grammy 2026: confira a lista completa de vencedores",
          url: window.location.href,
        })
      } catch (err) {
        console.log("Share cancelled")
      }
    } else {
      navigator.clipboard.writeText(window.location.href)
      setShowShareTooltip(true)
      setTimeout(() => setShowShareTooltip(false), 2000)
    }
  }

  return (
    <main className="min-h-screen bg-white">
      <div className="max-w-[1400px] mx-auto px-4 py-6 lg:py-8">
        <div className="flex flex-col lg:flex-row gap-8 lg:gap-12">
          {/* Main Content */}
          <article className="flex-1 max-w-[800px]">
            {/* Category Badge */}
            <div className="flex items-center gap-2 mb-4">
              <span className="text-xs font-bold text-muted-foreground border border-muted-foreground/30 px-2 py-1">
                PORTAL
              </span>
              <span className="text-lime-600 font-bold text-sm">POP</span>
            </div>

            {/* Title */}
            <h1 className="text-3xl md:text-4xl lg:text-[42px] font-bold text-foreground leading-tight mb-4 text-pretty">
              Grammy 2026: confira a lista completa de vencedores
            </h1>

            {/* Subtitle */}
            <p className="text-lg md:text-xl text-muted-foreground mb-6 leading-relaxed">
              Premiacao acontece neste domingo (1), em Los Angeles. Bad Bunny, Lady Gaga e Kendrick Lamar estao entre principais indicados.
            </p>

            {/* Author & Date */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 text-sm text-muted-foreground mb-6">
              <span>
                Por <Link href="#" className="text-lime-600 hover:underline transition-all duration-300 ease-out">Redacao Portal</Link>
              </span>
              <span className="hidden sm:inline">|</span>
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                01/02/2026 18h07 - Atualizado ha 50 minutos
              </span>
            </div>

            {/* Share Buttons */}
            <div className="flex gap-3 mb-8">
              <button 
                type="button"
                className="flex-1 flex items-center justify-center gap-2 py-3 border border-muted-foreground/20 hover:bg-blue-50 hover:border-blue-500 transition-all duration-300 ease-out group"
              >
                <Facebook className="w-5 h-5 text-blue-600 group-hover:scale-110 transition-transform duration-300 ease-out" />
              </button>
              <button 
                type="button"
                className="flex-1 flex items-center justify-center gap-2 py-3 border border-muted-foreground/20 hover:bg-sky-50 hover:border-sky-500 transition-all duration-300 ease-out group"
              >
                <Twitter className="w-5 h-5 text-sky-500 group-hover:scale-110 transition-transform duration-300 ease-out" />
              </button>
              <button 
                type="button"
                className="flex-1 flex items-center justify-center gap-2 py-3 border border-muted-foreground/20 hover:bg-green-50 hover:border-green-500 transition-all duration-300 ease-out group"
              >
                <MessageCircle className="w-5 h-5 text-green-600 group-hover:scale-110 transition-transform duration-300 ease-out" />
              </button>
              <div className="relative flex-1">
                <button 
                  type="button"
                  onClick={handleShare}
                  className="w-full flex items-center justify-center gap-2 py-3 border border-muted-foreground/20 hover:bg-muted/50 hover:border-muted-foreground transition-all duration-300 ease-out group"
                >
                  <Share2 className="w-5 h-5 text-muted-foreground group-hover:scale-110 transition-transform duration-300 ease-out" />
                </button>
                {showShareTooltip && (
                  <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-foreground text-background text-xs px-3 py-1.5 whitespace-nowrap animate-in fade-in slide-in-from-bottom-2 duration-300">
                    Link copiado!
                  </div>
                )}
              </div>
              <button 
                type="button"
                onClick={() => setIsBookmarked(!isBookmarked)}
                className={cn(
                  "flex items-center justify-center gap-2 py-3 px-4 border transition-all duration-300 ease-out group",
                  isBookmarked 
                    ? "bg-lime-400 border-lime-400" 
                    : "border-muted-foreground/20 hover:bg-lime-50 hover:border-lime-400"
                )}
              >
                <Bookmark className={cn(
                  "w-5 h-5 transition-all duration-300 ease-out",
                  isBookmarked ? "fill-black text-black" : "text-muted-foreground group-hover:text-lime-600"
                )} />
              </button>
            </div>

            {/* Image Gallery */}
            <div className="mb-8">
              <div className="relative bg-black aspect-video overflow-hidden group">
                <Image
                  src={galleryImages[currentImage].src || "https://v0.app/placeholder.svg"}
                  alt={galleryImages[currentImage].caption}
                  fill
                  className="object-cover transition-transform duration-700 ease-[cubic-bezier(0.23,1,0.32,1)] group-hover:scale-105"
                />
                
                {/* Gallery Counter */}
                <div className="absolute top-4 left-4 bg-lime-400 text-black text-xs font-bold px-2 py-1">
                  {currentImage + 1} de {galleryImages.length}
                </div>

                {/* Expand Button */}
                <button 
                  type="button"
                  className="absolute top-4 right-4 bg-black/80 hover:bg-black text-white p-2 transition-all duration-300 ease-out hover:scale-110"
                >
                  <ArrowUpRight className="w-4 h-4" />
                </button>

                {/* Caption */}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-4 pt-12">
                  <p className="text-white text-sm">
                    {galleryImages[currentImage].caption}
                    <span className="text-white/60 ml-2">- {galleryImages[currentImage].credit}</span>
                  </p>
                </div>

                {/* Navigation Arrows */}
                <button
                  type="button"
                  onClick={prevImage}
                  className="absolute left-0 top-1/2 -translate-y-1/2 bg-lime-400 hover:bg-lime-300 text-black p-2 transition-all duration-300 ease-out opacity-0 group-hover:opacity-100 hover:scale-110"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  onClick={nextImage}
                  className="absolute right-0 top-1/2 -translate-y-1/2 bg-lime-400 hover:bg-lime-300 text-black p-2 transition-all duration-300 ease-out opacity-0 group-hover:opacity-100 hover:scale-110"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>

              {/* Thumbnails */}
              <div className="flex gap-1 mt-1 overflow-x-auto pb-2 scrollbar-hide">
                {galleryImages.map((img, index) => (
                  <button
                    key={`thumb-${index}`}
                    type="button"
                    onClick={() => setCurrentImage(index)}
                    className={cn(
                      "relative flex-shrink-0 w-24 h-16 overflow-hidden transition-all duration-300 ease-out",
                      currentImage === index ? "ring-2 ring-lime-400" : "opacity-60 hover:opacity-100"
                    )}
                  >
                    <Image
                      src={img.src || "https://v0.app/placeholder.svg"}
                      alt={`Thumbnail ${index + 1}`}
                      fill
                      className="object-cover"
                    />
                  </button>
                ))}
              </div>
            </div>

            {/* Audio Player */}
            <div className="mb-8 p-4 bg-muted/30 border-l-4 border-lime-400">
              <p className="text-xs text-muted-foreground mb-3 uppercase tracking-wide font-medium">Ouvir noticia</p>
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={toggleAudio}
                  className="w-10 h-10 flex items-center justify-center bg-lime-400 hover:bg-lime-300 text-black transition-all duration-300 ease-out hover:scale-110 active:scale-95"
                >
                  {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
                </button>
                <div 
                  ref={progressRef}
                  onClick={handleProgressClick}
                  onKeyDown={(e) => {
                    if (e.key === 'ArrowRight') setAudioProgress(Math.min(100, audioProgress + 5))
                    if (e.key === 'ArrowLeft') setAudioProgress(Math.max(0, audioProgress - 5))
                  }}
                  role="slider"
                  tabIndex={0}
                  aria-valuenow={audioProgress}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label="Audio progress"
                  className="flex-1 h-8 bg-muted/50 relative cursor-pointer group"
                >
                  <div className="absolute inset-y-0 left-0 flex items-center">
                    {waveHeights.map((height, i) => (
                      <div
                        key={`wave-${i}`}
                        className={cn(
                          "w-0.5 mx-px transition-all duration-150",
                          (i / 60) * 100 < audioProgress ? "bg-lime-500" : "bg-muted-foreground/30"
                        )}
                        style={{ height: `${height}%` }}
                      />
                    ))}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsMuted(!isMuted)}
                  className="w-8 h-8 flex items-center justify-center hover:bg-muted/50 transition-all duration-300 ease-out"
                >
                  {isMuted ? <VolumeX className="w-4 h-4 text-muted-foreground" /> : <Volume2 className="w-4 h-4 text-muted-foreground" />}
                </button>
                <span className="text-sm text-muted-foreground min-w-[40px]">0:00</span>
                <button
                  type="button"
                  onClick={cycleSpeed}
                  className="px-2 py-1 bg-foreground text-background text-xs font-bold hover:bg-foreground/80 transition-all duration-300 ease-out"
                >
                  {playbackSpeed}x
                </button>
              </div>
            </div>

            {/* Article Content */}
            <div className="prose prose-lg max-w-none">
              <p className="text-lg leading-relaxed mb-6">
                A <strong>Academia Nacional de Artes e Ciencias de Gravacao dos Estados Unidos</strong> consagra neste domingo (1), os vencedores do gramofone de ouro do <strong>Grammy Awards</strong>. O evento acontece na Crypto.com Arena, em Los Angeles.
              </p>

              {/* Ad Space 1 */}
              <div className="my-8 relative">
                <div className="flex items-center justify-center gap-4 mb-2">
                  <div className="flex-1 h-px bg-muted-foreground/20" />
                  <span className="text-xs text-muted-foreground uppercase tracking-widest">Publicidade</span>
                  <div className="flex-1 h-px bg-muted-foreground/20" />
                </div>
                <div className="bg-muted/40 h-[250px] flex items-center justify-center">
                  <span className="text-muted-foreground/30 text-xs uppercase tracking-widest">Espaco para Anuncio</span>
                </div>
              </div>

              <p className="text-lg leading-relaxed mb-6">
                A cerimonia principal consagrou <strong className="text-lime-600 hover:underline cursor-pointer transition-all duration-300 ease-out">Kendrick Lamar</strong>, o maior indicado da edicao, tambem como o <strong className="text-lime-600 hover:underline cursor-pointer transition-all duration-300 ease-out">rapper com mais premios Grammy da historia da premiacao</strong>, chegando ao numero de 26 gramofones.
              </p>

              {/* Embedded Video */}
              <div className="my-8">
                <div className="relative aspect-video bg-black overflow-hidden group">
                  <Image
                    src="https://v0.app/placeholder.svg?height=600&width=800"
                    alt="Video thumbnail"
                    fill
                    className="object-cover"
                  />
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                    <button
                      type="button"
                      onClick={() => setIsVideoPlaying(!isVideoPlaying)}
                      className="w-16 h-16 bg-lime-400 flex items-center justify-center transition-all duration-300 ease-out hover:scale-110 hover:bg-lime-300 active:scale-95"
                    >
                      <Play className="w-6 h-6 text-black ml-1" />
                    </button>
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
                    <p className="text-white text-sm font-medium">Assista: Kendrick Lamar agradece ao receber premio historico</p>
                    <p className="text-white/60 text-xs mt-1">3:45</p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground mt-2">Video: Kendrick Lamar recebe o Grammy de Album do Ano - Fonte: Recording Academy</p>
              </div>

              {/* Bullet Points */}
              <ul className="space-y-4 my-8 list-none pl-0">
                <li className="flex gap-3 items-start">
                  <span className="w-2 h-2 bg-lime-400 mt-2.5 flex-shrink-0" />
                  <span>Caetano Veloso e Maria Bethania <strong className="text-lime-600 hover:underline cursor-pointer transition-all duration-300 ease-out">levaram o premio de Melhor Album de Musica Global</strong> pelo disco "Caetano e Bethania Ao Vivo".</span>
                </li>
                <li className="flex gap-3 items-start">
                  <span className="w-2 h-2 bg-lime-400 mt-2.5 flex-shrink-0" />
                  <span>Kendrick Lamar ultrapassou Jay-Z e se tornou o rapper mais premiado da historia do Grammy, com 26 premios.</span>
                </li>
                <li className="flex gap-3 items-start">
                  <span className="w-2 h-2 bg-lime-400 mt-2.5 flex-shrink-0" />
                  <span>Bad Bunny foi aplaudido <strong className="text-lime-600 hover:underline cursor-pointer transition-all duration-300 ease-out">em discurso contra agencia de imigracao</strong> nos EUA; na mesma linha, ao vencer Musica do Ano, Billie Eilish disse que "ninguem e ilegal em terra roubada".</span>
                </li>
                <li className="flex gap-3 items-start">
                  <span className="w-2 h-2 bg-lime-400 mt-2.5 flex-shrink-0" />
                  <span>Olivia Dean venceu o premio de Melhor Artista Revelacao.</span>
                </li>
              </ul>

              <p className="text-lg font-bold mb-4">
                Veja abaixo os principais indicados e vencedores da premiacao:
              </p>

              <p className="text-lg italic text-muted-foreground mb-8">
                Esta lista esta sendo atualizada em tempo real.
              </p>

              {/* In-Article Image */}
              <figure className="my-8">
                <div className="relative aspect-video overflow-hidden">
                  <Image
                    src="https://v0.app/placeholder.svg?height=600&width=800"
                    alt="Billie Eilish e Finneas recebem Grammy"
                    fill
                    className="object-cover transition-transform duration-700 ease-[cubic-bezier(0.23,1,0.32,1)] hover:scale-105"
                  />
                </div>
                <figcaption className="text-sm text-muted-foreground mt-2">
                  Billie Eilish e Finneas recebem Grammy de Musica do Ano por 'Wildflower' - Foto: Chris Pizzello/Invision/AP
                </figcaption>
              </figure>

              {/* Category Section */}
              <h2 className="text-2xl font-bold mt-10 mb-6">Musica do Ano</h2>
              <ul className="space-y-2 mb-8 list-none pl-0">
                <li className="flex gap-3 items-center">
                  <span className="w-2 h-2 bg-lime-400 flex-shrink-0" />
                  <span>Golden - <strong className="text-lime-600">HUNTR/X: EJAE</strong>, Audrey Nuna, Rei Ami</span>
                </li>
                <li className="flex gap-3 items-center">
                  <span className="w-2 h-2 bg-lime-400 flex-shrink-0" />
                  <span>Luther - <strong className="text-lime-600">Kendrick Lamar, SZA</strong></span>
                </li>
                <li className="flex gap-3 items-center bg-lime-400/10 -mx-2 px-2 py-1">
                  <span className="w-2 h-2 bg-lime-400 flex-shrink-0" />
                  <span>Wildflower - <strong className="text-lime-600">Billie Eilish</strong> (VENCEDOR)</span>
                </li>
              </ul>

              {/* Ad Space 2 */}
              <div className="my-8 relative">
                <div className="flex items-center justify-center gap-4 mb-2">
                  <div className="flex-1 h-px bg-muted-foreground/20" />
                  <span className="text-xs text-muted-foreground uppercase tracking-widest">Continua depois da publicidade</span>
                  <div className="flex-1 h-px bg-muted-foreground/20" />
                </div>
                <div className="bg-muted/40 h-[120px] flex items-center justify-center">
                  <span className="text-muted-foreground/30 text-xs uppercase tracking-widest">Espaco para Anuncio</span>
                </div>
              </div>

              <h2 className="text-2xl font-bold mt-10 mb-6">Album do Ano</h2>
              <ul className="space-y-2 mb-8 list-none pl-0">
                <li className="flex gap-3 items-center">
                  <span className="w-2 h-2 bg-lime-400 flex-shrink-0" />
                  <span>"DeBi TiRAR MaS FOTos" - Bad Bunny</span>
                </li>
                <li className="flex gap-3 items-center">
                  <span className="w-2 h-2 bg-lime-400 flex-shrink-0" />
                  <span>"Swag" - Justin Bieber</span>
                </li>
                <li className="flex gap-3 items-center">
                  <span className="w-2 h-2 bg-lime-400 flex-shrink-0" />
                  <span>"Man's Best Friend" - Sabrina Carpenter</span>
                </li>
                <li className="flex gap-3 items-center">
                  <span className="w-2 h-2 bg-lime-400 flex-shrink-0" />
                  <span>"Let God Sort Em Out" - <strong className="text-lime-600">Clipse, Pusha T & Malice</strong></span>
                </li>
                <li className="flex gap-3 items-center">
                  <span className="w-2 h-2 bg-lime-400 flex-shrink-0" />
                  <span>"Mayhem" - Lady Gaga</span>
                </li>
                <li className="flex gap-3 items-center bg-lime-400/10 -mx-2 px-2 py-1">
                  <span className="w-2 h-2 bg-lime-400 flex-shrink-0" />
                  <span>"GNX" - <strong className="text-lime-600">Kendrick Lamar</strong> (VENCEDOR)</span>
                </li>
                <li className="flex gap-3 items-center">
                  <span className="w-2 h-2 bg-lime-400 flex-shrink-0" />
                  <span>"Mutt" - Leon Thomas</span>
                </li>
                <li className="flex gap-3 items-center">
                  <span className="w-2 h-2 bg-lime-400 flex-shrink-0" />
                  <span>"Chromakopia" - Tyler, The Creator</span>
                </li>
              </ul>

              <h2 className="text-2xl font-bold mt-10 mb-6">Melhor Album de Musica Global</h2>
              <p className="text-lg mb-4">
                <strong>Vencedor: "Caetano e Bethania Ao Vivo" — Caetano Veloso e Maria Bethania</strong>
              </p>
              <ul className="space-y-2 mb-8 list-none pl-0">
                <li className="flex gap-3 items-center">
                  <span className="w-2 h-2 bg-lime-400 flex-shrink-0" />
                  <span>"Sounds Of Kumbha" - Sounds Of Kumbha</span>
                </li>
                <li className="flex gap-3 items-center">
                  <span className="w-2 h-2 bg-lime-400 flex-shrink-0" />
                  <span>"No Sign of Weakness" - Burna Boy</span>
                </li>
                <li className="flex gap-3 items-center">
                  <span className="w-2 h-2 bg-lime-400 flex-shrink-0" />
                  <span>"Eclairer le monde - Light the World" - Youssou N'Dour</span>
                </li>
              </ul>

              {/* Another In-Article Image */}
              <figure className="my-8">
                <div className="relative aspect-[16/9] overflow-hidden">
                  <Image
                    src="https://v0.app/placeholder.svg?height=600&width=800"
                    alt="Caetano e Bethania no Grammy"
                    fill
                    className="object-cover transition-transform duration-700 ease-[cubic-bezier(0.23,1,0.32,1)] hover:scale-105"
                  />
                </div>
                <figcaption className="text-sm text-muted-foreground mt-2">
                  Caetano Veloso e Maria Bethania celebram vitoria historica no Grammy 2026 - Foto: Kevin Winter/Getty Images
                </figcaption>
              </figure>

              {/* Read More Section */}
              <div className="my-10">
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                  Leia mais
                  <span className="w-1.5 h-1.5 bg-lime-400" />
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {relatedArticles.map((article, index) => (
                    <Link 
                      key={index} 
                      href="/blog" 
                      className="group block"
                    >
                      <div className="relative aspect-[4/3] overflow-hidden mb-2">
                        <Image
                          src={article.image || "https://v0.app/placeholder.svg"}
                          alt={article.title}
                          fill
                          className="object-cover transition-transform duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] group-hover:scale-105"
                        />
                      </div>
                      <h4 className="text-sm font-semibold leading-snug group-hover:text-lime-600 transition-colors duration-300 ease-out">
                        {article.title}
                      </h4>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </article>

          {/* Sidebar */}
          <aside className="w-full lg:w-[320px] xl:w-[360px] flex-shrink-0 space-y-6">
            {/* Ad Space */}
            <div className="bg-muted/30 h-[280px] flex items-center justify-center">
              <span className="text-muted-foreground/30 text-xs uppercase tracking-widest">Espaco para Anuncio</span>
            </div>

            {/* Mais Lidas */}
            <div className="bg-background">
              <div className="p-4 border-b border-border/30">
                <h2 className="text-lg font-bold tracking-tight flex items-center gap-2">
                  Mais Lidas
                  <span className="w-1.5 h-1.5 bg-lime-400" />
                </h2>
              </div>
              
              <div>
                {maisLidas.map((news, index) => (
                  <article
                    key={index}
                    className={cn(
                      "group p-4 hover:bg-muted/20 transition-all duration-300 ease-out cursor-pointer",
                      index !== 0 && "border-t border-border/20"
                    )}
                  >
                    <Link href="/blog" className="block">
                      <div className="flex gap-3">
                        <div className="w-24 h-16 overflow-hidden flex-shrink-0 relative">
                          <Image
                            src={news.image || "https://v0.app/placeholder.svg"}
                            alt={news.title}
                            fill
                            className="object-cover group-hover:scale-105 transition-transform duration-500 ease-[cubic-bezier(0.23,1,0.32,1)]"
                          />
                        </div>
                        <h3 className="flex-1 text-sm font-medium leading-snug group-hover:text-lime-600 transition-colors duration-300 ease-out line-clamp-3">
                          {news.title}
                        </h3>
                      </div>
                    </Link>
                  </article>
                ))}
              </div>
            </div>

            {/* Ad Space */}
            <div className="bg-muted/30 h-[280px] flex items-center justify-center">
              <span className="text-muted-foreground/30 text-xs uppercase tracking-widest">Espaco para Anuncio</span>
            </div>

            {/* Conteudo de Parceiros */}
            <div className="bg-background">
              <div className="p-4 border-b border-border/30">
                <h2 className="text-lg font-bold tracking-tight flex items-center gap-2">
                  Conteudo de Parceiros
                  <span className="w-1.5 h-1.5 bg-lime-400" />
                </h2>
              </div>
              
              <div>
                {conteudoParceiros.map((news, index) => (
                  <article
                    key={index}
                    className={cn(
                      "group p-4 hover:bg-muted/20 transition-all duration-300 ease-out cursor-pointer",
                      index !== 0 && "border-t border-border/20"
                    )}
                  >
                    <Link href="/blog" className="block">
                      <p className="text-xs text-muted-foreground mb-1">{news.source}</p>
                      <div className="flex gap-3">
                        <div className="w-24 h-16 overflow-hidden flex-shrink-0 relative">
                          <Image
                            src={news.image || "https://v0.app/placeholder.svg"}
                            alt={news.title}
                            fill
                            className="object-cover group-hover:scale-105 transition-transform duration-500 ease-[cubic-bezier(0.23,1,0.32,1)]"
                          />
                        </div>
                        <h3 className="flex-1 text-sm font-medium leading-snug group-hover:text-lime-600 transition-colors duration-300 ease-out line-clamp-3">
                          {news.title}
                        </h3>
                      </div>
                    </Link>
                  </article>
                ))}
              </div>
            </div>

            {/* Newsletter Sticky */}
            <div className="bg-foreground text-background p-5 sticky top-24">
              <h3 className="text-lg font-bold mb-2">Newsletter</h3>
              <p className="text-sm text-background/70 mb-4">
                Receba as principais noticias do dia no seu email
              </p>
              <form className="space-y-3">
                <input
                  type="email"
                  placeholder="Seu melhor email"
                  className="w-full px-4 py-3 bg-background/10 border border-background/20 text-background placeholder:text-background/50 text-sm focus:outline-none focus:border-lime-400 transition-colors duration-300"
                />
                <button
                  type="submit"
                  className="w-full px-4 py-3 bg-lime-400 text-black font-semibold text-sm hover:bg-lime-300 transition-all duration-300 ease-out active:scale-[0.98]"
                >
                  Inscrever-se
                </button>
              </form>
            </div>
          </aside>
        </div>
      </div>
    </main>
  )
}
