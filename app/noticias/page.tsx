import { NewsHeader } from "@/components/news/sidebar"
import { NewsMain } from "@/components/news/main"

export const metadata = {
  title: "Noticias | Portal de Noticias",
  description: "As ultimas noticias do Brasil e do mundo em tempo real",
}

export default function NoticiasPage() {
  return (
    <div className="min-h-screen bg-muted/20">
      <NewsHeader />
      <NewsMain />
    </div>
  )
}
