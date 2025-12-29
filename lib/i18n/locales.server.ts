import fs from 'fs'
import path from 'path'
import { DEFAULT_LOCALE, type Locale, type Messages } from './config'

type NamespaceMessages = Record<string, unknown>

function collectJsonFiles(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  const files: string[] = []
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...collectJsonFiles(fullPath))
    } else if (entry.isFile() && entry.name.endsWith('.json')) {
      files.push(fullPath)
    }
  }
  return files
}

function loadLocaleMessages(locale: Locale): Messages {
  const localeDir = path.join(process.cwd(), 'locales', locale)
  if (!fs.existsSync(localeDir)) return {}

  const namespaces: Record<string, NamespaceMessages> = {}
  const files = collectJsonFiles(localeDir)

  for (const file of files) {
    const relative = path
      .relative(localeDir, file)
      .replace(/\\/g, '/')
      .replace(/\.json$/, '')
    const data = JSON.parse(fs.readFileSync(file, 'utf8')) as NamespaceMessages
    namespaces[relative] = data
  }

  return namespaces
}

const cache: Partial<Record<Locale, Messages>> = {}

export function getMessages(locale: Locale): Messages {
  if (!cache[locale]) {
    cache[locale] = loadLocaleMessages(locale)
  }
  return cache[locale] ?? {}
}

export function getMessagesWithFallback(locale: Locale): Messages {
  const messages = getMessages(locale)
  if (Object.keys(messages).length > 0) return messages
  return getMessages(DEFAULT_LOCALE)
}
