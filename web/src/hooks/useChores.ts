import { useCallback, useEffect, useMemo, useState } from 'react'
import { isConfigured, supabase } from '../lib/supabase'
import { compareChores, computeMood, toView } from '../lib/chores'
import { refreshWidget } from '../lib/bridge'
import type { ChoreDraft, ChoreStatusRow, ChoreView, Person } from '../lib/types'

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

  /** Removes this person's tick from an already completed chore: the closed run
   *  reopens without their confirmation, so the chore returns to the to-do list
   *  still carrying the other person's tick. */
  const untickCompleted = useCallback(
    async (chore: ChoreView) => {
      if (!me) return
      setChoreBusy(chore.id, true)

      const { data, error: findError } = await supabase
        .from('chore_runs')
        .select('id')
        .eq('chore_id', chore.id)
        .not('completed_at', 'is', null)
        .order('completed_at', { ascending: false })
        .limit(1)

      const run = data?.[0]
      if (findError) {
        setError(findError.message)
      } else if (!run) {
        setError('Non trovo il completamento da annullare.')
      } else {
        const patch =
          me === 'riccardo'
            ? { completed_at: null, riccardo_at: null }
            : { completed_at: null, roberta_at: null }
        const { error } = await supabase.from('chore_runs').update(patch).eq('id', run.id)
        // Only one run per chore can be open. Hitting that index means the other
        // phone reopened this chore while this screen was still showing it done.
        if (error?.code === '23505') {
          setError('Questa faccenda è già tornata fra quelle da fare.')
        } else if (error) {
          setError(error.message)
        }
      }

      await load()
      await loadHistory()
      refreshWidget()
      setChoreBusy(chore.id, false)
    },
    [me, load, loadHistory],
  )

  /** Creates or updates a chore. Returns false when the save was rejected, so
   *  the editor can stay open with the error visible. */
  const saveChore = useCallback(
    async (draft: ChoreDraft): Promise<boolean> => {
      // A chore pinned to a date ignores cadence and the weekend rule, but the
      // column stays not null, so a placeholder cadence still has to go in.
      const scheduled = draft.scheduledOn
      const payload = {
        name: draft.name.trim(),
        emoji: draft.emoji.trim() || '🏠',
        category: draft.category.trim() || 'Casa',
        cadence_days: scheduled ? 365 : draft.cadenceDays,
        weekend_only: scheduled ? false : draft.weekendOnly,
        scheduled_on: scheduled,
        yearly: scheduled ? draft.yearly : false,
        note: draft.note.trim() || null,
      }

      const { error } = draft.id
        ? await supabase.from('chores').update(payload).eq('id', draft.id)
        : await supabase.from('chores').insert({
            ...payload,
            // Land at the bottom of the list.
            sort_order: Math.max(0, ...rows.map((r) => r.sort_order)) + 10,
          })

      if (error) {
        setError(
          error.code === '23505'
            ? 'Esiste già una faccenda con questo nome.'
            : error.message,
        )
        return false
      }

      await load()
      refreshWidget()
      return true
    },
    [rows, load],
  )

  /** Removes a chore and, through the cascade, its history. */
  const deleteChore = useCallback(
    async (id: string): Promise<boolean> => {
      const { error } = await supabase.from('chores').delete().eq('id', id)
      if (error) {
        setError(error.message)
        return false
      }
      await load()
      await loadHistory()
      refreshWidget()
      return true
    },
    [load, loadHistory],
  )

  const chores = useMemo(() => rows.map(toView), [rows])

  const groups = useMemo(() => {
    const late = chores.filter((c) => c.state === 'late').sort(compareChores)
    const due = chores.filter((c) => c.state === 'due').sort(compareChores)
    const upcoming = chores.filter((c) => c.state === 'upcoming').sort(compareChores)
    // Closed by both and not due again yet: this is the "Fatte" list.
    const done = chores
      .filter((c) => c.state === 'upcoming' && c.last_completed_at && !c.open_run_id)
      .sort((a, b) => (a.last_completed_at! < b.last_completed_at! ? 1 : -1))
    return { late, due, upcoming, done }
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
    untickCompleted,
    saveChore,
    deleteChore,
    reload: load,
    clearError: () => setError(null),
  }
}
