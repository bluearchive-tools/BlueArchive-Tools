'use client'

import { useEffect, useState, useRef, useCallback, useMemo, Fragment, type CSSProperties } from 'react'
import Link from 'next/link'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faPlus,
  faFileImport,
  faTimes,
  faCrosshairs,
  faUndo,
  faRedo,
  faExclamationTriangle,
} from '@fortawesome/free-solid-svg-icons'
import { useTranslations } from 'next-intl'
import AddEnemyModal from '../../../components/AddEnemyModal'
import equipmentJson from '@/data/equipment.json'



type EquipmentSlotMap = Record<string, string>



interface Student {
  id: string
  name: string
  image: string
  attackType: string
  defenseType: string
  hasAccessory?: boolean
  styleIds?: string[]
  styleOf?: string
  altIds?: string[]
  altOf?: string
  initialStars: number
  role: string
  characterType: string
  position: string
  cost?: number
  exDuration?: number
  exMotionDuration?: number
  exHitDelay?: number
  normalDuration?: number
  normalMotionDuration?: number
  normalInterval?: number
  normalHitDelay?: number
  equipmentSlots?: EquipmentSlotMap
  skills?: {
    ex?: { title?: string; type?: string; text?: string; values?: Record<string, number[]> }
    normal?: { title?: string; type?: string; text?: string; values?: Record<string, number[]> }
    passive?: { title?: string; type?: string; text?: string; values?: Record<string, number[]> }
    passivePlus?: { title?: string; type?: string; text?: string; values?: Record<string, number[]> }
    sub?: { title?: string; type?: string; text?: string; values?: Record<string, number[]> }
  }
}

interface Enemy {
  id: string
  name: string
  level?: number
  armor?: string
  stats?: { hp?: number; attack?: number; defense?: number; critResist?: number }
  skills?: Record<string, { name: string; duration?: number }>
  attackOrder?: { time: number; skill: string }[]
}

interface UserStudent {
  level: number
  ex_skill: number
  normal_skill: number
  passive_skill: number
  sub_skill: number
  [key: string]: number | Record<string, number> | undefined
}

interface SkillEvent {
  id: number
  row: number
  start: number
  end: number
  label: string
  type?: string
  travel?: number
  motion?: number
  target?: number
  show?: boolean
}

interface MarkerEvent {
  id: number
  time: number
  label: string
  duration: number
  skillable: boolean
  show?: boolean
}

interface EventTemplate {
  id: string
  label: string
  duration: number
  skillable: boolean
}

// ==== Plugin system (safe JSON plugins; no eval) ====

type PluginMacroAction =
  | {
      type: 'addMarker'
      time: number
      label: string
      duration?: number
      skillable?: boolean
    }
  | {
      type: 'addSkill'
      row: number
      start: number
      // end か duration のどちらかでOK
      end?: number
      duration?: number
      label: string
      skillType?: 'ex' | 'normal' | 'other'
    }
  | {
      type: 'alignSelected'
      mode: 'left' | 'pack' | 'even'
    }
  | {
      // 選択中（スキル/マーカー）を削除
      type: 'deleteSelected'
      scope?: 'skill' | 'marker' | 'all'
    }
  | {
      // 選択中を複製（time/start/end に offset を加算）
      type: 'duplicateSelected'
      offset?: number
      scope?: 'skill' | 'marker' | 'all'
    }
  | {
      // 選択中をまとめてずらす（秒）
      type: 'offsetSelected'
      delta: number
      scope?: 'skill' | 'marker' | 'all'
    }
  | {
      // 選択中のラベルを変更
      type: 'setSelectedLabel'
      label: string
      scope?: 'skill' | 'marker' | 'all'
    }
  | {
      // 選択中スキルの行を変更
      type: 'setSelectedRow'
      row: number
    }


  | {
      // プラグインの固有ウィンドウを開く（sandboxed iframe）
      type: 'openWindow'
      windowId: string
      target?: 'modal' | 'dockBottom'
    }
interface PluginMacro {
  id: string
  name: string
  description?: string
  actions: PluginMacroAction[]
}

interface PluginToolButton {
  id: string
  label: string
  // 'tools'（ツールのドロップダウン） or 'toolbar'（上部バー）
  location?: 'tools' | 'toolbar'
  // プロモード時のみ表示
  proOnly?: boolean
  // ボタン押下時に確認ダイアログを出す
  confirm?: string
  // macroId を指定すると、そのプラグイン内の macros の該当 macro を実行
  macroId?: string
  // macroId が無い場合、ここに actions を直接書ける
  actions?: PluginMacroAction[]
  // 並び順（小さいほど上）
  order?: number
}


interface PluginWindow {
  id: string
  title: string
  // sandboxed iframe に渡す srcdoc（html/css/js を全部入れた文字列）
  srcdoc: string
  width?: number
  height?: number
}

interface PluginPageBlock {
  // ページ内に埋め込むブロック（sandboxed iframe）
  id: string
  title: string
  srcdoc: string
  height?: number
  // 初期並び順（小さいほど上）
  order?: number
}


interface PluginStyleRule {
  target: 'skill' | 'marker'
  // skill のみ
  skillType?: 'ex' | 'normal' | 'other'
  row?: number
  labelIncludes?: string
  addClass?: string
  // positioning（left/top/width/height）以外の見た目調整用（任意）
  style?: Record<string, string | number>
  hide?: boolean
}

interface PluginStyle {
  // そのまま <style jsx global> に挿入されるCSS
  css?: string
  // CSS変数（--xxx）: ルート要素に style で適用される
  vars?: Record<string, string>
  // ルート要素に追加する class
  rootClass?: string
  // 要素ごとのクラス/スタイル付与ルール
  rules?: PluginStyleRule[]
}

interface UserPlugin {
  id: string
  name: string
  version?: string
  enabled?: boolean
  templates?: EventTemplate[]
  macros?: PluginMacro[]
  tools?: PluginToolButton[]
  windows?: PluginWindow[]
  // ページに埋め込むブロック
  blocks?: PluginPageBlock[]
  style?: PluginStyle
}



type UnknownRecord = Record<string, unknown>
const isRecord = (v: unknown): v is UnknownRecord =>
  typeof v === 'object' && v !== null && !Array.isArray(v)
const asArray = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])
const asToolLocation = (v: unknown): 'toolbar' | 'tools' | undefined =>
  v === 'toolbar' ? 'toolbar' : v === 'tools' ? 'tools' : undefined



// ざっくり型チェック（壊れたJSONで落ちないように）（壊れたJSONで落ちないように）
function normalizePlugins(raw: unknown): UserPlugin[] {
  const arr: unknown[] = Array.isArray(raw) ? raw : isRecord(raw) ? [raw] : []
  const out: UserPlugin[] = []

  const buildSrcdoc = (html: unknown, css: unknown, js: unknown): string => {
    const h = typeof html === 'string' ? html : ''
    const c = typeof css === 'string' ? css : ''
    const j0 = typeof js === 'string' ? js : ''
    const j = j0.replace(/<\/script/gi, '<\/script')
    if (!h && !c && !j) return ''
    return `<!doctype html><html><head><meta charset="utf-8"/><style>${c}</style></head><body>${h}<script>${j}</script></body></html>`
  }


  for (const item of arr) {
    if (!isRecord(item)) continue

    const id = typeof item.id === 'string' ? item.id.trim() : ''
    const name = typeof item.name === 'string' ? item.name.trim() : ''
    if (!id || !name) continue

    const enabled = typeof item.enabled === 'boolean' ? item.enabled : true

    const templates: EventTemplate[] = asArray(item.templates)
      .filter(isRecord)
      .map((t) => ({
        id: typeof t.id === 'string' ? t.id : '',
        label: typeof t.label === 'string' ? t.label : '',
        duration: typeof t.duration === 'number' && Number.isFinite(t.duration) ? t.duration : 0,
        skillable: typeof t.skillable === 'boolean' ? t.skillable : false,
      }))
      .filter((t) => !!t.id && !!t.label)

    const macros: PluginMacro[] = asArray(item.macros)
      .filter(isRecord)
      .map((m) => ({
        id: typeof m.id === 'string' ? m.id : '',
        name: typeof m.name === 'string' ? m.name : '',
        description: typeof m.description === 'string' ? m.description : undefined,
        actions: asArray(m.actions) as PluginMacroAction[],
      }))
      .filter((m) => !!m.id && !!m.name)

    const tools: PluginToolButton[] = asArray(item.tools)
      .filter(isRecord)
      .map((b) => ({
        id: typeof b.id === 'string' ? b.id : '',
        label: typeof b.label === 'string' ? b.label : '',
        location: asToolLocation(b.location),
        proOnly: typeof b.proOnly === 'boolean' ? b.proOnly : false,
        confirm: typeof b.confirm === 'string' ? b.confirm : undefined,
        macroId: typeof b.macroId === 'string' ? b.macroId : undefined,
        actions: asArray(b.actions) as PluginMacroAction[],
        order: typeof b.order === 'number' && Number.isFinite(b.order) ? b.order : 999,
      }))
      .filter((b) => !!b.id && !!b.label && (!!b.macroId || (b.actions?.length ?? 0) > 0))


    const windows: PluginWindow[] = asArray(item.windows)
      .filter(isRecord)
      .map((w) => {
        const id = typeof w.id === 'string' ? w.id : ''
        const title = typeof w.title === 'string' ? w.title : id
        const width = typeof w.width === 'number' && Number.isFinite(w.width) ? w.width : undefined
        const height = typeof w.height === 'number' && Number.isFinite(w.height) ? w.height : undefined
        const srcdoc =
          typeof w.srcdoc === 'string'
            ? w.srcdoc
            : buildSrcdoc(w.html, w.css, w.js)
        return { id, title, srcdoc, width, height }
      })
      .filter((w) => !!w.id && !!w.title && !!w.srcdoc)

    const blocks: PluginPageBlock[] = asArray(item.blocks)
      .filter(isRecord)
      .map((b) => {
        const id = typeof b.id === 'string' ? b.id : ''
        const title = typeof b.title === 'string' ? b.title : id
        const height = typeof b.height === 'number' && Number.isFinite(b.height) ? b.height : undefined
        const order = typeof b.order === 'number' && Number.isFinite(b.order) ? b.order : undefined
        const srcdoc =
          typeof b.srcdoc === 'string'
            ? b.srcdoc
            : buildSrcdoc(b.html, b.css, b.js)
        return { id, title, srcdoc, height, order }
      })
      .filter((b) => !!b.id && !!b.title && !!b.srcdoc)


    const style: PluginStyle | undefined = isRecord(item.style)
      ? (() => {
          const s = item.style
          const vars: Record<string, string> = {}

          if (isRecord(s.vars)) {
            for (const [k, v] of Object.entries(s.vars)) {
              if (k.startsWith('--') && typeof v === 'string') vars[k] = v
            }
          }

          const rules: PluginStyleRule[] = asArray(s.rules)
            .filter(isRecord)
            .map((r) => {
              const target = r.target
              if (target !== 'skill' && target !== 'marker') return null

              const skillType: 'ex' | 'normal' | 'other' | undefined =
                r.skillType === 'ex' || r.skillType === 'normal' || r.skillType === 'other'
                  ? r.skillType
                  : undefined

              const row = typeof r.row === 'number' && Number.isFinite(r.row) ? r.row : undefined
              const labelIncludes = typeof r.labelIncludes === 'string' ? r.labelIncludes : undefined
              const addClass = typeof r.addClass === 'string' ? r.addClass : undefined
              const hide = typeof r.hide === 'boolean' ? r.hide : undefined

              const styleObj: Record<string, string | number> = {}
              if (isRecord(r.style)) {
                for (const [k, v] of Object.entries(r.style)) {
                  if (typeof v === 'string' || (typeof v === 'number' && Number.isFinite(v))) {
                    styleObj[k] = v
                  }
                }
              }

              const outRule: PluginStyleRule = { target }
              if (skillType) outRule.skillType = skillType
              if (row != null) outRule.row = row
              if (labelIncludes) outRule.labelIncludes = labelIncludes
              if (addClass) outRule.addClass = addClass
              if (hide != null) outRule.hide = hide
              if (Object.keys(styleObj).length) outRule.style = styleObj
              return outRule
            })
            .filter((x): x is PluginStyleRule => !!x)

          const outStyle: PluginStyle = {}
          if (typeof s.css === 'string') outStyle.css = s.css
          if (Object.keys(vars).length) outStyle.vars = vars
          if (typeof s.rootClass === 'string') outStyle.rootClass = s.rootClass
          if (rules.length) outStyle.rules = rules
          return Object.keys(outStyle).length ? outStyle : undefined
        })()
      : undefined

    out.push({
      id,
      name,
      version: typeof item.version === 'string' ? item.version : undefined,
      enabled,
      templates,
      macros,
      tools,
      windows,
      blocks,
      style,
    })
  }

  return out
}

function mergePlugins(prev: UserPlugin[], incoming: UserPlugin[]): UserPlugin[] {
  const map = new Map(prev.map((p) => [p.id, p]))
  incoming.forEach((p) => map.set(p.id, p))
  return Array.from(map.values()).sort((a, b) => a.id.localeCompare(b.id))
}

interface Squad {
  strikers: string[]
  specials: string[]
  memo?: string
}

interface SquadGroup {
  id: string
  name: string
  squads: Squad[]
}

interface ProjectSnapshot {
  projectName: string
  rowStudents: string[]
  skills: SkillEvent[]
  markers: MarkerEvent[]
  groupId: string
  squadIndex: number
}

const armorBonus: Record<string, Record<string, number>> = {
  '爆発': { '重装甲': 1, '軽装備': 2, '特殊装甲': 0.5, '弾力装甲': 0.5 },
  '貫通': { '弾力装甲': 1, '重装甲': 2, '軽装備': 0.5, '特殊装甲': 1 },
  '神秘': { '特殊装甲': 2, '弾力装甲': 1, '重装甲': 0.5, '軽装備': 1 },
  '振動': { '軽装備': 1, '特殊装甲': 1.5, '弾力装甲': 2, '重装甲': 0.5 },
}


export default function TLMakerPage() {
  const t = useTranslations('tl')
  const tMaker = useCallback(
    (key: string, values?: Record<string, unknown>) => t(`maker.${key}`, values),
    [t]
  )
  const tPlugin = useCallback(
    (key: string, values?: Record<string, unknown>) => t(`plugin.${key}`, values),
    [t]
  )
  const [students, setStudents] = useState<Student[]>([])
  const [rowStudents, setRowStudents] = useState<string[]>(['', '', '', '', '', ''])
  const [skills, setSkills] = useState<SkillEvent[]>([])
  const [markers, setMarkers] = useState<MarkerEvent[]>([])
  const [eventTemplates, setEventTemplates] = useState<EventTemplate[]>([])
  const [menuInfo, setMenuInfo] = useState<{ index: number; x: number; y: number } | null>(null)
  const [eventMenu, setEventMenu] = useState<{ type: 'skill' | 'marker'; id: number; x: number; y: number } | null>(null)
  const [buffMenu, setBuffMenu] = useState<{ id: number; x: number; y: number } | null>(null)
  const [skillPopup, setSkillPopup] = useState<{
    id: number
    x: number
    y: number
    text: string
    target?: string
  } | null>(null)
  const [row, setRow] = useState(0)
  const [start, setStart] = useState(0)
  const [end, setEnd] = useState(1)
  const [label, setLabel] = useState('')
  const [templateId, setTemplateId] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [squads, setSquads] = useState<{ name: string; members: string[] }[]>([])
  const [showMenu, setShowMenu] = useState(false)
  const [selectedType, setSelectedType] = useState<'skill' | 'event' | null>(null)
  const [skillKind, setSkillKind] = useState<'ex' | 'normal'>('ex')
  const [timeScale, setTimeScale] = useState(20) // px per second
  const [applyTravel, setApplyTravel] = useState(false)
  const [waitCost, setWaitCost] = useState(false)
  const [zoomByPlayhead, setZoomByPlayhead] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const playheadTimer = useRef<NodeJS.Timeout | null>(null)
  const [playhead, setPlayhead] = useState(2)
  const [totalSeconds, setTotalSeconds] = useState(240)
  const [selected, setSelected] = useState<{ type: 'skill' | 'marker'; id: number }[]>([])
  const [copied, setCopied] = useState<{ skills: SkillEvent[]; markers: MarkerEvent[] } | null>(null)
  const [showEditMenu, setShowEditMenu] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [movingSkill, setMovingSkill] = useState<{ id: number; offset: number } | null>(null)
  const [moveModeSkill, setMoveModeSkill] = useState<number | null>(null)
  const scrollLock = useRef(0)
  const [playheadMenu, setPlayheadMenu] = useState<{ x: number; y: number } | null>(null)
  const [groups, setGroups] = useState<SquadGroup[]>([])
  const [selectedGroup, setSelectedGroup] = useState<SquadGroup | null>(null)
  const [squadIndex, setSquadIndex] = useState(0)
  const [projectName, setProjectName] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [hasCache, setHasCache] = useState(false)
  const [userStats, setUserStats] = useState<Record<string, UserStudent>>({})
  const [initialized, setInitialized] = useState(false)
  const [showTools, setShowTools] = useState(false)
  const [proMode, setProMode] = useState(false)
  const [snapPreset, setSnapPreset] = useState<'off' | '0.5' | '0.1' | '0.05' | '0.033'>('0.033')
  const [showAlignModal, setShowAlignModal] = useState(false)
  const [showHistoryModal, setShowHistoryModal] = useState(false)
  const [showExTemplateModal, setShowExTemplateModal] = useState(false)
  const [historyLog, setHistoryLog] = useState<Array<{ id: number; at: string; summary: string }>>([])

  // Plugins
  const [plugins, setPlugins] = useState<UserPlugin[]>([])
  const [showPluginModal, setShowPluginModal] = useState(false)
  const [openPluginWindow, setOpenPluginWindow] = useState<{ pluginId: string; windowId: string } | null>(null)
  const [dockPluginWindow, setDockPluginWindow] = useState<{ pluginId: string; windowId: string } | null>(null)

  // Page blocks（プラグインがページ内にiframeブロックを登録できる）
  const PAGE_BLOCK_ORDER_KEY = 'tlMaker:pageBlockOrder'
  const PAGE_BLOCK_HIDDEN_KEY = 'tlMaker:pageBlockHidden'
  const PAGE_LAYOUT_MODE_KEY = 'tlMaker:pageLayoutMode'
  const PAGE_LAYOUT_EDIT_KEY = 'tlMaker:pageLayoutEdit'
  const PAGE_BLOCK_RECTS_KEY = 'tlMaker:pageBlockRects'
  const HIDE_HEADER_KEY = 'tlMaker:hideHeader'
  type PageLayoutMode = 'stack' | 'free'
  type PageBlockRect = { x: number; y: number; w: number; h: number; z: number }
  const TOPBAR_KEY = 'default:topbar'
  const TOPBAR_HEIGHT = 48
  const [pageBlockOrder, setPageBlockOrder] = useState<string[]>([])
  const [pageBlockHidden, setPageBlockHidden] = useState<Record<string, boolean>>({})
  const [pageLayoutMode, setPageLayoutMode] = useState<PageLayoutMode>('stack')
  const [pageLayoutEdit, setPageLayoutEdit] = useState(false)
  const [pageBlockRects, setPageBlockRects] = useState<Record<string, PageBlockRect>>({})
  const [pluginText, setPluginText] = useState('')
  const [pluginError, setPluginError] = useState<string | null>(null)

  const enabledPlugins = useMemo(() => plugins.filter((p) => p.enabled !== false), [plugins])

// Resizable plugin window (modal)
const [pluginWindowSizeMap, setPluginWindowSizeMap] = useState<Record<string, { w: number; h: number }>>({})
const pluginWindowResizeRef = useRef<{
  key: string
  startX: number
  startY: number
  startW: number
  startH: number
} | null>(null)

const clampNum = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v))

const getDefaultPluginWindowSize = useCallback((win: { width?: number; height?: number }) => {
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1200
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800
  const maxW = Math.floor(vw * 0.95)
  const maxH = Math.floor(vh * 0.9)
  const baseW =
    typeof win.width === 'number' && Number.isFinite(win.width) ? Math.round(win.width) : Math.min(900, maxW)
  const baseH =
    typeof win.height === 'number' && Number.isFinite(win.height) ? Math.round(win.height) : Math.min(Math.floor(vh * 0.7), maxH)
  return { w: clampNum(baseW, 320, maxW), h: clampNum(baseH, 240, maxH) }
}, [])

const startResizePluginWindow = useCallback(
  (e: React.PointerEvent<HTMLDivElement>, key: string, startW: number, startH: number) => {
    e.preventDefault()
    e.stopPropagation()

    pluginWindowResizeRef.current = {
      key,
      startX: e.clientX,
      startY: e.clientY,
      startW,
      startH,
    }

    const onMove = (ev: PointerEvent) => {
      const st = pluginWindowResizeRef.current
      if (!st || st.key !== key) return
      const vw = window.innerWidth
      const vh = window.innerHeight
      const maxW = Math.floor(vw * 0.95)
      const maxH = Math.floor(vh * 0.9)
      const nextW = clampNum(st.startW + (ev.clientX - st.startX), 320, maxW)
      const nextH = clampNum(st.startH + (ev.clientY - st.startY), 240, maxH)
      setPluginWindowSizeMap((prev) => ({ ...prev, [key]: { w: nextW, h: nextH } }))
    }

    const onUp = () => {
      pluginWindowResizeRef.current = null
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  },
  []
)

  const pluginTemplates = useMemo<EventTemplate[]>(() => {
    return enabledPlugins.flatMap((p) =>
      (p.templates ?? []).map((t) => ({
        ...t,
        id: `${p.id}:${t.id}`,
      }))
    )
  }, [enabledPlugins])

  const allEventTemplates = useMemo<EventTemplate[]>(() => {
    return [...eventTemplates, ...pluginTemplates]
  }, [eventTemplates, pluginTemplates])

  type ResolvedMacro = PluginMacro & { pluginId: string; pluginName: string }

  const pluginMacros = useMemo<ResolvedMacro[]>(() => {
    return enabledPlugins.flatMap((p) =>
      (p.macros ?? []).map((m) => ({
        ...m,
        pluginId: p.id,
        pluginName: p.name,
      }))
    )
  }, [enabledPlugins])

  type ResolvedToolButton = PluginToolButton & { pluginId: string; pluginName: string }

  const pluginToolButtons = useMemo<ResolvedToolButton[]>(() => {
    const all = enabledPlugins.flatMap((p) =>
      (p.tools ?? []).map((b) => ({
        ...b,
        pluginId: p.id,
        pluginName: p.name,
      }))
    )
    return all.sort((a, b) => (a.order ?? 999) - (b.order ?? 999) || a.label.localeCompare(b.label))
  }, [enabledPlugins])

  const toolMenuPluginButtons = useMemo(() => {
    return pluginToolButtons.filter((b) => (b.location ?? 'tools') === 'tools' && (!b.proOnly || proMode))
  }, [pluginToolButtons, proMode])

  const toolbarPluginButtons = useMemo(() => {
    return pluginToolButtons.filter(
      (b) => (b.location ?? 'tools') === 'toolbar' && (!b.proOnly || proMode)
    )
  }, [pluginToolButtons, proMode])

  const pluginCss = useMemo(() => {
    return enabledPlugins
      .map((p) => p.style?.css)
      .filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
      .join('\n\n')
  }, [enabledPlugins])

  const pluginVars = useMemo(() => {
    const vars: Record<string, string> = {}
    enabledPlugins.forEach((p) => {
      if (!p.style?.vars) return
      Object.entries(p.style.vars).forEach(([k, v]) => {
        if (!k.startsWith('--')) return
        vars[k] = v
      })
    })
    return vars
  }, [enabledPlugins])

  const pluginRootClass = useMemo(() => {
    return enabledPlugins
      .map((p) => p.style?.rootClass)
      .filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
      .join(' ')
  }, [enabledPlugins])

  type PageBlockMeta = {
    key: string
    title: string
    pluginId: string
    pluginName: string
    height?: number
    order?: number
  }

  type ResolvedPageBlock = PluginPageBlock & { key: string; pluginId: string; pluginName: string }

  // plugins -> page blocks
  const pluginPageBlocks = useMemo<ResolvedPageBlock[]>(() => {
    return enabledPlugins.flatMap((p) =>
      (p.blocks ?? []).map((b) => ({
        ...b,
        key: `${p.id}:${b.id}`,
        pluginId: p.id,
        pluginName: p.name,
      }))
    )
  }, [enabledPlugins])

  const pageBlocksMeta = useMemo<PageBlockMeta[]>(() => {
    const defaults: PageBlockMeta[] = [
      { key: 'default:topbar', title: 'トップバー', pluginId: 'default', pluginName: 'デフォルト', order: 0 },
      { key: 'default:main', title: 'メイン', pluginId: 'default', pluginName: 'デフォルト', order: 10 },
      { key: 'default:damageCalc', title: 'ダメージ計算', pluginId: 'default', pluginName: 'デフォルト', order: 3000 },
    ]
    const plugins = pluginPageBlocks.map((b) => ({
      key: b.key,
      title: b.title,
      pluginId: b.pluginId,
      pluginName: b.pluginName,
      height: b.height,
      order: b.order,
    }))
    return [...defaults, ...plugins]
  }, [pluginPageBlocks])

  const orderedPageBlocks = useMemo<ResolvedPageBlock[]>(() => {
    const byKey = new Map(pluginPageBlocks.map((b) => [b.key, b]))
    const keys: string[] = []

    // localStorage に保存されている順番を優先
    for (const k of pageBlockOrder) {
      if (typeof k !== 'string') continue
      if (byKey.has(k) && !keys.includes(k)) keys.push(k)
    }

    // 追加分（未登録キー）は order → title で末尾に追加
    const rest = pluginPageBlocks
      .filter((b) => !keys.includes(b.key))
      .sort(
        (a, b) =>
          (a.order ?? 999) - (b.order ?? 999) ||
          a.title.localeCompare(b.title) ||
          a.key.localeCompare(b.key)
      )
      .map((b) => b.key)

    keys.push(...rest)

    return keys
      .map((k) => byKey.get(k))
      .filter((b): b is ResolvedPageBlock => !!b)
      .filter((b) => !pageBlockHidden[b.key])
  }, [pluginPageBlocks, pageBlockOrder, pageBlockHidden])

  // postMessage bridge（sandboxed iframe → 親ページ）
  const pageBlocksMetaRef = useRef<PageBlockMeta[]>([])
  const pageBlockOrderRef = useRef<string[]>([])
  const pageBlockHiddenRef = useRef<Record<string, boolean>>({})
  const pageLayoutModeRef = useRef<PageLayoutMode>('stack')
  const pageLayoutEditRef = useRef<boolean>(false)
  const pageBlockRectsRef = useRef<Record<string, PageBlockRect>>({})

  // free-layout: measure current stacked positions to seed rects
  const layoutAreaRef = useRef<HTMLElement | null>(null)
  const blockRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const registerBlockRef = useCallback(
    (key: string) => (el: HTMLDivElement | null) => {
      blockRefs.current[key] = el
    },
    []
  )

  const initFreeLayoutFromCurrent = useCallback(() => {
    const area = layoutAreaRef.current
    if (!area) return
    const areaRect = area.getBoundingClientRect()

    setPageBlockRects((prev) => {
      const next: Record<string, PageBlockRect> = { ...prev }
      let maxZ = Object.values(next).reduce((m, r) => Math.max(m, r?.z ?? 0), 0)

      for (const [key, el] of Object.entries(blockRefs.current)) {
        if (!el) continue
        if (next[key]) continue
        const r = el.getBoundingClientRect()
        if (!(r.width > 0 && r.height > 0)) continue
        maxZ += 1
        next[key] = {
          x: r.left - areaRect.left + area.scrollLeft,
          y: r.top - areaRect.top + area.scrollTop,
          w: r.width,
          h: r.height,
          z: maxZ,
        }
      }

      return next
    })
  }, [setPageBlockRects])


  useEffect(() => {
    pageBlocksMetaRef.current = pageBlocksMeta
  }, [pageBlocksMeta])
  useEffect(() => {
    pageBlockOrderRef.current = pageBlockOrder
  }, [pageBlockOrder])
  useEffect(() => {
    pageBlockHiddenRef.current = pageBlockHidden
  }, [pageBlockHidden])

  useEffect(() => {
    pageLayoutModeRef.current = pageLayoutMode
  }, [pageLayoutMode])
  useEffect(() => {
    pageLayoutEditRef.current = pageLayoutEdit
  }, [pageLayoutEdit])
  useEffect(() => {
    pageBlockRectsRef.current = pageBlockRects
  }, [pageBlockRects])

  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      const raw = e.data as unknown
      if (!raw || typeof raw !== 'object') return
      const data = raw as Record<string, unknown>
      const src = e.source as Window | null
      const type = data.type

      // ---- generic localStorage bridge ----
      if (type === 'TLMAKER_PLUGIN_STORAGE_GET') {
        const key = typeof data.key === 'string' ? data.key : ''
        if (!key) return
        let value: string | null = null
        try {
          value = localStorage.getItem(key)
        } catch {
          value = null
        }
        src?.postMessage({ type: 'TLMAKER_PLUGIN_STORAGE_VALUE', key, value }, '*')
        return
      }

      if (type === 'TLMAKER_PLUGIN_STORAGE_SET') {
        const key = typeof data.key === 'string' ? data.key : ''
        const value = typeof data.value === 'string' ? data.value : ''
        if (!key) return
        try {
          localStorage.setItem(key, value)
        } catch {
          /* ignore */
        }

        // 変更を全プラグインiframeへブロードキャスト（別iframeの埋め込みブロックにも即反映させる）
        try {
          const frames = Array.from(document.querySelectorAll('iframe'))
          for (const f of frames) {
            try {
              f.contentWindow?.postMessage({ type: 'TLMAKER_PLUGIN_STORAGE_SET', key, value }, '*')
            } catch {
              /* ignore */
            }
          }
        } catch {
          /* ignore */
        }

        src?.postMessage({ type: 'TLMAKER_PLUGIN_STORAGE_ACK', key }, '*')
        return
      }

      // ---- page blocks (layout) bridge ----
      if (type === 'TLMAKER_PAGE_BLOCKS_GET') {
        src?.postMessage(
          {
            type: 'TLMAKER_PAGE_BLOCKS_VALUE',
            blocks: pageBlocksMetaRef.current,
            order: pageBlockOrderRef.current,
            hidden: pageBlockHiddenRef.current,
          },
          '*'
        )
        return
      }

      if (type === 'TLMAKER_PAGE_BLOCKS_SET_ORDER') {
        const arr = Array.isArray(data.order) ? data.order : []
        const allowed = new Set(pageBlocksMetaRef.current.map((b) => b.key))
        const next = arr.filter((x: unknown) => typeof x === 'string' && allowed.has(x)) as string[]
        setPageBlockOrder(next)
        src?.postMessage({ type: 'TLMAKER_PAGE_BLOCKS_ACK', ok: true }, '*')
        return
      }

      if (type === 'TLMAKER_PAGE_BLOCKS_SET_HIDDEN') {
        const key = typeof data.key === 'string' ? data.key : ''
        const hidden = !!data.hidden
        if (!key) return
        setPageBlockHidden((prev) => ({ ...prev, [key]: hidden }))
        src?.postMessage({ type: 'TLMAKER_PAGE_BLOCKS_ACK', ok: true }, '*')
        return
      }

      if (type === 'TLMAKER_PAGE_BLOCKS_RESET') {
        setPageBlockOrder([])
        setPageBlockHidden({})
        src?.postMessage({ type: 'TLMAKER_PAGE_BLOCKS_ACK', ok: true }, '*')
        return
      }
      if (type === 'TLMAKER_PAGE_LAYOUT_GET') {
        src?.postMessage(
          {
            type: 'TLMAKER_PAGE_LAYOUT_VALUE',
            mode: pageLayoutModeRef.current,
            edit: pageLayoutEditRef.current,
            rects: pageBlockRectsRef.current,
          },
          '*'
        )
        return
      }

      if (type === 'TLMAKER_PAGE_LAYOUT_SET') {
        const mode = data.mode === 'free' || data.mode === 'stack' ? (data.mode as PageLayoutMode) : null
        if (mode) setPageLayoutMode(mode)
        if (typeof data.edit === 'boolean') setPageLayoutEdit(data.edit)
        const rects = data.rects
        if (rects && typeof rects === 'object' && !Array.isArray(rects)) {
          setPageBlockRects(rects as Record<string, PageBlockRect>)
        }
        src?.postMessage({ type: 'TLMAKER_PAGE_LAYOUT_ACK', ok: true }, '*')
        return
      }

    }

    window.addEventListener('message', onMsg)
    return () => window.removeEventListener('message', onMsg)
  }, [])

  type CompiledStyleRule = PluginStyleRule & { pluginId: string }

  const pluginStyleRules = useMemo<CompiledStyleRule[]>(() => {
    return enabledPlugins.flatMap((p) => (p.style?.rules ?? []).map((r) => ({ ...r, pluginId: p.id })))
  }, [enabledPlugins])


  // EXテンプレ生成(プロモード)
  const [tplRow, setTplRow] = useState(0)
  const [tplStart, setTplStart] = useState(0)
  const [tplInterval, setTplInterval] = useState(10)
  const [tplCount, setTplCount] = useState(6)
  const [tplLabel, setTplLabel] = useState('EX')
  const [showSquadMenu, setShowSquadMenu] = useState(false)
  const [showFileMenu, setShowFileMenu] = useState(false)
  const [showGroupMenu, setShowGroupMenu] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showTextTL, setShowTextTL] = useState(false)
  const [textTL, setTextTL] = useState('')
  const [showDamageCalc, setShowDamageCalc] = useState(false)
  const [hideHeader, setHideHeader] = useState(false)
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [showEnemyModal, setShowEnemyModal] = useState(false)
  const [includeStats, setIncludeStats] = useState(false)
  const [enemies, setEnemies] = useState<Enemy[]>([])
  const [defaultTargets, setDefaultTargets] = useState({ attack: 0, debuff: 0 })
  const [tlStats, setTlStats] = useState<Record<string, UserStudent>>({})
  const [defaultLevels, setDefaultLevels] = useState({ ex: 5, normal: 10, passive: 10, sub: 10 })
  const [skillColors, setSkillColors] = useState({
    ex: {
      travel: { color: '#3b82f6', alpha: 0.5 },
      motion: { color: '#3b82f6', alpha: 0.9 },
      rest: { color: '#3b82f6', alpha: 0.5 },
    },
    normal: {
      travel: { color: '#10b981', alpha: 0.5 },
      motion: { color: '#10b981', alpha: 0.9 },
      rest: { color: '#10b981', alpha: 0.5 },
    },
  })
  const prevSnapshot = useRef<ProjectSnapshot | null>(null)
  const undoStack = useRef<ProjectSnapshot[]>([])
  const redoStack = useRef<ProjectSnapshot[]>([])
  const isRestoring = useRef(false)

useEffect(() => {
  const loaded = loadUserStatsFromLocalStorage()
  setUserStats((prev) => ({ ...loaded, ...prev }))
}, [])


  // Pro mode / Snap の保存
  useEffect(() => {
    try {
      const v = localStorage.getItem('tlMaker:proMode')
      if (v != null) setProMode(v === '1')
      const s = localStorage.getItem('tlMaker:snapPreset')
      if (s === 'off' || s === '0.5' || s === '0.1' || s === '0.05' || s === '0.033') setSnapPreset(s)
      const hh = localStorage.getItem(HIDE_HEADER_KEY)
      if (hh != null) setHideHeader(hh === '1')
      const p = localStorage.getItem('tlMaker:plugins')
      if (p) {
        try {
          const raw = JSON.parse(p)
          setPlugins(normalizePlugins(raw))
        } catch {
          // ignore
        }
      }
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem('tlMaker:proMode', proMode ? '1' : '0')
      localStorage.setItem('tlMaker:snapPreset', snapPreset)
      localStorage.setItem('tlMaker:plugins', JSON.stringify(plugins))
      localStorage.setItem(HIDE_HEADER_KEY, hideHeader ? '1' : '0')
      window.dispatchEvent(new Event('tlMaker:hideHeaderChanged'))
    } catch {
      /* ignore */
    }
  }, [proMode, snapPreset, plugins, hideHeader])


  // Page blocks の保存（並び順・表示/非表示）
  useEffect(() => {
    try {
      const o = localStorage.getItem(PAGE_BLOCK_ORDER_KEY)
      if (o) {
        const arr = JSON.parse(o)
        if (Array.isArray(arr)) setPageBlockOrder(arr.filter((x) => typeof x === 'string'))
      }
      const h = localStorage.getItem(PAGE_BLOCK_HIDDEN_KEY)
      if (h) {
        const obj = JSON.parse(h)
        if (obj && typeof obj === 'object' && !Array.isArray(obj)) setPageBlockHidden(obj as Record<string, boolean>)
      }
      const m_ = localStorage.getItem(PAGE_LAYOUT_MODE_KEY)
      if (m_ === 'free' || m_ === 'stack') setPageLayoutMode(m_)
      const e_ = localStorage.getItem(PAGE_LAYOUT_EDIT_KEY)
      if (e_) {
        try {
          const v = JSON.parse(e_)
          if (typeof v === 'boolean') setPageLayoutEdit(v)
        } catch {
          /* ignore */
        }
      }
      const r_ = localStorage.getItem(PAGE_BLOCK_RECTS_KEY)
      if (r_) {
        const obj = JSON.parse(r_) as unknown
        if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
          const next: Record<string, PageBlockRect> = {}
          for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
            if (!v || typeof v !== 'object' || Array.isArray(v)) continue
            const r = v as Record<string, unknown>
            const x = typeof r.x === 'number' && Number.isFinite(r.x) ? r.x : 8
            const y = typeof r.y === 'number' && Number.isFinite(r.y) ? r.y : 8
            const w = typeof r.w === 'number' && Number.isFinite(r.w) ? r.w : 900
            const legacyH = (r as { height?: unknown }).height
            const h =
              typeof r.h === 'number' && Number.isFinite(r.h)
                ? r.h
                : typeof legacyH === 'number' && Number.isFinite(legacyH)
                ? legacyH
                : 360
            const z = typeof r.z === 'number' && Number.isFinite(r.z) ? r.z : 1
            next[k] = { x, y, w, h, z }
          }
          setPageBlockRects(next)
        }
      }
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(PAGE_BLOCK_ORDER_KEY, JSON.stringify(pageBlockOrder))
      localStorage.setItem(PAGE_BLOCK_HIDDEN_KEY, JSON.stringify(pageBlockHidden))
      localStorage.setItem(PAGE_LAYOUT_MODE_KEY, pageLayoutMode)
      localStorage.setItem(PAGE_LAYOUT_EDIT_KEY, JSON.stringify(pageLayoutEdit))
      localStorage.setItem(PAGE_BLOCK_RECTS_KEY, JSON.stringify(pageBlockRects))
    } catch {
      /* ignore */
    }
  }, [pageBlockOrder, pageBlockHidden, pageLayoutMode, pageLayoutEdit, pageBlockRects, PAGE_LAYOUT_MODE_KEY, PAGE_LAYOUT_EDIT_KEY, PAGE_BLOCK_RECTS_KEY, PAGE_BLOCK_ORDER_KEY, PAGE_BLOCK_HIDDEN_KEY])




  useEffect(() => {
    if (showCreateModal && !selectedGroup && groups.length > 0) {
      setSelectedGroup(groups[0])
    }
  }, [showCreateModal, selectedGroup, groups])

  useEffect(() => {
    const raw = localStorage.getItem('tlLength')
    if (raw) {
      const n = parseInt(raw)
      if (!isNaN(n)) setTotalSeconds(n)
    }
  }, [])

  useEffect(() => {
    localStorage.setItem('tlLength', String(totalSeconds))
  }, [totalSeconds])

  useEffect(() => {
    const raw = localStorage.getItem('tlDefaultSkillLevels')
    if (raw) {
      try {
        setDefaultLevels(JSON.parse(raw))
      } catch {
        /* ignore */
      }
    }
  }, [])

  useEffect(() => {
    localStorage.setItem('tlDefaultSkillLevels', JSON.stringify(defaultLevels))
  }, [defaultLevels])

  useEffect(() => {
    const raw = localStorage.getItem('tlSkillColors')
    if (raw) {
      try {
        setSkillColors(JSON.parse(raw))
      } catch {
        /* ignore */
      }
    }
  }, [])

  useEffect(() => {
    localStorage.setItem('tlSkillColors', JSON.stringify(skillColors))
  }, [skillColors])

  useEffect(() => {
    const raw = localStorage.getItem('tlDefaultTargets')
    if (raw) {
      try {
        setDefaultTargets(JSON.parse(raw))
      } catch {
        /* ignore */
      }
    }
  }, [])

  useEffect(() => {
    localStorage.setItem('tlDefaultTargets', JSON.stringify(defaultTargets))
  }, [defaultTargets])

  useEffect(() => {
    const firstEnemy = rowStudents.findIndex((id) => id.startsWith('enemy:'))
    if (firstEnemy !== -1) {
      setDefaultTargets((prev) => {
        const attack =
          rowStudents[prev.attack]?.startsWith('enemy:') ? prev.attack : firstEnemy
        const debuff =
          rowStudents[prev.debuff]?.startsWith('enemy:') ? prev.debuff : firstEnemy
        if (attack === prev.attack && debuff === prev.debuff) return prev
        return { attack, debuff }
      })
    }
  }, [rowStudents])

  const getSnapshot = useCallback((): ProjectSnapshot => ({
    projectName,
    rowStudents: [...rowStudents],
    skills: skills.map((s) => ({ ...s })),
    markers: markers.map((m) => ({ ...m })),
    groupId: selectedGroup?.id ?? '',
    squadIndex,
  }), [projectName, rowStudents, skills, markers, selectedGroup, squadIndex])

  useEffect(() => {
    if (initialized) {
      prevSnapshot.current = getSnapshot()
    }
  }, [initialized, getSnapshot])

  useEffect(() => {
    if (!initialized || isRestoring.current) return
    const snap = getSnapshot()
    if (
      prevSnapshot.current &&
      JSON.stringify(prevSnapshot.current) !== JSON.stringify(snap)
    ) {
      const prev = prevSnapshot.current
      undoStack.current.push(prev)
      if (undoStack.current.length > 200) undoStack.current.shift()
      redoStack.current = []

      // (3) 履歴ログ（プロモード時のみ）
      if (proMode) {
        const summary =
          prev.skills.length !== snap.skills.length
            ? snap.skills.length > prev.skills.length
              ? 'スキル追加'
              : 'スキル削除'
            : prev.markers.length !== snap.markers.length
              ? snap.markers.length > prev.markers.length
                ? 'イベント追加'
                : 'イベント削除'
              : '編集'
        setHistoryLog((list) =>
          [...list, { id: Date.now(), at: new Date().toLocaleTimeString(), summary }].slice(-200)
        )
      }
    }
    prevSnapshot.current = snap
  }, [projectName, rowStudents, skills, markers, selectedGroup, squadIndex, initialized, getSnapshot, proMode])

  const hidePopups = () => {
    if (menuInfo) setMenuInfo(null)
    if (eventMenu) setEventMenu(null)
    setMarkers((prev) => prev.map((m) => (m.show ? { ...m, show: false } : m)))
    setSkills((prev) => prev.map((s) => (s.show ? { ...s, show: false } : s)))
    setShowEditMenu(false)
    setSelected([])
    if (playheadMenu) setPlayheadMenu(null)
    if (buffMenu) setBuffMenu(null)
    if (buffPopup) setBuffPopup(null)
    if (skillPopup) setSkillPopup(null)
    if (moveModeSkill !== null) setMoveModeSkill(null)
    setShowMenu(false)
    setShowTools(false)
    setShowSquadMenu(false)
    setShowGroupMenu(false)
    setShowSettings(false)
    setShowFileMenu(false)
  }

  const closeMenus = () => {
    setShowMenu(false)
    setShowEditMenu(false)
    setShowTools(false)
    setShowFileMenu(false)
    setShowSquadMenu(false)
    setShowGroupMenu(false)
    setShowSettings(false)
    if (buffMenu) setBuffMenu(null)
    if (buffPopup) setBuffPopup(null)
    if (skillPopup) setSkillPopup(null)
    if (moveModeSkill !== null) setMoveModeSkill(null)
  }

  const addRow = () => setRowStudents((prev) => [...prev, ''])

  const addEnemyRow = (enemyId: string) => {
    const idx = rowStudents.length
    setRowStudents((prev) => [...prev, `enemy:${enemyId}`])
    const enemy = enemies.find((e) => e.id === enemyId)
    if (!enemy || !enemy.attackOrder) return
    const now = Date.now()
    const events = enemy.attackOrder.map((a, i) => {
      const info = enemy.skills?.[a.skill]
      const dur = info?.duration ?? 1
      const label = info?.name || a.skill
      return {
        id: now + i,
        row: idx,
        start: snapTime(a.time),
        end: snapTime(a.time + dur),
        label,
        type: 'attack',
      }
    })
    if (events.length) setSkills((prev) => [...prev, ...events])
  }

  const addNormalSkills = (members: string[]) => {
    const now = Date.now()
    const events: SkillEvent[] = []
    members.forEach((id, idx) => {
      const st = students.find((s) => s.id === id)
      if (!st || !st.normalInterval) return
      const interval = st.normalInterval
      const dur = st.normalDuration || 0
      const travel = st.normalHitDelay || 0
      const motion = st.normalMotionDuration || 0
      for (let t = interval; t < totalSeconds; t += interval) {
        let start = snapTime(t)
        let end = snapTime(t + dur)
        skills.forEach((ev) => {
          if (ev.row === idx && ev.type === 'ex') {
            const motionEnd = snapTime(
              ev.start + (ev.travel || 0) + (ev.motion || 0)
            )
            if (start >= ev.start && start < motionEnd) {
              const delta = motionEnd - start
              start = motionEnd
              end = snapTime(end + delta)
            }
          }
        })
        if (start >= totalSeconds) continue
        events.push({
          id: now + events.length,
          row: idx,
          start,
          end,
          label: st.skills?.normal?.title || 'NS',
          travel,
          motion,
          type: 'normal',
        })
      }
    })
    if (events.length) setSkills((prev) => [...prev, ...events])
  }

  const removeRow = (idx: number) => {
    setRowStudents((prev) => prev.filter((_, i) => i !== idx))
    setSkills((prev) =>
      prev
        .filter((ev) => ev.row !== idx)
        .map((ev) => ({ ...ev, row: ev.row > idx ? ev.row - 1 : ev.row }))
    )
  }

  const removeSkill = (id: number) => {
    setSkills((prev) => prev.filter((ev) => ev.id !== id))
  }

  const removeMarker = (id: number) => {
    setMarkers((prev) => prev.filter((m) => m.id !== id))
  }

  const applyMembers = (members: string[]) => {
    setRowStudents(members.concat(Array(Math.max(0, 6 - members.length)).fill('')))
  }

  const importSquad = (members: string[]) => {
    setSkills([])
    setMarkers([])
    applyMembers(members)
    addNormalSkills(members)
    setShowImport(false)
  }

  const projectKey = (gid: string | null, idx: number) =>
    gid ? `tlMakerProject_${gid}_${idx}` : 'tlMakerProject_default'

  const loadProject = (
    gid: string | null,
    idx: number,
    fallbackMembers?: string[]
  ) => {
    const saved = localStorage.getItem(projectKey(gid, idx))
    if (!saved) {
      if (fallbackMembers) {
        applyMembers(fallbackMembers)
        setTlStats({})
      }
      return false
    }
    try {
      const data = JSON.parse(saved) as {
        projectName: string
        rowStudents: string[]
        skills: SkillEvent[]
        markers: MarkerEvent[]
      }
      setProjectName(data.projectName)
      setSkills(data.skills || [])
      setMarkers(data.markers || [])
      applyMembers(data.rowStudents || fallbackMembers || [])
      setTlStats({})
      return true
    } catch {
      if (fallbackMembers) applyMembers(fallbackMembers)
      return false
    }
  }

  const saveProject = () => {
    const key = projectKey(selectedGroup?.id ?? null, squadIndex)
    const data = {
      projectName,
      rowStudents,
      skills,
      markers,
    }
    localStorage.setItem(key, JSON.stringify(data))
    localStorage.setItem('tlMakerCache', JSON.stringify({
      projectName,
      groupId: selectedGroup?.id ?? '',
      squadIndex,
      rowStudents,
      skills,
      markers,
    }))
    localStorage.setItem('tlMakerLastKey', key)
  }

  const downloadProject = (withStats = false) => {
    const data: Record<string, unknown> = {
      projectName,
      rowStudents,
      skills,
      markers,
      groupId: selectedGroup?.id ?? '',
      squadIndex,
    }
    if (withStats) {
      const stats: Record<string, UserStudent> = {}
      rowStudents.forEach((id) => {
        if (!id || id.startsWith('enemy:')) return
        const st = students.find((s) => s.id === id)
        const base = st?.styleOf || st?.altOf || st?.id || id
        const stat = getStats(id)
        if (stat) stats[base] = stat
      })
      data.userStats = stats
    }
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${projectName || 'timeline'}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const undo = () => {
    const snap = undoStack.current.pop()
    if (!snap) return
    redoStack.current.push(getSnapshot())
    restoreSnapshot(snap)
  }

  const redo = () => {
    const snap = redoStack.current.pop()
    if (!snap) return
    undoStack.current.push(getSnapshot())
    restoreSnapshot(snap)
  }

  const restoreSnapshot = (snap: ProjectSnapshot) => {
    isRestoring.current = true
    setProjectName(snap.projectName)
    setRowStudents([...snap.rowStudents])
    setSkills(snap.skills.map((s) => ({ ...s })))
    setMarkers(snap.markers.map((m) => ({ ...m })))
    const g = groups.find((gr) => gr.id === snap.groupId) || null
    setSelectedGroup(g)
    setSquadIndex(snap.squadIndex)
    prevSnapshot.current = snap
    setTimeout(() => {
      prevSnapshot.current = getSnapshot()
      isRestoring.current = false
    })
  }

  const switchSquad = (index: number) => {
  if (!selectedGroup) return

  const sq = selectedGroup.squads[index]
  if (!sq) return

  const members = [...sq.strikers, ...sq.specials]

  // 状態を一旦クリア
  setSkills([])
  setMarkers([])

  // 保存済みTLがあればロード、なければ初期化
  const loaded = loadProject(selectedGroup.id, index, members)
  if (!loaded) {
    addNormalSkills(members)
  }

  setSquadIndex(index)
}


  useEffect(() => {
    const loadStudents = async () => {
      try {
        const res = await fetch('/api/students')
        if (res.ok) setStudents(await res.json())
      } catch {
        /* ignore */
      }
    }
    const loadEvents = async () => {
      try {
        const res = await fetch('/api/events')
        if (res.ok) setEventTemplates(await res.json())
      } catch {
        /* ignore */
      }
    }
    const loadEnemies = async () => {
      try {
        const res = await fetch('/api/enemies')
        if (res.ok) setEnemies(await res.json())
      } catch {
        /* ignore */
      }
    }
    loadStudents()
    loadEvents()
    loadEnemies()
    const map: Record<string, UserStudent> = {}
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith('userStudent:')) {
        const id = key.substring('userStudent:'.length)
        const val = localStorage.getItem(key)
        if (val) {
          try {
            map[id] = JSON.parse(val) as UserStudent
          } catch {
            /* ignore */
          }
        }
      }
    }
    setUserStats(map)
    const raw = localStorage.getItem('squadGroups')
    let parsed: SquadGroup[] = []
    if (raw) {
      try {
        parsed = JSON.parse(raw) as SquadGroup[]
        setGroups(parsed)
        const list: { name: string; members: string[] }[] = []
        parsed.forEach((g) => {
          g.squads.forEach((sq, idx) => {
            list.push({ name: `${g.name} #${idx + 1}`, members: [...sq.strikers, ...sq.specials] })
          })
        })
        setSquads(list)
      } catch {
        /* ignore */
      }
    }
    const lastKey = localStorage.getItem('tlMakerLastKey')
    if (lastKey) {
      const m = lastKey.match(/^tlMakerProject_(.+)_(\d+)$/)
      const gid = m ? m[1] : null
      const idx = m ? parseInt(m[2]) : 0
      const g = gid ? parsed.find((gr) => gr.id === gid) || null : null
      setSelectedGroup(g)
      setSquadIndex(idx)
      const members = g ? [...g.squads[idx].strikers, ...g.squads[idx].specials] : Array(6).fill('')
      const loaded = loadProject(gid, idx, members)
      if (!loaded) addNormalSkills(members)
      setInitialized(true)
    } else if (localStorage.getItem('tlMakerCache')) {
      setHasCache(true)
    }
  }, [])

  useEffect(() => {
    if (selectedType === 'event') {
      const tpl = allEventTemplates.find((t) => t.id === templateId)
      if (tpl) {
        setLabel(tpl.label)
      }
    }
  }, [templateId, selectedType, allEventTemplates])

  useEffect(() => {
    if (!initialized || !selectedGroup) return
    if (rowStudents.every((id) => id === '') && selectedGroup.squads.length > 0) {
      switchSquad(0)
    }
  }, [initialized, selectedGroup])

  useEffect(() => {
    if (selectedType !== 'skill') return
    const st = students.find((s) => s.id === rowStudents[row])
    if (!st) return
    const dur =
      skillKind === 'ex' ? st.exDuration : st.normalDuration
    if (dur !== undefined) {
      const travel =
        skillKind === 'ex'
          ? st.exHitDelay || 0
          : st.normalHitDelay || 0
      const extra = applyTravel ? 0 : travel
      setEnd(snapTime(start + dur + extra))
    }
  }, [row, start, selectedType, rowStudents, students, applyTravel, skillKind])

  useEffect(() => {
  if (!initialized || isRestoring.current) return
  saveProject()
}, [initialized, projectName, selectedGroup, squadIndex, rowStudents, skills, markers])


  const INITIAL_COST = 0
  const MAX_COST = 10

  function calcCost(t: number) {
  // 🔒 初期化ガード
  if (!initialized || students.length === 0 || rowStudents.length === 0) {
    return 0
  }

  const members = rowStudents.filter(
    (id) => id && !id.startsWith('enemy:')
  ).length

  const recoveryTime = Math.max(0, t - 2)
  let recovery = 0.07 * members * recoveryTime

  rowStudents.forEach((id) => {
    if (!id || id.startsWith('enemy:')) return
    const st = students.find((s) => s.id === id)
    if (!st) return

    if (st.role === 'SPECIAL') {
      const val = st.skills?.sub?.values?.cost
      if (val) {
        const stats = getStats(id)
        const level = stats?.sub_skill ?? defaultLevels.sub
        const buff = val[level - 1]
        if (buff !== undefined) recovery *= 1 + buff / 100
      }
    }
  })

  let spent = 0
  skills
    .filter((ev) => ev.type === 'ex' && ev.start <= t)
    .forEach((ev) => {
      const rowId = rowStudents[ev.row]
      if (!rowId || rowId.startsWith('enemy:')) return
      const st = students.find((s) => s.id === rowId)
      if (!st) return
      spent += st.cost || 0
    })

  return Math.min(MAX_COST, INITIAL_COST + recovery - spent)
}



  const addEvent = () => {
    const id = Date.now()
    if (selectedType === 'skill') {
      const st = students.find((s) => s.id === rowStudents[row])
      const travel =
        skillKind === 'ex'
          ? st?.exHitDelay || 0
          : st?.normalHitDelay || 0
      const duration = end - start
      let s = snapTime(applyTravel ? start - travel : start)
      let e = snapTime(start + duration)
      const motion =
        skillKind === 'ex'
          ? Math.max(0, (st?.exMotionDuration || 0) - travel)
          : Math.max(0, (st?.normalMotionDuration || 0) - travel)
      if (skillKind === 'ex' && waitCost && st?.cost) {
        let t = s
        if (calcCost(t) < st.cost) {
          while (t <= totalSeconds) {
            if (calcCost(t) >= st.cost) break
            t = snapTime(t + 0.1)
          }
          if (t !== s) {
            const delta = t - s
            s = t
            e = snapTime(e + delta)
          }
        } else {
          while (t >= 0) {
            const prev = snapTime(t - 0.1)
            if (prev < 0 || calcCost(prev) < st.cost) break
            t = prev
          }
          if (t !== s) {
            const delta = s - t
            s = t
            e = snapTime(e - delta)
          }
        }
      }
      if (skillKind === 'normal') {
        skills.forEach((ev) => {
          if (ev.row === row && ev.type === 'ex') {
            const motionEnd = snapTime(
              ev.start + (ev.travel || 0) + (ev.motion || 0)
            )
            if (s >= ev.start && s < motionEnd) {
              const delta = motionEnd - s
              s = motionEnd
              e = snapTime(e + delta)
            }
          }
        })
      }
      if (e <= s) return
      const lbl =
        label ||
        (skillKind === 'ex'
          ? st?.skills?.ex?.title
          : st?.skills?.normal?.title) ||
        ''
      let target: number | undefined
      const skillType =
        skillKind === 'ex' ? st?.skills?.ex?.type : st?.skills?.normal?.type
      if (skillType === 'attack') target = defaultTargets.attack
      if (skillType === 'debuff') target = defaultTargets.debuff
      setSkills([
        ...skills,
        {
          id,
          row,
          start: s,
          end: e,
          label: lbl,
          travel,
          motion,
          type: skillKind,
          ...(target !== undefined ? { target } : {}),
        },
      ])
    } else if (selectedType === 'event') {
      const tpl = allEventTemplates.find((t) => t.id === templateId)
      setMarkers([
        ...markers,
        {
          id,
          time: snapTime(start),
          label: label || tpl?.label || '',
          duration: tpl?.duration ?? 0,
          skillable: tpl?.skillable ?? false,
        },
      ])
    }
    setLabel('')
    setShowForm(false)
    setSelectedType(null)
  }

  const rowHeight = 42 // px
  const rows = rowStudents.length

  const currentCost = useMemo(() => {
  if (!initialized) return 0
  return calcCost(playhead)
}, [initialized, calcCost, playhead])

  const dangerSkills = useMemo(() => {
    if (!initialized) return new Set<number>()

    const set = new Set<number>()
    skills
      .filter((ev) => ev.type === 'ex')
      .forEach((ev) => {
        const rowId = rowStudents[ev.row]
        if (!rowId) return
        if (rowId.startsWith('enemy:')) return
        const st = students.find((s) => s.id === rowId)
        const need = st?.cost ?? 0
        if (need <= 0) return
        if (calcCost(ev.start) < need) set.add(ev.id)
      })

    return set
  }, [initialized, skills, calcCost, rowStudents, students])



  const formatRemain = (t: number) => {
    const clamped = Math.max(0, t)
    const m = Math.floor(clamped / 60)
    const s = clamped - m * 60
    const str = s.toFixed(3).padStart(6, '0')
    return `${m}:${str}`
  }

  
  const selectedSkillIds = useMemo(() => {
    return new Set(selected.filter((s) => s.type === 'skill').map((s) => s.id))
  }, [selected])

  // (2) 整列（同一行・複数選択のスキルに対して実行）
  const alignSelectedSkills = (mode: 'left' | 'pack' | 'even') => {
    const picked = skills
      .filter((ev) => selectedSkillIds.has(ev.id))
      .sort((a, b) => a.start - b.start)

    if (picked.length < 2) return

    const row = picked[0].row
    if (picked.some((ev) => ev.row !== row)) return

    const durations = new Map<number, number>()
    picked.forEach((ev) => durations.set(ev.id, ev.end - ev.start))

    if (mode === 'left') {
      const base = picked[0].start
      setSkills((prev) =>
        prev.map((ev) => {
          if (!selectedSkillIds.has(ev.id)) return ev
          const d = durations.get(ev.id) ?? (ev.end - ev.start)
          return { ...ev, start: snapTime(base), end: snapTime(base + d) }
        })
      )
      return
    }

    if (mode === 'pack') {
      let t = picked[0].start
      const nextStart = new Map<number, number>()
      picked.forEach((ev) => {
        nextStart.set(ev.id, t)
        t = snapTime(t + (durations.get(ev.id) ?? (ev.end - ev.start)))
      })

      setSkills((prev) =>
        prev.map((ev) => {
          if (!selectedSkillIds.has(ev.id)) return ev
          const s = nextStart.get(ev.id)
          if (s == null) return ev
          const d = durations.get(ev.id) ?? (ev.end - ev.start)
          return { ...ev, start: snapTime(s), end: snapTime(s + d) }
        })
      )
      return
    }

    // even
    const min = picked[0].start
    const max = picked[picked.length - 1].start
    const step = (max - min) / (picked.length - 1)

    const nextStart = new Map<number, number>()
    picked.forEach((ev, i) => nextStart.set(ev.id, snapTime(min + step * i)))

    setSkills((prev) =>
      prev.map((ev) => {
        if (!selectedSkillIds.has(ev.id)) return ev
        const s = nextStart.get(ev.id)
        if (s == null) return ev
        const d = durations.get(ev.id) ?? (ev.end - ev.start)
        return { ...ev, start: snapTime(s), end: snapTime(s + d) }
      })
    )
  }

  
  const sanitizePluginStyle = useCallback((raw?: Record<string, string | number>) => {
    if (!raw) return {}
    const out: Record<string, string | number> = {}
    // 位置やサイズは基本側で固定（レイアウト崩壊を避ける）
    const blocked = new Set(['left', 'top', 'right', 'bottom', 'width', 'height', 'position', 'transform', 'zIndex'])
    for (const [k, v] of Object.entries(raw)) {
      if (blocked.has(k)) continue
      out[k] = v
    }
    return out
  }, [])

  const getPluginDecorForSkill = useCallback(
    (ev: SkillEvent) => {
      let addClass = ''
      const style: Record<string, string | number> = {}
      let hide = false
      for (const r of pluginStyleRules) {
        if (r.target !== 'skill') continue
        if (r.skillType && r.skillType !== ev.type) continue
        if (typeof r.row === 'number' && r.row !== ev.row) continue
        if (r.labelIncludes && !String(ev.label ?? '').includes(r.labelIncludes)) continue
        if (r.addClass) addClass += (addClass ? ' ' : '') + r.addClass
        if (r.style) Object.assign(style, sanitizePluginStyle(r.style))
        if (r.hide) hide = true
      }
      return { addClass, style, hide }
    },
    [pluginStyleRules, sanitizePluginStyle]
  )

  const getPluginDecorForMarker = useCallback(
    (m: MarkerEvent) => {
      let addClass = ''
      const style: Record<string, string | number> = {}
      let hide = false
      for (const r of pluginStyleRules) {
        if (r.target !== 'marker') continue
        if (typeof r.row === 'number') continue // marker には row が無いので無視
        if (r.labelIncludes && !String(m.label ?? '').includes(r.labelIncludes)) continue
        if (r.addClass) addClass += (addClass ? ' ' : '') + r.addClass
        if (r.style) Object.assign(style, sanitizePluginStyle(r.style))
        if (r.hide) hide = true
      }
      return { addClass, style, hide }
    },
    [pluginStyleRules, sanitizePluginStyle]
  )

  const snapTime = useCallback(
    (t: number) => {
      // snapPreset は localStorage に保存（設定で変更可）
      if (snapPreset === 'off') return parseFloat(t.toFixed(3))
      if (snapPreset === '0.5') return parseFloat((Math.round(t / 0.5) * 0.5).toFixed(3))
      if (snapPreset === '0.1') return parseFloat((Math.round(t * 10) / 10).toFixed(3))
      if (snapPreset === '0.05') return parseFloat((Math.round(t / 0.05) * 0.05).toFixed(3))

      // 0.033（≒30fps）: 0.0 / 0.033 / 0.066 / 0.1 / ... にスナップ
      const n = Math.round(t * 30)
      const group = Math.floor(n / 3)
      const offsetIndex = n % 3
      const offset = offsetIndex === 1 ? 0.033 : offsetIndex === 2 ? 0.066 : 0
      return parseFloat((group * 0.1 + offset).toFixed(3))
    },
    [snapPreset]
  )

  const runPluginActions = useCallback(
    (actions: unknown, ownerPluginId?: string) => {
      const list: unknown[] = Array.isArray(actions) ? actions : []
      if (list.length === 0) return

      const selectedSkillIds = new Set(
        selected.filter((x) => x.type === 'skill').map((x) => x.id)
      )
      const selectedMarkerIds = new Set(
        selected.filter((x) => x.type === 'marker').map((x) => x.id)
      )

      const matchScope = (scope: unknown, t: 'skill' | 'marker') => {
        if (scope == null || scope === 'all') return true
        return scope === t
      }

      const newSkills: SkillEvent[] = []
      const newMarkers: MarkerEvent[] = []
      let seq = Date.now()

      for (const a of list) {
        if (!isRecord(a)) continue


        if (a.type === 'openWindow') {
          const windowId = typeof a.windowId === 'string' ? a.windowId : ''
          if (!windowId || !ownerPluginId) continue
          const target = a.target === 'dockBottom' ? 'dockBottom' : 'modal'
          if (target === 'dockBottom') setDockPluginWindow({ pluginId: ownerPluginId, windowId })
          else setOpenPluginWindow({ pluginId: ownerPluginId, windowId })
          continue
        }

        if (a.type === 'addMarker') {
          const time = typeof a.time === 'number' ? snapTime(a.time) : 0
          const label = typeof a.label === 'string' ? a.label : ''
          if (!label) continue
          const duration = typeof a.duration === 'number' && Number.isFinite(a.duration) ? a.duration : 1
          const skillable = typeof a.skillable === 'boolean' ? a.skillable : false
          newMarkers.push({
            id: seq++,
            time,
            label,
            duration,
            skillable,
          })
          continue
        }

        if (a.type === 'addSkill') {
          const row = typeof a.row === 'number' && Number.isFinite(a.row) ? a.row : 0
          const start = typeof a.start === 'number' ? snapTime(a.start) : 0
          const label = typeof a.label === 'string' ? a.label : ''
          if (!label) continue

          const skillType: 'ex' | 'normal' | 'other' =
            a.skillType === 'ex' || a.skillType === 'normal' || a.skillType === 'other'
              ? a.skillType
              : 'other'

          const safeRow = Math.max(0, Math.min(rowStudents.length - 1, row))
          const rowId = rowStudents[safeRow]
          const st = rowId ? students.find((s) => s.id === rowId) : undefined
          const defaultDur =
            skillType === 'ex'
              ? st?.exDuration ?? 1
              : skillType === 'normal'
                ? st?.normalDuration ?? 1
                : 1

          const end =
            typeof a.end === 'number'
              ? snapTime(a.end)
              : snapTime(start + (typeof a.duration === 'number' && Number.isFinite(a.duration) ? a.duration : defaultDur))

          newSkills.push({
            id: seq++,
            row: safeRow,
            start,
            end,
            label,
            type: skillType,
          })
          continue
        }

        if (a.type === 'alignSelected') {
          const mode = a.mode
          if (mode === 'left' || mode === 'pack' || mode === 'even') alignSelectedSkills(mode)
          continue
        }

        if (a.type === 'deleteSelected') {
          const scope = a.scope
          if (matchScope(scope, 'skill') && selectedSkillIds.size) {
            setSkills((prev) => prev.filter((s) => !selectedSkillIds.has(s.id)))
          }
          if (matchScope(scope, 'marker') && selectedMarkerIds.size) {
            setMarkers((prev) => prev.filter((m) => !selectedMarkerIds.has(m.id)))
          }
          setSelected([])
          continue
        }

        if (a.type === 'duplicateSelected') {
          const offset = typeof a.offset === 'number' && Number.isFinite(a.offset) ? a.offset : 0
          const scope = a.scope
          if (matchScope(scope, 'skill') && selectedSkillIds.size) {
            setSkills((prev) => {
              const clones = prev
                .filter((s) => selectedSkillIds.has(s.id))
                .map((s) => ({
                  ...s,
                  id: seq++,
                  start: snapTime(s.start + offset),
                  end: snapTime(s.end + offset),
                }))
              return clones.length ? [...prev, ...clones] : prev
            })
          }
          if (matchScope(scope, 'marker') && selectedMarkerIds.size) {
            setMarkers((prev) => {
              const clones = prev
                .filter((m) => selectedMarkerIds.has(m.id))
                .map((m) => ({
                  ...m,
                  id: seq++,
                  time: snapTime(m.time + offset),
                }))
              return clones.length ? [...prev, ...clones] : prev
            })
          }
          continue
        }

        if (a.type === 'offsetSelected') {
          const delta = typeof a.delta === 'number' && Number.isFinite(a.delta) ? a.delta : 0
          const scope = a.scope
          if (matchScope(scope, 'skill') && selectedSkillIds.size) {
            setSkills((prev) =>
              prev.map((s) =>
                selectedSkillIds.has(s.id)
                  ? { ...s, start: snapTime(s.start + delta), end: snapTime(s.end + delta) }
                  : s
              )
            )
          }
          if (matchScope(scope, 'marker') && selectedMarkerIds.size) {
            setMarkers((prev) =>
              prev.map((m) => (selectedMarkerIds.has(m.id) ? { ...m, time: snapTime(m.time + delta) } : m))
            )
          }
          continue
        }

        if (a.type === 'setSelectedLabel') {
          const label = typeof a.label === 'string' ? a.label : ''
          if (!label) continue
          const scope = a.scope
          if (matchScope(scope, 'skill') && selectedSkillIds.size) {
            setSkills((prev) => prev.map((s) => (selectedSkillIds.has(s.id) ? { ...s, label } : s)))
          }
          if (matchScope(scope, 'marker') && selectedMarkerIds.size) {
            setMarkers((prev) => prev.map((m) => (selectedMarkerIds.has(m.id) ? { ...m, label } : m)))
          }
          continue
        }

        if (a.type === 'setSelectedRow') {
          const row = typeof a.row === 'number' && Number.isFinite(a.row) ? a.row : 0
          const safeRow = Math.max(0, Math.min(rowStudents.length - 1, row))
          if (selectedSkillIds.size) {
            setSkills((prev) => prev.map((s) => (selectedSkillIds.has(s.id) ? { ...s, row: safeRow } : s)))
          }
          continue
        }
      }

      if (newSkills.length) setSkills((prev) => [...prev, ...newSkills])
      if (newMarkers.length) setMarkers((prev) => [...prev, ...newMarkers])
    },
    [alignSelectedSkills, rowStudents, students, snapTime, selected]
  )

  const runPluginMacro = useCallback(
    (macro: ResolvedMacro) => {
      runPluginActions(macro?.actions, macro?.pluginId)
    },
    [runPluginActions]
  )

  const runPluginToolButton = useCallback(
    (btn: ResolvedToolButton) => {
      if (btn.proOnly && !proMode) return
      if (btn.confirm) {
        const ok = window.confirm(btn.confirm)
        if (!ok) return
      }
      if (btn.macroId) {
        const macro = pluginMacros.find((m) => m.pluginId === btn.pluginId && m.id === btn.macroId)
        if (macro) {
          runPluginMacro(macro)
          return
        }
      }
      if (btn.actions && Array.isArray(btn.actions)) {
        runPluginActions(btn.actions, btn.pluginId)
      }
    },
    [pluginMacros, proMode, runPluginActions, runPluginMacro]
  )



  const exTimelineText = useMemo(() => {
  if (!initialized) return []

  return skills
    .filter((ev) => ev.type === 'ex')
    .sort((a, b) => a.start - b.start)
    .map((ev) => {
      const rowId = rowStudents[ev.row]
      if (!rowId) return ''

      const st = students.find((s) => s.id === rowId)
      if (!st) return ''

      const baseCost = st.cost ?? 0
      const before = Math.min(MAX_COST, calcCost(ev.start) + baseCost)
      return `${formatRemain(ev.start)}(${before.toFixed(2)}cost) ${st.name}`
    })
}, [initialized, skills, students, rowStudents, calcCost])


  useEffect(() => {
  if (!initialized) return
  if (showTextTL) setTextTL(exTimelineText.join('\n'))
}, [initialized, exTimelineText, showTextTL])


  const tickStep = timeScale >= 180 ? 0.1 : timeScale >= 40 ? 0.5 : 1
  const labelStep =
    tickStep < 1 ? tickStep : timeScale < 20 ? 5 : 1



  const toRgba = (hex: string, alpha: number) => {
    const r = parseInt(hex.slice(1, 3), 16)
    const g = parseInt(hex.slice(3, 5), 16)
    const b = parseInt(hex.slice(5, 7), 16)
    return `rgba(${r}, ${g}, ${b}, ${alpha})`
  }

  function formatSkillText(
  skill: { text?: string; values?: Record<string, number[]> } | undefined,
  level: number
) {
  if (!skill?.text) return ''

  // {key} と {{key}} の両方を置換する
  return skill.text.replace(/\{\{?(\w+)\}?\}/g, (matched, key) => {
    const arr = skill.values?.[key]
    if (!Array.isArray(arr)) return matched

    const idx = Math.min(Math.max(level - 1, 0), arr.length - 1)
    const val = arr[idx]
    return val !== undefined ? String(val) : matched
  })
}



  function getSkillLevel(
  type: 'ex' | 'normal',
  stats: UserStudent | undefined
) {
  if (type === 'normal') return stats?.normal_skill ?? defaultLevels.normal
  return stats?.ex_skill ?? defaultLevels.ex
}


  function getStats(id: string): UserStudent | undefined {
  const st = students.find((s) => s.id === id)

  const candidates = [
    st?.id,        // ← まず「自分自身」
    st?.styleOf,   // ← 次に共有元
    st?.altOf,
    id,
  ].filter(Boolean) as string[]

  for (const key of candidates) {
    if (tlStats[key]) return tlStats[key]
    if (userStats[key]) return userStats[key]

    // 最終フォールバック：localStorage直読み
    try {
      const raw = localStorage.getItem(`userStudent:${key}`)
      if (raw) return JSON.parse(raw)
    } catch {}
  }

  return undefined
}


function loadUserStatsFromLocalStorage(): Record<string, UserStudent> {
  const result: Record<string, UserStudent> = {}

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (!key || !key.startsWith('userStudent:')) continue

    try {
      const id = key.replace('userStudent:', '')
      const data = JSON.parse(localStorage.getItem(key) || 'null')
      if (data) result[id] = data
    } catch {}
  }

  return result
}

function sumSpecialSub(
    rowStudents: string[],
    key: string
  ): number {
    let sum = 0

    rowStudents.forEach((id) => {
      if (!id || id.startsWith('enemy:')) return

      const st = students.find((s) => s.id === id)
      if (!st || st.role !== 'SPECIAL') return

      const userStat = getStats(st.id)
      const subLevel = userStat?.sub_skill
      if (!subLevel || subLevel <= 0) return

      const baseId = st.styleOf || st.altOf || st.id
      const base = students.find((s) => s.id === baseId)
      if (!base) return

      const arr = st.skills?.sub?.values?.[key]
    if (!Array.isArray(arr)) return

      const idx = Math.min(subLevel - 1, arr.length - 1)
      sum += Number(arr[idx])
    })

    return sum
  }
  const getTimeFromClientX = (x: number) => {
    if (!containerRef.current) return 0
    const rect = containerRef.current.getBoundingClientRect()
    const pos = x - rect.left + containerRef.current.scrollLeft
    const clamped = Math.max(0, Math.min(pos, totalSeconds * timeScale))
    const t = clamped / timeScale
    return snapTime(t)
  }

  const isBuffSkill = (ev: SkillEvent) => {
    const st = students.find((s) => s.id === rowStudents[ev.row])
    if (!st || !st.skills) return false
    if (ev.type === 'ex' && st.skills.ex) {
      return st.skills.ex.type === 'buff'
    }
    if (ev.type === 'normal' && st.skills.normal) {
      return st.skills.normal.type === 'buff'
    }
    if (st.skills.ex && st.skills.ex.title === ev.label) {
      return st.skills.ex.type === 'buff'
    }
    const normalTitle = st.skills.normal?.title || 'NS'
    if (ev.label === normalTitle) {
      return st.skills.normal?.type === 'buff'
    }
    return false
  }

  const getSkillType = (ev: SkillEvent): string | undefined => {
    const rowId = rowStudents[ev.row]
    if (rowId.startsWith('enemy:')) {
      return ev.type
    }
    const st = students.find((s) => s.id === rowId)
    if (!st || !st.skills) return undefined
    if (ev.type === 'ex') return st.skills.ex?.type
    if (ev.type === 'normal') return st.skills.normal?.type
    return ev.type
  }

  const isTargetableSkill = (ev: SkillEvent) => {
    const t = getSkillType(ev)
    return t === 'buff' || t === 'attack' || t === 'debuff'
  }

  const getEffectiveTarget = (ev: SkillEvent) => {
    if (ev.target !== undefined) return ev.target
    const t = getSkillType(ev)
    if (t === 'attack') return defaultTargets.attack
    if (t === 'debuff') return defaultTargets.debuff
    return ev.row
  }

  const getActiveBuffs = (rowIdx: number, t: number) => {
    return skills
      .filter((ev) => isBuffSkill(ev))
      .filter((ev) => {
        const target = getEffectiveTarget(ev)
        if (target !== rowIdx) return false
        const start = ev.start + (ev.travel || 0)
        return start <= t && t <= ev.end
      })
      .map((ev) => {
        const st = students.find((s) => s.id === rowStudents[ev.row])
        const stats = getStats(rowStudents[ev.row])
        const level = getSkillLevel(ev.type as 'ex' | 'normal', stats)
        const skill =
          ev.type === 'normal'
            ? st?.skills?.normal
            : st?.skills?.ex
        const text = formatSkillText(skill, level)
        return text ? `${ev.label}: ${text}` : ev.label
      })
  }

  const getExBuffMultiplier = (rowIdx: number, t: number) => {
    let bonus = 0
    skills
      .filter((ev) => isBuffSkill(ev))
      .forEach((ev) => {
        const target = getEffectiveTarget(ev)
        if (target !== rowIdx) return
        const start = ev.start + (ev.travel || 0)
        if (start <= t && t <= ev.end) {
          const st = students.find((s) => s.id === rowStudents[ev.row])
          const stats = getStats(rowStudents[ev.row])
          const level = getSkillLevel(ev.type as 'ex' | 'normal', stats)
          const skill =
            ev.type === 'normal'
              ? st?.skills?.normal
              : st?.skills?.ex
          const val = skill?.values?.ex?.[level - 1]
          if (val) bonus += Number(val)
        }
      })
    return (10000 + bonus * 100) / 10000
  }
  const getBuffBonus = (
  rowIdx: number,
  t: number,
  key: 'ex' | 'attack' | 'type' | 'critdamage'
) => {
  let bonus = 0

  skills
    .filter((ev) => isBuffSkill(ev))
    .forEach((ev) => {
      const target = getEffectiveTarget(ev)
      if (target !== rowIdx) return

      const start = ev.start + (ev.travel || 0)
      if (!(start <= t && t <= ev.end)) return

      const st = students.find((s) => s.id === rowStudents[ev.row])
      const stats = getStats(rowStudents[ev.row])
      const level = getSkillLevel(ev.type as 'ex' | 'normal', stats)

      const skill =
        ev.type === 'normal'
          ? st?.skills?.normal
          : st?.skills?.ex

      const arr = skill?.values?.[key]
      const val = arr?.[level - 1]

      if (val !== undefined) {
        bonus += Number(val)
      }
    })

  return bonus
}
type EquipBonus = {
  attackMul: number // %系（合計。例: 0.45 = 45%）
  attackAdd: number // 実数加算
  critDamage: number // 実数（いまの定義のまま）
}

type EquipPickMode = 'percent' | 'flat' | 'both'
type EquipmentTier = {
  tier: number
  attack?: number
  criticaldamage?: number
}

type EquipmentSlotDef = {
  tiers: EquipmentTier[]
}

type EquipmentJson = Record<string, EquipmentSlotDef>
const equipmentData: EquipmentJson = equipmentJson
type UserStatsWithEquip = UserStudent & {
  equipment?: Record<string, number>
} & LegacyEquipStats

type LegacyEquipStats = {
  equip1?: number
  equip2?: number
  equip3?: number
  equip4?: number
}


const getEquipTier = (
  stats: UserStatsWithEquip,
  slot: string
): number | undefined => {
  // 新形式
  if (stats.equipment?.[slot] !== undefined) {
    return stats.equipment[slot]
  }

  // 旧形式（完全型安全）
  switch (slot) {
    case 'slot1':
      return stats.equip1
    case 'slot2':
      return stats.equip2
    case 'slot3':
      return stats.equip3
    case 'accessory':
      return stats.equip4
    default:
      return undefined
  }
}

function typedEntries(
  obj: Record<string, string>
): Array<[string, string]> {
  return Object.entries(obj)
}



const getEquipmentBonus = (
  student: Student,
  stats: UserStatsWithEquip | undefined,
  mode: EquipPickMode = 'both'
): EquipBonus => {
  let attackMul = 0
  let attackAdd = 0
  let critDamage = 0

  const slots = student.equipmentSlots
if (!slots || !stats) {
  return { attackMul: 0, attackAdd: 0, critDamage: 0 }
}

typedEntries(slots).forEach(([slotKey, equipCategory]) => {
  const equipTier = getEquipTier(stats, slotKey)
  if (!equipTier) return

  const equipDef = equipmentData[equipCategory]
  if (!equipDef) return

  const tierDef = equipDef.tiers.find(t => t.tier === equipTier)
  if (!tierDef) return

  if (typeof tierDef.attack === 'number') {
    if (tierDef.attack < 10) {
      if (mode !== 'flat') attackMul += tierDef.attack
    } else {
      if (mode !== 'percent') attackAdd += tierDef.attack
    }
  }

  if (typeof tierDef.criticaldamage === 'number') {
    if (mode !== 'percent') critDamage += tierDef.criticaldamage
  }
})

  if (mode === 'percent') return { attackMul, attackAdd: 0, critDamage: 0 }
  if (mode === 'flat') return { attackMul: 0, attackAdd, critDamage }
  return { attackMul, attackAdd, critDamage }
}

type BuffPopup = {
  row: number
  x: number
  y: number
  buffs: string[]
  info: string[]
  studentId: string            // ★追加
  values?: Record<string, number[]> // ★追加（crit / attack / type）
}

const [buffPopup, setBuffPopup] = useState<BuffPopup | null>(null)


function resolveBuffText(
  text: string,
  studentId: string,
  values?: Record<string, number[]>
): string {
  if (!values) return text

  const userStat = getStats(studentId)
  if (!userStat) return text

  return text.replace(/\{(\w+)\}/g, (_, key) => {
    const arr = values[key]
    if (!Array.isArray(arr)) return `{${key}}`

    // ★ key に応じて参照するレベルを切り替え
    let level: number | undefined
    if (key === 'crit' || key === 'type' || key === 'attack') {
      level = userStat.sub_skill
    } else {
      level = userStat.passive_skill
    }

    if (!level || level <= 0) return `{${key}}`

    const idx = Math.min(level - 1, arr.length - 1)
    return String(arr[idx])
  })
}







  const getBlockOrder = useCallback(
    (key: string, fallback: number) => {
      const idx = pageBlockOrder.indexOf(key)
      return idx >= 0 ? idx : fallback
    },
    [pageBlockOrder]
  )

  const getBlockStyle = useCallback(
    (key: string, fallbackOrder: number, defaultWidth: number): CSSProperties => {
      if (pageBlockHidden[key]) return { display: 'none' }
      if (pageLayoutMode === 'free') {
        const r = pageBlockRects[key]
        if (!r) {
          return {
            position: 'absolute',
            left: 8,
            top: 8,
            width: defaultWidth,
            zIndex: 1,
          }
        }
        return {
          position: 'absolute',
          left: r.x,
          top: r.y,
          width: r.w,
          height: r.h,
          zIndex: r.z,
        }
      }
      return { order: getBlockOrder(key, fallbackOrder) }
    },
    [pageBlockHidden, pageLayoutMode, pageBlockRects, getBlockOrder]
  )

  const bringBlockToFront = useCallback(
    (key: string, defaultWidth: number, defaultHeight: number, fixedHeight?: number) => {
      setPageBlockRects((prev) => {
        const cur0 = prev[key]
        const maxZ0 = Object.values(prev).reduce((m, r) => Math.max(m, r?.z ?? 0), 0)
        const curZ0 = cur0?.z ?? 0
        const targetH = typeof fixedHeight === 'number' ? fixedHeight : cur0?.h

        // already on top and (if requested) already has fixed height
        if (cur0 && curZ0 >= maxZ0 && (typeof fixedHeight !== 'number' || cur0.h === targetH)) return prev

        // prevent z-index from growing without bound
        let next: Record<string, PageBlockRect> = prev
        if (maxZ0 >= 45) {
          const entries = Object.entries(prev)
            .filter(([, r]) => !!r)
            .sort((a, b) => (a[1]!.z ?? 0) - (b[1]!.z ?? 0) || a[0].localeCompare(b[0]))
          const normalized: Record<string, PageBlockRect> = { ...prev }
          let z = 1
          for (const [k, r] of entries) {
            if (!r) continue
            normalized[k] = { ...r, z }
            z += 1
          }
          next = normalized
        }

        const maxZ = Object.values(next).reduce((m, r) => Math.max(m, r?.z ?? 0), 0)
        const cur = next[key] ?? cur0
        const base: PageBlockRect =
          cur ??
          {
            x: 8,
            y: 8,
            w: defaultWidth,
            h: defaultHeight,
            z: 1,
          }
        const h = typeof fixedHeight === 'number' ? fixedHeight : base.h

        if (cur && cur.z >= maxZ && cur.h === h) return next

        return {
          ...next,
          [key]: { ...base, w: base.w ?? defaultWidth, h, z: maxZ + 1 },
        }
      })
    },
    [setPageBlockRects]
  )

  // free-layout の時はトップバーを常に最前面にする（開いた時に隠れないように）
  useEffect(() => {
    if (pageLayoutMode !== 'free') return
    bringBlockToFront(TOPBAR_KEY, 900, TOPBAR_HEIGHT, TOPBAR_HEIGHT)
  }, [pageLayoutMode, pageBlockRects, bringBlockToFront])



  const startDragBlock = useCallback(
    (e: React.PointerEvent, key: string, defaultWidth: number) => {
      if (pageLayoutMode !== 'free' || !pageLayoutEdit) return
      e.preventDefault()
      e.stopPropagation()

      const startX = e.clientX
      const startY = e.clientY

      const current = pageBlockRectsRef.current
      const base =
        current[key] ??
        {
          x: 8,
          y: 8,
          w: defaultWidth,
          h:
            key === TOPBAR_KEY
              ? TOPBAR_HEIGHT
              : Math.max(120, Math.round(blockRefs.current[key]?.getBoundingClientRect().height ?? 300)),
          z: 1,
        }
      const maxZ = Object.values(current).reduce((m, r) => Math.max(m, r?.z ?? 0), 0)
      const z = maxZ + 1

      setPageBlockRects((prev) => ({
        ...prev,
        [key]: { ...base, w: base.w ?? defaultWidth, z },
      }))

      const originX = base.x
      const originY = base.y

      const onMove = (ev: PointerEvent) => {
        const dx = ev.clientX - startX
        const dy = ev.clientY - startY
        setPageBlockRects((prev) => {
          const cur = prev[key] ?? { ...base, w: defaultWidth, z }
          return {
            ...prev,
            [key]: { ...cur, x: originX + dx, y: originY + dy, z },
          }
        })
      }

      const onUp = () => {
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
      }

      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
    },
    [pageLayoutMode, pageLayoutEdit]
  )


  const startResizeBlock = useCallback(
    (e: React.PointerEvent, key: string, defaultWidth: number, defaultHeight: number) => {
      if (pageLayoutMode !== 'free' || !pageLayoutEdit) return
      e.preventDefault()
      e.stopPropagation()

      const startX = e.clientX
      const startY = e.clientY

      const current = pageBlockRectsRef.current
      const el = blockRefs.current[key]
      const measuredH = el ? el.getBoundingClientRect().height : undefined

      const base =
        current[key] ??
        {
          x: 8,
          y: 8,
          w: defaultWidth,
          h: key === TOPBAR_KEY ? TOPBAR_HEIGHT : Math.max(120, Math.round(measuredH ?? defaultHeight)),
          z: 1,
        }

      const maxZ = Object.values(current).reduce((m, r) => Math.max(m, r?.z ?? 0), 0)
      const z = maxZ + 1

      const originW = base.w ?? defaultWidth
      const originH = base.h ?? Math.max(120, Math.round(measuredH ?? defaultHeight))

      setPageBlockRects((prev) => ({
        ...prev,
        [key]: { ...base, w: originW, h: originH, z },
      }))

      const minW = 240
      const minH = key === TOPBAR_KEY ? TOPBAR_HEIGHT : 140
      const maxW = Math.max(1200, Math.floor(window.innerWidth * 3))
      const maxH = Math.max(900, Math.floor(window.innerHeight * 3))

      const onMove = (ev: PointerEvent) => {
        const dx = ev.clientX - startX
        const dy = ev.clientY - startY
        setPageBlockRects((prev) => {
          const cur = prev[key] ?? { ...base, w: originW, h: originH, z }
          return {
            ...prev,
            [key]: {
              ...cur,
              w: clampNum(originW + dx, minW, maxW),
              h: key === TOPBAR_KEY ? TOPBAR_HEIGHT : clampNum(originH + dy, minH, maxH),
              z,
            },
          }
        })
      }

      const onUp = () => {
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
      }

      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
    },
    [pageLayoutMode, pageLayoutEdit]
  )

  const renderBlockResizeHandle = useCallback(
    (key: string, defaultWidth: number, defaultHeight: number) => {
      if (pageLayoutMode !== 'free' || !pageLayoutEdit) return null
      return (
        <div
          className="absolute right-1 bottom-1 z-40 h-5 w-5 cursor-se-resize select-none rounded border bg-white/80 flex items-center justify-center text-[10px] text-gray-600"
          onPointerDown={(e) => startResizeBlock(e, key, defaultWidth, defaultHeight)}
          title="ドラッグでリサイズ"
        >
          ◢
        </div>
      )
    },
    [pageLayoutMode, pageLayoutEdit, startResizeBlock]
  )

  const renderBlockHandle = useCallback(
    (key: string, defaultWidth: number) => {
      if (pageLayoutMode !== 'free' || !pageLayoutEdit) return null
      return (
        <div
          className="absolute top-1 left-1 z-30 cursor-move select-none border rounded bg-white/80 px-1 text-[10px]"
          onPointerDown={(e) => startDragBlock(e, key, defaultWidth)}
          title="ドラッグで移動"
        >
          ≡
        </div>
      )
    },
    [pageLayoutMode, pageLayoutEdit, startDragBlock]
  )

  const freeCanvasStyle = useMemo<CSSProperties>(() => {
    if (pageLayoutMode !== 'free') return {}
    let maxX = 0
    let maxY = 0
    for (const r of Object.values(pageBlockRects)) {
      if (!r) continue
      maxX = Math.max(maxX, r.x + r.w)
      // height is unknown here; assume a reasonable block height to size the scroll area
      maxY = Math.max(maxY, r.y + r.h)
    }
    return {
      width: Math.max(1200, maxX + 80),
      height: Math.max(900, maxY + 200),
    }
  }, [pageLayoutMode, pageBlockRects])

  useEffect(() => {
    if (pageLayoutMode !== 'free') return
    setPageBlockRects((prev) => {
      const next: Record<string, PageBlockRect> = { ...prev }
      const keys: Array<{ key: string; w: number; h: number }> = [
        { key: 'default:topbar', w: 900, h: 48 },
        { key: 'default:main', w: 1200, h: 520 },
        { key: 'default:damageCalc', w: 520, h: 420 },
        ...pluginPageBlocks.map((b) => ({
          key: b.key,
          w: 900,
          h: Math.max(
            200,
            Math.round((typeof b.height === 'number' && Number.isFinite(b.height) ? b.height : 260) + 40)
          ),
        })),
      ]
      const existing = Object.values(next)
      let y = existing.reduce((m, r) => Math.max(m, (r?.y ?? 0) + (r?.h ?? 140) + 24), 8)
      let z = existing.reduce((m, r) => Math.max(m, r?.z ?? 0), 0) + 1
      for (const k of keys) {
        if (!next[k.key]) {
          next[k.key] = { x: 8, y, w: k.w, h: k.h, z }
          y += k.h + 24
          z += 1
        }
      }
      return next
    })
  }, [pageLayoutMode, pluginPageBlocks])


  return (
    <main ref={layoutAreaRef} className={`p-4 select-none tl-root ${pluginRootClass} flex flex-col ${pageLayoutMode === 'free' ? 'relative overflow-auto' : 'gap-4 overflow-y-hidden'}`}
      style={pluginVars}
      onClick={hidePopups}
    >
      {pluginCss && <style jsx global>{pluginCss}</style>}
      {pageLayoutMode === 'free' && (
        <div aria-hidden className="pointer-events-none flex-none" style={freeCanvasStyle} />
      )}
      {!initialized && (
        <div className="flex flex-col items-center justify-center py-20 space-y-2">
          <button
            type="button"
            className="border px-4 py-1 rounded w-40"
            onClick={() => setShowCreateModal(true)}
          >
            TLを作成
          </button>
          <label className="border px-4 py-1 rounded w-40 text-center cursor-pointer">
            TLをインポート
            <input
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (!file) return
                file.text().then((txt) => {
                  try {
                    const data = JSON.parse(txt)
                    setProjectName(data.projectName || '')
                    setSkills(data.skills || [])
                    setMarkers(data.markers || [])
                    applyMembers(data.rowStudents || [])
                    const g = groups.find((gr) => gr.id === data.groupId) || null
                    setSelectedGroup(g)
                    setSquadIndex(data.squadIndex || 0)
                    if (data.userStats) {
                      const map: Record<string, UserStudent> = {}
                      Object.entries(data.userStats as Record<string, UserStudent>).forEach(
                        ([id, val]) => {
                          const st = students.find((s) => s.id === id)
                          const base = st?.styleOf || st?.altOf || st?.id || id
                          map[base] = val
                        }
                      )
                      setTlStats(map)
                    } else {
                      setTlStats({})
                    }
                    setInitialized(true)
                  } catch {
                    /* ignore */
                  }
                })
              }}
            />
          </label>
          {hasCache && (
            <button
              type="button"
              className="border px-4 py-1 rounded w-40"
              onClick={() => {
                const raw = localStorage.getItem('tlMakerCache')
                if (!raw) return
                try {
                  const data = JSON.parse(raw)
                  setProjectName(data.projectName || '')
                  setSkills(data.skills || [])
                  setMarkers(data.markers || [])
                  applyMembers(data.rowStudents || [])
                  const g = groups.find((gr) => gr.id === data.groupId) || null
                  setSelectedGroup(g)
                  setSquadIndex(data.squadIndex || 0)
                  setTlStats({})
                  setInitialized(true)
                } catch {
                  /* ignore */
                }
              }}
            >
              キャッシュから復元
            </button>
          )}
        </div>
      )}

      {showSaveModal && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center"
          onClick={() => setShowSaveModal(false)}
        >
          <div
            className="border rounded p-4 bg-white space-y-2 w-72"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setShowSaveModal(false)}
              className="absolute top-1 right-1"
              aria-label="閉じる"
            >
              <FontAwesomeIcon icon={faTimes} />
            </button>
            <div className="text-sm font-bold">保存オプション</div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={includeStats}
                onChange={(e) => setIncludeStats(e.target.checked)}
              />
              <span>育成データを含める</span>
            </label>
            <button
              type="button"
              onClick={() => {
                downloadProject(includeStats)
                setShowSaveModal(false)
              }}
              className="border px-2 py-1 bg-blue-500 text-white rounded"
            >
              保存
            </button>
          </div>
        </div>
      )}

      {showEnemyModal && (
        <AddEnemyModal
          enemies={enemies}
          addRow={addEnemyRow}
          close={() => setShowEnemyModal(false)}
        />
      )}

      {showCreateModal && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center"
          onClick={() => setShowCreateModal(false)}
        >
          <div
            className="border rounded p-4 bg-white space-y-2 w-72"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setShowCreateModal(false)}
              className="absolute top-1 right-1"
              aria-label="閉じる"
            >
              <FontAwesomeIcon icon={faTimes} />
            </button>
            <div className="text-sm font-bold">TL作成</div>
            <label className="flex items-center gap-2">
              <span>名前:</span>
              <input
                type="text"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                className="border rounded p-1 flex-1"
              />
            </label>
            <label className="flex items-center gap-2">
              <span>編成:</span>
              <select
                value={selectedGroup?.id || ''}
                onChange={(e) => {
                  const g = groups.find((gr) => gr.id === e.target.value) || null
                  setSelectedGroup(g)
                }}
                className="border rounded p-1 flex-1"
              >
                <option value="">--</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={() => {
                if (selectedGroup) {
  const sq = selectedGroup.squads[0]
  const members = [...sq.strikers, ...sq.specials]

  applyMembers(members)
  setSkills([])
  setMarkers([])
  addNormalSkills(members)

  setSquadIndex(0)
} else {
  const empty = Array(6).fill('')
  applyMembers(empty)
  setSkills([])
  setMarkers([])
}

setInitialized(true)
setShowCreateModal(false)

              }}
              className="border px-2 py-1 bg-blue-500 text-white rounded"
            >
              作成
            </button>
          </div>
        </div>
      )}

      {initialized && (
        <Fragment>
      <div className="sticky top-0 z-20 flex items-center gap-4 bg-gray-200 dark:bg-gray-700 p-2 text-sm relative" ref={registerBlockRef('default:topbar')} style={getBlockStyle('default:topbar', 0, 900)}>
        {renderBlockHandle('default:topbar', 900)}
        {renderBlockResizeHandle('default:topbar', 900, 48)}
        <div className="relative">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              closeMenus()
              setShowFileMenu(!showFileMenu)
            }}
            className="px-1"
          >
            ファイル
          </button>
          {showFileMenu && (
            <div
              className="absolute left-0 mt-1 border bg-white rounded shadow z-10 text-sm w-32"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => {
                  setShowCreateModal(true)
                  closeMenus()
                }}
                className="block w-full text-left px-2 py-1 hover:bg-gray-200"
              >
                TLを作成
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowSaveModal(true)
                  closeMenus()
                }}
                className="block w-full text-left px-2 py-1 hover:bg-gray-200"
              >
                TLを保存
              </button>
              <label className="block w-full text-left px-2 py-1 hover:bg-gray-200 cursor-pointer">
                TLを読み込み
                <input
                  type="file"
                  accept="application/json"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) {
                      file.text().then((txt) => {
                        try {
                          const data = JSON.parse(txt)
                          setProjectName(data.projectName || '')
                          setSkills(data.skills || [])
                          setMarkers(data.markers || [])
                          applyMembers(data.rowStudents || [])
                          const g = groups.find((gr) => gr.id === data.groupId) || null
                          setSelectedGroup(g)
                          setSquadIndex(data.squadIndex || 0)
                          setInitialized(true)
                        } catch {
                          /* ignore */
                        }
                      })
                    }
                    e.target.value = ''
                    closeMenus()
                  }}
                />
              </label>
              <button
                type="button"
                onClick={() => {
                  closeMenus()
                  setShowSettings(true)
                }}
                className="block w-full text-left px-2 py-1 hover:bg-gray-200"
              >
                設定
              </button>
            </div>
          )}
        </div>
        <div className="relative">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              closeMenus()
              setShowMenu(!showMenu)
            }}
            className="px-1"
          >
            追加
          </button>
          {showMenu && (
            <div
              className="absolute left-0 mt-1 border bg-white rounded shadow z-10 text-sm w-32"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => {
                  setSelectedType('skill')
                  setSkillKind('ex')
                  setRow(0)
                  const st = students.find((s) => s.id === rowStudents[0])
                  const dur = st?.exDuration ?? 1
                  setApplyTravel(false)
                  setStart(snapTime(playhead))
                  setEnd(snapTime(playhead + dur))
                  setShowForm(true)
                  setShowMenu(false)
                }}
                className="block w-full text-left px-2 py-1 hover:bg-gray-200"
              >
                スキル追加
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedType('event')
                  setStart(snapTime(playhead))
                  setShowForm(true)
                  setShowMenu(false)
                }}
                className="block w-full text-left px-2 py-1 hover:bg-gray-200"
              >
                イベント追加
              </button>
              <button
                type="button"
                onClick={() => {
                  addRow()
                  setShowMenu(false)
                }}
                className="block w-full text-left px-2 py-1 hover:bg-gray-200"
              >
                行追加
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowEnemyModal(true)
                  setShowMenu(false)
                }}
                className="block w-full text-left px-2 py-1 hover:bg-gray-200"
              >
                敵行追加
              </button>
            </div>
          )}
        </div>
        <div className="relative">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              closeMenus()
              setShowEditMenu(!showEditMenu)
            }}
            className="px-1"
          >
            編集
          </button>
          {showEditMenu && (
            <div
              className="absolute left-0 mt-1 border bg-white rounded shadow z-10 text-sm w-32"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => {
                  if (selected.length) {
                    const cutSkills = skills.filter((s) =>
                      selected.some((sel) => sel.type === 'skill' && sel.id === s.id)
                    )
                    const cutMarkers = markers.filter((m) =>
                      selected.some((sel) => sel.type === 'marker' && sel.id === m.id)
                    )
                    if (cutSkills.length || cutMarkers.length) {
                      setCopied({
                        skills: cutSkills.map((s) => ({ ...s })),
                        markers: cutMarkers.map((m) => ({ ...m })),
                      })
                      setSkills((prev) => prev.filter((s) => !cutSkills.some((c) => c.id === s.id)))
                      setMarkers((prev) => prev.filter((m) => !cutMarkers.some((c) => c.id === m.id)))
                      setSelected([])
                    }
                  }
                  setShowEditMenu(false)
                }}
                className="block w-full text-left px-2 py-1 hover:bg-gray-200"
              >
                カット
              </button>
              <button
                type="button"
                onClick={() => {
                  if (selected.length) {
                    const cpSkills = skills.filter((s) =>
                      selected.some((sel) => sel.type === 'skill' && sel.id === s.id)
                    )
                    const cpMarkers = markers.filter((m) =>
                      selected.some((sel) => sel.type === 'marker' && sel.id === m.id)
                    )
                    if (cpSkills.length || cpMarkers.length) {
                      setCopied({
                        skills: cpSkills.map((s) => ({ ...s })),
                        markers: cpMarkers.map((m) => ({ ...m })),
                      })
                    }
                  }
                  setShowEditMenu(false)
                }}
                className="block w-full text-left px-2 py-1 hover:bg-gray-200"
              >
                コピー
              </button>
              <button
                type="button"
                onClick={() => {
                  if (copied) {
                    const base = snapTime(playhead)
                    copied.skills.forEach((ev, idx) => {
                      const id = Date.now() + idx
                      const duration = ev.end - ev.start
                      const travel = ev.travel || 0
                      const motion = ev.motion
                      setSkills((prev) => [
                        ...prev,
                        {
                          ...ev,
                          id,
                          start: base,
                          end: snapTime(base + duration),
                          travel,
                          motion,
                          type: ev.type,
                        },
                      ])
                    })
                    copied.markers.forEach((mk, idx) => {
                      const id = Date.now() + copied.skills.length + idx
                      setMarkers((prev) => [
                        ...prev,
                        { ...mk, id, time: base },
                      ])
                    })
                  }
                  setShowEditMenu(false)
                }}
                className="block w-full text-left px-2 py-1 hover:bg-gray-200"
              >
                ペースト
              </button>
              <button
                type="button"
                onClick={() => {
                  if (selected.length) {
                    setSkills((prev) =>
                      prev.filter((s) => !selected.some((sel) => sel.type === 'skill' && sel.id === s.id))
                    )
                    setMarkers((prev) =>
                      prev.filter((m) => !selected.some((sel) => sel.type === 'marker' && sel.id === m.id))
                    )
                    setSelected([])
                  }
                  setShowEditMenu(false)
                }}
                className="block w-full text-left px-2 py-1 hover:bg-gray-200"
              >
                削除
              </button>
            </div>
          )}
        </div>
        <div className="relative">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              closeMenus()
              setShowTools(!showTools)
            }}
            className="px-3 w-20"
          >
            ツール
          </button>
          {showTools && (
            <div
              className="absolute left-0 mt-1 border bg-white rounded shadow z-10 text-sm"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => setProMode((v) => !v)}
                className="block w-full text-left px-2 py-1 hover:bg-gray-200 whitespace-nowrap"
              >
                {tMaker('proMode', { state: proMode ? 'ON' : 'OFF' })}
              </button>

              {proMode && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAlignModal(true)
                      closeMenus()
                    }}
                    className="block w-full text-left px-2 py-1 hover:bg-gray-200 whitespace-nowrap"
                  >
                    {tMaker('align')}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowHistoryModal(true)
                      closeMenus()
                    }}
                    className="block w-full text-left px-2 py-1 hover:bg-gray-200 whitespace-nowrap"
                  >
                    {tMaker('history')}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowExTemplateModal(true)
                      closeMenus()
                    }}
                    className="block w-full text-left px-2 py-1 hover:bg-gray-200 whitespace-nowrap"
                  >
                    {tMaker('exTemplate')}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowPluginModal(true)
                      closeMenus()
                    }}
                    className="block w-full text-left px-2 py-1 hover:bg-gray-200 whitespace-nowrap"
                  >
                    {tPlugin('menu')}
                  </button>
                  <div className="border-t my-1" />
                </>
              )}
              {toolMenuPluginButtons.length > 0 && (
                <>
                  <div className="border-t my-1" />
                  <div className="px-2 py-1 text-xs text-gray-500">{tPlugin('pluginsLabel')}</div>
                  {toolMenuPluginButtons.map((b) => (
                    <button
                      key={`${b.pluginId}:${b.id}`}
                      type="button"
                      onClick={() => {
                        runPluginToolButton(b)
                        closeMenus()
                      }}
                      className="block w-full text-left px-2 py-1 hover:bg-gray-200 whitespace-nowrap"
                    >
                      {b.label}
                      <span className="text-xs text-gray-500 ml-1">({b.pluginName})</span>
                    </button>
                  ))}
                </>
              )}

              <button
                type="button"
                onClick={() => setShowSquadMenu(!showSquadMenu)}
                className="block w-full text-left px-2 py-1 hover:bg-gray-200 whitespace-nowrap"
              >
                部隊の変更
              </button>
              <button
                type="button"
                onClick={() => setShowGroupMenu(!showGroupMenu)}
                className="block w-full text-left px-2 py-1 hover:bg-gray-200 whitespace-nowrap"
              >
                グループの変更
              </button>
              <Link
                href="/squads"
                className="block w-full text-left px-2 py-1 hover:bg-gray-200 whitespace-nowrap"
                onClick={() => closeMenus()}
              >
                部隊の編集
              </Link>
              <label className="flex items-center gap-1 px-2 py-1 hover:bg-gray-200">
                <input
                  type="checkbox"
                  checked={showDamageCalc}
                  onChange={(e) => setShowDamageCalc(e.target.checked)}
                />
                <span>ダメージ計算</span>
              </label>
              <label className="flex items-center gap-1 px-2 py-1 hover:bg-gray-200">
                <input
                  type="checkbox"
                  checked={showTextTL}
                  onChange={(e) => setShowTextTL(e.target.checked)}
                />
                <span>TLをテキスト表示</span>
              </label>
            </div>
          )}
          {showSquadMenu && selectedGroup && selectedGroup.squads.length > 1 && (
            <div
              className="absolute left-0 mt-1 border bg-white rounded shadow z-20 text-sm px-2 py-1"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex gap-1">
                {selectedGroup.squads.map((sq, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onMouseDown={() => {
                      switchSquad(idx)
                      setShowSquadMenu(false)
                      setShowTools(false)
                    }}
                    className="px-2 py-1 hover:bg-gray-200 whitespace-nowrap"
                  >
                    {selectedGroup.name} #{idx + 1}
                  </button>
                ))}
              </div>
            </div>
          )}
          {showGroupMenu && groups.length > 0 && (
            <div
              className="absolute left-0 mt-1 border bg-white rounded shadow z-20 text-sm px-2 py-1"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex gap-1">
                {groups.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    onMouseDown={() => {
                      setSelectedGroup(g)
                      switchSquad(0)
                      setShowGroupMenu(false)
                      setShowTools(false)
                    }}
                    className="px-2 py-1 hover:bg-gray-200 whitespace-nowrap"
                  >
                    {g.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        <button type="button" className="px-1">再生</button>
        <button
          type="button"
          onClick={undo}
          className="border rounded p-1 ml-2"
          aria-label="元に戻す"
        >
          <FontAwesomeIcon icon={faUndo} />
        </button>
        <button
          type="button"
          onClick={redo}
          className="border rounded p-1 ml-1"
          aria-label="やり直す"
        >
          <FontAwesomeIcon icon={faRedo} />
        </button>
        <button
          type="button"
          onClick={() => setShowImport(true)}
          className="border rounded p-1 ml-2"
          aria-label="部隊インポート"
        >
          <FontAwesomeIcon icon={faFileImport} />
        </button>
        <span className="ml-4 font-mono text-black">
          {formatRemain(totalSeconds - playhead)} ({currentCost.toFixed(2)})
        </span>
        
        {toolbarPluginButtons.length > 0 && (
          <div className="flex items-center gap-1 ml-2">
            {toolbarPluginButtons.map((b) => (
              <button
                key={`${b.pluginId}:${b.id}`}
                type="button"
                onClick={() => runPluginToolButton(b)}
                className="border px-2 py-0.5 rounded bg-white text-black"
                title={`${b.pluginName}`}
              >
                {b.label}
              </button>
            ))}
          </div>
        )}

<div className="flex items-center gap-2 ml-auto">
          <span className="text-sm">拡大</span>
          <input
            type="range"
            min="10"
            max="250"
            step="5"
            value={timeScale}
            onChange={(e) => {
              const newScale = parseInt(e.target.value)
              if (containerRef.current) {
                const { scrollLeft, clientWidth } = containerRef.current
                const pivot = zoomByPlayhead
                  ? playhead * timeScale - scrollLeft
                  : clientWidth / 2
                const centerTime =
                  zoomByPlayhead
                    ? playhead
                    : (scrollLeft + clientWidth / 2) / timeScale
                setTimeScale(newScale)
                requestAnimationFrame(() => {
                  if (containerRef.current) {
                    if (zoomByPlayhead) {
                      containerRef.current.scrollLeft = playhead * newScale - pivot
                    } else {
                      containerRef.current.scrollLeft = centerTime * newScale - clientWidth / 2
                    }
                  }
                })
              } else {
                setTimeScale(newScale)
              }
            }}
          />
          <span className="text-sm">{timeScale}px/s</span>
          <button
            type="button"
            onClick={() => setZoomByPlayhead(!zoomByPlayhead)}
            className="border rounded px-1"
          >
            <FontAwesomeIcon icon={faCrosshairs} className="mr-1" />
            {zoomByPlayhead ? '操作線' : '画面中心'}
          </button>
        </div>
      </div>
      {showForm && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center"
          onClick={() => setShowForm(false)}
        >
          <div
            className="space-y-2 border p-4 rounded bg-white select-text relative w-72"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="absolute top-1 right-1"
              aria-label="閉じる"
            >
              <FontAwesomeIcon icon={faTimes} />
            </button>
          {selectedType && (
            <div className="text-sm font-bold">{selectedType === 'skill' ? 'スキル' : 'イベント'}</div>
          )}
          {selectedType === 'skill' && (
            <>
              <label className="flex items-center gap-2">
                <span>生徒:</span>
                <select
                  value={row}
                  onChange={(e) => setRow(parseInt(e.target.value))}
                  className="border rounded p-1 w-24"
                >
                  {rowStudents.map((id, idx) => {
                    const st = students.find((s) => s.id === id)
                    return (
                      <option key={idx} value={idx}>
                        {st ? st.name : `行${idx + 1}`}
                      </option>
                    )
                  })}
                </select>
              </label>
              <label className="flex items-center gap-2">
                <span>種類:</span>
                <select
                  value={skillKind}
                  onChange={(e) => setSkillKind(e.target.value as 'ex' | 'normal')}
                  className="border rounded p-1 w-24"
                >
                  <option value="ex">EX</option>
                  <option value="normal">NS</option>
                </select>
              </label>
              <label className="flex items-center gap-2">
                <span>開始:</span>
                <input
                  type="number"
                  value={start}
                  onChange={(e) => setStart(parseFloat(e.target.value))}
                  className="border rounded p-1 w-24"
                />
              </label>
              <label className="flex items-center gap-2">
                <span>終了:</span>
                <input
                  type="number"
                  value={end}
                  onChange={(e) => setEnd(parseFloat(e.target.value))}
                  className="border rounded p-1 w-24"
                />
              </label>
              <label className="flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={applyTravel}
                  onChange={(e) => setApplyTravel(e.target.checked)}
                />
                <span>着弾時間を考慮</span>
              </label>
              {skillKind === 'ex' && (
                <label className="flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={waitCost}
                    onChange={(e) => setWaitCost(e.target.checked)}
                  />
                  <span>コストが貯まったら</span>
                </label>
              )}
            </>
          )}
          {selectedType === 'event' && (
            <>
              <label className="flex items-center gap-2">
                <span>テンプレ:</span>
                <select
                  value={templateId}
                  onChange={(e) => setTemplateId(e.target.value)}
                  className="border rounded p-1 flex-1"
                >
                  <option value="">--</option>
                  {allEventTemplates.map((tpl) => (
                    <option key={tpl.id} value={tpl.id}>
                      {tpl.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-2">
                <span>時間:</span>
                <input
                  type="number"
                  value={start}
                  onChange={(e) => setStart(parseFloat(e.target.value))}
                  className="border rounded p-1 w-24"
                />
              </label>
            </>
          )}
          <label className="flex items-center gap-2">
            <span>ラベル:</span>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="border rounded p-1 flex-1"
            />
          </label>
          <button onClick={addEvent} className="border px-2 py-1 bg-blue-500 text-white rounded">
            <FontAwesomeIcon icon={faPlus} />
          </button>
        </div>
        </div>
      )}

      {showImport && squads.length > 0 && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center"
          onClick={() => setShowImport(false)}
        >
          <div
            className="border rounded p-2 space-y-1 bg-white relative w-60"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setShowImport(false)}
              className="absolute top-1 right-1"
              aria-label="閉じる"
            >
              <FontAwesomeIcon icon={faTimes} />
            </button>
            {squads.map((sq, i) => (
              <button
                key={i}
                type="button"
                onClick={() => importSquad(sq.members)}
                className="border rounded w-full text-left p-1"
              >
                {sq.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {showSettings && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center"
          onClick={() => setShowSettings(false)}
        >
          <div
            className="border rounded p-4 bg-white space-y-2 max-h-[60vh] overflow-y-auto overscroll-contain relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setShowSettings(false)}
              className="absolute top-1 right-1"
              aria-label="閉じる"
            >
              <FontAwesomeIcon icon={faTimes} />
            </button>
                        <div className="text-sm font-bold">プロモード</div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={proMode}
                onChange={(e) => setProMode(e.target.checked)}
              />
              <span>プロモードを有効化</span>
            </label>

            <div className="text-sm font-bold mt-2">表示</div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={showDamageCalc}
                onChange={(e) => setShowDamageCalc(e.target.checked)}
              />
              <span>ダメージ計算を表示</span>
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={showTextTL} onChange={(e) => setShowTextTL(e.target.checked)} />
              <span>TLをテキスト表示</span>
            </label>

            <label className="flex items-center gap-2">
              <input type="checkbox" checked={hideHeader} onChange={(e) => setHideHeader(e.target.checked)} />
              <span>ヘッダーを非表示にする</span>
            </label>

            <div className="text-sm font-bold mt-2">ページレイアウト</div>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="pageLayoutMode"
                checked={pageLayoutMode === 'stack'}
                onChange={() => setPageLayoutMode('stack')}
              />
              <span>縦並び（通常）</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="pageLayoutMode"
                checked={pageLayoutMode === 'free'}
                onChange={() => {
                  initFreeLayoutFromCurrent()
                  setPageLayoutMode('free')
                }}
              />
              <span>自由配置</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={pageLayoutEdit}
                onChange={(e) => setPageLayoutEdit(e.target.checked)}
                disabled={pageLayoutMode !== 'free'}
              />
              <span>自由配置を編集（ドラッグ）</span>
            </label>
            <button
              type="button"
              className="border px-3 py-1 rounded text-xs w-fit"
              onClick={() => {
                setPageLayoutMode('stack')
                setPageLayoutEdit(false)
                setPageBlockRects({})
              }}
              disabled={pageLayoutMode !== 'free'}
            >
              自由配置をリセット
            </button>

            <div className="text-sm font-bold mt-2">スナップ</div>
            <label className="flex items-center gap-2">
              <span>単位:</span>
              <select
                value={snapPreset}
                onChange={(e) =>
                  setSnapPreset(e.target.value as 'off' | '0.5' | '0.1' | '0.05' | '0.033')
                }
                className="border rounded p-1"
              >
                <option value="off">OFF</option>
                <option value="0.5">0.5s</option>
                <option value="0.1">0.1s</option>
                <option value="0.05">0.05s</option>
                <option value="0.033">0.033s</option>
              </select>
            </label>

            <div className="border-t my-2" />

            <div className="text-sm font-bold">デフォルトスキルレベル</div>
            <label className="flex items-center gap-2">
              <span>EX:</span>
              <input
                type="number"
                min="1"
                max="10"
                value={defaultLevels.ex}
                onChange={(e) =>
                  setDefaultLevels({ ...defaultLevels, ex: parseInt(e.target.value) || 1 })
                }
                className="border rounded p-1 w-16"
              />
            </label>
            <label className="flex items-center gap-2">
              <span>NS:</span>
              <input
                type="number"
                min="1"
                max="10"
                value={defaultLevels.normal}
                onChange={(e) =>
                  setDefaultLevels({ ...defaultLevels, normal: parseInt(e.target.value) || 1 })
                }
                className="border rounded p-1 w-16"
              />
            </label>
            <label className="flex items-center gap-2">
              <span>PS:</span>
              <input
                type="number"
                min="1"
                max="10"
                value={defaultLevels.passive}
                onChange={(e) =>
                  setDefaultLevels({ ...defaultLevels, passive: parseInt(e.target.value) || 1 })
                }
                className="border rounded p-1 w-16"
              />
            </label>
            <label className="flex items-center gap-2">
              <span>SS:</span>
              <input
                type="number"
                min="1"
                max="10"
                value={defaultLevels.sub}
                onChange={(e) =>
                  setDefaultLevels({ ...defaultLevels, sub: parseInt(e.target.value) || 1 })
                }
                className="border rounded p-1 w-16"
              />
            </label>
            <div className="text-sm font-bold mt-2">TL長さ</div>
            <select
              value={totalSeconds}
              onChange={(e) => setTotalSeconds(parseInt(e.target.value))}
              className="border rounded p-1"
            >
              <option value={180}>3:00</option>
              <option value={240}>4:00</option>
              <option value={270}>4:30</option>
            </select>
            <div className="text-sm font-bold mt-2">オブジェクト色</div>
            <table className="text-sm border-collapse">
              <thead>
                <tr>
                  <th className="text-left"></th>
                  <th className="px-1">着弾まで</th>
                  <th className="px-1">モーション終了まで</th>
                  <th className="px-1">スキル終了まで</th>
                </tr>
              </thead>
              <tbody>
                {(['ex', 'normal'] as const).map((t) => (
                  <tr key={t}>
                    <th className="text-left px-1">{t === 'ex' ? 'EX' : 'NS'}</th>
                    {(['travel', 'motion', 'rest'] as const).map((p) => (
                      <td key={p} className="px-1 space-x-1">
                        <input
                          type="color"
                          value={skillColors[t][p].color}
                          onChange={(e) =>
                            setSkillColors({
                              ...skillColors,
                              [t]: {
                                ...skillColors[t],
                                [p]: {
                                  ...skillColors[t][p],
                                  color: e.target.value,
                                },
                              },
                            })
                          }
                        />
                        <input
                          type="number"
                          min="0"
                          max="1"
                          step="0.05"
                          value={skillColors[t][p].alpha}
                          onChange={(e) =>
                            setSkillColors({
                              ...skillColors,
                              [t]: {
                                ...skillColors[t],
                                [p]: {
                                  ...skillColors[t][p],
                                  alpha: parseFloat(e.target.value) || 0,
                                },
                              },
                            })
                          }
                          className="w-16 border rounded p-1"
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {rowStudents.some((id) => id.startsWith('enemy:')) && (
              <>
                <div className="text-sm font-bold mt-2">デフォルトターゲット</div>
                <label className="flex items-center gap-2">
                  <span>攻撃:</span>
                  <select
                    value={defaultTargets.attack}
                    onChange={(e) =>
                      setDefaultTargets({ ...defaultTargets, attack: parseInt(e.target.value) })
                    }
                    className="border rounded p-1 w-24"
                  >
                    {rowStudents.map((id, idx) => {
                      if (!id.startsWith('enemy:')) return null
                      const en = enemies.find((e) => `enemy:${e.id}` === id)
                      return (
                        <option key={idx} value={idx}>
                          {en ? en.name : `敵${idx + 1}`}
                        </option>
                      )
                    })}
                  </select>
                </label>
                <label className="flex items-center gap-2">
                  <span>デバフ:</span>
                  <select
                    value={defaultTargets.debuff}
                    onChange={(e) =>
                      setDefaultTargets({ ...defaultTargets, debuff: parseInt(e.target.value) })
                    }
                    className="border rounded p-1 w-24"
                  >
                    {rowStudents.map((id, idx) => {
                      if (!id.startsWith('enemy:')) return null
                      const en = enemies.find((e) => `enemy:${e.id}` === id)
                      return (
                        <option key={idx} value={idx}>
                          {en ? en.name : `敵${idx + 1}`}
                        </option>
                      )
                    })}
                  </select>
                </label>
              </>
            )}
            <button
              type="button"
              onClick={() => setShowSettings(false)}
              className="border px-2 py-1 bg-blue-500 text-white rounded"
            >
              OK
            </button>
          </div>
        </div>
          )}

      {showAlignModal && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center"
          onClick={() => setShowAlignModal(false)}
        >
          <div
            className="border p-4 rounded bg-white w-80 space-y-2"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="font-bold">整列（選択したスキル）</div>
            <div className="text-xs text-gray-600">
              ※同一行のスキルを2つ以上選択してから実行（Shiftで複数選択）
            </div>
            <div className="flex gap-2">
              <button className="border px-2 py-1 rounded" onClick={() => alignSelectedSkills('left')}>
                左揃え
              </button>
              <button className="border px-2 py-1 rounded" onClick={() => alignSelectedSkills('pack')}>
                詰める
              </button>
              <button className="border px-2 py-1 rounded" onClick={() => alignSelectedSkills('even')}>
                等間隔
              </button>
            </div>
            <div className="text-right">
              <button className="border px-2 py-1 rounded" onClick={() => setShowAlignModal(false)}>
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}

      {showHistoryModal && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center"
          onClick={() => setShowHistoryModal(false)}
        >
          <div
            className="border p-4 rounded bg-white w-[420px] space-y-2"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="font-bold">履歴</div>
            <div className="text-xs text-gray-600">
              Undo: {undoStack.current.length} / Redo: {redoStack.current.length}
            </div>
            <div className="border rounded p-2 h-56 overflow-auto text-sm space-y-1">
              {historyLog.length === 0 ? (
                <div className="text-gray-500">履歴なし</div>
              ) : (
                historyLog
                  .slice()
                  .reverse()
                  .map((h) => (
                    <div key={h.id} className="flex justify-between gap-2">
                      <span className="text-gray-600">{h.at}</span>
                      <span>{h.summary}</span>
                    </div>
                  ))
              )}
            </div>
            <div className="flex justify-between">
              <button className="border px-2 py-1 rounded" onClick={undo}>
                Undo
              </button>
              <button className="border px-2 py-1 rounded" onClick={redo}>
                Redo
              </button>
              <button
                className="border px-2 py-1 rounded"
                onClick={() => {
                  setHistoryLog([])
                }}
              >
                クリア
              </button>
              <button className="border px-2 py-1 rounded" onClick={() => setShowHistoryModal(false)}>
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}

      {showExTemplateModal && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center"
          onClick={() => setShowExTemplateModal(false)}
        >
          <div
            className="border p-4 rounded bg-white w-[420px] space-y-2"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="font-bold">EXテンプレ生成</div>

            <div className="grid grid-cols-2 gap-2 text-sm">
              <label className="space-y-1">
                <div className="text-xs text-gray-600">行</div>
                <select
                  className="border rounded px-2 py-1 w-full"
                  value={tplRow}
                  onChange={(e) => setTplRow(parseInt(e.target.value))}
                >
                  {rowStudents.map((id, i) => {
                    const st = students.find((s) => s.id === id)
                    const en = enemies.find((e) => `enemy:${e.id}` === id)
                    return (
                      <option key={i} value={i}>
                        {i + 1}: {st?.name ?? en?.name ?? id ?? '(empty)'}
                      </option>
                    )
                  })}
                </select>
              </label>

              <label className="space-y-1">
                <div className="text-xs text-gray-600">開始(秒)</div>
                <input
                  className="border rounded px-2 py-1 w-full"
                  type="number"
                  step="0.033"
                  value={tplStart}
                  onChange={(e) => setTplStart(parseFloat(e.target.value))}
                />
              </label>

              <label className="space-y-1">
                <div className="text-xs text-gray-600">間隔(秒)</div>
                <input
                  className="border rounded px-2 py-1 w-full"
                  type="number"
                  step="0.033"
                  value={tplInterval}
                  onChange={(e) => setTplInterval(parseFloat(e.target.value))}
                />
              </label>

              <label className="space-y-1">
                <div className="text-xs text-gray-600">回数</div>
                <input
                  className="border rounded px-2 py-1 w-full"
                  type="number"
                  min={1}
                  value={tplCount}
                  onChange={(e) => setTplCount(parseInt(e.target.value))}
                />
              </label>

              <label className="space-y-1 col-span-2">
                <div className="text-xs text-gray-600">ラベル</div>
                <input
                  className="border rounded px-2 py-1 w-full"
                  value={tplLabel}
                  onChange={(e) => setTplLabel(e.target.value)}
                />
              </label>
            </div>

            <div className="flex justify-between pt-2">
              <button
                className="border px-3 py-1 rounded bg-blue-500 text-white"
                onClick={() => {
                  const rowId = rowStudents[tplRow]
                  const st = students.find((s) => s.id === rowId)
                  if (!st) {
                    setShowExTemplateModal(false)
                    return
                  }

                  const dur = st.exDuration ?? 1
                  const base = snapTime(tplStart)

                  const events: SkillEvent[] = Array.from({ length: tplCount }).map((_, i) => {
                    const start = snapTime(base + tplInterval * i)
                    return {
                      id: Date.now() + i,
                      row: tplRow,
                      start,
                      end: snapTime(start + dur),
                      label: tplLabel || st.skills?.ex?.title || 'EX',
                      type: 'ex',
                    }
                  })

                  setSkills((prev) => [...prev, ...events])
                  setShowExTemplateModal(false)
                }}
              >
                生成
              </button>

              <button className="border px-3 py-1 rounded" onClick={() => setShowExTemplateModal(false)}>
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}

      {orderedPageBlocks.map((b) => {
        const heightStyle =
          typeof b.height === 'number' && Number.isFinite(b.height) ? { height: `${b.height}px` } : { height: '260px' }
        const fallback = 1000 + (b.order ?? 999)

        return (
          <div
            key={b.key}
            className="border rounded bg-white shadow-sm overflow-hidden relative flex flex-col"
            ref={registerBlockRef(b.key)}
            style={getBlockStyle(b.key, fallback, 900)}
          >
            {renderBlockHandle(b.key, 900)}
            {renderBlockResizeHandle(b.key, 900, Math.max(200, Math.round((typeof b.height === 'number' && Number.isFinite(b.height) ? b.height : 260) + 40)))}
            <div className="flex items-center justify-between gap-2 px-2 py-1 border-b bg-gray-50 flex-none">
              <div className="text-xs font-semibold">
                {b.title}
                <span className="text-gray-500">{` — ${b.pluginName}`}</span>
              </div>
              <button
                className="border px-2 py-1 rounded text-[10px]"
                onClick={() => setPageBlockHidden((prev) => ({ ...prev, [b.key]: true }))}
                title="非表示"
              >
                非表示
              </button>
            </div>

            <iframe
              title={b.key}
              srcDoc={b.srcdoc}
              sandbox="allow-scripts allow-forms allow-popups allow-modals allow-same-origin"
              className="w-full flex-1 min-h-0"
              style={pageLayoutMode === 'free' ? undefined : heightStyle}
            />
          </div>
        )
      })}


      {dockPluginWindow &&
        (() => {
          const p = enabledPlugins.find((x) => x.id === dockPluginWindow.pluginId)
          const w = p?.windows?.find((x) => x.id === dockPluginWindow.windowId)
          if (!p || !w) return null

          const widthStyle =
            typeof w.width === 'number' && Number.isFinite(w.width)
              ? { width: `${w.width}px` }
              : { width: 'min(95vw, 900px)' }

          const heightStyle =
            typeof w.height === 'number' && Number.isFinite(w.height)
              ? { height: `${w.height}px` }
              : { height: '240px' }

          return (
            <div className="fixed bottom-2 left-2 right-2 z-[55] pointer-events-none">
              <div
                className="border rounded bg-white shadow pointer-events-auto overflow-hidden mx-auto"
                style={widthStyle}
              >
                <div className="flex items-center justify-between gap-2 px-2 py-1 border-b bg-gray-50 flex-none">
                  <div className="font-semibold text-xs">
                    {w.title}
                    <span className="text-gray-500">{` — ${p.name}`}</span>
                  </div>
                  <button
                    className="border px-2 py-1 rounded text-[10px]"
                    onClick={() => setDockPluginWindow(null)}
                  >
                    {tPlugin('window.dockClose')}
                  </button>
                </div>

                <iframe
                  title={p.id + ':' + w.id + ':dock'}
                  srcDoc={w.srcdoc}
                  sandbox="allow-scripts allow-forms allow-popups allow-modals"
                  className="w-full"
                  style={heightStyle}
                />
              </div>
            </div>
          )
        })()}


      {openPluginWindow &&
        (() => {
          const p = enabledPlugins.find((x) => x.id === openPluginWindow.pluginId)
          const w = p?.windows?.find((x) => x.id === openPluginWindow.windowId)
          if (!p || !w) return null

          
const key = `${p.id}:${w.id}`
const defaultSize = getDefaultPluginWindowSize(w)
const size = pluginWindowSizeMap[key] ?? defaultSize
const winStyle: React.CSSProperties = { width: `${size.w}px`, height: `${size.h}px` }
return (
            <div
              className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center"
              onClick={() => setOpenPluginWindow(null)}
            >
              <div
                className="border rounded bg-white shadow p-2 max-w-[95vw] max-h-[90vh] flex flex-col min-h-[240px] relative"
                style={winStyle}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between gap-2 px-2 py-1">
                  <div className="font-semibold text-sm">
                    {w.title}
                    <span className="text-gray-500">{` — ${p.name}`}</span>
                  </div>
                  <button className="border px-2 py-1 rounded text-xs" onClick={() => setOpenPluginWindow(null)}>
                    {tPlugin('window.dockClose')}
                  </button>
                </div>

                <iframe
                  title={p.id + ':' + w.id}
                  srcDoc={w.srcdoc}
                  sandbox="allow-scripts allow-forms allow-popups allow-modals"
                  className="w-full border rounded flex-1 min-h-0"
                />

              <div
                className="absolute right-2 bottom-2 z-20 h-5 w-5 cursor-se-resize select-none rounded border bg-white/80 flex items-center justify-center text-[10px] text-gray-600 opacity-80 hover:opacity-100"
                onPointerDown={(e) => startResizePluginWindow(e, key, size.w, size.h)}
                title={tPlugin('window.resizeHint')}
              >
                ◢
              </div>
              </div>
            </div>
          )
        })()}

      {showPluginModal && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center"
          onClick={() => {
            setPluginError(null)
            setShowPluginModal(false)
          }}
        >
          <div
            className="border p-4 rounded bg-white w-[780px] max-w-[95vw] space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div className="font-bold text-lg">{tPlugin('manager')}</div>
              <button
                className="border px-2 py-1 rounded"
                onClick={() => {
                  setPluginError(null)
                  setShowPluginModal(false)
                }}
              >
                {tPlugin('close')}
              </button>
            </div>

            <div className="text-xs text-gray-600">{tPlugin('description')}</div>

            {pluginError && <div className="text-sm text-red-600">{pluginError}</div>}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-2">
                <div className="font-semibold">{tPlugin('installed')}</div>
                <div className="border rounded p-2 h-56 overflow-auto space-y-2 text-sm">
                  {plugins.length === 0 ? (
                    <div className="text-gray-500">{tPlugin('none')}</div>
                  ) : (
                    plugins.map((p) => (
                      <div key={p.id} className="border rounded p-2">
                        <div className="flex items-center justify-between gap-2">
                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={p.enabled !== false}
                              onChange={() =>
                                setPlugins((prev) =>
                                  prev.map((x) =>
                                    x.id === p.id ? { ...x, enabled: x.enabled === false } : x
                                  )
                                )
                              }
                            />
                            <span className="font-semibold">{p.name}</span>
                          </label>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-600">{p.id}</span>
                            <button
                              className="border px-2 py-0.5 rounded text-xs"
                              onClick={() => setPlugins((prev) => prev.filter((x) => x.id !== p.id))}
                            >
                              削除
                            </button>
                          </div>
                        </div>

                        <div className="text-xs text-gray-600 mt-1">
                          templates: {p.templates?.length ?? 0} / macros: {p.macros?.length ?? 0} / tools: {p.tools?.length ?? 0} / style: {p.style ? 'yes' : 'no'}
                          {p.version ? ` / v${p.version}` : ''}
                        </div>

                        {(p.templates?.length ?? 0) > 0 && (
                          <details className="mt-1">
                            <summary className="cursor-pointer text-xs text-gray-700">{tPlugin('templates')}</summary>
                            <div className="text-xs mt-1 space-y-1">
                              {p.templates!.map((t) => (
                                <div key={t.id} className="flex justify-between gap-2">
                                  <span>{t.label}</span>
                                  <span className="text-gray-600">{p.id}:{t.id}</span>
                                </div>
                              ))}
                            </div>
                          </details>
                        )}

                        {(p.macros?.length ?? 0) > 0 && (
                          <details className="mt-1">
                            <summary className="cursor-pointer text-xs text-gray-700">{tPlugin('macros')}</summary>
                            <div className="text-xs mt-1 space-y-1">
                              {p.macros!.map((m) => (
                                <div key={m.id} className="flex items-center justify-between gap-2">
                                  <span>{m.name}</span>
                                  <span className="text-gray-600">{p.id}:{m.id}</span>
                                </div>
                              ))}
                            </div>
                          </details>
                        )}
                      </div>
                    ))
                  )}
                </div>

                <div className="flex gap-2">
                  <button
                    className="border px-2 py-1 rounded"
                    onClick={() => {
                      const data = JSON.stringify(plugins, null, 2)
                      const blob = new Blob([data], { type: 'application/json' })
                      const url = URL.createObjectURL(blob)
                      const a = document.createElement('a')
                      a.href = url
                      a.download = 'plugins.json'
                      a.click()
                      URL.revokeObjectURL(url)
                    }}
                  >
                    {tPlugin('download')}
                  </button>

                  <button
                    className="border px-2 py-1 rounded"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(JSON.stringify(plugins, null, 2))
                      } catch {
                        /* ignore */
                      }
                    }}
                  >
                    {tPlugin('copy')}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <div className="font-semibold">{tPlugin('import')}</div>
                <textarea
                  className="border rounded p-2 w-full h-40 font-mono text-xs"
                  placeholder={tPlugin('placeholder')}
                  value={pluginText}
                  onChange={(e) => setPluginText(e.target.value)}
                />
                <div className="flex flex-wrap gap-2">
                  <button
                    className="border px-2 py-1 rounded bg-blue-500 text-white"
                    onClick={() => {
                      setPluginError(null)
                      try {
                        const raw = JSON.parse(pluginText || 'null')
                        const incoming = normalizePlugins(raw)
                        if (incoming.length === 0) {
                          setPluginError(tPlugin('errors.invalid'))
                          return
                        }
                        setPlugins((prev) => mergePlugins(prev, incoming))
                        setPluginText('')
                      } catch {
                        setPluginError(tPlugin('errors.parse'))
                      }
                    }}
                  >
                    {tPlugin('add')}
                  </button>

                  <button
                    className="border px-2 py-1 rounded"
                    onClick={() => {
                      const sample = [
                        {
                          id: 'sample',
                          name: 'Sample Plugin',
                          version: '1.1.0',
                          enabled: true,
                          // ツール/上部バーにボタンを追加できます（proOnly でプロモード限定も可能）
                          tools: [
                            { id: 'open_set', label: '開幕セット', location: 'tools', macroId: 'macro1', proOnly: true },
                            { id: 'dup10', label: '複製(+10s)', location: 'toolbar', actions: [{ type: 'duplicateSelected', offset: 10 }], proOnly: true },
                          ],
                          // CSS/変数/ルールで見た目を変更できます
                          style: {
                            vars: { '--tl-accent': '#7c3aed' },
                            css:
                              '.tl-root{--tl-accent:var(--tl-accent,#2563eb);} .tl-skill{border:1px solid rgba(0,0,0,.2);} .tl-skill-ex{background:var(--tl-accent)!important;} .tl-marker{border-radius:6px;}',
                            rules: [
                              { target: 'marker', labelIncludes: '開幕', addClass: 'opacity-100', style: { border: '2px solid var(--tl-accent)' } },
                            ],
                          },
                          templates: [
                            { id: 'open', label: '開幕', duration: 1, skillable: false },
                            { id: 'buff', label: 'バフ(10s)', duration: 10, skillable: true },
                          ],
                          macros: [
                            {
                              id: 'macro1',
                              name: '開幕マーカー+EX3回',
                              actions: [
                                { type: 'addMarker', time: 0, label: '開幕', duration: 1, skillable: false },
                                { type: 'addSkill', row: 0, start: 2, label: 'EX', skillType: 'ex' },
                                { type: 'addSkill', row: 0, start: 12, label: 'EX', skillType: 'ex' },
                                { type: 'addSkill', row: 0, start: 22, label: 'EX', skillType: 'ex' },
                              ],
                            },
                            {
                              id: 'macro2',
                              name: '選択を+1.0s ずらす',
                              actions: [{ type: 'offsetSelected', delta: 1, scope: 'all' }],
                            },
                          ],
                        },
                      ]
                      setPluginText(JSON.stringify(sample, null, 2))
                    }}
                  >
                    {tPlugin('sample')}
                  </button>

                  <button className="border px-2 py-1 rounded" onClick={() => setPluginText('')}>
                    {tPlugin('clear')}
                  </button>
                </div>

                <div className="border-t pt-2 space-y-2">
                  <div className="font-semibold">{tPlugin('macroRun')}</div>
                  <div className="border rounded p-2 h-40 overflow-auto space-y-2 text-sm">
                    {pluginMacros.length === 0 ? (
                      <div className="text-gray-500">{tPlugin('noMacro')}</div>
                    ) : (
                      pluginMacros.map((m) => (
                        <div key={`${m.pluginId}:${m.id}`} className="flex items-center justify-between gap-2">
                          <div>
                            <div className="font-semibold">{m.name}</div>
                            <div className="text-xs text-gray-600">{m.pluginName} / {m.pluginId}:{m.id}</div>
                          </div>
                          <button
                            className="border px-2 py-1 rounded"
                            onClick={() => runPluginMacro(m)}
                          >
                            {tPlugin('execute')}
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                  <div className="text-xs text-gray-600">{tPlugin('macroNote')}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}


      <div className="flex relative" ref={registerBlockRef('default:main')} style={getBlockStyle('default:main', 10, 1200)}>
        {renderBlockHandle('default:main', 1200)}
        {renderBlockResizeHandle('default:main', 1200, 520)}
        {showTextTL && (
          <textarea
            className="mr-2 text-xs font-mono flex-shrink-0 border rounded p-1"
            rows={rows}
            value={textTL}
            onChange={(e) => setTextTL(e.target.value)}
          />
        )}
        <div className="flex gap-0 max-h-96 overflow-y-hidden touch-pan-x overscroll-none select-none">
          <div className="flex flex-col">
            <div className="h-5" />
          {rowStudents.map((id, i) => {
            const st = students.find((s) => s.id === rowStudents[i])
if (!st) return
            const enemy = enemies.find((e) => `enemy:${e.id}` === id)
            const handleContext = (e: React.MouseEvent) => {
              e.preventDefault()
              setMenuInfo({ index: i, x: e.clientX, y: e.clientY })
            }
            let touchTimer: NodeJS.Timeout | null = null
            const handleTouchStart = (e: React.TouchEvent) => {
              touchTimer = setTimeout(() => {
                const t = e.touches[0]
                setMenuInfo({ index: i, x: t.clientX, y: t.clientY })
              }, 600)
            }
            const clearTouch = () => {
              if (touchTimer) clearTimeout(touchTimer)
            }
            return (
              <div
                key={i}
                onContextMenu={handleContext}
                onClick={(e) => {
                  e.stopPropagation()
                  const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect()
                  const buffs = getActiveBuffs(i, playhead)
                  const stats = st ? getStats(st.id) : undefined
                  const star = stats?.star ?? st?.initialStars
                  const unique = stats?.unique_star ?? 0
                  const info = st
  ? [
      st.name,
      `★${star}${unique ? `+${unique}` : ''}`,
      st.role,
    ]
  : enemy
  ? [enemy.name]
  : [`行${i + 1}`]
setBuffPopup({
  row: i,
  x: rect.right,
  y: rect.top,
  buffs,
  info,
  studentId: st.id,

  // ★ ここでは分岐しない
  values: st.skills?.sub?.values,
})
                }}
                onTouchStart={handleTouchStart}
                onTouchEnd={clearTouch}
                onTouchCancel={clearTouch}
                className="border border-gray-500 overflow-hidden"
                style={{ width: rowHeight, height: rowHeight }}
              >
                {st ? (
                  <img src={st.image} alt={st.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xs">
                    {enemy ? enemy.name : ''}
                  </div>
                )}
              </div>
            )
          })}
        </div>
        <div
          ref={containerRef}
          className="w-full"
          style={{
            overflowX: dragging || movingSkill ? 'hidden' : 'auto',
            touchAction: dragging || movingSkill ? 'none' : 'pan-x',
          }}
          onWheel={(e) => {
            if (dragging || movingSkill) e.preventDefault()
          }}
        >
          <div className="relative" style={{ width: totalSeconds * timeScale }}>
            <div className="flex text-xs h-5 relative">
              {Array.from({ length: totalSeconds / tickStep }, (_, idx) => {
                const t = +(idx * tickStep).toFixed(1)
                const ratio = t / labelStep
                const showLabel = Math.abs(ratio - Math.round(ratio)) < 1e-6
                const borderClass =
                  tickStep === 0.1 && idx % 5 !== 0
                    ? 'border-dotted border-gray-400'
                    : 'border-gray-500'
                return (
                  <div
                    key={idx}
                    className={`border-l ${borderClass}`}
                    style={{ width: timeScale * tickStep }}
                  >
                    {showLabel ? t : ''}
                  </div>
                )
              })}
              <div
                className="border-l border-gray-500"
                style={{ width: 0 }}
              >
                {totalSeconds}
              </div>
              {/* remaining time moved to toolbar */}
            </div>
            <div
              className="relative border bg-gray-900"
              style={{
                width: '100%',
                height: rows * rowHeight,
                backgroundImage:
                  `repeating-linear-gradient(to right, #555 0, #555 1px, transparent 1px, transparent ${timeScale}px)` +
                  (timeScale >= 40
                    ? `, repeating-linear-gradient(to right, rgba(85,85,85,0.5) 0, rgba(85,85,85,0.5) 1px, transparent 1px, transparent ${timeScale / 2}px)`
                    : '') +
                  (timeScale >= 180
                    ? `, repeating-linear-gradient(to right, transparent 0, transparent ${timeScale / 10}px, rgba(85,85,85,0.3) ${timeScale / 10}px, rgba(85,85,85,0.3) ${timeScale / 10 + 1}px)`
                    : '') +
                  `, repeating-linear-gradient(to bottom, #555 0, #555 1px, transparent 1px, transparent ${rowHeight}px)`,
              }}
              onMouseMove={(e) => {
                if (dragging) {
                  if (playheadTimer.current) {
                    clearTimeout(playheadTimer.current)
                    playheadTimer.current = null
                  }
                  setPlayhead(getTimeFromClientX(e.clientX))
                  if (containerRef.current) containerRef.current.scrollLeft = scrollLock.current
                } else if (movingSkill) {
                  if (containerRef.current) containerRef.current.scrollLeft = scrollLock.current
                }
              }}
              onMouseUp={() => {
                if (playheadTimer.current) {
                  clearTimeout(playheadTimer.current)
                  playheadTimer.current = null
                }
                setDragging(false)
              }}
              onMouseLeave={() => {
                if (playheadTimer.current) {
                  clearTimeout(playheadTimer.current)
                  playheadTimer.current = null
                }
                setDragging(false)
              }}
              onTouchMove={(e) => {
                if (dragging) {
                  if (playheadTimer.current) {
                    clearTimeout(playheadTimer.current)
                    playheadTimer.current = null
                  }
                  setPlayhead(getTimeFromClientX(e.touches[0].clientX))
                  if (containerRef.current) containerRef.current.scrollLeft = scrollLock.current
                } else if (movingSkill) {
                  if (containerRef.current) containerRef.current.scrollLeft = scrollLock.current
                }
              }}
              onTouchEnd={() => {
                if (playheadTimer.current) {
                  clearTimeout(playheadTimer.current)
                  playheadTimer.current = null
                }
                setDragging(false)
              }}
              onTouchCancel={() => {
                if (playheadTimer.current) {
                  clearTimeout(playheadTimer.current)
                  playheadTimer.current = null
                }
                setDragging(false)
              }}
            >
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-red-500"
                style={{ left: playhead * timeScale, zIndex: 15 }}
              >
                <div
                  className="absolute -left-2 top-0 bottom-0 w-4 cursor-ew-resize"
                  onMouseDown={(e) => {
                    e.stopPropagation()
                    if (playheadTimer.current) {
                      clearTimeout(playheadTimer.current)
                      playheadTimer.current = null
                    }
                    setPlayheadMenu(null)
                    scrollLock.current = containerRef.current?.scrollLeft ?? 0
                    setDragging(true)
                    setPlayhead(getTimeFromClientX(e.clientX))
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault()
                    if (playheadTimer.current) {
                      clearTimeout(playheadTimer.current)
                      playheadTimer.current = null
                    }
                    setDragging(false)
                    setPlayheadMenu({ x: e.clientX, y: e.clientY })
                  }}
                  onTouchStart={(e) => {
                    e.stopPropagation()
                    const t = e.touches[0]
                    if (playheadTimer.current) {
                      clearTimeout(playheadTimer.current)
                      playheadTimer.current = null
                    }
                    setPlayheadMenu(null)
                    scrollLock.current = containerRef.current?.scrollLeft ?? 0
                    setDragging(true)
                    setPlayhead(getTimeFromClientX(t.clientX))
                    playheadTimer.current = setTimeout(() => {
                      setPlayheadMenu({ x: t.clientX, y: t.clientY })
                      setDragging(false)
                    }, 600)
                  }}
                  onTouchEnd={() => {
                    if (playheadTimer.current) {
                      clearTimeout(playheadTimer.current)
                      playheadTimer.current = null
                    }
                    setDragging(false)
                  }}
                  onTouchCancel={() => {
                    if (playheadTimer.current) {
                      clearTimeout(playheadTimer.current)
                      playheadTimer.current = null
                    }
                    setDragging(false)
                  }}
                />
              </div>
              {markers.map((m) => {
                let timer: NodeJS.Timeout | null = null
                const startTouch = (e: React.TouchEvent) => {
                  timer = setTimeout(() => {
                    const t = e.touches[0]
                    setSelected([{ type: 'marker', id: m.id }])
                    if (m.label) {
                      setMarkers((prev) =>
                        prev.map((mk) => ({ ...mk, show: mk.id === m.id }))
                      )
                    }
                    setEventMenu({ type: 'marker', id: m.id, x: t.clientX, y: t.clientY })
                  }, 600)
                }
                const clearTouch = () => {
                  if (timer) clearTimeout(timer)
                }
                const pluginMarker = getPluginDecorForMarker(m)
                if (pluginMarker.hide) return null
                return (
                  <div
                    key={m.id}
                    className={`absolute bg-yellow-400 cursor-pointer opacity-70 tl-marker ${pluginMarker.addClass} ${
                      selected.some((sel) => sel.type === 'marker' && sel.id === m.id)
                        ? 'ring-2 ring-red-500'
                        : ''
                    }`}
                    style={{
                      ...pluginMarker.style,
                      left: m.time * timeScale,
                      top: 0,
                      width: Math.max(m.duration * timeScale, 4),
                      height: rows * rowHeight,
                      touchAction: 'pan-x',
                    }}
                    onClick={(e) => {
                      e.stopPropagation()
                      if (e.shiftKey) {
                        setSelected((prev) => {
                          const exists = prev.find((sel) => sel.type === 'marker' && sel.id === m.id)
                          if (exists) return prev.filter((sel) => !(sel.type === 'marker' && sel.id === m.id))
                          return [...prev, { type: 'marker', id: m.id }]
                        })
                      } else if (selected.length === 1 && selected[0].type === 'marker' && selected[0].id === m.id) {
                        setMarkers((prev) =>
                          prev.map((mk) => (mk.id === m.id ? { ...mk, show: !mk.show } : mk))
                        )
                      } else {
                        setSelected([{ type: 'marker', id: m.id }])
                        if (m.label) {
                          setMarkers((prev) =>
                            prev.map((mk) => ({ ...mk, show: mk.id === m.id }))
                          )
                        }
                      }
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault()
                      setEventMenu({ type: 'marker', id: m.id, x: e.clientX, y: e.clientY })
                    }}
                    onTouchStart={startTouch}
                    onTouchEnd={clearTouch}
                    onTouchCancel={clearTouch}
                  >
                    {m.show && (
                      <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-yellow-200 border px-1 rounded whitespace-nowrap text-xs">
                        {m.label}
                      </div>
                    )}
                  </div>
                )
              })}
              {skills.map((ev) => {
                let timer: NodeJS.Timeout | null = null
                let startX = 0
                let startY = 0
                let moved = false
                const startTouch = (e: React.TouchEvent) => {
                  startX = e.touches[0].clientX
                  startY = e.touches[0].clientY
                  moved = false
                  if (moveModeSkill === ev.id) {
                    scrollLock.current = containerRef.current?.scrollLeft ?? 0
                    setMovingSkill({ id: ev.id, offset: startX - ev.start * timeScale })
                  } else {
                    timer = setTimeout(() => {
                      if (!moved) {
                        setEventMenu({ type: 'skill', id: ev.id, x: startX, y: startY })
                      }
                    }, 600)
                  }
                }
                const moveTouch = (e: React.TouchEvent) => {
                  const clientX = e.touches[0].clientX
                  if (movingSkill && movingSkill.id === ev.id) {
                    const newStart = snapTime((clientX - movingSkill.offset) / timeScale)
                    const delta = newStart - ev.start
                    setSkills((prev) =>
                      prev.map((sk) =>
                        sk.id === ev.id ? { ...sk, start: newStart, end: sk.end + delta } : sk
                      )
                    )
                    if (containerRef.current) containerRef.current.scrollLeft = scrollLock.current
                  } else if (timer && Math.abs(clientX - startX) > 5) {
                    moved = true
                    clearTimeout(timer)
                    timer = null
                  }
                }
                const clearTouch = () => {
                  if (timer) {
                    clearTimeout(timer)
                    timer = null
                  }
                  if (movingSkill && movingSkill.id === ev.id) {
                    setMovingSkill(null)
                    setMoveModeSkill(null)
                    return
                  }
                  if (!moved) {
                    const rect = { right: startX, top: startY }
                    const st = students.find((s) => s.id === rowStudents[ev.row])
                    const stats = getStats(rowStudents[ev.row])
                    const level = getSkillLevel(ev.type as 'ex' | 'normal', stats)
                    const skill =
                      ev.type === 'normal'
                        ? st?.skills?.normal
                        : st?.skills?.ex
                    const text = formatSkillText(skill, level)
                    const targetId = getEffectiveTarget(ev)
                    const targetName = isTargetableSkill(ev)
                      ? (() => {
                          const id = rowStudents[targetId]
                          const st2 = students.find((s) => s.id === id)
                          const en = enemies.find((e) => `enemy:${e.id}` === id)
                          return st2 ? st2.name : en ? en.name : `行${targetId + 1}`
                        })()
                      : undefined
                    setSelected([{ type: 'skill', id: ev.id }])
                    if (ev.label) {
                      setSkills((prev) => prev.map((sk) => ({ ...sk, show: sk.id === ev.id })))
                    }
                    setSkillPopup({
                      id: ev.id,
                      x: rect.right,
                      y: rect.top,
                      text: text || '',
                      target: targetName,
                    })
                 }
               }
                const pluginSkill = getPluginDecorForSkill(ev)
                if (pluginSkill.hide) return null
                return (
                  <div
                    key={ev.id}
                    className={`absolute text-white text-xs px-1 overflow-hidden z-10 tl-skill tl-skill-${ev.type} ${pluginSkill.addClass} ${
                      selected.some((sel) => sel.type === 'skill' && sel.id === ev.id)
                        ? 'ring-2 ring-red-500'
                        : ''
                    }`}
                    style={{
                      ...pluginSkill.style,
                      left: ev.start * timeScale,
                      top: ev.row * rowHeight,
                      width: (ev.end - ev.start) * timeScale,
                      height: rowHeight - 2,
                      touchAction: 'pan-x',
                    }}
                    onMouseDown={(e) => {
                      if (moveModeSkill === ev.id) {
                        scrollLock.current = containerRef.current?.scrollLeft ?? 0
                        setMovingSkill({ id: ev.id, offset: e.clientX - ev.start * timeScale })
                      }
                    }}
                    onMouseMove={(e) => {
                      if (movingSkill && movingSkill.id === ev.id) {
                        const newStart = snapTime((e.clientX - movingSkill.offset) / timeScale)
                        const delta = newStart - ev.start
                        setSkills((prev) =>
                          prev.map((sk) =>
                            sk.id === ev.id ? { ...sk, start: newStart, end: sk.end + delta } : sk
                          )
                        )
                        if (containerRef.current) containerRef.current.scrollLeft = scrollLock.current
                      }
                    }}
                    onMouseUp={() => {
                      if (movingSkill && movingSkill.id === ev.id) {
                        setMovingSkill(null)
                        setMoveModeSkill(null)
                      }
                    }}
                    onMouseLeave={() => {
                      if (movingSkill && movingSkill.id === ev.id) {
                        setMovingSkill(null)
                        setMoveModeSkill(null)
                      }
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault()
                      setEventMenu({ type: 'skill', id: ev.id, x: e.clientX, y: e.clientY })
                    }}
                    onClick={(e) => {
                      e.stopPropagation()
                      const rect = (
                        e.currentTarget as HTMLDivElement
                      ).getBoundingClientRect()
                      const st = students.find((s) => s.id === rowStudents[ev.row])
                      const stats = getStats(rowStudents[ev.row])
                      const level = getSkillLevel(ev.type as 'ex' | 'normal', stats)
                      const skill =
                        ev.type === 'normal'
                          ? st?.skills?.normal
                          : st?.skills?.ex
                      const text = formatSkillText(skill, level)
                      const targetId = getEffectiveTarget(ev)
                      const targetName = isTargetableSkill(ev)
                        ? (() => {
                            const id = rowStudents[targetId]
                            const st2 = students.find((s) => s.id === id)
                            const en = enemies.find((e) => `enemy:${e.id}` === id)
                            return st2 ? st2.name : en ? en.name : `行${targetId + 1}`
                          })()
                        : undefined
                      if (selected.some((sel) => sel.type === 'skill' && sel.id === ev.id)) {
                        const newShow = !ev.show
                        setSkills((prev) =>
                          prev.map((sk) =>
                            sk.id === ev.id ? { ...sk, show: newShow } : sk
                          )
                        )
                        if (newShow) {
                          setSkillPopup({
                            id: ev.id,
                            x: rect.right,
                            y: rect.top,
                            text: text || '',
                            target: targetName,
                          })
                        } else if (skillPopup && skillPopup.id === ev.id) {
                          setSkillPopup(null)
                        }
                      } else if (e.shiftKey) {
                        setSelected((prev) => {
                          const exists = prev.find((sel) => sel.type === 'skill' && sel.id === ev.id)
                          if (exists) return prev.filter((sel) => !(sel.type === 'skill' && sel.id === ev.id))
                          return [...prev, { type: 'skill', id: ev.id }]
                        })
                      } else {
                        setSelected([{ type: 'skill', id: ev.id }])
                        if (ev.label) {
                          setSkills((prev) =>
                            prev.map((sk) => ({ ...sk, show: sk.id === ev.id }))
                          )
                        }
                        setSkillPopup({
                          id: ev.id,
                          x: rect.right,
                          y: rect.top,
                          text: text || '',
                          target: targetName,
                        })
                      }
                    }}
                    onTouchStart={startTouch}
                    onTouchMove={moveTouch}
                    onTouchEnd={() => {
                      clearTouch()
                    }}
                    onTouchCancel={() => {
                      clearTouch()
                    }}
                  >
                    {(() => {
                      const colors =
                        ev.type === 'ex' ? skillColors.ex : skillColors.normal
                      const travelW = Math.min(ev.travel || 0, ev.end - ev.start)
                      const motionW = Math.min(
                        ev.motion || ev.end - ev.start - travelW,
                        ev.end - ev.start - travelW
                      )
                      const restW =
                        ev.end - ev.start - travelW - motionW
                      return (
                        <>
                          <div
                            className="absolute inset-y-0 left-0 z-0"
                            style={{
                              width: travelW * timeScale,
                              backgroundColor: toRgba(
                                colors.travel.color,
                                colors.travel.alpha,
                              ),
                            }}
                          />
                          <div
                            className="absolute inset-y-0 z-0"
                            style={{
                              left: travelW * timeScale,
                              width: motionW * timeScale,
                              backgroundColor: toRgba(
                                colors.motion.color,
                                colors.motion.alpha,
                              ),
                            }}
                          />
                          {restW > 0 && (
                            <div
                              className="absolute inset-y-0 z-0"
                              style={{
                                left: (travelW + motionW) * timeScale,
                                width: restW * timeScale,
                                backgroundColor: toRgba(
                                  colors.rest.color,
                                  colors.rest.alpha,
                                ),
                              }}
                            />
                          )}
                        </>
                      )
                    })()}
                    <span className="relative z-10 pointer-events-none">{ev.label}</span>
                    {dangerSkills.has(ev.id) && (
                      <span className="absolute -top-1 -right-1 text-red-600">
                        <FontAwesomeIcon icon={faExclamationTriangle} />
                      </span>
                    )}
                    {ev.show && ev.label && (
                      <div
                        className={`absolute -top-6 left-1/2 -translate-x-1/2 ${
                          ev.type === 'ex' ? 'bg-blue-200' : 'bg-green-200'
                        } border px-1 rounded whitespace-nowrap text-xs text-black z-20`}
                      >
                        {ev.label}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
      {menuInfo && (
        <div
          className="fixed bg-white border rounded shadow text-sm z-50"
          style={{ left: menuInfo.x, top: menuInfo.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => {
              removeRow(menuInfo.index)
              setMenuInfo(null)
            }}
            className="block w-full text-left px-2 py-1 hover:bg-gray-200"
          >
            行削除
          </button>
        </div>
      )}
      {eventMenu && (
        <div
          className="fixed bg-white border rounded shadow text-sm z-50"
          style={{ left: eventMenu.x, top: eventMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          {eventMenu.type === 'skill' && (() => {
            const ev = skills.find((s) => s.id === eventMenu.id)
            if (ev && isTargetableSkill(ev)) {
              return (
                <button
                  type="button"
                  onClick={() => {
                    setBuffMenu({ id: eventMenu.id, x: eventMenu.x, y: eventMenu.y })
                    setEventMenu(null)
                  }}
                  className="block w-full text-left px-2 py-1 hover:bg-gray-200"
                >
                  ターゲット設定
                </button>
              )
            }
            return null
          })()}
          <button
            type="button"
            onClick={() => {
              if (eventMenu.type === 'skill') {
                const ev = skills.find((s) => s.id === eventMenu.id)
                if (ev) {
                  setCopied({ skills: [{ ...ev }], markers: [] })
                  removeSkill(ev.id)
                }
              } else {
                const mk = markers.find((m) => m.id === eventMenu.id)
                if (mk) {
                  setCopied({ skills: [], markers: [{ ...mk }] })
                  removeMarker(mk.id)
                }
              }
              setEventMenu(null)
            }}
            className="block w-full text-left px-2 py-1 hover:bg-gray-200"
          >
            カット
          </button>
          <button
            type="button"
            onClick={() => {
              if (eventMenu.type === 'skill') {
                const ev = skills.find((s) => s.id === eventMenu.id)
                if (ev) setCopied({ skills: [{ ...ev }], markers: [] })
              } else {
                const mk = markers.find((m) => m.id === eventMenu.id)
                if (mk) setCopied({ skills: [], markers: [{ ...mk }] })
              }
              setEventMenu(null)
            }}
            className="block w-full text-left px-2 py-1 hover:bg-gray-200"
          >
            コピー
          </button>
          {eventMenu.type === 'skill' && (
            <button
              type="button"
              onClick={() => {
                setMoveModeSkill(eventMenu.id)
                setEventMenu(null)
              }}
              className="block w-full text-left px-2 py-1 hover:bg-gray-200"
            >
              移動モード
            </button>
          )}
          {copied && (
            <button
              type="button"
              onClick={() => {
                const base = snapTime(playhead)
                copied.skills.forEach((ev, idx) => {
                  const id = Date.now() + idx
                  const duration = ev.end - ev.start
                  const travel = ev.travel || 0
                  const motion = ev.motion
                  setSkills((prev) => [
                    ...prev,
                    {
                      ...ev,
                      id,
                      start: base,
                      end: snapTime(base + duration),
                      travel,
                      motion,
                      type: ev.type,
                    },
                  ])
                })
                copied.markers.forEach((mk, idx) => {
                  const id = Date.now() + copied.skills.length + idx
                  setMarkers((prev) => [
                    ...prev,
                    { ...mk, id, time: base },
                  ])
                })
                setEventMenu(null)
              }}
              className="block w-full text-left px-2 py-1 hover:bg-gray-200"
            >
              ペースト
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              if (eventMenu.type === 'skill') {
                removeSkill(eventMenu.id)
              } else {
                removeMarker(eventMenu.id)
              }
              setEventMenu(null)
            }}
            className="block w-full text-left px-2 py-1 hover:bg-gray-200"
          >
            削除
          </button>
        </div>
      )}
      {playheadMenu && (
        <div
          className="fixed bg-white border rounded shadow text-sm z-50"
          style={{ left: playheadMenu.x, top: playheadMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          {copied && (
            <button
              type="button"
              onClick={() => {
                const base = snapTime(playhead)
                copied.skills.forEach((ev, idx) => {
                  const id = Date.now() + idx
                  const duration = ev.end - ev.start
                  const travel = ev.travel || 0
                  setSkills((prev) => [
                    ...prev,
                    {
                      ...ev,
                      id,
                      start: base,
                      end: snapTime(base + duration),
                      travel,
                      type: ev.type,
                    },
                  ])
                })
                copied.markers.forEach((mk, idx) => {
                  const id = Date.now() + copied.skills.length + idx
                  setMarkers((prev) => [
                    ...prev,
                    { ...mk, id, time: base },
                  ])
                })
                setPlayheadMenu(null)
              }}
              className="block w-full text-left px-2 py-1 hover:bg-gray-200"
            >
              ここにペースト
            </button>
          )}
          <button
            type="button"
            onClick={() => setPlayheadMenu(null)}
            className="block w-full text-left px-2 py-1 hover:bg-gray-200"
          >
          閉じる
        </button>
        </div>
      )}
      {buffMenu && (
        <div
          className="fixed bg-white border rounded shadow text-sm z-50"
          style={{ left: buffMenu.x, top: buffMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          {(() => {
            const sk = skills.find((s) => s.id === buffMenu.id)
            const t = sk ? getSkillType(sk) : undefined
            const enemiesOnly = t === 'attack' || t === 'debuff'
            return rowStudents.map((id, idx) => {
              if (enemiesOnly && !id.startsWith('enemy:')) return null
              const st = students.find((s) => s.id === id)
              const enemy = enemies.find((e) => `enemy:${e.id}` === id)
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setSkills((prev) =>
                      prev.map((sk2) =>
                        sk2.id === buffMenu.id ? { ...sk2, target: idx } : sk2
                      )
                    )
                    setBuffMenu(null)
                  }}
                  className="block w-full text-left px-2 py-1 hover:bg-gray-200"
                >
                  {st ? st.name : enemy ? enemy.name : `行${idx + 1}`}
                </button>
              )
            })
          })()}
        </div>
      )}
      {buffPopup && (
        <div
          className="fixed bg-white border rounded shadow text-sm z-50 px-2 py-1"
          style={{ left: buffPopup.x, top: buffPopup.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="border-b mb-1 pb-1">
            {buffPopup.info.map((inf, i) => (
              
              
    <div key={i}>
      {resolveBuffText(
        inf,
        buffPopup.studentId,
        buffPopup.values
      )}
    </div>
  ))}
          </div>
          {buffPopup.buffs.length ? (
            buffPopup.buffs.map((b, i) => <div key={i}>{b}</div>)
          ) : (
            <div>バフなし</div>
          )}
        </div>
      )}
      {skillPopup && (
        <div
          className="fixed bg-white border rounded shadow text-sm z-50 px-2 py-1"
          style={{ left: skillPopup.x, top: skillPopup.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="whitespace-pre-wrap mb-1">{skillPopup.text}</div>
          {skillPopup.target && <div>対象: {skillPopup.target}</div>}
        </div>
      )}
      </div>
      {showDamageCalc && selected.length === 1 && selected[0].type === 'skill' && (() => {
        const ev = skills.find((s) => s.id === selected[0].id)
        if (!ev || getSkillType(ev) !== 'attack') return null
        const attackerId = rowStudents[ev.row]
        if (attackerId.startsWith('enemy:')) return null
        const attacker = students.find((s) => s.id === attackerId)
        if (!attacker) return null
        const atkStats = getStats(attacker.id)
        if (!atkStats) {
          return (
            <div className="mt-2 text-sm relative" ref={registerBlockRef('default:damageCalc')} style={getBlockStyle('default:damageCalc', 3000, 520)}>
              {renderBlockHandle('default:damageCalc', 520)}
              {renderBlockResizeHandle('default:damageCalc', 520, 420)}
              ステータスが設定されていません！
            </div>
          )
        }
        const specialRows = rowStudents.filter((id) => {
          if (!id || id.startsWith('enemy:')) return false
          const st = students.find((s) => s.id === id)
          return st?.role === 'SPECIAL'
        })
        const specials: number[] = []
        let missing = false
        specialRows.forEach((id) => {
          const st = students.find((s) => s.id === id)
          const base = st?.styleOf || st?.altOf || st?.id
          const stat = base ? getStats(st.id) : undefined
          if (!stat || stat.attack === undefined) missing = true
          else specials.push(Number(stat.attack))
        })
        if (missing) {
          return <div className="mt-2 text-sm">ステータスが設定されていません！</div>
        }

        const rawAtk = Number(atkStats.attack ?? 0)
        let specialSum = specials.reduce((a, b) => a + b, 0)
        let plusAdd = 0
        let passiveBuff = 0
        let critBuffnum = 0
        let critBuff = 0
        let typeBuff = 0
        const passiveLevel = atkStats.passive_skill ?? defaultLevels.passive
        const atkBuffArr = attacker.skills?.passive?.values?.attack
        const critBuffArr = attacker.skills?.passive?.values?.critdamage
        const typeArr = attacker.skills?.passive?.values?.type
        const typeArr_sub = attacker.skills?.sub?.values?.type
        if (atkBuffArr) {
          const val = atkBuffArr[passiveLevel - 1]
          if (val !== undefined) passiveBuff = Number(val)
        }
        if (Number(atkStats.unique_star ?? 0) >= 2) {
          const plusArr = attacker.skills?.passivePlus?.values?.attacknum
          if (plusArr) {
            const val = plusArr[passiveLevel - 1]
            if (val !== undefined) {
              plusAdd = Number(val)
              specialSum += plusAdd
            }
          }
        }
        if (critBuffArr) {
          const val = critBuffArr[passiveLevel - 1]
          if (val !== undefined) critBuff = Number(val)
        }
        if (Number(atkStats.unique_star ?? 0) >= 2) {
          const plusArr = attacker.skills?.passivePlus?.values?.critdamagenum
          if (plusArr) {
            const val = plusArr[passiveLevel - 1]
            if (val !== undefined) {
              critBuffnum = Number(val)
            }
          }
        }
        if (typeArr) {
          const val = typeArr[passiveLevel - 1]
          if (val !== undefined) typeBuff = Number(val)
        }
        if (typeArr_sub) {
          const val = typeArr_sub[passiveLevel - 1]
          if (val !== undefined) {
          typeBuff += Number(val)
          }
        }
        const t = ev.start + (ev.travel || 0)
        const equipPct = getEquipmentBonus(attacker, atkStats, 'percent')
        const equipFlat = getEquipmentBonus(attacker, atkStats, 'flat')
        const baseAtkBefore = rawAtk / ( 1 + equipPct.attackMul) + Math.floor(specialSum / 10) - equipFlat.attackAdd
        const attackBuff = getBuffBonus(ev.row, t, 'attack') // %の合計
        typeBuff += getBuffBonus(ev.row, t, 'type')
        const atkMul = (1+equipPct.attackMul) + passiveBuff / 100 + attackBuff / 100
        const battleAtk = (baseAtkBefore+equipFlat.attackAdd) * atkMul
        const skill = ev.type === 'ex' ? attacker.skills?.ex : attacker.skills?.normal
        const level = getSkillLevel(ev.type as 'ex' | 'normal', atkStats)
        const mult = Number(
          skill?.values?.damage?.[level - 1] ??
            skill?.values?.ex?.[level - 1] ??
            0
        )
        const targetIdx = getEffectiveTarget(ev)
        const targetRowId = rowStudents[targetIdx]
        const enemy = enemies.find((e) => `enemy:${e.id}` === targetRowId)
        const defense = Number(enemy?.stats?.defense ?? 0)
        const attackerLevel = Number(atkStats.level ?? 1)
        const enemyLevel = enemy?.level ?? attackerLevel
        const levelMul = (10000 - 200 * (attackerLevel - enemyLevel)) / 10000
        const baseTypeMul = armorBonus[attacker.attackType]?.[enemy?.armor || ''] ?? 1
        let typeMul = baseTypeMul === 2 ? baseTypeMul + typeBuff / 100 : baseTypeMul
        if (Number(atkStats.unique_star ?? 0) >= 4) {
          typeMul += 0.1
        }
        const exBuffMul = getExBuffMultiplier(ev.row, ev.start + (ev.travel || 0))
        const baseDmg =
          battleAtk *
          (mult / 100) *
          (10000 / (defense * 6 + 10000)) *
          levelMul *
          typeMul *
          exBuffMul
        const critResist = Number(enemy?.stats?.critResist ?? 0)
        const critMul = Math.max(10000, (20000 + equipFlat.critDamage + critBuffnum) * (1 + 1 * sumSpecialSub(rowStudents, 'crit') / 100 + equipPct.critDamage / 100 + critBuff / 100) - critResist) / 10000
        const dmg = baseDmg
        const crit = baseDmg * critMul
        const formula =
          `(((${rawAtk}/${equipPct.attackMul} + (${specialSum}${plusAdd ? `+${plusAdd}` : ''})/10) * (1+${equipPct.attackMul}+${passiveBuff}/100+${attackBuff}/100)) * (${mult}/100) * (10000/(${defense}*6+10000)) * ${levelMul.toFixed(2)} * ${typeMul.toFixed(3)} * ${exBuffMul.toFixed(3)})=${dmg}`
        const formula_crit = 
          `(((${rawAtk}/${equipPct.attackMul} + (${specialSum}${plusAdd ? `+${plusAdd}` : ''})/10) * (1+${equipPct.attackMul}+${passiveBuff}/100+${attackBuff}/100)) * (${mult}/100) * (10000/(${defense}*6+10000)) * ${levelMul.toFixed(2)} * ${typeMul.toFixed(3)} * ${exBuffMul.toFixed(3)} * ${critMul})=${crit}`

        const targetName = enemy
          ? enemy.name
          : students.find((s) => s.id === targetRowId)?.name ?? `行${targetIdx + 1}`

        return (
          <div className="mt-2 text-sm relative" ref={registerBlockRef('default:damageCalc')} style={getBlockStyle('default:damageCalc', 3000, 520)}>
            {renderBlockHandle('default:damageCalc', 520)}
              {renderBlockResizeHandle('default:damageCalc', 520, 420)}
            <div>対象: {targetName}</div>
            <div>ダメージ: {dmg.toFixed(0)}</div>
            <div>会心ダメージ: {crit.toFixed(0)}</div>
            <div className="text-xs text-gray-600 break-all">計算式: {formula}</div>
            <div className="text-xs text-gray-600 break-all">計算式(会心): {formula_crit}</div>
          </div>
        )
      })()}
        </Fragment>
      )}
    </main>
  )
}
