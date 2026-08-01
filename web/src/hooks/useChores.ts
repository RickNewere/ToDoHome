import { useCallback, useEffect, useMemo, useState } from 'react'
import { isConfigured, supabase } from '../lib/supabase'
import { compareChores, computeMood, toView } from '../lib/chores'
import { refreshWidget } from '../lib/bridge'
import type { ChoreStatusRow, ChoreView, Person } from '../lib/types'

export interface HistoryEntry {
  id: string
  completed_at: string
  name: string
  emoji: string
}

const RELOAD_INTERVAL_MS = 5 * 60 * 1000

export function useChores(me: Person | null) {
  const [rows, setRows] = useState<ChoreStatusRow[]>([])
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<Set<string>>(new Set())

  const load = useCallback(async () => {
    if (!isConfigured) {
      setLoading(false)
      return
    }
    const { data, error } = await supabase
      .from('chore_status')
      .select('*')
      .order('sort_order')

    if (error) setError(error.message)
    else {
      setError(null)
      setRows(data as ChoreStatusRow[])
    }
    setLoading(false)
  }, [])

  const loadHistory = useCallback(async () => {
    if (!isConfigured) return
    const { data, error } = await supabase
      .from('chore_runs')
      .select('id, completed_at, chores(name, emoji)')
      .not('completed_at', 'is', null)
      .order('completed_at', { ascending: false })
      .limit(60)

    if (error || !data) return
    setHistory(
      data.map((r) => {
        // PostgREST returns the embedded row as an object for a to-one relation,
        // but the generated types widen it to an array.
        const chore = (Array.isArray(r.chores) ? r.chores[0] : r.chores) as
          | { name: string; emoji: string }
          | undefined
        return {
          id: r.id as string,
          completed_at: r.completed_at as string,
          name: chore?.name ?? 'Faccenda rimossa',
          emoji: chore?.emoji ?? '🏠',
        }
      }),
    )
  }, [])

  useEffect(() => {
    void load()
    void loadHistory()
  }, [load, loadHistory])

  // Live sync: a tick on one phone lands on the other without a refresh.
  useEffect(() => {
    if (!isConfigured) return
    const channel = supabase
      .channel('todohome-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chore_runs' }, () => {
        void load()
        void loadHistory()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chores' }, () => {
        void load()
      })
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [load, loadHistory])

  // Lateness is computed by Postgres against the current date, so a periodic
  // reload is what makes the list roll over at midnight.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') void load()
    }
    const timer = setInterval(() => void load(), RELOAD_INTERVAL_MS)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [load])

  const setChoreBusy = (id: string, on: boolean) =>
    setBusy((prev) => {
      const next = new Set(prev)
      if (on) next.add(id)
      else next.delete(id)
      return next
    })

  /** Toggles the current person's tick. The chore completes only once both
   *  Riccardo and Roberta have ticked it; that rule lives in the RPC. */
  const toggle = useCallback(
    async (chore: ChoreView) => {
      if (!me) return
      setChoreBusy(chore.id, true)

      const now = new Date().toISOString()
      setRows((prev) =>
        prev.map((r) => {
          if (r.id !== chore.id) return r
          return me === 'riccardo'
            ? { ...r, riccardo_at: r.riccardo_at ? null : now }
            : { ...r, roberta_at: r.roberta_at ? null : now }
        }),
      )

      const { error } = await supabase.rpc('toggle_check', {
        p_chore_id: chore.id,
        p_user: me,
      })
      if (error) setError(error.message)

      await load()
      await loadHistory()
      refreshWidget()
      setChoreBusy(chore.id, false)
    },
    [me, load, loadHistory],
  )

  /** Undo the last completion of a chore, for when it was ticked by mistake. */
  const reopen = useCallback(
    async (chore: ChoreView) => {
      setChoreBusy(chore.id, true)
      const { error } = await supabase.rpc('reopen_last', { p_chore_id: chore.id })
      if (error) setError(error.message)
      await load()
      await loadHistory()
      refreshWidget()
      setChoreBusy(chore.id, false)
    },
    [load, loadHistory],
  )

  const chores = useMemo(() => rows.map(toView), [rows])

  const groups = useMemo(() => {
    const late = chores.filter((c) => c.state === 'late').sort(compareChores)
    const due = chores.filter((c) => c.state === 'due').sort(compareChores)
    const upcoming = chores.filter((c) => c.state === 'upcoming').sort(compareChores)
    // "Started" means one of the two has ticked but the chore is not closed yet.
    const started = chores.filter((c) => c.waitingFor.length === 1).sort(compareChores)
    return { late, due, upcoming, started }
  }, [chores])

  const mood = useMemo(() => computeMood(chores), [chores])

  return {
    chores,
    groups,
    history,
    mood,
    loading,
    error,
    busy,
    toggle,
    reopen,
    reload: load,
    clearError: () => setError(null),
  }
}
