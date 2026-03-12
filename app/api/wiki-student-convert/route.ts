import { NextRequest, NextResponse } from 'next/server'
import * as cheerio from 'cheerio'
import type { AnyNode, Element, ParentNode } from 'domhandler'

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

type MappingRule = {
  path: string
  selector: string
  attr?: string
  valueType?: 'text' | 'number' | 'json'
}

type InspectField = {
  label: string
  selector: string
  value: string
  html: string
}

type NumberToken = {
  value: number
  raw: string
  start: number
  end: number
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
    .filter((_: number, el: Element) => normalizeText($(el).find('th').first().text()).includes(label))
    .first()
  if (!row.length) return ''
  return normalizeText(row.find('td').first().text())
}

function parseTokens(text: string): NumberToken[] {
  const regex = /-?\d+(?:\.\d+)?/g
  const tokens: NumberToken[] = []
  let match = regex.exec(text)
  while (match) {
    const raw = match[0] ?? ''
    const start = match.index
    tokens.push({
      raw,
      value: Number(raw),
      start,
      end: start + raw.length,
    })
    match = regex.exec(text)
  }
  return tokens
}

function inferValueKey(text: string, token: NumberToken) {
  const before = text.slice(Math.max(0, token.start - 18), token.start)
  const after = text.slice(token.end, Math.min(text.length, token.end + 18))
  const around = `${before}${token.raw}${after}`
  const hasPercent = after.trimStart().startsWith('%') || after.trimStart().startsWith('％')

  if (around.includes('会心ダメージ率')) return 'critdamage'
  if (around.includes('会心率')) return 'crit'
  if (around.includes('会心ダメージ')) return hasPercent ? 'critdamage' : 'critdamagenum'
  if (around.includes('会心値')) return hasPercent ? 'crit' : 'critnum'
  if (around.includes('特攻')) return hasPercent ? 'type' : 'typenum'
  if (around.includes('ダメージ')) return 'damage'
  if (around.includes('攻撃力')) return hasPercent ? 'attack' : 'attacknum'
  return hasPercent ? 'value' : 'valuenum'
}

function buildSkillTemplateAndValues(levelEffects: string[]) {
  const normalized = levelEffects.map((line) => normalizeText(line))
  const first = normalized[0] ?? ''
  const firstTokens = parseTokens(first)
  if (firstTokens.length === 0) return { text: first, values: {} as Record<string, number[]> }

  const rows = normalized.map((line) => parseTokens(line))
  const values: Record<string, number[]> = {}
  const keyUsage: Record<string, number> = {}
  const replacementByIndex = new Map<number, string>()

  for (let i = 0; i < firstTokens.length; i += 1) {
    const seq = rows.map((row: NumberToken[]) => row[i]?.value).filter((v): v is number => Number.isFinite(v))
    if (seq.length !== rows.length) continue

    const isConstant = seq.every((value) => value === seq[0])
    if (isConstant) continue

    const base = inferValueKey(first, firstTokens[i])
    keyUsage[base] = (keyUsage[base] ?? 0) + 1
    const key = keyUsage[base] === 1 ? base : `${base}${keyUsage[base]}`

    values[key] = seq
    replacementByIndex.set(i, `{${key}}`)
  }

  let cursor = 0
  let output = ''
  for (let i = 0; i < firstTokens.length; i += 1) {
    const token = firstTokens[i]
    output += first.slice(cursor, token.start)
    output += replacementByIndex.get(i) ?? token.raw
    cursor = token.end
  }
  output += first.slice(cursor)

  return { text: output, values }
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

  const readEffect = (row: string[], index: number) => {
    if (index >= 0 && row[index]) return normalizeText(row[index])
    return normalizeText(row[row.length - 1] ?? '')
  }

  const baseLevelEffects = dataRows.map((row: string[]) => readEffect(row, baseEffectIndex)).filter(Boolean)
  const plusLevelEffects =
    plusEffectIndex >= 0 ? dataRows.map((row: string[]) => readEffect(row, plusEffectIndex)).filter(Boolean) : []

  const baseExtracted = buildSkillTemplateAndValues(baseLevelEffects)
  const base: SkillBlock = {
    title: baseTitle,
    text: baseExtracted.text,
    values: baseExtracted.values,
  }

  if (!plusTitle && plusLevelEffects.length === 0) {
    return { base, plus: null }
  }

  const plusExtracted = buildSkillTemplateAndValues(plusLevelEffects)
  return {
    base,
    plus: {
      title: plusTitle || `${baseTitle}+`,
      text: plusExtracted.text,
      values: plusExtracted.values,
    },
  }
}

function extractSkillTableByHeading($: cheerio.CheerioAPI, headingLabel: string) {
  const heading = $('h3')
    .filter((_: number, el: Element) => normalizeText($(el).text()).startsWith(headingLabel))
    .first()

  if (!heading.length) return null

  const container = heading.nextAll('div.ie5').first()
  if (!container.length) return null

  const table = container.find('table.style_table').first()
  if (!table.length) return null

  const rows = table
    .find('tr')
    .toArray()
    .map((row: AnyNode) =>
      $(row)
        .find('th,td')
        .toArray()
        .map((cell: AnyNode) => normalizeText($(cell).text())),
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
  const heading = $('h2, h3').filter((_: number, el: Element) => normalizeText($(el).text()).startsWith('固有武器')).first()
  if (!heading.length) return { name: '', hp: 0, attack: 0, heal: 0 }

  const table = heading.nextAll('table').first()
  if (!table.length) return { name: '', hp: 0, attack: 0, heal: 0 }

  const rows = table.find('tr')
  const name = normalizeText(rows.first().find('th,td').first().text())

  let lv1Index = 1
  rows.each((_: number, row: Element) => {
    const cells = $(row)
      .find('th,td')
      .toArray()
      .map((cell: AnyNode) => normalizeText($(cell).text()))
    const index = cells.findIndex((cell: string) => /Lv\.?1/i.test(cell))
    if (index >= 0) lv1Index = index
  })

  const readLv1 = (label: string) => {
    const row = rows
      .filter((_: number, tr: Element) => normalizeText($(tr).find('th,td').first().text()).includes(label))
      .first()
    if (!row.length) return 0
    const cells = row
      .find('th,td')
      .toArray()
      .map((cell: AnyNode) => normalizeText($(cell).text()))
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
    .filter((_: number, el: Element) => normalizeText($(el).text()).startsWith('ステータス(初期値/MAX値)'))
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
      .filter((_: number, tr: Element) => normalizeText($(tr).find('th,td').first().text()).includes(label))
      .first()
    if (!row.length) return 0
    const cells = row.find('th,td').toArray().map((cell: AnyNode) => normalizeText($(cell).text()))
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


function setByPath(target: Record<string, unknown>, path: string, value: unknown) {
  const parts = path.split('.').map((part) => part.trim()).filter(Boolean)
  if (parts.length === 0) return

  let cursor: Record<string, unknown> = target
  for (let i = 0; i < parts.length - 1; i += 1) {
    const key = parts[i]
    const next = cursor[key]
    if (!next || typeof next !== 'object' || Array.isArray(next)) {
      cursor[key] = {}
    }
    cursor = cursor[key] as Record<string, unknown>
  }
  cursor[parts[parts.length - 1]] = value
}

function applyCustomMappings(student: StudentJsonLike, $: cheerio.CheerioAPI, mappings: MappingRule[]) {
  const next = JSON.parse(JSON.stringify(student)) as Record<string, unknown>

  for (const mapping of mappings) {
    if (!mapping.path || !mapping.selector) continue
    const element = $(mapping.selector).first()
    if (!element.length) continue

    const raw = mapping.attr ? element.attr(mapping.attr) ?? '' : element.text()
    const text = normalizeText(raw)
    const mode = mapping.valueType ?? 'text'

    if (mode === 'number') {
      setByPath(next, mapping.path, parseNumber(text))
      continue
    }

    if (mode === 'json') {
      try {
        setByPath(next, mapping.path, JSON.parse(text) as unknown)
      } catch {
        // ignore invalid json
      }
      continue
    }

    setByPath(next, mapping.path, text)
  }

  return next as StudentJsonLike
}

function buildCssPath($: cheerio.CheerioAPI, element: Element) {
  const parts: string[] = []
  let current: Element | undefined = element

  while (current && current.type === 'tag') {
    const node = $(current)
    const id = node.attr('id')
    const tagName = current.tagName?.toLowerCase() ?? 'div'

    if (id) {
      parts.unshift(`#${id}`)
      break
    }

    const parentNode: ParentNode | null = current.parent
    const parent: Element | null = parentNode !== null && parentNode.type === 'tag' ? parentNode : null
    if (!parent) {
      parts.unshift(tagName)
      break
    }

    const siblings = $(parent)
      .children(tagName)
      .toArray()
      .filter((item: AnyNode): item is Element => item.type === 'tag')

    const index = siblings.findIndex((item: Element) => item === current) + 1
    parts.unshift(`${tagName}:nth-of-type(${Math.max(1, index)})`)
    current = parent
  }

  return parts.join(' > ')
}

function buildStructureFromHtml($: cheerio.CheerioAPI) {
  const startHeading = $('h2').filter((_: number, el: Element) => normalizeText($(el).text()).startsWith('基本情報')).first()
  const fields: InspectField[] = []

  if (startHeading.length) {
    const scopeElements: Element[] = []
    let cursor = startHeading.next()[0] as Element | undefined

    while (cursor) {
      const node = $(cursor)
      const tag = cursor.tagName?.toLowerCase() ?? ''
      const headingText = tag in { h2: 1, h3: 1 } ? normalizeText(node.text()) : ''
      if (tag === 'h2' && headingText.startsWith('コメントフォーム')) break

      scopeElements.push(cursor)
      cursor = node.next()[0] as Element | undefined
    }

    const rowElements: Element[] = []
    const seenRows = new Set<Element>()

    for (const scopeElement of scopeElements) {
      const tagName = scopeElement.tagName?.toLowerCase() ?? ''
      if (tagName === 'tr') {
        if (!seenRows.has(scopeElement)) {
          seenRows.add(scopeElement)
          rowElements.push(scopeElement)
        }
        continue
      }

      const nestedRows = $(scopeElement)
        .find('tr')
        .toArray()
        .filter((node: AnyNode): node is Element => node.type === 'tag')

      for (const rowElement of nestedRows) {
        if (seenRows.has(rowElement)) continue
        seenRows.add(rowElement)
        rowElements.push(rowElement)
      }
    }

    for (const rowElement of rowElements) {
      const row = $(rowElement)
      const th = row.find('th').first()
      const td = row.find('td').first()
      if (!th.length || !td.length) continue

      const tdNode = td.get(0)
      if (!tdNode || tdNode.type !== 'tag') continue

      const label = normalizeText(th.text())
      const value = normalizeText(td.text())
      if (!label || !value) continue

      const selector = buildCssPath($, tdNode)
      fields.push({
        label,
        selector,
        value,
        html: (td.prop('outerHTML') as string | undefined) ?? '',
      })
    }
  }

  const uniqueFields = fields.filter((field, index) => {
    return fields.findIndex((item) => item.label === field.label && item.selector === field.selector) === index
  })

  return {
    title: normalizeText($('title').text()),
    fieldCount: uniqueFields.length,
    fields: uniqueFields,
    rawHtml: $.html(),
  }
}

function buildStructureFromProxyText(source: string) {
  const lines = source.split('\n').map((line) => normalizeText(line)).filter(Boolean)
  const headingLines = lines.filter((line) => /^#+\s*/.test(line)).slice(0, 200)
  const tableLines = lines.filter((line) => line.includes('|')).slice(0, 300)
  return {
    headingLines,
    tableLines,
    rawText: source,
  }
}


export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as {
    url?: string
    mode?: 'convert' | 'inspect'
    mappings?: MappingRule[]
  } | null

  const rawUrl = body?.url?.trim() ?? ''
  const mode = body?.mode ?? 'convert'
  const mappings = Array.isArray(body?.mappings) ? body?.mappings : []

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
      const $ = cheerio.load(direct.text)
      if (mode === 'inspect') {
        return NextResponse.json({ source: 'direct', structure: buildStructureFromHtml($) })
      }

      let student = parseFromHtml(direct.text)
      if (mappings.length > 0) {
        student = applyCustomMappings(student, $, mappings)
      }
      return NextResponse.json({ student, source: 'direct' })
    }

    const proxyUrl = `https://r.jina.ai/http://${url.host}${url.pathname}${url.search}`
    const proxy = await requestText(proxyUrl, {
      'User-Agent': 'Mozilla/5.0',
      Accept: 'text/plain',
    })

    if (!proxy.ok) {
      return NextResponse.json({ message: `fetch failed: direct=${direct.status}, proxy=${proxy.status}` }, { status: 502 })
    }

    if (mode === 'inspect') {
      return NextResponse.json({ source: 'proxy', structure: buildStructureFromProxyText(proxy.text) })
    }

    const student = parseFromProxyText(proxy.text)
    if (mappings.length > 0) {
      return NextResponse.json({
        student,
        source: 'proxy',
        warning: 'proxyモードではCSS selectorのカスタムマッピングは適用されません',
      })
    }

    return NextResponse.json({ student, source: 'proxy' })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'convert failed'
    return NextResponse.json({ message }, { status: 500 })
  }
}
