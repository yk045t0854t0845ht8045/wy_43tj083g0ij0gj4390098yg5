"use client"

import React from "react"
import { useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { ChevronDown, Clock, TrendingUp, Play, Headphones, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"

// Dados de exemplo - TODAS AS IMAGENS USANDO PLACEHOLDER
const mainNews = {
  category: "Tortura animal",
  title: "Caso Orelha: investigacao envolve 20 testemunhas e mil horas de imagens",
  description: "Cao foi vitima de agressao, e policia apura envolvimento de adolescentes. Segundo delegado, videos analisados nao mostram animal com suspeitos.",
  image: "https://v0.app/placeholder.svg?height=600&width=800",
  author: "Redacao",
  time: "2 horas atras",
 
}

const sideGridNews = [
  {
    category: "Premio nos EUA",
    title: "Grammy com Bad Bunny e Gaga anuncia vencedores; acompanhe",
    subtitle: "FOTOS: veja imagens do tapete vermelho e da premiacao",
    image: "https://v0.app/placeholder.svg?height=600&width=800",
     gradient: "from-zinc-900/30 via-zinc-800/20 to-zinc-700/10"
  },
  {
    category: "Musica",
    title: "Caetano e Bethania vencem Grammy de Album de Musica Global",
    subtitle: "Irmaos se surpreendem: 'Nem sabia que horas era'",
    image: "https://v0.app/placeholder.svg?height=600&width=800",
     gradient: "from-zinc-900/30 via-zinc-800/20 to-zinc-700/10"
  }
]

const secondaryNews = [
  {
    title: "Economia brasileira surpreende analistas com crescimento",
    description: "PIB do trimestre supera expectativas do mercado financeiro",
    image: "https://v0.app/placeholder.svg?height=600&width=800",
    category: "Economia",
    time: "3 horas"
  },
  {
    title: "Nova tecnologia promete revolucionar energia renovavel",
    description: "Paineis solares de nova geracao chegam ao mercado brasileiro",
    image: "https://v0.app/placeholder.svg?height=600&width=800",
    category: "Tecnologia",
    time: "4 horas"
  },
  {
    title: "Selecao brasileira convoca jogadores para eliminatorias",
    description: "Tecnico anuncia lista com novidades para proximos jogos",
    image: "https://v0.app/placeholder.svg?height=600&width=800",
    category: "Esportes",
    time: "5 horas"
  }
]

const videoNews = [
  {
    title: "'Se eu tivesse visto batendo no cachorro, eu diria', diz porteiro",
    subtitle: "Atos pelo pais pedem prisao de agressores do cao Orelha",
    image: "https://v0.app/placeholder.svg?height=600&width=800",
    duration: "12 min",
    time: "Ha 4 horas",
    source: "Em Fantastico",
    isVideo: true
  },
  {
    title: "Por que lei que pune maus-tratos a animais e tao branda? Entenda",
    subtitle: "Isso e Fantastico: o debate sobre a lei de maus-tratos a animais",
    image: "https://v0.app/placeholder.svg?height=600&width=800",
    duration: "7 min",
    time: "Ha 4 horas",
    source: "Em Fantastico",
    isVideo: true,
    hasAudio: true
  },
  {
    category: "Material cirurgico esquecido",
    title: "73% dos cirurgioes ja retiraram corpo estranho de pacientes, diz USP",
    image: "https://v0.app/placeholder.svg?height=600&width=800",
    time: "Ha 3 horas",
    source: "Em Fantastico",
    isVideo: false
  },
  {
    title: "Previsao do tempo: frente fria avanca sobre o Sul e Sudeste",
    subtitle: "Temperaturas devem cair ate 10 graus em algumas regioes",
    image: "https://v0.app/placeholder.svg?height=600&width=800",
    time: "Ha 5 horas",
    source: "Jornal Nacional",
    isVideo: false,
    category: "Clima"
  }
]

const latestNews = [
  {
    title: "Chuva forte alaga ruas e invade casas na Grande SP; milhares ficam sem energia na capital",
    image: "https://v0.app/placeholder.svg?height=600&width=800",
    time: "15 min"
  },
  {
    title: "Menina de 10 anos morta no RJ seguia com o pai para uma festa de aniversario quando levou 6 tiros",
    image: "https://v0.app/placeholder.svg?height=600&width=800",
    time: "32 min"
  },
  {
    title: "Jovem e morta a tiros depois de pegar carona ao sair de festa em Cariacica",
    image: "https://v0.app/placeholder.svg?height=600&width=800",
    time: "1 hora"
  },
  {
    title: "Economia brasileira surpreende analistas com crescimento acima do esperado no trimestre",
    image: "https://v0.app/placeholder.svg?height=600&width=800",
    time: "1 hora"
  },
  {
    title: "Nova tecnologia promete revolucionar o setor de energia renovavel no pais",
    image: "https://v0.app/placeholder.svg?height=600&width=800",
    time: "2 horas"
  }
]

const trendingNews = [
  { title: "Bitcoin atinge nova maxima historica", views: "125K" },
  { title: "Eleicoes 2026: pesquisa revela favoritos", views: "98K" },
  { title: "Novo smartphone promete bateria infinita", views: "87K" },
  { title: "Descoberta cientifica pode curar cancer", views: "76K" }
]

export function NewsMain() {
  const [isLatestExpanded, setIsLatestExpanded] = useState(false)
  const [hoveredCard, setHoveredCard] = useState<string | null>(null)

  return (
    <main className="min-h-screen bg-muted/20">
      <div className="max-w-[1560px] mx-auto px-4 lg:px-8 py-6 lg:py-8">
        <div className="flex flex-col xl:flex-row gap-6 lg:gap-8">
          {/* Main Content Area */}
          <div className="flex-1 min-w-0 space-y-6 lg:space-y-8">
            {/* Hero Grid Section */}
            <section className="grid grid-cols-1 lg:grid-cols-5 gap-4 lg:gap-5">
              {/* Main Featured Article with Full Image */}
              <article 
                className="lg:col-span-3 group cursor-pointer relative overflow-hidden"
                onMouseEnter={() => setHoveredCard("main")}
                onMouseLeave={() => setHoveredCard(null)}
              >
                <Link href="/blog" className="block">
                  <div className="relative aspect-[16/10] lg:aspect-[16/11]">
                    <Image
                      src={mainNews.image || "https://v0.app/placeholder.svg"}
                      alt={mainNews.title}
                      fill
                      className={cn(
                        "object-cover transition-transform duration-700 ease-[cubic-bezier(0.23,1,0.32,1)]",
                        hoveredCard === "main" && "scale-[1.03]"
                      )}
                      priority
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                    
                    {/* Category Badge */}
                    <div className="absolute top-4 left-4">
                      <span className="px-3 py-1.5 bg-white text-[11px] font-semibold uppercase tracking-wide">
                        {mainNews.category}
                      </span>
                    </div>
                    
                    {/* Content on Image */}
                    <div className="absolute bottom-0 left-0 right-0 p-5 lg:p-8">
                      <h1 
                        className={cn(
                          "text-xl sm:text-2xl lg:text-3xl xl:text-4xl font-bold text-white leading-tight mb-3 transition-transform duration-500 ease-[cubic-bezier(0.23,1,0.32,1)]",
                          hoveredCard === "main" && "translate-x-1"
                        )}
                      >
                        {mainNews.title}
                      </h1>
                      
                      <p className="text-white/80 text-sm lg:text-base leading-relaxed mb-4 max-w-2xl hidden sm:block">
                        {mainNews.description}
                      </p>
                      
                      <div className="flex items-center gap-3 text-sm text-white/60">
                        <Clock className="h-4 w-4" />
                        <span>{mainNews.time}</span>
                        <span className="text-white/30">|</span>
                        <span>Por {mainNews.author}</span>
                      </div>
                    </div>
                  </div>
                </Link>
              </article>

              {/* Side Grid - Two stacked cards */}
              <div className="lg:col-span-2 flex flex-col gap-4 lg:gap-5">
                {sideGridNews.map((news, index) => (
                  <article
                    key={index}
                    className="group relative flex-1 min-h-[180px] lg:min-h-0 overflow-hidden cursor-pointer"
                    onMouseEnter={() => setHoveredCard(`side-${index}`)}
                    onMouseLeave={() => setHoveredCard(null)}
                  >
                    <Link href="/blog" className="block h-full">
                      {/* Background Image */}
                      <div className="absolute inset-0">
                        <Image
                          src={news.image || "https://v0.app/placeholder.svg"}
                          alt={news.title}
                          fill
                          className={cn(
                            "object-cover transition-transform duration-700 ease-[cubic-bezier(0.23,1,0.32,1)]",
                            hoveredCard === `side-${index}` && "scale-[1.05]"
                          )}
                        />
                        <div className={cn(
                          "absolute inset-0 bg-gradient-to-t",
                          news.gradient
                        )} />
                      </div>
                      
                      {/* Content */}
                      <div className="relative h-full p-5 lg:p-6 flex flex-col justify-end text-white">
                        <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wide mb-2 lg:mb-3 opacity-90">
                          {news.category}
                        </span>
                        
                        <h2 
                          className={cn(
                            "text-base sm:text-lg lg:text-xl font-bold leading-tight mb-2 transition-transform duration-500 ease-[cubic-bezier(0.23,1,0.32,1)]",
                            hoveredCard === `side-${index}` && "translate-x-1"
                          )}
                        >
                          {news.title}
                        </h2>
                        
                        <p className="text-xs sm:text-sm opacity-75 flex items-center gap-2">
                          <span className="w-1 h-1 bg-white/80 flex-shrink-0" />
                          <span className="line-clamp-1">{news.subtitle}</span>
                        </p>
                      </div>
                    </Link>
                  </article>
                ))}
              </div>
            </section>

            {/* Secondary News Grid */}
            <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-5">
              {secondaryNews.map((news, index) => (
                <article
                  key={index}
                  className="group bg-background overflow-hidden transition-all duration-300 ease-out cursor-pointer hover:bg-muted/30"
                  onMouseEnter={() => setHoveredCard(`secondary-${index}`)}
                  onMouseLeave={() => setHoveredCard(null)}
                >
                  <Link href="/blog" className="block">
                    <div className="aspect-video relative overflow-hidden">
                      <Image
                        src={news.image || "https://v0.app/placeholder.svg"}
                        alt={news.title}
                        fill
                        className={cn(
                          "object-cover transition-transform duration-700 ease-[cubic-bezier(0.23,1,0.32,1)]",
                          hoveredCard === `secondary-${index}` && "scale-[1.03]"
                        )}
                      />
                      <div className="absolute top-3 left-3">
                        <span className="px-3 py-1 bg-lime-400 text-black text-[10px] font-semibold">
                          {news.category}
                        </span>
                      </div>
                    </div>
                    
                    <div className="p-4 lg:p-5">
                      <h3 
                        className={cn(
                          "font-semibold text-base lg:text-lg leading-tight mb-2 line-clamp-2 transition-colors duration-300 ease-out",
                          hoveredCard === `secondary-${index}` && "text-lime-600"
                        )}
                      >
                        {news.title}
                      </h3>
                      <p className="text-sm text-muted-foreground/70 line-clamp-2 mb-3">
                        {news.description}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground/50">
                        <Clock className="h-3.5 w-3.5" />
                        <span>{news.time} atras</span>
                      </div>
                    </div>
                  </Link>
                </article>
              ))}
            </section>

            {/* Video/Media News Section - Clean list style */}
            <section>
              <h2 className="text-lg lg:text-xl font-bold tracking-tight px-1 mb-5">Mais Noticias</h2>
              
              <div className="bg-background">
                {videoNews.map((news, index) => (
                  <article
                    key={index}
                    className={cn(
                      "group cursor-pointer transition-all duration-300 ease-out hover:bg-muted/20",
                      index !== 0 && "border-t border-border/30"
                    )}
                    onMouseEnter={() => setHoveredCard(`video-${index}`)}
                    onMouseLeave={() => setHoveredCard(null)}
                  >
                    <Link href="/blog" className="block">
                      <div className="flex flex-col sm:flex-row p-4 lg:p-5 gap-4">
                        {/* Image */}
                        <div className="relative w-full sm:w-64 lg:w-72 flex-shrink-0 aspect-video sm:aspect-[16/10] overflow-hidden">
                          <Image
                            src={news.image || "https://v0.app/placeholder.svg"}
                            alt={news.title}
                            fill
                            className={cn(
                              "object-cover transition-transform duration-700 ease-[cubic-bezier(0.23,1,0.32,1)]",
                              hoveredCard === `video-${index}` && "scale-[1.03]"
                            )}
                          />
                          
                          {/* Video Badge */}
                          {news.isVideo && (
                            <div className="absolute top-3 left-3">
                              <span className="px-2 py-1 bg-lime-400 text-black text-[10px] font-bold uppercase tracking-wide">
                                Video em alta
                              </span>
                            </div>
                          )}
                          
                          {/* Duration / Play */}
                          {news.duration && (
                            <div className="absolute bottom-3 left-3 flex items-center gap-2">
                              <div className="w-8 h-8 lg:w-9 lg:h-9 bg-lime-400 flex items-center justify-center transition-transform duration-300 ease-out group-hover:scale-110">
                                <Play className="h-4 w-4 text-black fill-black ml-0.5" />
                              </div>
                              <span className="text-white text-sm font-medium drop-shadow-lg">{news.duration}</span>
                            </div>
                          )}
                        </div>
                        
                        {/* Content */}
                        <div className="flex-1 flex flex-col justify-center min-w-0">
                          {news.category && (
                            <span className="text-xs text-muted-foreground/50 mb-1.5">{news.category}</span>
                          )}
                          <h3 
                            className={cn(
                              "font-bold text-lg lg:text-xl text-lime-600 leading-tight mb-2 transition-transform duration-300 ease-out",
                              hoveredCard === `video-${index}` && "translate-x-1"
                            )}
                          >
                            {news.title}
                          </h3>
                          
                          {news.subtitle && (
                            <div className="flex items-start gap-2 text-sm text-muted-foreground/70 mb-3">
                              {news.hasAudio && (
                                <Headphones className="h-4 w-4 text-muted-foreground/50 flex-shrink-0 mt-0.5" />
                              )}
                              <span className="flex items-start gap-1.5">
                                <span className="w-1 h-1 bg-muted-foreground/30 flex-shrink-0 mt-2" />
                                <span className="line-clamp-2">{news.subtitle}</span>
                              </span>
                            </div>
                          )}
                          
                          <div className="text-xs text-muted-foreground/50 mt-auto">
                            {news.time} — {news.source}
                          </div>
                        </div>
                      </div>
                    </Link>
                  </article>
                ))}
              </div>
            </section>
          </div>

          {/* Right Sidebar */}
          <aside className="w-full xl:w-[380px] flex-shrink-0 space-y-5 lg:space-y-6">
            {/* Viu isso? Section */}
            <div className="bg-background">
              <div className="p-4 lg:p-5 border-b border-border/30">
                <h2 className="text-lg font-bold tracking-tight">Viu isso?</h2>
              </div>
              
              <div>
                {latestNews.slice(0, isLatestExpanded ? latestNews.length : 3).map((news, index) => (
                  <article
                    key={index}
                    className={cn(
                      "group p-4 hover:bg-muted/20 transition-all duration-300 ease-out cursor-pointer",
                      index !== 0 && "border-t border-border/20"
                    )}
                  >
                    <Link href="/blog" className="block">
                      <div className="flex gap-4">
                        <div className="flex-1 min-w-0">
                          <h3 className="text-sm font-semibold text-lime-600 leading-snug group-hover:underline decoration-lime-600/30 underline-offset-2 transition-all duration-300 ease-out line-clamp-3">
                            {news.title}
                          </h3>
                          <span className="text-xs text-muted-foreground/50 mt-2 flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {news.time}
                          </span>
                        </div>
                        <div className="w-20 h-16 overflow-hidden flex-shrink-0 relative">
                          <Image
                            src={news.image || "https://v0.app/placeholder.svg"}
                            alt={news.title}
                            fill
                            className="object-cover group-hover:scale-105 transition-transform duration-500 ease-[cubic-bezier(0.23,1,0.32,1)]"
                          />
                        </div>
                      </div>
                    </Link>
                  </article>
                ))}
              </div>
              
              <button
                onClick={() => setIsLatestExpanded(!isLatestExpanded)}
                className="w-full p-4 flex items-center justify-center gap-2 text-sm font-medium text-lime-600 hover:bg-lime-400/10 transition-all duration-300 ease-out border-t border-border/20"
              >
                <span>Mais conteudos</span>
                <ChevronDown className={cn(
                  "h-4 w-4 transition-transform duration-300 ease-out",
                  isLatestExpanded && "rotate-180"
                )} />
              </button>
            </div>

            {/* Ad Space */}
            <div className="bg-muted/30 h-[300px] flex items-center justify-center">
              <span className="text-muted-foreground/30 text-xs uppercase tracking-widest">Espaco para Anuncio</span>
            </div>

            {/* Trending / Em Alta */}
            <div className="bg-background">
              <div className="p-4 lg:p-5 border-b border-border/30">
                <h2 className="text-lg font-bold tracking-tight flex items-center gap-2">
                  Em Alta
                  <span className="w-1.5 h-1.5 bg-lime-400" />
                </h2>
              </div>
              
              <div>
                {trendingNews.map((news, index) => (
                  <article
                    key={index}
                    className={cn(
                      "group p-4 hover:bg-muted/20 transition-all duration-300 ease-out cursor-pointer",
                      index !== 0 && "border-t border-border/20"
                    )}
                  >
                    <Link href="/blog" className="block">
                      <div className="flex items-start gap-4">
                        <span className="text-3xl font-bold text-lime-400/50 leading-none min-w-[32px]">
                          {index + 1}
                        </span>
                        <div className="flex-1">
                          <h3 className="text-sm font-semibold leading-snug group-hover:text-lime-600 transition-colors duration-300 ease-out">
                            {news.title}
                          </h3>
                          <div className="flex items-center gap-1.5 mt-2 text-xs text-muted-foreground/50">
                            <TrendingUp className="h-3 w-3 text-lime-500" />
                            <span>{news.views} views</span>
                          </div>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-lime-500 group-hover:translate-x-1 transition-all duration-300 ease-out mt-1" />
                      </div>
                    </Link>
                  </article>
                ))}
              </div>
            </div>

            {/* Quick Links */}
            <div className="bg-background p-4 lg:p-5">
              <h3 className="text-xs font-semibold text-muted-foreground/50 uppercase tracking-widest mb-4">
                Links Rapidos
              </h3>
              <div className="flex flex-wrap gap-2">
                {["COVID-19", "Eleicoes 2026", "Economia", "Esportes", "Tecnologia", "Entretenimento"].map((tag) => (
                  <Link
                    key={tag}
                    href={`/noticias/${tag.toLowerCase().replace(/\s+/g, "-")}`}
                    className="px-3 py-1.5 text-xs font-medium bg-muted/50 hover:bg-lime-400 hover:text-black transition-all duration-300 ease-out"
                  >
                    {tag}
                  </Link>
                ))}
              </div>
            </div>

            {/* Newsletter */}
            <div className="bg-foreground text-background p-5 lg:p-6">
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
