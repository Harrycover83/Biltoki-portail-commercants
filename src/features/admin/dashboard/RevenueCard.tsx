import { useEffect, useMemo, useState } from 'react'
import { fetchDailyRevenue, parisYesterday } from '@/features/admin/dashboard/revenue'
import { addDays, comparePeriod, isoWeek, requiredRanges, weekStart, type RevenueMode } from '@/features/admin/dashboard/weeks'
import { formatDateTime } from '@/lib/format'
import { formatEuroFromCents } from '@/lib/money'

const TOULON_HALL_ID = '29a1b758-07c9-481e-bd54-c72b6a9949c4'

const money = (value: number | null) => (value === null ? 'Indisponible' : formatEuroFromCents(value))
const dateLabel = (value: string) => value.split('-').reverse().join('/')
const shortDate = (value: string) => value.split('-').reverse().slice(0, 2).join('/')
const plural = (count: number, word: string) => `${count} ${word}${count > 1 ? 's' : ''}`

function missingDayLabel(hallId: string, date: string): string {
  return hallId === TOULON_HALL_ID && new Date(`${date}T00:00:00Z`).getUTCDay() === 1 ? 'Fermé · lundi' : 'Données non remontées'
}

function trendLabel(percent: number | null): string {
  if (percent === null) return 'Non calculable'
  return `${percent > 0 ? '+' : ''}${percent.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} %`
}

type Loaded = { key: string; series?: Map<string, number | null>; fetchedAt?: string; error?: string }

/** Reads the weeks needed around the observed one; moving between days of that week costs no request. */
function useDailySeries(hallId: string | undefined, monday: string, lastDate: string, refresh: number) {
  const key = `${hallId}:${monday}:${refresh}`
  const [result, setResult] = useState<Loaded | null>(null)

  useEffect(() => {
    if (!hallId) return
    const controller = new AbortController()
    const ranges = requiredRanges(monday, lastDate)
    void Promise.all(ranges.map((range) => fetchDailyRevenue(hallId, range.since, range.until, controller.signal))).then(
      (responses) => {
        if (controller.signal.aborted) return
        const series = new Map<string, number | null>()
        for (const response of responses) for (const day of response.days) series.set(day.date, day.cents)
        setResult({ key, series, fetchedAt: responses.map((response) => response.fetchedAt).sort().at(-1) })
      },
      (error: unknown) => {
        if (!controller.signal.aborted) {
          setResult({ key, error: error instanceof Error ? error.message : 'Impossible de charger le CA Popina.' })
        }
      },
    )
    return () => controller.abort()
  }, [hallId, key, lastDate, monday])

  return result?.key === key ? result : null
}

function referenceLabel(key: 'previousYear' | 'previousWeek', mode: RevenueMode, dates: string[], monday: string): string {
  if (mode === 'day') {
    const base = key === 'previousYear' ? 'Même jour, semaine N‑1' : 'Même jour, semaine précédente'
    return dates[0] ? `${base} · ${dateLabel(dates[0])}` : base
  }
  const week = key === 'previousYear' ? 'Semaine N‑1' : 'Semaine précédente'
  return `${week} · ${shortDate(monday)} → ${shortDate(addDays(monday, 6))}`
}

export function RevenueCard({ hall, loading }: { hall: { id: string } | undefined; loading: boolean }) {
  const lastDate = parisYesterday()
  const [mode, setMode] = useState<RevenueMode>('day')
  const [anchor, setAnchor] = useState(lastDate)
  const [open, setOpen] = useState(false)
  const [refresh, setRefresh] = useState(0)
  const monday = weekStart(anchor)
  const loaded = useDailySeries(hall?.id, monday, lastDate, refresh)

  const comparison = useMemo(
    () => (loaded?.series ? comparePeriod(mode, anchor, (date) => loaded.series?.get(date) ?? null, lastDate) : null),
    [anchor, lastDate, loaded, mode],
  )

  const move = (direction: -1 | 1) => {
    const next = addDays(anchor, direction * (mode === 'day' ? 1 : 7))
    setAnchor(next > lastDate ? lastDate : next)
  }
  const canGoNext = mode === 'day' ? anchor < lastDate : addDays(monday, 7) <= lastDate
  const unit = mode === 'day' ? 'Jour' : 'Semaine'
  const feminine = mode === 'day' ? '' : 'e'

  const title = mode === 'week'
    ? `CA de la semaine ${isoWeek(monday).week} · ${shortDate(monday)} → ${shortDate(addDays(monday, 6))}`
    : anchor === lastDate ? 'CA de la veille' : `CA du ${dateLabel(anchor)}`
  const headline = !comparison || !hall
    ? '…'
    : comparison.currentCents === null
      ? mode === 'day' ? missingDayLabel(hall.id, anchor) : 'Indisponible'
      : money(comparison.currentCents)

  return (
    <div className="space-y-4">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="revenue-chooser"
        onClick={() => setOpen((value) => !value)}
        className="block w-full border border-[#d6cebf] p-3 text-left hover:bg-[#f7e7b8]"
      >
        <span className="block text-sm font-semibold">{title}</span>
        <span className="brand-display block text-3xl">{headline}</span>
        <span className="block text-xs text-[#615b51]">{open ? 'Masquer le choix' : 'Cliquer pour choisir un jour ou une semaine'}</span>
      </button>

      {open && (
        <div id="revenue-chooser" className="space-y-3 border border-[#e4ddd1] p-3">
          <div role="group" aria-label="Type de période" className="flex gap-2">
            {(['day', 'week'] as const).map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={mode === value}
                onClick={() => setMode(value)}
                className={`border border-[#171511] px-3 py-1 text-sm font-bold ${mode === value ? 'bg-[#171511] text-white' : ''}`}
              >
                {value === 'day' ? 'Jour' : 'Semaine'}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" aria-label={`${unit} précédent${feminine}`} onClick={() => move(-1)} className="border px-3 py-1 font-bold">‹</button>
            <input
              type="date"
              aria-label="Date observée"
              value={anchor}
              max={lastDate}
              onChange={(event) => {
                if (event.target.value && event.target.value <= lastDate) setAnchor(event.target.value)
              }}
              className="border p-1 text-sm"
            />
            <button type="button" aria-label={`${unit} suivant${feminine}`} disabled={!canGoNext} onClick={() => move(1)} className="border px-3 py-1 font-bold disabled:opacity-30">›</button>
            <button type="button" onClick={() => setRefresh((version) => version + 1)} className="ml-auto text-sm font-bold underline">Actualiser</button>
          </div>
          {mode === 'week' && (
            <p className="text-xs text-[#615b51]">Semaines calendaires, du lundi au dimanche : choisissez n’importe quelle date de la semaine.</p>
          )}
        </div>
      )}

      {loading ? <p role="status">Chargement des halles…</p>
        : !hall ? <p role="alert">Aucune halle accessible sélectionnée.</p>
        : !loaded ? <p role="status">Chargement du CA Popina…</p>
        : loaded.error || !comparison ? <p role="alert" className="border border-[#d84d2c] bg-[#fdeee9] p-3">{loaded.error}</p>
        : (
          <div className="space-y-3">
            {mode === 'week' && comparison.dates.length < 7 && (
              <p className="text-xs text-[#615b51]">
                Semaine en cours : {plural(comparison.dates.length, 'jour')} clôturé{comparison.dates.length > 1 ? 's' : ''}, comparé{comparison.dates.length > 1 ? 's' : ''} jour pour jour.
              </p>
            )}
            <ul className="space-y-2">
              {comparison.references.map((reference) => (
                <li key={reference.key} className="border-t border-[#e4ddd1] pt-2 text-sm">
                  <p className="font-semibold">{referenceLabel(reference.key, mode, reference.dates, reference.monday)}</p>
                  <p>
                    <span className="brand-display text-lg">{trendLabel(reference.trendPercent)}</span>
                    <span className="ml-2 text-[#615b51]">
                      {reference.totalCents === null
                        ? mode === 'day' ? missingDayLabel(hall.id, reference.dates[0] ?? anchor) : 'Données non remontées'
                        : money(reference.totalCents)}
                    </span>
                  </p>
                  {mode === 'week' && reference.comparableDays > 0 && reference.comparableDays < comparison.dates.length && (
                    <p className="text-xs text-[#615b51]">Tendance calculée sur {plural(reference.comparableDays, 'jour')} présent(s) des deux côtés.</p>
                  )}
                </li>
              ))}
            </ul>
            {loaded.fetchedAt && <p className="text-xs text-[#615b51]">Source Popina · TTC · lu le {formatDateTime(loaded.fetchedAt)}.</p>}
          </div>
        )}
    </div>
  )
}
