import type { Metadata } from 'next'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { extractMetadataFromMarkdown, readLegalMarkdown, resolveLegalLocale } from '../../lib/legal-docs'

const LEGAL_DOC_FILENAME = 'privacy-policy.md'

export async function generateMetadata(): Promise<Metadata> {
  const locale = await resolveLegalLocale()
  const markdown = await readLegalMarkdown(locale, LEGAL_DOC_FILENAME)
  const meta = extractMetadataFromMarkdown(markdown, 'Privacy Policy')
  return {
    title: meta.heading,
    description: meta.description,
  }
}

export default async function PrivacyPolicyPage() {
  const locale = await resolveLegalLocale()
  const markdown = await readLegalMarkdown(locale, LEGAL_DOC_FILENAME)

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
