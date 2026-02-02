import { NewsHeader } from "@/components/news/sidebar"
import { NewsArticle } from "@/components/news/notice"

export const metadata = {
  title: "Grammy 2026: confira a lista completa de vencedores | Portal de Noticias",
  description: "Premiacao acontece neste domingo (1), em Los Angeles. Bad Bunny, Lady Gaga e Kendrick Lamar estao entre principais indicados.",
}

export default function BlogPage() {
  return (
    <div className="min-h-screen bg-white">
      <NewsHeader />
      <NewsArticle />
    </div>
  )
}
