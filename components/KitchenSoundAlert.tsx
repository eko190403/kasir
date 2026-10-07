"use client"

import { useEffect, useRef } from "react"

export default function KitchenSoundAlert({ newOrderCount }: { newOrderCount: number }) {
  const prevCountRef = useRef(newOrderCount)

  useEffect(() => {
    if (newOrderCount > prevCountRef.current) {
      // Play beep sound using Web Audio API (no external file needed)
      try {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
        const playBeep = (freq: number, start: number, duration: number, gain: number) => {
          const osc = ctx.createOscillator()
          const gainNode = ctx.createGain()
          osc.connect(gainNode)
          gainNode.connect(ctx.destination)
          osc.frequency.value = freq
          osc.type = 'sine'
          gainNode.gain.setValueAtTime(gain, ctx.currentTime + start)
          gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + duration)
          osc.start(ctx.currentTime + start)
          osc.stop(ctx.currentTime + start + duration)
        }
        // Play 3 ascending beeps
        playBeep(880, 0, 0.15, 0.4)
        playBeep(1100, 0.2, 0.15, 0.4)
        playBeep(1320, 0.4, 0.25, 0.5)
      } catch (e) {
        // AudioContext not supported - silently fail
      }
    }
    prevCountRef.current = newOrderCount
  }, [newOrderCount])

  return null
}
