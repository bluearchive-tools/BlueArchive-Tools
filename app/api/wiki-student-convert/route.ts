import { NextRequest, NextResponse } from 'next/server'
import * as cheerio from 'cheerio'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

type SkillBlock = { title: string; text: string; values: Record<string, number[]> }
type StudentJsonLike = {
  id: string
  importid: string
  name: string
  englishName: string
  image: string
  attackType: string
  defenseType: string
  hasAccessory: boolean
  altIds: string[]
  initialStars: number
  role: string
  characterType: string
  position: string
  cost: number
  exDuration: number
  normalDuration: number
  normalInterval: number
  skills: Record<string, SkillBlock>
  equipmentSlots: { slot1: string[]; slot2: string[]; slot3: string[]; accessory: string[] }
  accessory: { tiers: Array<{ tier: number; name: string; description: string }> }
  exHitDelay: number
  normalHitDelay: number
  hp: number
  attack: number
  defense: number
  heal: number
  range: number
  uniqueWeapon: { name: string; hp: number; attack: number; heal: number }
  aliases: string[]
}

const TYPE_MAP: Record<string, string> = { TANK: 'タンク', TANKER: 'タンク', ATTACKER: 'アタッカー', HEALER: 'ヒーラー', SUPPORTER: 'サポーター', 'TACTICAL SUPPORT': 'T.S.' }
const POSITION_MAP: Record<string, string> = { FRONT: 'FRONT', MIDDLE: 'MIDDLE', BACK: 'BACK' }
const EMPTY_SKILL: SkillBlock = { title: '', text: '', values: {} }


const execFileAsync = promisify(execFile)

async function requestText(url: string, headers: Record<string, string> = {}): Promise<{ status: number; text: string }> {
  const script = [
    'import json, requests',
    `url = ${JSON.stringify(url)}`,
    `headers = json.loads(${JSON.stringify(JSON.stringify(headers))})`,
    'res = requests.get(url, headers=headers, timeout=20)',
    "print(json.dumps({'status': res.status_code, 'text': res.text}))",
  ].join('\n')
  const { stdout } = await execFileAsync('python', ['-c', script], { maxBuffer: 20 * 1024 * 1024 })
  return JSON.parse(stdout.trim()) as { status: number; text: string }
}


function normalizeText(value: string) { return value.replace(/\s+/g, ' ').replaceAll('\u3000', ' ').trim() }
function parseNumber(value: string) { const m = value.replaceAll(',', '').match(/-?\d+(?:\.\d+)?/); return m ? Number(m[0]) : 0 }

function extractByLabel($: cheerio.CheerioAPI, label: string) {
  const row = $('tr').filter((_, el) => normalizeText($(el).find('th').first().text()).includes(label)).first()
  if (!row.length) return ''
  return normalizeText(row.find('td').first().text())
}
function extractSkillBlock($: cheerio.CheerioAPI, label: string): SkillBlock {
  const row = $('tr').filter((_, el) => normalizeText($(el).find('th').first().text()).includes(label)).first()
  if (!row.length) return EMPTY_SKILL
  const td = row.find('td').first()
  return { title: normalizeText(td.find('strong').first().text() || td.find('b').first().text()), text: normalizeText(td.text()), values: {} }
}

function extractTextLine(source: string, label: string) {
  const re = new RegExp(`${label}[:：]?\\s*([^\\n|]+)`)
  return normalizeText(source.match(re)?.[1] ?? '')
}

function extractSkillFromText(source: string, label: string): SkillBlock {
  const idx = source.indexOf(label)
  if (idx < 0) return EMPTY_SKILL
  const chunk = source.slice(idx, idx + 600)
  const lines = chunk.split('\n').map((l) => normalizeText(l)).filter(Boolean)
  const title = lines[1] ?? ''
  return { title, text: lines.slice(1, 4).join(' / '), values: {} }
}

function makeStudentBase(name: string): StudentJsonLike {
  return {
    id: '', importid: '', name, englishName: '', image: '', attackType: '', defenseType: '', hasAccessory: false, altIds: [], initialStars: 1,
    role: 'STRIKER', characterType: 'アタッカー', position: 'BACK', cost: 0, exDuration: 0, normalDuration: 0, normalInterval: 0,
    skills: { ex: EMPTY_SKILL, normal: EMPTY_SKILL, passive: EMPTY_SKILL, sub: EMPTY_SKILL },
    equipmentSlots: { slot1: ['weapon'], slot2: ['gloves'], slot3: ['shoes'], accessory: ['accessory'] }, accessory: { tiers: [] },
    exHitDelay: 0, normalHitDelay: 0, hp: 0, attack: 0, defense: 0, heal: 0, range: 0, uniqueWeapon: { name: '', hp: 0, attack: 0, heal: 0 }, aliases: name ? [name] : [],
  }
}


export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as { url?: string } | null
  const rawUrl = body?.url?.trim() ?? ''
  if (!rawUrl) return NextResponse.json({ message: 'url is required' }, { status: 400 })

  let url: URL
  try { url = new URL(rawUrl) } catch { return NextResponse.json({ message: 'invalid url' }, { status: 400 }) }
  if (!url.hostname.endsWith('wikiru.jp')) return NextResponse.json({ message: 'wikiru.jp only' }, { status: 400 })

  try {
    const response = await requestText(url.toString(), { 'User-Agent': 'Mozilla/5.0', Accept: 'text/html,application/xhtml+xml', 'Accept-Language': 'ja,en-US;q=0.9' })
    if (response.status >= 200 && response.status < 300) {
      const html = response.text
      const $ = cheerio.load(html)
      const ogTitle = $('meta[property="og:title"]').attr('content') ?? ''
      const name = (ogTitle.match(/(?:星\d+\/)?([^の]+)の詳細/)?.[1] ?? '').trim()
      const student = makeStudentBase(name)
      student.image = $('meta[property="og:image"]').attr('content') ?? ''
      student.initialStars = Number(ogTitle.match(/星(\d+)/)?.[1] ?? '1')
      student.attackType = extractByLabel($, '攻撃タイプ')
      student.defenseType = extractByLabel($, '防御タイプ')
      const classText = extractByLabel($, 'クラス').toUpperCase()
      student.role = classText.includes('SPECIAL') ? 'SPECIAL' : 'STRIKER'
      student.characterType = TYPE_MAP[classText] ?? 'アタッカー'
      const positionKey = extractByLabel($, 'ポジション').toUpperCase()
      student.position = POSITION_MAP[positionKey] ?? 'BACK'
      student.cost = parseNumber(extractByLabel($, 'コスト'))
      student.normalInterval = parseNumber(extractByLabel($, '通常攻撃'))
      student.skills = { ex: extractSkillBlock($, 'EXスキル'), normal: extractSkillBlock($, 'ノーマルスキル'), passive: extractSkillBlock($, 'パッシブスキル'), sub: extractSkillBlock($, 'サブスキル') }
      student.hp = parseNumber(extractByLabel($, 'HP')); student.attack = parseNumber(extractByLabel($, '攻撃力')); student.defense = parseNumber(extractByLabel($, '防御力')); student.heal = parseNumber(extractByLabel($, '治癒力')); student.range = parseNumber(extractByLabel($, '射程'))
      return NextResponse.json({ student })
    }

    const proxyUrl = `https://r.jina.ai/http://${url.host}${url.pathname}${url.search}`
    const proxy = await requestText(proxyUrl, { 'User-Agent': 'Mozilla/5.0' })
    if (proxy.status < 200 || proxy.status >= 300) return NextResponse.json({ message: 'fetch failed' }, { status: 502 })
    const text = proxy.text
    const name = normalizeText(text.match(/Title:\s*([^\n]+)/)?.[1] ?? '').replace(/.*\//, '').replace('の詳細・評価', '')
    const student = makeStudentBase(name)
    student.attackType = extractTextLine(text, '攻撃タイプ')
    student.defenseType = extractTextLine(text, '防御タイプ')
    const classText = extractTextLine(text, 'クラス').toUpperCase()
    student.role = classText.includes('SPECIAL') ? 'SPECIAL' : 'STRIKER'
    student.characterType = TYPE_MAP[classText] ?? 'アタッカー'
    student.position = POSITION_MAP[extractTextLine(text, 'ポジション').toUpperCase()] ?? 'BACK'
    student.cost = parseNumber(extractTextLine(text, 'コスト'))
    student.skills = { ex: extractSkillFromText(text, 'EXスキル'), normal: extractSkillFromText(text, 'ノーマルスキル'), passive: extractSkillFromText(text, 'パッシブスキル'), sub: extractSkillFromText(text, 'サブスキル') }
    return NextResponse.json({ student, note: 'proxy fallback used' })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'convert failed'
    return NextResponse.json({ message }, { status: 500 })
  }
}
