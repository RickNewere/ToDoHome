import { useEffect, useState } from 'react'
import type { ChoreDraft } from '../lib/types'

interface Props {
  draft: ChoreDraft
  /** Categories already in use, offered as suggestions. */
  categories: string[]
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

export default function ChoreEditor({ draft, categories, onSave, onDelete, onClose }: Props) {
  const [form, setForm] = useState<ChoreDraft>(draft)
  const [busy, setBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const isNew = draft.id === null

  // Escape closes the sheet, like any other modal.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const set = <K extends keyof ChoreDraft>(key: K, value: ChoreDraft[K]) =>
    setForm((f) => ({ ...f, [key]: value }))

  const save = async () => {
    if (!form.name.trim()) return
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
                maxLength={4}
                onChange={(e) => set('emoji', e.target.value)}
              />
            </label>
            <label>
              <span>Nome</span>
              <input
                className="input"
                value={form.name}
                placeholder="Es. Lavare i vetri"
                onChange={(e) => set('name', e.target.value)}
              />
            </label>
          </div>

          <label className="field">
            <span>Categoria</span>
            <input
              className="input"
              list="todohome-categories"
              value={form.category}
              onChange={(e) => set('category', e.target.value)}
            />
            <datalist id="todohome-categories">
              {categories.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </label>

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

          <label className="field">
            <span>Nota</span>
            <input
              className="input"
              value={form.note}
              placeholder="Facoltativa"
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
          <button
            type="button"
            className="btn-primary"
            onClick={save}
            disabled={busy || !form.name.trim()}
          >
            {isNew ? 'Crea' : 'Salva'}
          </button>
        </footer>
      </div>
    </div>
  )
}
