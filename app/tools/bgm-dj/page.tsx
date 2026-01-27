'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import type { BgmTrack } from '../../../lib/minigames/bgm-quiz'
import { getBgmTrackDisplayTitle, getBgmTracks } from '../../../lib/minigames/bgm-quiz'
import AudioWithFallback from '../../../components/AudioWithFallback'

type DeckId = 'A' | 'B'

type DeckState = {
  track: BgmTrack | null
  isPlaying: boolean
  volume: number
  eqLow: number
  eqMid: number
  eqHigh: number
  pitch: number
  bpm: number
  loopBeats: number | null
  loopStart: number | null
  hotCues: Array<number | null>
  filterType: 'off' | 'lowpass' | 'highpass'
  filterAmount: number
  delayAmount: number
  keyLabel: string
}

type DeckNodes = {
  source: MediaElementAudioSourceNode
  low: BiquadFilterNode
  mid: BiquadFilterNode
  high: BiquadFilterNode
  filter: BiquadFilterNode
  delay: DelayNode
  feedback: GainNode
  dry: GainNode
  wet: GainNode
  deckGain: GainNode
  crossGain: GainNode
  analyser: AnalyserNode
}

type MasterNodes = {
  masterInput: GainNode
  splitter: ChannelSplitterNode
  merger: ChannelMergerNode
  speakerLeft: GainNode
  speakerRight: GainNode
}

const clamp = (value: number, min = 0, max = 1) => Math.min(Math.max(value, min), max)

const createInitialDeckState = (): DeckState => ({
  track: null,
  isPlaying: false,
  volume: 0.8,
  eqLow: 0,
  eqMid: 0,
  eqHigh: 0,
  pitch: 0,
  bpm: 120,
  loopBeats: null,
  loopStart: null,
  hotCues: [null, null, null],
  filterType: 'off',
  filterAmount: 0,
  delayAmount: 0,
  keyLabel: '—',
})

const LOOP_BEATS = [2, 4, 8, 16]

const applyCrossfaderCurve = (value: number, curve: 'linear' | 'sharp') => {
  if (curve === 'linear') {
    return {
      left: 1 - value,
      right: value,
    }
  }
  const left = Math.cos(value * 0.5 * Math.PI)
  const right = Math.sin(value * 0.5 * Math.PI)
  return { left, right }
}

const calculatePlaybackRate = (pitch: number) => 1 + pitch / 100

const calculateLoopSeconds = (beats: number, bpm: number) => (60 / Math.max(1, bpm)) * beats

export default function BgmDjPage() {
  const t = useTranslations('bgm-dj')
  const tracks = useMemo(() => getBgmTracks(), [])
  const [query, setQuery] = useState('')
  const [crossfader, setCrossfader] = useState(0.5)
  const [crossCurve, setCrossCurve] = useState<'linear' | 'sharp'>('linear')
  const [speakerLeftVolume, setSpeakerLeftVolume] = useState(0.9)
  const [speakerRightVolume, setSpeakerRightVolume] = useState(0.9)

  const [deckA, setDeckA] = useState<DeckState>(() => createInitialDeckState())
  const [deckB, setDeckB] = useState<DeckState>(() => createInitialDeckState())

  const audioContextRef = useRef<AudioContext | null>(null)
  const masterNodesRef = useRef<MasterNodes | null>(null)
  const deckNodesRef = useRef<Partial<Record<DeckId, DeckNodes>>>({})

  const deckARef = useRef<HTMLAudioElement | null>(null)
  const deckBRef = useRef<HTMLAudioElement | null>(null)

  const waveformCanvasA = useRef<HTMLCanvasElement | null>(null)
  const waveformCanvasB = useRef<HTMLCanvasElement | null>(null)

  const filteredTracks = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return tracks
    return tracks.filter((track) => {
      const title = getBgmTrackDisplayTitle(track).toLowerCase()
      return (
        title.includes(normalized) ||
        track.category.toLowerCase().includes(normalized) ||
        track.file.toLowerCase().includes(normalized)
      )
    })
  }, [query, tracks])

  const ensureAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext()
    }
    if (!masterNodesRef.current && audioContextRef.current) {
      const ctx = audioContextRef.current
      const masterInput = ctx.createGain()
      const splitter = ctx.createChannelSplitter(2)
      const merger = ctx.createChannelMerger(2)
      const speakerLeft = ctx.createGain()
      const speakerRight = ctx.createGain()

      masterInput.connect(splitter)
      splitter.connect(speakerLeft, 0)
      splitter.connect(speakerRight, 1)
      speakerLeft.connect(merger, 0, 0)
      speakerRight.connect(merger, 0, 1)
      merger.connect(ctx.destination)

      masterNodesRef.current = { masterInput, splitter, merger, speakerLeft, speakerRight }
    }
    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume().catch(() => undefined)
    }
  }, [])

  const setupDeckNodes = useCallback(
    (deckId: DeckId, audioElement: HTMLAudioElement | null) => {
      if (!audioElement) return
      ensureAudioContext()
      const ctx = audioContextRef.current
      const masterNodes = masterNodesRef.current
      if (!ctx || !masterNodes) return

      if (deckNodesRef.current[deckId]) return

      const source = ctx.createMediaElementSource(audioElement)
      const low = ctx.createBiquadFilter()
      const mid = ctx.createBiquadFilter()
      const high = ctx.createBiquadFilter()
      const filter = ctx.createBiquadFilter()
      const delay = ctx.createDelay(1.0)
      const feedback = ctx.createGain()
      const dry = ctx.createGain()
      const wet = ctx.createGain()
      const deckGain = ctx.createGain()
      const crossGain = ctx.createGain()
      const analyser = ctx.createAnalyser()

      low.type = 'lowshelf'
      mid.type = 'peaking'
      high.type = 'highshelf'
      filter.type = 'lowpass'
      filter.frequency.value = 20000

      delay.delayTime.value = 0.2
      feedback.gain.value = 0.2

      source.connect(low)
      low.connect(mid)
      mid.connect(high)
      high.connect(filter)

      filter.connect(dry)
      filter.connect(delay)
      delay.connect(feedback)
      feedback.connect(delay)
      delay.connect(wet)

      dry.connect(deckGain)
      wet.connect(deckGain)

      deckGain.connect(analyser)
      deckGain.connect(crossGain)
      crossGain.connect(masterNodes.masterInput)

      deckNodesRef.current[deckId] = {
        source,
        low,
        mid,
        high,
        filter,
        delay,
        feedback,
        dry,
        wet,
        deckGain,
        crossGain,
        analyser,
      }
    },
    [ensureAudioContext],
  )

  const teardownDeckNodes = useCallback((deckId: DeckId) => {
    const nodes = deckNodesRef.current[deckId]
    if (!nodes) return
    nodes.source.disconnect()
    nodes.low.disconnect()
    nodes.mid.disconnect()
    nodes.high.disconnect()
    nodes.filter.disconnect()
    nodes.delay.disconnect()
    nodes.feedback.disconnect()
    nodes.dry.disconnect()
    nodes.wet.disconnect()
    nodes.deckGain.disconnect()
    nodes.crossGain.disconnect()
    nodes.analyser.disconnect()
    delete deckNodesRef.current[deckId]
  }, [])

  const updateDeckNodes = useCallback(
    (deckId: DeckId, state: DeckState) => {
      const nodes = deckNodesRef.current[deckId]
      if (!nodes) return
      nodes.deckGain.gain.value = clamp(state.volume)
      nodes.low.gain.value = state.eqLow
      nodes.mid.gain.value = state.eqMid
      nodes.high.gain.value = state.eqHigh

      nodes.filter.type = state.filterType === 'off' ? 'lowpass' : state.filterType
      const amount = clamp(state.filterAmount)
      const minFreq = 120
      const maxFreq = 20000
      if (state.filterType === 'off') {
        nodes.filter.frequency.value = maxFreq
      } else if (state.filterType === 'lowpass') {
        nodes.filter.frequency.value = minFreq + (1 - amount) * (maxFreq - minFreq)
      } else {
        nodes.filter.frequency.value = minFreq + amount * (maxFreq - minFreq)
      }

      const delayMix = clamp(state.delayAmount)
      nodes.dry.gain.value = 1 - delayMix
      nodes.wet.gain.value = delayMix
    },
    [],
  )

  useEffect(() => {
    if (deckA.track) {
      setupDeckNodes('A', deckARef.current)
    }
  }, [deckA.track, setupDeckNodes])

  useEffect(() => {
    if (deckB.track) {
      setupDeckNodes('B', deckBRef.current)
    }
  }, [deckB.track, setupDeckNodes])

  useEffect(() => {
    updateDeckNodes('A', deckA)
  }, [deckA, updateDeckNodes])

  useEffect(() => {
    updateDeckNodes('B', deckB)
  }, [deckB, updateDeckNodes])

  useEffect(() => {
    const masterNodes = masterNodesRef.current
    if (!masterNodes) return
    masterNodes.speakerLeft.gain.value = clamp(speakerLeftVolume)
    masterNodes.speakerRight.gain.value = clamp(speakerRightVolume)
  }, [speakerLeftVolume, speakerRightVolume])

  useEffect(() => {
    const nodesA = deckNodesRef.current.A
    const nodesB = deckNodesRef.current.B
    if (!nodesA || !nodesB) return
    const curve = applyCrossfaderCurve(crossfader, crossCurve)
    nodesA.crossGain.gain.value = curve.left
    nodesB.crossGain.gain.value = curve.right
  }, [crossfader, crossCurve])

  useEffect(() => {
    if (deckARef.current) {
      deckARef.current.playbackRate = calculatePlaybackRate(deckA.pitch)
    }
  }, [deckA.pitch])

  useEffect(() => {
    if (deckBRef.current) {
      deckBRef.current.playbackRate = calculatePlaybackRate(deckB.pitch)
    }
  }, [deckB.pitch])

  const handlePlayToggle = (deckId: DeckId) => {
    ensureAudioContext()
    if (deckId === 'A') {
      const audio = deckARef.current
      if (!audio || !deckA.track) return
      if (deckA.isPlaying) {
        audio.pause()
        setDeckA((prev) => ({ ...prev, isPlaying: false }))
        return
      }
      audio.play().catch(() => undefined)
      setDeckA((prev) => ({ ...prev, isPlaying: true }))
      return
    }
    const audio = deckBRef.current
    if (!audio || !deckB.track) return
    if (deckB.isPlaying) {
      audio.pause()
      setDeckB((prev) => ({ ...prev, isPlaying: false }))
      return
    }
    audio.play().catch(() => undefined)
    setDeckB((prev) => ({ ...prev, isPlaying: true }))
  }

  const handleCue = (deckId: DeckId) => {
    ensureAudioContext()
    if (deckId === 'A') {
      const audio = deckARef.current
      if (!audio) return
      audio.pause()
      audio.currentTime = 0
      setDeckA((prev) => ({ ...prev, isPlaying: false }))
      return
    }
    const audio = deckBRef.current
    if (!audio) return
    audio.pause()
    audio.currentTime = 0
    setDeckB((prev) => ({ ...prev, isPlaying: false }))
  }

  const loadTrackToDeck = (deckId: DeckId, track: BgmTrack) => {
    if (deckId === 'A') {
      teardownDeckNodes('A')
      setDeckA((prev) => ({
        ...prev,
        track,
        isPlaying: false,
        loopBeats: null,
        loopStart: null,
      }))
      return
    }
    teardownDeckNodes('B')
    setDeckB((prev) => ({
      ...prev,
      track,
      isPlaying: false,
      loopBeats: null,
      loopStart: null,
    }))
  }

  const handleHotCue = (deckId: DeckId, index: number) => {
    const audio = deckId === 'A' ? deckARef.current : deckBRef.current
    if (!audio) return
    if (deckId === 'A') {
      setDeckA((prev) => {
        const next = [...prev.hotCues]
        if (next[index] === null) {
          next[index] = audio.currentTime
        } else {
          audio.currentTime = next[index] ?? 0
        }
        return { ...prev, hotCues: next }
      })
      return
    }
    setDeckB((prev) => {
      const next = [...prev.hotCues]
      if (next[index] === null) {
        next[index] = audio.currentTime
      } else {
        audio.currentTime = next[index] ?? 0
      }
      return { ...prev, hotCues: next }
    })
  }

  const clearHotCue = (deckId: DeckId, index: number) => {
    if (deckId === 'A') {
      setDeckA((prev) => {
        const next = [...prev.hotCues]
        next[index] = null
        return { ...prev, hotCues: next }
      })
      return
    }
    setDeckB((prev) => {
      const next = [...prev.hotCues]
      next[index] = null
      return { ...prev, hotCues: next }
    })
  }

  const toggleLoop = (deckId: DeckId, beats: number) => {
    const audio = deckId === 'A' ? deckARef.current : deckBRef.current
    if (!audio) return
    if (deckId === 'A') {
      setDeckA((prev) => {
        if (prev.loopBeats === beats) {
          return { ...prev, loopBeats: null, loopStart: null }
        }
        return { ...prev, loopBeats: beats, loopStart: audio.currentTime }
      })
      return
    }
    setDeckB((prev) => {
      if (prev.loopBeats === beats) {
        return { ...prev, loopBeats: null, loopStart: null }
      }
      return { ...prev, loopBeats: beats, loopStart: audio.currentTime }
    })
  }

  const handleLoopTick = (deckId: DeckId, state: DeckState, audio: HTMLAudioElement | null) => {
    if (!audio || !state.loopBeats || state.loopStart === null) return
    const loopSeconds = calculateLoopSeconds(state.loopBeats, state.bpm)
    if (audio.currentTime >= state.loopStart + loopSeconds) {
      audio.currentTime = state.loopStart
    }
  }

  useEffect(() => {
    const interval = window.setInterval(() => {
      handleLoopTick('A', deckA, deckARef.current)
      handleLoopTick('B', deckB, deckBRef.current)
    }, 120)
    return () => window.clearInterval(interval)
  }, [deckA, deckB])

  const handleSync = (deckId: DeckId) => {
    if (deckId === 'A') {
      setDeckA((prev) => ({ ...prev, bpm: deckB.bpm, pitch: deckB.pitch }))
      if (deckARef.current) {
        deckARef.current.playbackRate = calculatePlaybackRate(deckB.pitch)
      }
      return
    }
    setDeckB((prev) => ({ ...prev, bpm: deckA.bpm, pitch: deckA.pitch }))
    if (deckBRef.current) {
      deckBRef.current.playbackRate = calculatePlaybackRate(deckA.pitch)
    }
  }

  const drawWaveform = useCallback((canvas: HTMLCanvasElement | null, analyser?: AnalyserNode) => {
    if (!canvas || !analyser) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const bufferLength = analyser.fftSize
    const dataArray = new Uint8Array(bufferLength)

    const render = () => {
      analyser.getByteTimeDomainData(dataArray)
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.lineWidth = 2
      ctx.strokeStyle = '#38bdf8'
      ctx.beginPath()
      const sliceWidth = canvas.width / bufferLength
      let x = 0
      for (let i = 0; i < bufferLength; i += 1) {
        const v = dataArray[i] / 128.0
        const y = (v * canvas.height) / 2
        if (i === 0) {
          ctx.moveTo(x, y)
        } else {
          ctx.lineTo(x, y)
        }
        x += sliceWidth
      }
      ctx.lineTo(canvas.width, canvas.height / 2)
      ctx.stroke()
      requestAnimationFrame(render)
    }
    render()
  }, [])

  useEffect(() => {
    const analyserA = deckNodesRef.current.A?.analyser
    const analyserB = deckNodesRef.current.B?.analyser
    if (analyserA) {
      analyserA.fftSize = 1024
      drawWaveform(waveformCanvasA.current, analyserA)
    }
    if (analyserB) {
      analyserB.fftSize = 1024
      drawWaveform(waveformCanvasB.current, analyserB)
    }
  }, [drawWaveform])

  const getVuLevel = (deckId: DeckId) => {
    const analyser = deckNodesRef.current[deckId]?.analyser
    if (!analyser) return 0
    const data = new Uint8Array(analyser.frequencyBinCount)
    analyser.getByteFrequencyData(data)
    const average = data.reduce((sum, value) => sum + value, 0) / data.length
    return clamp(average / 255)
  }

  const [vuA, setVuA] = useState(0)
  const [vuB, setVuB] = useState(0)

  useEffect(() => {
    let rafId: number
    const tick = () => {
      setVuA(getVuLevel('A'))
      setVuB(getVuLevel('B'))
      rafId = requestAnimationFrame(tick)
    }
    tick()
    return () => cancelAnimationFrame(rafId)
  }, [])

  const renderDeck = (deckId: DeckId, state: DeckState, setState: (next: DeckState) => void) => {
    const isDeckA = deckId === 'A'
    const audioRef = isDeckA ? deckARef : deckBRef
    const waveformRef = isDeckA ? waveformCanvasA : waveformCanvasB
    const vuLevel = isDeckA ? vuA : vuB

    return (
      <div className="rounded-2xl border border-slate-700 bg-slate-950 p-4 text-slate-100 shadow-xl">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold tracking-[0.2em] text-slate-400">{t('deck.label', { deck: deckId })}</span>
          <span className="text-xs text-slate-400">{state.keyLabel}</span>
        </div>
        <div className="mt-3 rounded-xl border border-slate-800 bg-slate-900 p-3">
          <div className="text-sm font-semibold">
            {state.track ? getBgmTrackDisplayTitle(state.track) : t('deck.noTrack')}
          </div>
          <div className="text-xs text-slate-400">{state.track?.category ?? t('deck.selectHint')}</div>
          <div className="mt-2 flex items-center gap-3">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-800">
              <div
                className={`h-full rounded-full ${vuLevel > 0.9 ? 'bg-red-500' : vuLevel > 0.7 ? 'bg-amber-400' : 'bg-emerald-400'}`}
                style={{ width: `${vuLevel * 100}%` }}
              />
            </div>
            <span className="text-[10px] font-semibold text-slate-400">VU</span>
          </div>
        </div>

        <div className="mt-3 rounded-xl border border-slate-800 bg-slate-900 p-3">
          <canvas ref={waveformRef} width={360} height={80} className="w-full" />
        </div>

        <div className="mt-4 grid grid-cols-3 gap-3">
          <button
            type="button"
            onClick={() => handlePlayToggle(deckId)}
            className="rounded-xl bg-emerald-500 px-3 py-2 text-xs font-semibold text-slate-900 shadow"
          >
            {state.isPlaying ? t('deck.pause') : t('deck.play')}
          </button>
          <button
            type="button"
            onClick={() => handleCue(deckId)}
            className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-semibold"
          >
            {t('deck.cue')}
          </button>
          <button
            type="button"
            onClick={() => handleSync(deckId)}
            className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-semibold"
          >
            {t('deck.sync')}
          </button>
        </div>

        <div className="mt-4 grid gap-4">
          <div>
            <div className="text-[10px] font-semibold text-slate-400">{t('deck.volume')}</div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={state.volume}
              onChange={(event) => setState({ ...state, volume: Number(event.target.value) })}
              className="w-full"
            />
          </div>

          <div className="grid grid-cols-3 gap-2 text-xs">
            {[
              { label: t('deck.eq.low'), value: state.eqLow, key: 'eqLow' },
              { label: t('deck.eq.mid'), value: state.eqMid, key: 'eqMid' },
              { label: t('deck.eq.high'), value: state.eqHigh, key: 'eqHigh' },
            ].map((item) => (
              <label key={item.key} className="space-y-1">
                <span className="text-[10px] font-semibold text-slate-400">{item.label}</span>
                <input
                  type="range"
                  min={-12}
                  max={12}
                  step={1}
                  value={item.value}
                  onChange={(event) =>
                    setState({
                      ...state,
                      [item.key]: Number(event.target.value),
                    } as DeckState)
                  }
                />
              </label>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <label className="space-y-1">
              <span className="text-[10px] font-semibold text-slate-400">{t('deck.pitch')}</span>
              <input
                type="range"
                min={-16}
                max={16}
                step={0.1}
                value={state.pitch}
                onChange={(event) => setState({ ...state, pitch: Number(event.target.value) })}
              />
            </label>
            <label className="space-y-1">
              <span className="text-[10px] font-semibold text-slate-400">{t('deck.bpm')}</span>
              <input
                type="number"
                min={60}
                max={200}
                value={state.bpm}
                onChange={(event) => setState({ ...state, bpm: Number(event.target.value) })}
                className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs"
              />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <label className="space-y-1">
              <span className="text-[10px] font-semibold text-slate-400">{t('deck.filterType')}</span>
              <select
                value={state.filterType}
                onChange={(event) =>
                  setState({ ...state, filterType: event.target.value as DeckState['filterType'] })
                }
                className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs"
              >
                <option value="off">{t('deck.filterOff')}</option>
                <option value="lowpass">{t('deck.filterLow')}</option>
                <option value="highpass">{t('deck.filterHigh')}</option>
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-[10px] font-semibold text-slate-400">{t('deck.filter')}</span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={state.filterAmount}
                onChange={(event) => setState({ ...state, filterAmount: Number(event.target.value) })}
              />
            </label>
          </div>

          <div>
            <span className="text-[10px] font-semibold text-slate-400">{t('deck.delay')}</span>
            <input
              type="range"
              min={0}
              max={0.8}
              step={0.01}
              value={state.delayAmount}
              onChange={(event) => setState({ ...state, delayAmount: Number(event.target.value) })}
            />
          </div>

          <div className="grid gap-2">
            <span className="text-[10px] font-semibold text-slate-400">{t('deck.loop')}</span>
            <div className="flex flex-wrap gap-2">
              {LOOP_BEATS.map((beats) => (
                <button
                  key={beats}
                  type="button"
                  onClick={() => toggleLoop(deckId, beats)}
                  className={`rounded-full px-3 py-1 text-[10px] font-semibold ${
                    state.loopBeats === beats
                      ? 'bg-blue-400 text-slate-900'
                      : 'border border-slate-700 bg-slate-900 text-slate-300'
                  }`}
                >
                  {t('deck.loopBeats', { beats })}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-2">
            <span className="text-[10px] font-semibold text-slate-400">{t('deck.hotCue')}</span>
            <div className="grid grid-cols-3 gap-2">
              {state.hotCues.map((cue, index) => (
                <div key={`cue-${deckId}-${index}`} className="space-y-1">
                  <button
                    type="button"
                    onClick={() => handleHotCue(deckId, index)}
                    className={`w-full rounded-lg px-2 py-2 text-[10px] font-semibold ${
                      cue === null ? 'bg-slate-800 text-slate-300' : 'bg-pink-400 text-slate-900'
                    }`}
                  >
                    {t('deck.hotCueLabel', { label: String.fromCharCode(65 + index) })}
                  </button>
                  <button
                    type="button"
                    onClick={() => clearHotCue(deckId, index)}
                    className="w-full rounded-md border border-slate-700 px-2 py-1 text-[9px] text-slate-400"
                  >
                    {t('deck.hotCueClear')}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {state.track && (
          <AudioWithFallback
            key={state.track.file}
            ref={audioRef}
            src={`/bgm/${encodeURIComponent(state.track.file)}`}
            onEnded={() => setState({ ...state, isPlaying: false })}
          />
        )}
      </div>
    )
  }

  return (
    <main className="p-4 space-y-6 pb-16">
      <section className="space-y-1">
        <h1 className="text-2xl font-semibold text-slate-900">{t('title')}</h1>
        <p className="text-sm text-slate-600">{t('description')}</p>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1fr_300px_1fr]">
        {renderDeck('A', deckA, (next) => setDeckA(next))}

        <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{t('mixer.title')}</p>
            <label className="space-y-1 text-xs font-semibold text-slate-500">
              {t('mixer.crossfader')}
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={crossfader}
                onChange={(event) => setCrossfader(Number(event.target.value))}
                className="w-full"
              />
            </label>
            <label className="space-y-1 text-xs font-semibold text-slate-500">
              {t('mixer.curve')}
              <select
                value={crossCurve}
                onChange={(event) => setCrossCurve(event.target.value as 'linear' | 'sharp')}
                className="w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-xs"
              >
                <option value="linear">{t('mixer.curveLinear')}</option>
                <option value="sharp">{t('mixer.curveSharp')}</option>
              </select>
            </label>
          </div>

          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{t('mixer.speakers')}</p>
            <label className="space-y-1 text-xs font-semibold text-slate-500">
              {t('mixer.speakerLeft')}
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={speakerLeftVolume}
                onChange={(event) => setSpeakerLeftVolume(Number(event.target.value))}
              />
            </label>
            <label className="space-y-1 text-xs font-semibold text-slate-500">
              {t('mixer.speakerRight')}
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={speakerRightVolume}
                onChange={(event) => setSpeakerRightVolume(Number(event.target.value))}
              />
            </label>
          </div>
        </div>

        {renderDeck('B', deckB, (next) => setDeckB(next))}
      </section>

      <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label className="text-xs font-semibold text-slate-500" htmlFor="dj-search">
            {t('search.label')}
          </label>
          <input
            id="dj-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('search.placeholder')}
            className="w-full max-w-md rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
          />
        </div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{t('list.title')}</p>
        <ul className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {filteredTracks.map((track) => (
            <li key={track.file} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="font-medium text-slate-800">{getBgmTrackDisplayTitle(track)}</p>
              <p className="text-xs text-slate-500">{track.category}</p>
              <div className="mt-2 flex flex-wrap gap-2 text-[10px] font-semibold">
                <button
                  type="button"
                  onClick={() => loadTrackToDeck('A', track)}
                  className="rounded-full border border-slate-300 px-3 py-1 text-slate-600 hover:bg-white"
                >
                  {t('list.loadLeft')}
                </button>
                <button
                  type="button"
                  onClick={() => loadTrackToDeck('B', track)}
                  className="rounded-full border border-slate-300 px-3 py-1 text-slate-600 hover:bg-white"
                >
                  {t('list.loadRight')}
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </main>
  )
}
