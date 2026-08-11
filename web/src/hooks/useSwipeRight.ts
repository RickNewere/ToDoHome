import { useCallback, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'

interface Options {
  /** When false the card never moves and the handlers do nothing. */
  enabled: boolean
  onTrigger: () => void
}

/** How far the card has to travel before releasing it counts as a swipe. */
export const THRESHOLD = 88

/** Movement below this is a tap, not a drag. */
export const SLOP = 8

/** Past the threshold the card keeps moving, but grudgingly, so the gesture
 *  feels like it has caught on something. */
const DRAG = 0.35

/**
 * Which way the finger has committed to, from the first movement past [SLOP].
 *
 * Vertical wins ties by a wide margin: a list that stops scrolling because a
 * thumb drifted sideways is far worse than a swipe that needs a second try.
 * Leftward movement is vertical as far as this is concerned, since there is
 * nothing to the left.
 */
export function decideAxis(dx: number, dy: number): 'undecided' | 'x' | 'y' {
  if (Math.abs(dx) < SLOP && Math.abs(dy) < SLOP) return 'undecided'
  return dx > Math.abs(dy) * 1.4 ? 'x' : 'y'
}

/** How far the card is drawn for a finger that has travelled [pulled]. */
export function travel(pulled: number): number {
  if (pulled <= 0) return 0
  return pulled > THRESHOLD ? THRESHOLD + (pulled - THRESHOLD) * DRAG : pulled
}

/**
 * Drag a card to the right to fire an action.
 *
 * The direction is decided once, on the first few pixels, and vertical wins
 * ties: a list that stops scrolling because a finger drifted sideways is far
 * more annoying than a swipe that needs a second try.
 */
export function useSwipeRight({ enabled, onTrigger }: Options) {
  const [offset, setOffset] = useState(0)
  const [dragging, setDragging] = useState(false)

  const start = useRef<{ x: number; y: number } | null>(null)
  const axis = useRef<'undecided' | 'x' | 'y'>('undecided')
  const live = useRef(0)
  const moved = useRef(false)

  const reset = useCallback(() => {
    start.current = null
    axis.current = 'undecided'
    live.current = 0
    setOffset(0)
    setDragging(false)
  }, [])

  const onPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLElement>) => {
      if (!enabled) return
      if (e.pointerType === 'mouse' && e.button !== 0) return
      start.current = { x: e.clientX, y: e.clientY }
      axis.current = 'undecided'
      moved.current = false
      live.current = 0
    },
    [enabled],
  )

  const onPointerMove = useCallback((e: ReactPointerEvent<HTMLElement>) => {
    const from = start.current
    if (!from) return

    const dx = e.clientX - from.x
    const dy = e.clientY - from.y

    if (axis.current === 'undecided') {
      const decided = decideAxis(dx, dy)
      if (decided === 'undecided') return
      axis.current = decided
      if (decided !== 'x') {
        start.current = null
        return
      }
      // Keep receiving moves even if the finger leaves the card.
      e.currentTarget.setPointerCapture(e.pointerId)
      setDragging(true)
    }

    moved.current = true
    const pulled = Math.max(0, dx)
    live.current = pulled
    setOffset(travel(pulled))
  }, [])

  const onPointerUp = useCallback(() => {
    const reached = live.current >= THRESHOLD
    reset()
    if (reached) onTrigger()
  }, [onTrigger, reset])

  /** True right after a drag, so the tap it would otherwise become is ignored.
   *
   *  The enabled check matters: a swipe can be the very thing that uses up the
   *  last postponement, and once the card stops being swipeable no pointerdown
   *  arrives to clear the flag, which would swallow the next honest tap. */
  const swallowedClick = useCallback(() => {
    const dragged = enabled && moved.current
    moved.current = false
    return dragged
  }, [enabled])

  return {
    offset,
    dragging,
    /** 0 to 1: how close the gesture is to firing, for the reveal behind. */
    progress: Math.min(1, offset / THRESHOLD),
    swallowedClick,
    handlers: enabled
      ? {
          onPointerDown,
          onPointerMove,
          onPointerUp,
          onPointerCancel: reset,
        }
      : {},
  }
}
