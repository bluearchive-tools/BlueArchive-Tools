'use client'

import { forwardRef, useEffect, useState, type ComponentProps } from 'react'

const isOpusSource = (src: string) => /\.opus($|[?#])/i.test(src)

const toM4aSource = (src: string) => src.replace(/\.opus(?=$|[?#])/i, '.m4a')

const detectOpusSupport = () => {
  if (typeof document === 'undefined') return null
  const audio = document.createElement('audio')
  if (!audio.canPlayType) return false
  const result = audio.canPlayType('audio/ogg; codecs="opus"')
  return result === 'probably' || result === 'maybe'
}

type AudioProps = Omit<ComponentProps<'audio'>, 'src'> & {
  src: string
}

const AudioWithFallback = forwardRef<HTMLAudioElement, AudioProps>(function AudioWithFallback(
  { src, onError, ...rest },
  ref,
) {
  const [canPlayOpus, setCanPlayOpus] = useState<boolean | null>(null)
  const [resolvedSrc, setResolvedSrc] = useState(src)

  useEffect(() => {
    setCanPlayOpus(detectOpusSupport())
  }, [])

  useEffect(() => {
    if (canPlayOpus === false && isOpusSource(src)) {
      setResolvedSrc(toM4aSource(src))
      return
    }
    setResolvedSrc(src)
  }, [src, canPlayOpus])

  const handleError: React.ReactEventHandler<HTMLAudioElement> = (event) => {
    if (isOpusSource(src) && resolvedSrc === src) {
      const fallback = toM4aSource(src)
      if (fallback !== resolvedSrc) {
        setResolvedSrc(fallback)
        return
      }
    }
    onError?.(event)
  }

  return <audio ref={ref} src={resolvedSrc} onError={handleError} {...rest} />
})

export default AudioWithFallback
