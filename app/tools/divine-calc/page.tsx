'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSession, useSupabaseClient } from '@supabase/auth-helpers-react'
import StudentSelect from '../../../components/StudentSelect'
import PageHelpButton from '../../../components/PageHelpButton'

type Student = {
  id: string
  name: string
  image: string
  imageFull?: string
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
  exHitDelay?: number
  normalHitDelay?: number
}

type Goal = 'star4' | 'star5_u1' | 'unique2' | 'unique3' | 'unique4'

const GOALS: Array<{ value: Goal; label: string }> = [
  { value: 'star4', label: '星4' },
  { value: 'star5_u1', label: '星5（固有1）' },
  { value: 'unique2', label: '固有2' },
  { value: 'unique3', label: '固有3' },
  { value: 'unique4', label: '固有4' },
]

function isGoal(v: string): v is Goal {
  return GOALS.some((g) => g.value === v)
}

const LS_GLOBAL = 'divine-calc.global.v2'
const LS_PER_STUDENT_PREFIX = 'divine-calc.student.v2:' // + studentId

function safeJsonParse(raw: string | null): unknown {
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function toNum(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

function clamp(n: number, min: number, max: number) {
  if (!Number.isFinite(n)) return min
  return Math.min(max, Math.max(min, n))
}

function nonNeg(n: number) {
  return Number.isFinite(n) ? Math.max(0, n) : 0
}

type StoredPerStudent = {
  studentDivine?: number
  remaining?: number
  rate?: number
  star?: number
  uniqueStar?: number
}

/**
 * レート（コスト/1個）は 20個ごとに +1、5で固定
 */
function tierFrom(star: number, uniqueStar: number): number {
  if (star >= 5 && uniqueStar >= 4) return 5
  if (star >= 5 && uniqueStar >= 3) return 4
  if (star >= 5 && uniqueStar >= 2) return 3
  if (star >= 5 && uniqueStar >= 1) return 2
  if (star >= 4) return 1
  return 0
}

function goalFromTier(tier: number): Goal {
  const t = clamp(tier, 1, 5)
  if (t === 1) return 'star4'
  if (t === 2) return 'star5_u1'
  if (t === 3) return 'unique2'
  if (t === 4) return 'unique3'
  return 'unique4'
}

function rateAtByOffset(baseRate: number, within: number, offset: number) {
  if (baseRate >= 5) return 5
  return Math.min(5, baseRate + Math.floor((within + offset) / 20))
}

export default function DivineCalcPage() {
  const session = useSession()
  const supabase = useSupabaseClient()

  const [students, setStudents] = useState<Student[]>([])
  const [selectedStudentId, setSelectedStudentId] = useState<string>('')

  // 入力
  const [totalDivine, setTotalDivine] = useState<number>(0) // 通貨（神名文字）
  const [studentDivine, setStudentDivine] = useState<number>(0) // 生徒の神名文字
  const [rate, setRate] = useState<number>(1) // 1〜5
  const [remaining, setRemaining] = useState<number>(20) // rate<5: 次のレートまで(1-20) / rate=5: 残り総数(1-200)

  // 星/固有星
  const [star, setStar] = useState<number>(3)
  const [uniqueStar, setUniqueStar] = useState<number>(0)
  const [hasStarData, setHasStarData] = useState<boolean>(false)

  // 目標
  const [goal, setGoal] = useState<Goal>('star4')

  // 生徒一覧（/api/students）
  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/students')
        if (!res.ok) return
        type ApiStudent = {
          id: string | number
          name: string
          image?: string
          imageFull?: string
          attackType?: string
          defenseType?: string
          hasAccessory?: boolean
          styleIds?: string[]
          styleOf?: string
          altIds?: string[]
          altOf?: string
          initialStars?: number
          role?: string
          characterType?: string
          position?: string
          exHitDelay?: number
          normalHitDelay?: number
        }
        const json: unknown = await res.json()
        const data: ApiStudent[] = Array.isArray(json) ? (json as ApiStudent[]) : []
        const list: Student[] = data.map((s) => ({
          id: String(s.id),
          name: String(s.name),
          image: typeof s.image === 'string' ? s.image : '',
          imageFull: typeof s.imageFull === 'string' ? s.imageFull : undefined,
          attackType: typeof s.attackType === 'string' ? s.attackType : '',
          defenseType: typeof s.defenseType === 'string' ? s.defenseType : '',
          hasAccessory: typeof s.hasAccessory === 'boolean' ? s.hasAccessory : undefined,
          styleIds: Array.isArray(s.styleIds) ? (s.styleIds as string[]) : undefined,
          styleOf: typeof s.styleOf === 'string' ? s.styleOf : undefined,
          altIds: Array.isArray(s.altIds) ? (s.altIds as string[]) : undefined,
          altOf: typeof s.altOf === 'string' ? s.altOf : undefined,
          initialStars: typeof s.initialStars === 'number' && Number.isFinite(s.initialStars) ? s.initialStars : 1,
          role: typeof s.role === 'string' ? s.role : '',
          characterType: typeof s.characterType === 'string' ? s.characterType : '',
          position: typeof s.position === 'string' ? s.position : '',
          exHitDelay: typeof s.exHitDelay === 'number' && Number.isFinite(s.exHitDelay) ? s.exHitDelay : undefined,
          normalHitDelay:
            typeof s.normalHitDelay === 'number' && Number.isFinite(s.normalHitDelay) ? s.normalHitDelay : undefined,
        }))
        setStudents(list)
        if (list[0]?.id && !selectedStudentId) setSelectedStudentId(list[0].id)
      } catch {
        // ignore
      }
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // global復元（通貨・選択生徒）
  useEffect(() => {
    const raw = safeJsonParse(localStorage.getItem(LS_GLOBAL))
    if (!raw || typeof raw !== 'object') return
    const o = raw as { totalDivine?: unknown; selectedStudentId?: unknown }
    const td = toNum(o.totalDivine)
    if (td !== null) setTotalDivine(nonNeg(td))
    if (typeof o.selectedStudentId === 'string') setSelectedStudentId(o.selectedStudentId)
  }, [])

  // global保存
  useEffect(() => {
    localStorage.setItem(
      LS_GLOBAL,
      JSON.stringify({
        totalDivine: nonNeg(totalDivine),
        selectedStudentId,
      })
    )
  }, [totalDivine, selectedStudentId])

  // レート変更時：remainingの上限を矯正
  useEffect(() => {
    const remMax = rate < 5 ? 20 : 200
    setRemaining((v) => clamp(v, 1, remMax))
  }, [rate, star, uniqueStar])

  // per-student復元
  const loadPerStudentLocal = useCallback(
    (studentId: string) => {
      const raw = safeJsonParse(localStorage.getItem(LS_PER_STUDENT_PREFIX + studentId))
      if (!raw || typeof raw !== 'object') return
      const o = raw as StoredPerStudent

      const sd = toNum(o.studentDivine)
      const rt = toNum(o.rate)
      const rm = toNum(o.remaining)
      const st = toNum(o.star)
      const us = toNum(o.uniqueStar)

      if (sd !== null) setStudentDivine(nonNeg(sd))
      if (rt !== null) setRate(clamp(rt, 1, 5))
      if (rm !== null) {
        const remMax = (rt ?? rate) < 5 ? 20 : 200
        setRemaining(clamp(rm, 1, remMax))
      }
      const nextStar = st !== null ? clamp(st, 1, 5) : star
      const nextUnique = us !== null ? clamp(us, 0, 4) : uniqueStar
      if (st !== null) setStar(nextStar)
      if (us !== null) setUniqueStar(nextUnique)
      if (st !== null || us !== null) {
        const nextTier = Math.min(5, tierFrom(nextStar, nextUnique) + 1)
        setGoal(goalFromTier(nextTier))
      }
    },
    [rate]
  )

  // per-student保存
  useEffect(() => {
    if (!selectedStudentId) return
    const remMax = rate < 5 ? 20 : 200
    const data: StoredPerStudent = {
      studentDivine: nonNeg(studentDivine),
      rate: clamp(rate, 1, 5),
      remaining: clamp(remaining, 1, remMax),
      // 星データが自動取得できない場合の入力値を保持
      star: clamp(star, 1, 5),
      uniqueStar: clamp(uniqueStar, 0, 4),
    }
    localStorage.setItem(LS_PER_STUDENT_PREFIX + selectedStudentId, JSON.stringify(data))
  }, [selectedStudentId, studentDivine, rate, remaining, star, uniqueStar])

  // 育成状況を自動取得（Supabase or localStorage userStudent:<id>）
  const refreshFromUserData = useCallback(
    async (studentId: string) => {
      // まずは手入力保存を復元
      loadPerStudentLocal(studentId)

      // 自動取得ヘルパ（共通）
      const applyRow = (row: Record<string, unknown>) => {
        const st = toNum(row.star)
        const us = toNum(row.unique_star)
        const has = st !== null || us !== null
        setHasStarData(has)
        const nextStar = st !== null ? clamp(st, 1, 5) : star
        const nextUnique = us !== null ? clamp(us, 0, 4) : uniqueStar
        if (st !== null) setStar(nextStar)
        if (us !== null) setUniqueStar(nextUnique)
        if (st !== null || us !== null) {
          const nextTier = Math.min(5, tierFrom(nextStar, nextUnique) + 1)
          setGoal(goalFromTier(nextTier))
        }

        // 生徒の神名文字（もし保存されているなら）
        const eleph = toNum(row.eleph) ?? toNum(row.studentDivine)
        if (eleph !== null) setStudentDivine(nonNeg(eleph))

        // 残り交換可能数（もし保存されているなら）
        const rm = toNum(row.remainingExchange) ?? toNum(row.remaining)
        if (rm !== null) {
          const remMax = rate < 5 ? 20 : 200
          setRemaining(clamp(rm, 1, remMax))
        }

        // 通貨（もし保存されているなら）
        const td = toNum(row.totalDivine) ?? toNum(row.eligma)
        if (td !== null) setTotalDivine(nonNeg(td))
      }

      if (session) {
        const { data } = await supabase
          .from('user_students')
          .select('*')
          .eq('user_id', session.user.id)
          .eq('student_id', studentId)
          .maybeSingle()

        if (data && typeof data === 'object') {
          applyRow(data as Record<string, unknown>)
        }
        return
      }

      const raw = localStorage.getItem(`userStudent:${studentId}`)
      const parsed = safeJsonParse(raw)
      if (parsed && typeof parsed === 'object') {
        applyRow(parsed as Record<string, unknown>)
      } else {
        setHasStarData(false)
      }
    },
    [loadPerStudentLocal, rate, session, supabase, star, uniqueStar]
  )

  // 生徒選択時に自動取得
  useEffect(() => {
    if (!selectedStudentId) return
    refreshFromUserData(selectedStudentId)
  }, [selectedStudentId, refreshFromUserData])

  // 残り交換可能数の解釈：
  // - rate<5: 次のレートに到達するまでの残り個数（1..20）
  // - rate=5: 残り総数（1..200）
  const calc = useMemo(() => {
    const A = nonNeg(totalDivine)
    const B = nonNeg(studentDivine)

    const r0 = clamp(rate, 1, 5)
    const remMax = r0 < 5 ? 20 : 200
    const rem = clamp(remaining, 1, remMax)

    // rate<5: 現在の20個区間内の進行度 0..19（次レートまで rem 個）
    const within = r0 < 5 ? clamp(20 - rem, 0, 19) : 0

    // 200上限における「既に交換済み数」を推定（rate=5は固定レートなので80起点でOK）
    const tierBase = r0 < 5 ? (r0 - 1) * 20 : 80
    const alreadyBought = r0 < 5 ? tierBase + within : 80

    // 総残り数（rate<5は200から推定、rate=5は入力値を採用）
    const totalRemaining = r0 < 5 ? clamp(200 - alreadyBought, 0, 200) : rem

    // 実際に買える数
    let budget = A
    let bought = 0
    let spent = 0
    for (let i = 0; i < totalRemaining; i++) {
      const cost = rateAtByOffset(r0, within, i)
      if (budget < cost) break
      budget -= cost
      spent += cost
      bought++
    }

    // 残りを全部買う合計コスト
    let costAll = 0
    for (let i = 0; i < totalRemaining; i++) costAll += rateAtByOffset(r0, within, i)
    const needMore = Math.max(0, costAll - A)

    return {
      currentRate: r0,
      toNextRateRemaining: r0 < 5 ? rem : 0,
      totalRemaining,
      bought,
      spent,
      leftCurrency: budget,
      afterStudentDivine: B + bought,
      afterRemainingTotal: Math.max(0, totalRemaining - bought),
      costAll,
      needMore,
    }
  }, [totalDivine, studentDivine, remaining, rate])

  // 目標までに必要な生徒神名文字
  const goalInfo = useMemo(() => {
    // 段階: 0=星3以下, 1=星4, 2=星5(固有1), 3=固有2, 4=固有3, 5=固有4
    const currentTier = (() => {
      if (star >= 5 && uniqueStar >= 4) return 5
      if (star >= 5 && uniqueStar >= 3) return 4
      if (star >= 5 && uniqueStar >= 2) return 3
      if (star >= 5 && uniqueStar >= 1) return 2
      if (star >= 4) return 1
      return 0
    })()

    const goalTier =
      goal === 'star4'
        ? 1
        : goal === 'star5_u1'
        ? 2
        : goal === 'unique2'
        ? 3
        : goal === 'unique3'
        ? 4
        : 5

    // 累計必要数（星3→星4:100、→固有1:+120、→固有2:+120、→固有3:+180、→固有4:+200）
    const cum = [0, 100, 220, 340, 520, 720] as const

    const needEleph = Math.max(0, cum[goalTier] - cum[currentTier])
    const afterEleph = nonNeg(studentDivine) + calc.bought
    const shortageNow = Math.max(0, needEleph - nonNeg(studentDivine))
    const shortageAfter = Math.max(0, needEleph - afterEleph)

    return { currentTier, goalTier, needEleph, afterEleph, shortageNow, shortageAfter }
  }, [goal, star, uniqueStar, studentDivine, calc.bought])

  const reset = () => {
    setTotalDivine(0)
    setStudentDivine(0)
    setRate(1)
    setRemaining(20)
    setGoal('star4')
    setStar(3)
    setUniqueStar(0)
    setHasStarData(false)
    if (selectedStudentId) {
      try {
        localStorage.removeItem(LS_PER_STUDENT_PREFIX + selectedStudentId)
      } catch {
        // ignore
      }
    }
  }

  const selectedStudent = students.find((s) => s.id === selectedStudentId)
  const remainingLabel = rate < 5 ? '残り交換可能数（次のレートまで 1〜20）' : '残り交換可能数（1〜200）'
  const remainingMax = rate < 5 ? 20 : 200

  return (
    <main className="p-4 max-w-5xl mx-auto space-y-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold">神名文字計算機</h1>
            <PageHelpButton pageKey="tools-divine-calc" />
          </div>
          <p className="text-sm opacity-70">
            生徒を選ぶと育成状況を自動取得します
          </p>
        </div>
        <button
          type="button"
          onClick={reset}
          className="text-sm px-3 py-2 rounded-lg border hover:bg-black/5 dark:hover:bg-white/10"
        >
          リセット
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <div className="space-y-4">


          <div className="grid gap-1">
            <span className="text-sm font-medium">目的の生徒</span>
            <StudentSelect students={students} value={selectedStudentId} onChange={setSelectedStudentId} />

            {selectedStudent?.image ? (
              <img
                src={selectedStudent.image}
                alt={selectedStudent.name}
                className="w-24 h-auto rounded border mt-2"
              />
            ) : null}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="grid gap-1">
              <span className="text-sm font-medium">現在の神名文字（通貨）</span>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                value={totalDivine}
                onChange={(e) => setTotalDivine(nonNeg(Number(e.target.value)))}
                className="w-full px-3 py-2 rounded-lg border bg-transparent"
              />
            </label>

            <label className="grid gap-1">
              <span className="text-sm font-medium">現在の生徒の神名文字</span>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                value={studentDivine}
                onChange={(e) => setStudentDivine(nonNeg(Number(e.target.value)))}
                className="w-full px-3 py-2 rounded-lg border bg-transparent"
              />
            </label>

            <label className="grid gap-1">
              <span className="text-sm font-medium">{remainingLabel}</span>
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={remainingMax}
                step={1}
                value={remaining}
                onChange={(e) => setRemaining(clamp(Number(e.target.value), 1, remainingMax))}
                className="w-full px-3 py-2 rounded-lg border bg-transparent"
              />
              {rate < 5 ? (
                <span className="text-xs opacity-70">例：レート3で「11」なら、次レート(4)までレート3で11回分</span>
              ) : (
                <span className="text-xs opacity-70">レート5では以降固定のため「残り総数」を入力</span>
              )}
            </label>

            <label className="grid gap-1">
              <span className="text-sm font-medium">現在の交換レート（1〜5）</span>
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={5}
                step={1}
                value={rate}
                onChange={(e) => setRate(clamp(Number(e.target.value), 1, 5))}
                className="w-full px-3 py-2 rounded-lg border bg-transparent"
              />
              <span className="text-xs opacity-70">20個交換ごとに+1、5で固定</span>
            </label>
          </div>

          {hasStarData ? (
            <div className="grid gap-1">
              <span className="text-sm font-medium">星 / 固有武器の星（自動取得）</span>
              <div className="px-3 py-2 rounded-lg border bg-transparent font-mono">
                星 {star} / 固有 {uniqueStar}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="grid gap-1">
                <span className="text-sm font-medium">星（手入力）</span>
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={5}
                  step={1}
                  value={star}
                  onChange={(e) => {
                const nextStar = clamp(Number(e.target.value), 1, 5)
                setStar(nextStar)
                const nextTier = Math.min(5, tierFrom(nextStar, uniqueStar) + 1)
                setGoal(goalFromTier(nextTier))
              }}
                  className="w-full px-3 py-2 rounded-lg border bg-transparent"
                />
              </label>
              <label className="grid gap-1">
                <span className="text-sm font-medium">固有武器の星（手入力）</span>
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={4}
                  step={1}
                  value={uniqueStar}
                  onChange={(e) => {
                const nextUnique = clamp(Number(e.target.value), 0, 4)
                setUniqueStar(nextUnique)
                const nextTier = Math.min(5, tierFrom(star, nextUnique) + 1)
                setGoal(goalFromTier(nextTier))
              }}
                  className="w-full px-3 py-2 rounded-lg border bg-transparent"
                />
              </label>
            </div>
          )}

          <label className="grid gap-1">
            <span className="text-sm font-medium">目標</span>
            <select
              value={goal}
              onChange={(e) => {
                const v = e.target.value
                if (isGoal(v)) setGoal(v)
              }}
              className="w-full px-3 py-2 rounded-lg border bg-transparent"
            >
              {GOALS.map((g) => (
                <option key={g.value} value={g.value}>
                  {g.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="space-y-4">


          <div className="rounded-xl border p-4">
            <h2 className="font-bold mb-2">計算結果（レート変動込み）</h2>
            <div className="grid gap-2 text-sm">
              <div className="flex justify-between gap-3">
                <span className="opacity-70">残り（総数）</span>
                <span className="font-mono">{calc.totalRemaining}</span>
              </div>
              {calc.toNextRateRemaining > 0 ? (
                <div className="flex justify-between gap-3">
                  <span className="opacity-70">次レートまで残り</span>
                  <span className="font-mono">{calc.toNextRateRemaining}</span>
                </div>
              ) : null}

              <div className="flex justify-between gap-3">
                <span className="opacity-70">実際に交換できる数</span>
                <span className="font-mono">{calc.bought}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="opacity-70">消費した神名文字</span>
                <span className="font-mono">{calc.spent}</span>
              </div>

              <hr className="my-1 opacity-40" />

              <div className="flex justify-between gap-3">
                <span className="opacity-70">交換後の神名文字（残り）</span>
                <span className="font-mono">{calc.leftCurrency}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="opacity-70">交換後の生徒の神名文字</span>
                <span className="font-mono">{calc.afterStudentDivine}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="opacity-70">交換後の残り（総数）</span>
                <span className="font-mono">{calc.afterRemainingTotal}</span>
              </div>

              <hr className="my-1 opacity-40" />

              <div className="flex justify-between gap-3">
                <span className="opacity-70">残りを全部交換する合計コスト</span>
                <span className="font-mono">{calc.costAll}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="opacity-70">残りを全部交換する不足分</span>
                <span className="font-mono">{calc.needMore}</span>
              </div>
            </div>
          </div>

          <div className="rounded-xl border p-4">
            <h2 className="font-bold mb-2">目標まで</h2>
            <div className="grid gap-2 text-sm">
              <div className="flex justify-between">
                <span className="opacity-70">追加で必要な生徒の神名文字</span>
                <span className="font-mono">{goalInfo.needEleph}</span>
              </div>
              <div className="flex justify-between">
                <span className="opacity-70">現時点の不足</span>
                <span className="font-mono">{goalInfo.shortageNow}</span>
              </div>
              <div className="flex justify-between">
                <span className="opacity-70">交換後の不足</span>
                <span className="font-mono">{goalInfo.shortageAfter}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

    </main>
  )
}
