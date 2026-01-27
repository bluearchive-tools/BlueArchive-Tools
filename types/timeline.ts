export interface Timeline {
  id: number
  armor: string
  difficulty: string
  videoid: string
  platform?: 'youtube' | 'bilibili'
  score: string
  formation: string
  guide?: boolean
  formationStatus?: string
  title: string
  description: string
  publishedAt?: string
  season?: string
  thumbnail?: string
}
