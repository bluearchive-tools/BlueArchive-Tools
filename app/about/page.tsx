import { readFile } from 'node:fs/promises'
import path from 'node:path'
import type { Metadata } from 'next'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { cookies, headers } from 'next/headers'
import { DEFAULT_LOCALE, parseLocale, type Locale } from '../../lib/i18n/config'

const LEGAL_DOC_FILENAME = 'about.md'

async function resolveLocale(): Promise<Locale> {
  const cookieStore = await cookies()
  const cookieLocale = parseLocale(cookieStore.get('locale')?.value)
  if (cookieLocale) return cookieLocale

  const headerStore = await headers()
  const acceptLanguage = headerStore.get('accept-language')
  if (acceptLanguage) {
    for (const language of acceptLanguage.split(',')) {
      const parsed = parseLocale(language.trim().split(';')[0])
      if (parsed) return parsed
    }
  }

  return DEFAULT_LOCALE
}

async function readLegalMarkdown(locale: Locale): Promise<string> {
  const exactPath = path.join(process.cwd(), 'content', 'legal', locale, LEGAL_DOC_FILENAME)
  try {
    return await readFile(exactPath, 'utf-8')
  } catch {
    const fallbackPath = path.join(process.cwd(), 'content', 'legal', DEFAULT_LOCALE, LEGAL_DOC_FILENAME)
    return readFile(fallbackPath, 'utf-8')
  }
}

function extractMetadataFromMarkdown(markdown: string) {
  const lines = markdown.split(/\r?\n/)
  const heading = lines.find((line) => line.trim().startsWith('# '))?.replace(/^#\s+/, '').trim() || 'About'
  const description =
    lines.find((line) => {
      const trimmed = line.trim()
      return trimmed.length > 0 && !trimmed.startsWith('#')
    })?.trim() || heading
  return { heading, description }
}

export async function generateMetadata(): Promise<Metadata> {
  const locale = await resolveLocale()
  const markdown = await readLegalMarkdown(locale)
  const meta = extractMetadataFromMarkdown(markdown)
  return {
    title: meta.heading,
    description: meta.description,
  }
}

export default async function AboutPage() {
  const locale = await resolveLocale()
  const markdown = await readLegalMarkdown(locale)

  return (
    <main className="mx-auto max-w-3xl p-4">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        className="prose prose-sm dark:prose-invert max-w-none prose-headings:font-semibold prose-h1:text-2xl prose-h2:text-xl"
      >
        {markdown}
      </ReactMarkdown>
    </main>
  )
}
