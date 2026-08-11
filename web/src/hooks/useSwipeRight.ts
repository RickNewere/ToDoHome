import { useCallback, useRef, useState } from 'react'
import type { MouseEvent as ReactMouseEvent, TouchEvent as ReactTouchEvent } from 'react'

interface Options {
  /** When false the card never moves and the handlers do nothing. */
  enabled: boolean
  onTrigger: () => void
}

/** How far the card has to travel before releasing it counts as a swipe. */
export const THRESHOLD = 78

/** Movement below this is a tap, not a drag. */
export const SLOP = 6

/** Past the threshold the card keeps moving, but grudgingly, so the gesture
 *  feels like it has caught on something. */
const DRAG = 0.4

/** Where the card goes once the swipe is committed, in pixels. Beyond any
 *  phone's width, so it leaves the screen rather than stopping at its edge. */
const EXIT = 520

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

type Phase = 'idle' | 'dragging' | 'leaving'

/**
 * Drag a card to the right to fire an action, the way a chat row is archived.
 *
 * Touch events rather than pointer events on purpose: Safari on iOS cancels a
 * pointer stream as soon as it suspects a scroll, which is exactly the moment
 * this gesture needs it. Touch events, paired with touch-action: pan-y on the
 * card, keep the horizontal drag while the browser keeps the vertical scroll.
 */
export function useSwipeRight({ enabled, onTrigger }: Options) {
  const [offset, setOffset] = useState(0)
  const [phase, setPhase] = useState<Phase>('idle')

  const start = useRef<{ x: number; y: number } | null>(null)
  const axis = useRef<'undecided' | 'x' | 'y'>('undecided')
  const live = useRef(0)
  const moved = useRef(false)

  const begin = useCallback(
    (x: number, y: number) => {
      if (!enabled) return
      start.current = { x, y }
      axis.current = 'undecided'
      moved.current = false
      live.current = 0
    },
    [enabled],
  )

  const move = useCallback((x: number, y: number) => {
    const from = start.current
    if (!from) return

    const dx = x - from.x
    const dy = y - from.y

    if (axis.current === 'undecided') {
      const decided = decideAxis(dx, dy)
      if (decided === 'undecided') return
      axis.current = decided
      if (decided !== 'x') {
        // The list is scrolling: let go of the gesture entirely.
        start.current = null
        return
      }
      setPhase('dragging')
    }

    moved.current = true
    const pulled = Math.max(0, dx)
    live.current = pulled
    setOffset(travel(pulled))
  }, [])

  const end = useCallback(() => {
    if (!start.current && axis.current !== 'x') {
      start.current = null
      return
    }
    const reached = live.current >= THRESHOLD
    start.current = null
    axis.current = 'undecided'
    live.current = 0

    if (reached) {
      // Send it off the screen and act at once, so the round trip happens while
      // the card is still sliding rather than after it.
      setPhase('leaving')
      setOffset(EXIT)
      onTrigger()
      // If the chore is still on the list a moment later, the action failed:
      // put the card back rather than leaving a hole.
      window.setTimeout(() => {
        setPhase('idle')
        setOffset(0)
      }, 900)
      return
    }

    setPhase('idle')
    setOffset(0)
  }, [onTrigger])

  const cancel = useCallback(() => {
    start.current = null
    axis.current = 'undecided'
    live.current = 0
    setPhase('idle')
    setOffset(0)
  }, [])

  /** True right after a drag, so the tap it would otherwise become is ignored.
   *
   *  The enabled check matters: a swipe can be the very thing that uses up the
   *  last postponement, and once the card stops being swipeable no touchstart
   *  arrives to clear the flag, which would swallow the next honest tap. */
  const swallowedClick = useCallback(() => {
    const dragged = enabled && moved.current
    moved.current = false
    return dragged
  }, [enabled])

  const onTouchStart = useCallback(
    (e: ReactTouchEvent<HTMLElement>) => {
      const t = e.touches[0]
      if (t) begin(t.clientX, t.clientY)
    },
    [begin],
  )

  const onTouchMove = useCallback(
    (e: ReactTouchEvent<HTMLElement>) => {
      const t = e.touches[0]
      if (t) move(t.clientX, t.clientY)
    },
    [move],
  )

  // Mouse is only here so the gesture can be tried on a desktop browser.
  const onMouseDown = useCallback(
    (e: ReactMouseEvent<HTMLElement>) => {
      if (e.button !== 0) return
      begin(e.clientX, e.clientY)
    },
    [begin],
  )

  const onMouseMove = useCallback(
    (e: ReactMouseEvent<HTMLElement>) => {
      if (e.buttons === 0) return
      move(e.clientX, e.clientY)
    },
    [move],
  )

  return {
    offset,
    phase,
    /** 0 to 1: how close the gesture is to firing, for the reveal behind. */
    progress: Math.min(1, offset / THRESHOLD),
    armed: offset >= THRESHOLD,
    swallowedClick,
    handlers: enabled
      ? {
          onTouchStart,
          onTouchMove,
          onTouchEnd: end,
          onTouchCancel: cancel,
          onMouseDown,
          onMouseMove,
          onMouseUp: end,
          onMouseLeave: cancel,
        }
      : {},
  }
}
