import { useEffect, useState } from 'react'
import type { ChoreDraft } from '../lib/types'

interface Props {
  draft: ChoreDraft
  onSave: (draft: ChoreDraft) => Promise<boolean>
  onDelete: (id: string) => Promise<boolean>
  onClose: () => void
}

const CADENCES = [
  { days: 1, label: 'Ogni giorno' },
  { days: 2, label: 'Ogni 2 giorni' },
  { days: 3, label: 'Ogni 3 giorni' },
  { days: 7, label: 'Ogni settimana' },
  { days: 14, label: 'Ogni 2 settimane' },
  { days: 30, label: 'Ogni mese' },
]

/** Today as YYYY-MM-DD in local time, the format a date input expects. */
function todayValue(): string {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

export default function ChoreEditor({ draft, onSave, onDelete, onClose }: Props) {
  const [form, setForm] = useState<ChoreDraft>(draft)
  const [busy, setBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const isNew = draft.id === null
  const onDate = form.scheduledOn !== null

  /** The on screen keyboard covers the lower fields, so bring whatever gets
   *  focused back into view once the keyboard has finished animating. */
  const keepInView = (e: React.FocusEvent<HTMLInputElement>) => {
    const input = e.currentTarget
    setTimeout(() => input.scrollIntoView({ block: 'center', behavior: 'smooth' }), 300)
  }

  // Escape closes the sheet, like any other modal.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const set = <K extends keyof ChoreDraft>(key: K, value: ChoreDraft[K]) => {
    // Editing again means the delete was not what was wanted: disarm it, so a
    // second tap on that button cannot remove the chore by surprise.
    setConfirmDelete(false)
    setForm((f) => ({ ...f, [key]: value }))
  }

  const canSave = form.name.trim().length > 0 && (!onDate || Boolean(form.scheduledOn))

  const save = async () => {
    if (!canSave) return
    setBusy(true)
    const ok = await onSave(form)
    setBusy(false)
    if (ok) onClose()
  }

  const remove = async () => {
    if (!form.id) return
    if (!confirmDelete) {
      setConfirmDelete(true)
      return
    }
    setBusy(true)
    const ok = await onDelete(form.id)
    setBusy(false)
    if (ok) onClose()
  }

  return (
    <div className="sheet" role="dialog" aria-modal="true" aria-label={isNew ? 'Nuova faccenda' : 'Modifica faccenda'}>
      <div className="sheet__backdrop" onClick={onClose} />

      <div className="sheet__panel">
        <header className="sheet__head">
          <h2>{isNew ? 'Nuova faccenda' : 'Modifica faccenda'}</h2>
          <button type="button" className="sheet__close" onClick={onClose} aria-label="Chiudi">
            ✕
          </button>
        </header>

        <div className="sheet__body">
          <div className="field field--split">
            <label>
              <span>Icona</span>
              <input
                className="input input--emoji"
                value={form.emoji}
                // Emoji built from several code points, like 🧑‍🍳, run past four
                // UTF-16 units: cutting there leaves half a character behind.
                maxLength={12}
                onChange={(e) => set('emoji', e.target.value)}
              />
            </label>
            <label>
              <span>Nome</span>
              <input
                className="input"
                value={form.name}
                placeholder="Es. Lavare i vetri"
                onFocus={keepInView}
                onChange={(e) => set('name', e.target.value)}
              />
            </label>
          </div>

          <div className="field">
            <span>Quando</span>
            <div className="chips chips--modes">
              <button
                type="button"
                className={`chip${!onDate ? ' chip--on' : ''}`}
                onClick={() => set('scheduledOn', null)}
              >
                Si ripete
              </button>
              <button
                type="button"
                className={`chip${onDate ? ' chip--on' : ''}`}
                onClick={() => set('scheduledOn', form.scheduledOn ?? todayValue())}
              >
                In una data
              </button>
            </div>
          </div>

          {onDate ? (
            <>
              <label className="field">
                <span>Giorno</span>
                <input
                  className="input"
                  type="date"
                  value={form.scheduledOn ?? ''}
                  onFocus={keepInView}
                  onChange={(e) => set('scheduledOn', e.target.value || null)}
                />
              </label>

              <label className="switch">
                <input
                  type="checkbox"
                  checked={form.yearly}
                  onChange={(e) => set('yearly', e.target.checked)}
                />
                <span>
                  Torna ogni anno
                  <small>
                    {form.yearly
                      ? 'Ricompare lo stesso giorno l’anno prossimo'
                      : 'Una volta sola: fatta, non torna più'}
                  </small>
                </span>
              </label>
            </>
          ) : (
            <>
              <div className="field">
                <span>Ogni quanto</span>
                <div className="chips">
                  {CADENCES.map((c) => (
                    <button
                      key={c.days}
                      type="button"
                      className={`chip${form.cadenceDays === c.days ? ' chip--on' : ''}`}
                      onClick={() => set('cadenceDays', c.days)}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
                <label className="field__inline">
                  <span>oppure ogni</span>
                  <input
                    className="input input--num"
                    type="number"
                    min={1}
                    max={365}
                    value={form.cadenceDays}
                    onFocus={keepInView}
                    onChange={(e) => set('cadenceDays', Math.max(1, Number(e.target.value) || 1))}
                  />
                  <span>giorni</span>
                </label>
              </div>

              <label className="switch">
                <input
                  type="checkbox"
                  checked={form.weekendOnly}
                  onChange={(e) => set('weekendOnly', e.target.checked)}
                />
                <span>
                  Solo sabato o domenica
                  <small>La scadenza slitta al primo weekend utile</small>
                </span>
              </label>
            </>
          )}

          <label className="field field--last">
            <span>Nota</span>
            <input
              className="input"
              value={form.note}
              placeholder="Facoltativa"
              onFocus={keepInView}
              onChange={(e) => set('note', e.target.value)}
            />
          </label>
        </div>

        <footer className="sheet__foot">
          {!isNew && (
            <button
              type="button"
              className={`btn-danger${confirmDelete ? ' btn-danger--armed' : ''}`}
              onClick={remove}
              disabled={busy}
            >
              {confirmDelete ? 'Confermi?' : 'Elimina'}
            </button>
          )}
          <button type="button" className="btn-primary" onClick={save} disabled={busy || !canSave}>
            {isNew ? 'Crea' : 'Salva'}
          </button>
        </footer>
      </div>
    </div>
  )
}
