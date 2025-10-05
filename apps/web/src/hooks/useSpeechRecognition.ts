import { useCallback, useEffect, useRef, useState } from 'react'

type SpeechRecognitionCallback = (transcript: string) => void

type RecognitionAlternative = {
  transcript: string
}

type RecognitionResult = {
  isFinal: boolean
  length: number
  [index: number]: RecognitionAlternative
}

type RecognitionEvent = Event & {
  resultIndex: number
  results: {
    length: number
    [index: number]: RecognitionResult
  }
}

type RecognitionInstance = {
  lang: string
  continuous: boolean
  interimResults: boolean
  start: () => void
  stop: () => void
  addEventListener: (type: 'result' | 'end' | 'error', listener: (event: unknown) => void) => void
  removeEventListener: (type: 'result' | 'end' | 'error', listener: (event: unknown) => void) => void
}

type RecognitionConstructor = new () => RecognitionInstance

interface UseSpeechRecognitionOptions {
  lang?: string
  interimResults?: boolean
  continuous?: boolean
  onResult?: SpeechRecognitionCallback
}

export const useSpeechRecognition = ({
  lang,
  interimResults = false,
  continuous = false,
  onResult,
}: UseSpeechRecognitionOptions = {}) => {
  const [supported, setSupported] = useState(false)
  const [listening, setListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const recognitionRef = useRef<RecognitionInstance | null>(null)
  const onResultRef = useRef<SpeechRecognitionCallback | undefined>(onResult)
  const transcriptRef = useRef('')

  useEffect(() => {
    onResultRef.current = onResult
  }, [onResult])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const SpeechRecognitionCtor: RecognitionConstructor | undefined =
      (window as typeof window & {
        SpeechRecognition?: RecognitionConstructor
        webkitSpeechRecognition?: RecognitionConstructor
      }).SpeechRecognition ??
      (window as typeof window & {
        SpeechRecognition?: RecognitionConstructor
        webkitSpeechRecognition?: RecognitionConstructor
      }).webkitSpeechRecognition

    if (!SpeechRecognitionCtor) {
      setSupported(false)
      return
    }

    const recognition = new SpeechRecognitionCtor()
    recognition.lang = lang ?? (typeof navigator !== 'undefined' ? navigator.language : 'en-US')
    recognition.interimResults = interimResults
    recognition.continuous = continuous

    const handleResult = (event: unknown) => {
      const recognitionEvent = event as RecognitionEvent
      const result = recognitionEvent.results[recognitionEvent.resultIndex]
      if (!result || !result.isFinal) return

      const transcript = Array.from({ length: result.length }, (_, index) => result[index]?.transcript.trim())
        .filter(Boolean)
        .join(' ')

      if (!transcript) return

      transcriptRef.current = transcriptRef.current
        ? `${transcriptRef.current} ${transcript}`.replace(/\s+/g, ' ').trim()
        : transcript

      setTranscript(transcriptRef.current)

      if (onResultRef.current) {
        onResultRef.current(transcript)
      }
    }

    const handleEnd = () => {
      setListening(false)
    }

    const handleError = () => {
      setListening(false)
    }

    recognition.addEventListener('result', handleResult)
    recognition.addEventListener('end', handleEnd)
    recognition.addEventListener('error', handleError)

    recognitionRef.current = recognition
    setSupported(true)

    return () => {
      recognition.removeEventListener('result', handleResult)
      recognition.removeEventListener('end', handleEnd)
      recognition.removeEventListener('error', handleError)
      recognition.stop()
      recognitionRef.current = null
    }
  }, [continuous, interimResults, lang])

  const start = useCallback(() => {
    const recognition = recognitionRef.current
    if (!recognition || listening) return

    try {
      transcriptRef.current = ''
      setTranscript('')
      recognition.start()
      setListening(true)
    } catch (error) {
      const domError = error as DOMException
      if (domError.name === 'InvalidStateError') {
        recognition.stop()
        transcriptRef.current = ''
        setTranscript('')
        recognition.start()
        setListening(true)
      }
    }
  }, [listening])

  const stop = useCallback(() => {
    const recognition = recognitionRef.current
    if (!recognition) return

    recognition.stop()
    setListening(false)
  }, [])

  return {
    supported,
    listening,
    start,
    stop,
    transcript,
  }
}
