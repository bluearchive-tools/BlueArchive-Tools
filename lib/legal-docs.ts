import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { cookies, headers } from 'next/headers'
import { DEFAULT_LOCALE, parseLocale, type Locale } from './i18n/config'

export async function resolveLegalLocale(): Promise<Locale> {
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

export async function readLegalMarkdown(locale: Locale, filename: string): Promise<string> {
  const exactPath = path.join(process.cwd(), 'content', 'legal', locale, filename)
  try {
    return await readFile(exactPath, 'utf-8')
  } catch {
    const fallbackPath = path.join(process.cwd(), 'content', 'legal', DEFAULT_LOCALE, filename)
    return readFile(fallbackPath, 'utf-8')
  }
}

export function extractMetadataFromMarkdown(markdown: string, fallbackTitle: string) {
  const lines = markdown.split(/\r?\n/)
  const heading = lines.find((line) => line.trim().startsWith('# '))?.replace(/^#\s+/, '').trim() || fallbackTitle
  const description =
    lines.find((line) => {
      const trimmed = line.trim()
      return trimmed.length > 0 && !trimmed.startsWith('#')
    })?.trim() || heading

  return { heading, description }
}
