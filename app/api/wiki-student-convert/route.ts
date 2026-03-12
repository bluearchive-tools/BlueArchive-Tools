import { NextRequest, NextResponse } from 'next/server'
import * as cheerio from 'cheerio'

type SkillBlock = {
  title: string
  text: string
  values: Record<string, number[]>
}

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

type BaseStats = {
  hp: number
  attack: number
  defense: number
  heal: number
  range: number
}

const TYPE_MAP: Record<string, string> = {
  TANK: 'タンク',
  TANKER: 'タンク',
  ATTACKER: 'アタッカー',
  HEALER: 'ヒーラー',
  SUPPORTER: 'サポーター',
  'TACTICAL SUPPORT': 'T.S.',
}

const POSITION_MAP: Record<string, string> = {
  FRONT: 'FRONT',
  MIDDLE: 'MIDDLE',
  BACK: 'BACK',
}

const EMPTY_SKILL: SkillBlock = { title: '', text: '', values: {} }

function normalizeText(value: string) {
  return value.replace(/\s+/g, ' ').replaceAll('\u3000', ' ').trim()
}

function parseNumber(value: string) {
  const matched = value.replaceAll(',', '').match(/-?\d+(?:\.\d+)?/)
  return matched ? Number(matched[0]) : 0
}

function extractByLabel($: cheerio.CheerioAPI, label: string) {
  const row = $('tr')
    .filter((_, el) => normalizeText($(el).find('th').first().text()).includes(label))
    .first()
  if (!row.length) return ''
  return normalizeText(row.find('td').first().text())
}

function extractNumbersFromSkillText(text: string) {
  const matched = text.replaceAll(',', '').match(/-?\d+(?:\.\d+)?/g) ?? []
  return matched.map((value) => Number(value))
}

function buildSkillValuesByLevel(levelEffects: string[]) {
  const matrix = levelEffects.map((effect) => extractNumbersFromSkillText(effect))
  const width = matrix.reduce((max, row) => Math.max(max, row.length), 0)
  const values: Record<string, number[]> = {}

  for (let col = 0; col < width; col += 1) {
    const key = `value${col + 1}`
    values[key] = matrix.map((row) => row[col] ?? 0)
  }

  return values
}

function parseSkillTableRows(rows: string[][]): { base: SkillBlock; plus: SkillBlock | null } {
  const titleRow = rows[0] ?? []
  const headerRow = rows[1] ?? []
  const dataRows = rows.filter((row) => /^\d+$/.test(row[0] ?? ''))

  const effectColumnIndexes = headerRow
    .map((header, index) => ({ header, index }))
    .filter((item) => item.header.includes('効果'))
    .map((item) => item.index)

  const baseTitle = normalizeText(titleRow[1] ?? '')
  const plusTitle = normalizeText(titleRow[2] ?? '')
  const baseEffectIndex = effectColumnIndexes[0] ?? 1
  const plusEffectIndex = effectColumnIndexes[1] ?? -1

  const baseLevelEffects = dataRows.map((row) => normalizeText(row[baseEffectIndex] ?? ''))
  const plusLevelEffects = plusEffectIndex >= 0 ? dataRows.map((row) => normalizeText(row[plusEffectIndex] ?? '')) : []

  const base: SkillBlock = {
    title: baseTitle,
    text: baseLevelEffects[0] ?? '',
    values: buildSkillValuesByLevel(baseLevelEffects),
  }

  if (!plusTitle && plusLevelEffects.length === 0) {
    return { base, plus: null }
  }

  return {
    base,
    plus: {
      title: plusTitle || `${baseTitle}+`,
      text: plusLevelEffects[0] ?? '',
      values: buildSkillValuesByLevel(plusLevelEffects),
    },
  }
}

function extractSkillTableByHeading($: cheerio.CheerioAPI, headingLabel: string) {
  const heading = $('h3')
    .filter((_, el) => normalizeText($(el).text()).startsWith(headingLabel))
    .first()

  if (!heading.length) return null

  const container = heading.nextAll('div.ie5').first()
  if (!container.length) return null

  const table = container.find('table.style_table').first()
  if (!table.length) return null

  const rows = table
    .find('tr')
    .toArray()
    .map((row) =>
      $(row)
        .find('th,td')
        .toArray()
        .map((cell) => normalizeText($(cell).text())),
    )

  if (rows.length < 2) return null
  return parseSkillTableRows(rows)
}

function extractSkillsFromHtml($: cheerio.CheerioAPI): Record<string, SkillBlock> {
  const skills: Record<string, SkillBlock> = {}

  const ex = extractSkillTableByHeading($, 'EXスキル')
  const normal = extractSkillTableByHeading($, 'ノーマルスキル')
  const passive = extractSkillTableByHeading($, 'パッシブスキル')
  const sub = extractSkillTableByHeading($, 'サブスキル')

  if (ex) skills.ex = ex.base
  if (normal) {
    skills.normal = normal.base
    if (normal.plus) skills.normalPlus = normal.plus
  }
  if (passive) {
    skills.passive = passive.base
    if (passive.plus) skills.passivePlus = passive.plus
  }
  if (sub) {
    skills.sub = sub.base
    if (sub.plus) skills.subPlus = sub.plus
  }

  return skills
}

function extractTextLine(source: string, label: string) {
  const re = new RegExp(`${label}[:：]?\\s*([^\\n|]+)`)
  return normalizeText(source.match(re)?.[1] ?? '')
}

function extractSectionByHeading(source: string, heading: string) {
  const start = source.indexOf(heading)
  if (start < 0) return ''
  const rest = source.slice(start + heading.length)
  const nextHeadingOffset = rest.search(/(?:\n|\r)#+\s*[^\n]+/)
  const end = nextHeadingOffset >= 0 ? start + heading.length + nextHeadingOffset : source.length
  return source.slice(start, end)
}

function parseProxyTableRow(line: string) {
  const cells = line.split('|').map((cell) => normalizeText(cell))
  while (cells.length > 0 && cells[0] === '') cells.shift()
  while (cells.length > 0 && cells[cells.length - 1] === '') cells.pop()
  return cells
}

function extractSkillSectionFromProxy(source: string, label: string) {
  const section = extractSectionByHeading(source, label)
  if (!section) return null

  const rows = section
    .split('\n')
    .map((line) => normalizeText(line))
    .filter((line) => line.includes('|'))
    .map((line) => parseProxyTableRow(line))
    .filter((cells) => cells.length >= 2)

  if (rows.length < 2) return null
  return parseSkillTableRows(rows)
}

function extractSkillsFromProxyText(source: string): Record<string, SkillBlock> {
  const mapping: Array<{ heading: string; key: string; plusKey: string }> = [
    { heading: 'EXスキル', key: 'ex', plusKey: 'exPlus' },
    { heading: 'ノーマルスキル', key: 'normal', plusKey: 'normalPlus' },
    { heading: 'パッシブスキル', key: 'passive', plusKey: 'passivePlus' },
    { heading: 'サブスキル', key: 'sub', plusKey: 'subPlus' },
  ]

  const result: Record<string, SkillBlock> = {}

  for (const item of mapping) {
    const parsed = extractSkillSectionFromProxy(source, item.heading)
    if (!parsed) continue
    result[item.key] = parsed.base
    if (parsed.plus) result[item.plusKey] = parsed.plus
  }

  return result
}

function makeStudentBase(name: string): StudentJsonLike {
  return {
    id: '',
    importid: '',
    name,
    englishName: '',
    image: '',
    attackType: '',
    defenseType: '',
    hasAccessory: false,
    altIds: [],
    initialStars: 1,
    role: 'STRIKER',
    characterType: 'アタッカー',
    position: 'BACK',
    cost: 0,
    exDuration: 0,
    normalDuration: 0,
    normalInterval: 0,
    skills: { ex: EMPTY_SKILL, normal: EMPTY_SKILL, passive: EMPTY_SKILL, sub: EMPTY_SKILL },
    equipmentSlots: { slot1: ['weapon'], slot2: ['gloves'], slot3: ['shoes'], accessory: ['accessory'] },
    accessory: { tiers: [] },
    exHitDelay: 0,
    normalHitDelay: 0,
    hp: 0,
    attack: 0,
    defense: 0,
    heal: 0,
    range: 0,
    uniqueWeapon: { name: '', hp: 0, attack: 0, heal: 0 },
    aliases: name ? [name] : [],
  }
}

async function requestText(url: string, headers: Record<string, string>) {
  const response = await fetch(url, {
    cache: 'no-store',
    headers,
  })
  const text = await response.text()
  return { ok: response.ok, status: response.status, text }
}

function extractUniqueWeaponFromHtml($: cheerio.CheerioAPI) {
  const heading = $('h2, h3').filter((_, el) => normalizeText($(el).text()).startsWith('固有武器')).first()
  if (!heading.length) return { name: '', hp: 0, attack: 0, heal: 0 }

  const table = heading.nextAll('table').first()
  if (!table.length) return { name: '', hp: 0, attack: 0, heal: 0 }

  const rows = table.find('tr')
  const name = normalizeText(rows.first().find('th,td').first().text())

  let lv1Index = 1
  rows.each((_, row) => {
    const cells = $(row)
      .find('th,td')
      .toArray()
      .map((cell) => normalizeText($(cell).text()))
    const index = cells.findIndex((cell) => /Lv\.?1/i.test(cell))
    if (index >= 0) lv1Index = index
  })

  const readLv1 = (label: string) => {
    const row = rows
      .filter((_, tr) => normalizeText($(tr).find('th,td').first().text()).includes(label))
      .first()
    if (!row.length) return 0
    const cells = row
      .find('th,td')
      .toArray()
      .map((cell) => normalizeText($(cell).text()))
    return parseNumber(cells[lv1Index] ?? '')
  }

  return {
    name,
    hp: readLv1('最大HP'),
    attack: readLv1('攻撃力'),
    heal: readLv1('治癒力'),
  }
}

function extractUniqueWeaponFromProxyText(source: string) {
  const lvHeaderIndex = source.indexOf('Lv.1 | Lv.30')
  if (lvHeaderIndex < 0) return { name: '', hp: 0, attack: 0, heal: 0 }

  const start = Math.max(0, lvHeaderIndex - 1200)
  const end = Math.min(source.length, lvHeaderIndex + 1600)
  const chunk = source.slice(start, end)

  const nameMatch = chunk.match(/\|\s*([^|\n]+?)\s*\|\s*\|\s*---/)
  const name = normalizeText(nameMatch?.[1] ?? '')

  const pick = (label: string) => {
    const re = new RegExp(`\\|\\s*${label}\\s*\\|\\s*(-?\\d+(?:,\\d+)*)\\s*\\|`)
    return parseNumber(chunk.match(re)?.[1] ?? '')
  }

  return {
    name,
    hp: pick('最大HP'),
    attack: pick('攻撃力'),
    heal: pick('治癒力'),
  }
}

function extractBaseStatsFromHtml($: cheerio.CheerioAPI): BaseStats {
  const heading = $('h3')
    .filter((_, el) => normalizeText($(el).text()).startsWith('ステータス(初期値/MAX値)'))
    .first()

  if (!heading.length) {
    return {
      hp: parseNumber(extractByLabel($, 'HP')),
      attack: parseNumber(extractByLabel($, '攻撃力')),
      defense: parseNumber(extractByLabel($, '防御力')),
      heal: parseNumber(extractByLabel($, '治癒力')),
      range: parseNumber(extractByLabel($, '射程距離') || extractByLabel($, '射程')),
    }
  }

  const table = heading.nextAll('div.ie5').first().find('table.style_table').first()
  if (!table.length) {
    return { hp: 0, attack: 0, defense: 0, heal: 0, range: 0 }
  }

  const read = (label: string) => {
    const row = table
      .find('tr')
      .filter((_, tr) => normalizeText($(tr).find('th,td').first().text()).includes(label))
      .first()
    if (!row.length) return 0
    const cells = row.find('th,td').toArray().map((cell) => normalizeText($(cell).text()))
    for (let i = 1; i < cells.length; i += 1) {
      if (cells[i] && cells[i] !== '-') return parseNumber(cells[i])
    }
    return 0
  }

  return {
    hp: read('HP'),
    attack: read('攻撃力'),
    defense: read('防御力'),
    heal: read('治癒力'),
    range: read('射程距離') || read('射程'),
  }
}

function extractBaseStatsFromProxyText(source: string): BaseStats {
  const section = extractSectionByHeading(source, 'ステータス(初期値/MAX値)')
  const target = section || source

  const pick = (label: string) => {
    const re = new RegExp(`\\|\\s*${label}\\s*\\|\\s*([^|\\n]+)\\|`)
    return parseNumber(target.match(re)?.[1] ?? '')
  }

  return {
    hp: pick('HP'),
    attack: pick('攻撃力'),
    defense: pick('防御力'),
    heal: pick('治癒力'),
    range: pick('射程距離') || pick('射程'),
  }
}

function parseFromHtml(html: string) {
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
  student.skills = extractSkillsFromHtml($)

  const baseStats = extractBaseStatsFromHtml($)
  student.hp = baseStats.hp
  student.attack = baseStats.attack
  student.defense = baseStats.defense
  student.heal = baseStats.heal
  student.range = baseStats.range
  student.uniqueWeapon = extractUniqueWeaponFromHtml($)

  return student
}

function parseFromProxyText(text: string) {
  const rawTitle = normalizeText(text.match(/Title:\s*([^\n]+)/)?.[1] ?? '')
  const name = rawTitle.replace(/.*\//, '').replace('の詳細・評価', '')
  const student = makeStudentBase(name)

  student.attackType = extractTextLine(text, '攻撃タイプ')
  student.defenseType = extractTextLine(text, '防御タイプ')
  const classText = extractTextLine(text, 'クラス').toUpperCase()
  student.role = classText.includes('SPECIAL') ? 'SPECIAL' : 'STRIKER'
  student.characterType = TYPE_MAP[classText] ?? 'アタッカー'
  student.position = POSITION_MAP[extractTextLine(text, 'ポジション').toUpperCase()] ?? 'BACK'
  student.cost = parseNumber(extractTextLine(text, 'コスト'))
  student.skills = extractSkillsFromProxyText(text)

  const baseStats = extractBaseStatsFromProxyText(text)
  student.hp = baseStats.hp
  student.attack = baseStats.attack
  student.defense = baseStats.defense
  student.heal = baseStats.heal
  student.range = baseStats.range
  student.uniqueWeapon = extractUniqueWeaponFromProxyText(text)

  return student
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as { url?: string } | null
  const rawUrl = body?.url?.trim() ?? ''
  if (!rawUrl) return NextResponse.json({ message: 'url is required' }, { status: 400 })

  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    return NextResponse.json({ message: 'invalid url' }, { status: 400 })
  }

  if (!url.hostname.endsWith('wikiru.jp')) {
    return NextResponse.json({ message: 'wikiru.jp only' }, { status: 400 })
  }

  try {
    const direct = await requestText(url.toString(), {
      'User-Agent': 'Mozilla/5.0',
      Accept: 'text/html,application/xhtml+xml',
      'Accept-Language': 'ja,en-US;q=0.9',
    })

    if (direct.ok) {
      return NextResponse.json({ student: parseFromHtml(direct.text), source: 'direct' })
    }

    const proxyUrl = `https://r.jina.ai/http://${url.host}${url.pathname}${url.search}`
    const proxy = await requestText(proxyUrl, {
      'User-Agent': 'Mozilla/5.0',
      Accept: 'text/plain',
    })

    if (!proxy.ok) {
      return NextResponse.json({ message: `fetch failed: direct=${direct.status}, proxy=${proxy.status}` }, { status: 502 })
    }

    return NextResponse.json({ student: parseFromProxyText(proxy.text), source: 'proxy' })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'convert failed'
    return NextResponse.json({ message }, { status: 500 })
  }
}
