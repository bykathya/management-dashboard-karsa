import { useState, useMemo } from 'react'
import { useApi } from '../../hooks/useApi'
import { useIsMobile } from '../../hooks/useIsMobile'
import { ECOSYSTEM_NAME_FULL } from '../../config/ecosystem'

const MONTHS  = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember']
const DAYS    = ['Sen','Sel','Rab','Kam','Jum','Sab','Min']

const TIPE_CONFIG = {
  ULANG_TAHUN:       { label: 'Ulang Tahun',        icon: '🎂', bg: 'color-mix(in srgb, var(--pink) 15%, transparent)',  color: 'var(--pink)' },
  DEADLINE_PRODUKSI: { label: 'Deadline Produksi',  icon: '📦', bg: 'color-mix(in srgb, var(--cyan) 15%, transparent)',   color: 'var(--cyan)' },
  DEADLINE_GOAL:     { label: 'Deadline Goal',       icon: '🎯', bg: 'color-mix(in srgb, var(--accent) 15%, transparent)',  color: 'var(--accent)' },
  REKRUTMEN:         { label: 'Rekrutmen',           icon: '👤', bg: 'rgba(234,88,12,0.15)',   color: '#EA580C' },
  EVENT_KADER:       { label: 'Event Kader',         icon: '📝', bg: 'color-mix(in srgb, var(--cyan) 15%, transparent)',   color: 'var(--cyan)' },
  // Karsa (27 Nov 2026): event dari Info & Dokumen dan acara web kerja harian, serta hari libur kerja
  EVENT:             { label: 'Event',               icon: '📣', bg: 'var(--pink-subtle)', color: 'var(--text)' },
  LIBUR:             { label: 'Hari libur',          icon: '🏖️', bg: 'var(--hover-strong)', color: 'var(--text)' },
}

function getDaysInMonth(bulan, tahun) {
  return new Date(tahun, bulan, 0).getDate()
}

function DayDetailHeader({ selected, bulan, tahun, count, onClose }) {
  return (
    <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)',
      display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
      <div>
        <div style={{ fontWeight: 800, fontSize: 15 }}>
          {selected} {MONTHS[bulan-1]} {tahun}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          {count} event
        </div>
      </div>
      <button className="modal-close" onClick={onClose} aria-label="Tutup">✕</button>
    </div>
  )
}

function DayDetailList({ evts }) {
  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 500, overflowY: 'auto' }}>
      {evts.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)', fontSize: 13 }}>
          Tidak ada event hari ini
        </div>
      ) : evts.map(ev => {
        const cfg = TIPE_CONFIG[ev.tipe]
        return (
          <div key={ev.id} style={{
            padding: '10px 12px', borderRadius: 10,
            background: cfg?.bg ?? 'var(--bg-surface)',
            borderLeft: `3px solid ${cfg?.color ?? 'var(--text-muted)'}`,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <span style={{ fontSize: 14 }}>{cfg?.icon}</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: cfg?.color ?? 'var(--text-muted)',
                textTransform: 'uppercase', letterSpacing: '0.05em' }}>{cfg?.label}</span>
            </div>
            <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)', marginBottom: 2 }}>
              {ev.judul}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{ev.detail}</div>
          </div>
        )
      })}
    </div>
  )
}

function getFirstDayOfMonth(bulan, tahun) {
  const d = new Date(tahun, bulan - 1, 1).getDay()
  return d === 0 ? 6 : d - 1 // Monday = 0
}

export default function Calendar({ onNavigate }) {
  const now = new Date()
  const isMobile = useIsMobile()
  const [bulan, setBulan] = useState(now.getMonth() + 1)
  const [tahun, setTahun] = useState(now.getFullYear())
  const [selected, setSelected] = useState(null)
  const [filterTipe, setFilterTipe] = useState('all')

  const { data: events, loading } = useApi(
    `/api/calendar?bulan=${bulan}&tahun=${tahun}`,
    [bulan, tahun]
  )

  const filtered = useMemo(() => {
    if (!events) return []
    return filterTipe === 'all' ? events : events.filter(e => e.tipe === filterTipe)
  }, [events, filterTipe])

  // Group events by date string
  const byDate = useMemo(() => {
    const map = {}
    for (const ev of filtered) {
      const d = new Date(ev.tanggal)
      const key = `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`
      if (!map[key]) map[key] = []
      map[key].push(ev)
    }
    return map
  }, [filtered])

  const daysInMonth  = getDaysInMonth(bulan, tahun)
  const firstDay     = getFirstDayOfMonth(bulan, tahun)
  const today        = now.getDate()
  const isThisMonth  = now.getMonth() + 1 === bulan && now.getFullYear() === tahun

  const selectedKey  = selected ? `${tahun}-${bulan}-${selected}` : null
  const selectedEvts = selectedKey ? (byDate[selectedKey] ?? []) : []

  const prev = () => { if (bulan === 1) { setBulan(12); setTahun(t => t-1) } else setBulan(b => b-1); setSelected(null) }
  const next = () => { if (bulan === 12) { setBulan(1); setTahun(t => t+1) } else setBulan(b => b+1); setSelected(null) }

  // Total per tipe untuk summary
  const tipeCount = useMemo(() => {
    const c = {}
    for (const ev of (events ?? [])) c[ev.tipe] = (c[ev.tipe] ?? 0) + 1
    return c
  }, [events])

  // Desain Karsa (28 Nov 2026): warna titik per jenis acara, sama dengan contoh desain.
  const warnaEv = (t) => ({ EVENT: 'var(--pink-candy)', ULANG_TAHUN: 'var(--accent)', DEADLINE_PRODUKSI: 'var(--kd-kuning)', DEADLINE_GOAL: 'var(--kd-kuning)', LIBUR: '#111111' }[t] ?? '#ffffff')
  const pilihHari = selected ?? (isThisMonth ? today : null)
  const kunciPilih = pilihHari ? `${tahun}-${bulan}-${pilihHari}` : null
  const acaraHari = kunciPilih ? (byDate[kunciPilih] ?? []) : []
  const acaraBulan = [...filtered].sort((x, y) => new Date(x.tanggal) - new Date(y.tanggal))
  const tglPanjang = (d) => new Date(tahun, bulan - 1, d).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const KartuEv = ({ ev }) => (
    <div className="ev"><span className="pita-ev" style={{ background: warnaEv(ev.tipe) }} />
      <div><small>{TIPE_CONFIG[ev.tipe]?.label ?? ev.tipe}</small><b>{ev.judul}</b>{ev.detail && <small>{ev.detail}</small>}
        {ev.tautan && <small><a href={ev.tautan} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text)', fontWeight: 600 }}>Buka tautan →</a></small>}</div></div>
  )
  return (
    <div className="kd">
      <div className="kepala"><h1>Kalender</h1><span className="chip">{ECOSYSTEM_NAME_FULL}</span></div>
      <p className="sub">Semua acara circle di satu kalender: event, ulang tahun anggota, deadline order, hari libur, dan pengingat. Event yang dibuat di sini atau di Info &amp; Dokumen (tab Event) muncul juga di web kerja harian.</p>
      {(events ?? []).length > 0 && (
        <div className="chips">
          <button type="button" className={filterTipe === 'all' ? 'on' : ''} onClick={() => setFilterTipe('all')}>Semua ({(events ?? []).length})</button>
          {Object.entries(TIPE_CONFIG).map(([key, cfg]) => tipeCount[key] ? <button key={key} type="button" className={filterTipe === key ? 'on' : ''} onClick={() => setFilterTipe(filterTipe === key ? 'all' : key)}>{cfg.label} ({tipeCount[key]})</button> : null)}
        </div>
      )}
      <div className="kal-wrap">
        <div className="kartu kal">
          <div className="kal-head">
            <button type="button" className="tombol k" onClick={prev} aria-label="Bulan sebelumnya">‹</button>
            <h2>{MONTHS[bulan - 1]} {tahun}</h2>
            <button type="button" className="tombol k" onClick={next} aria-label="Bulan berikutnya">›</button>
            {!isThisMonth && <button type="button" className="tombol k" onClick={() => { setBulan(now.getMonth() + 1); setTahun(now.getFullYear()); setSelected(null) }}>Hari ini</button>}
            {onNavigate && <button type="button" className="tombol k hitam" style={{ marginLeft: 'auto' }} onClick={() => onNavigate('Announcement', { buat: 'EVENT' })}>+ Tambah event</button>}
          </div>
          <div className="kal-grid">
            {DAYS.map(d => <div key={d} className="nm">{d}</div>)}
            {Array.from({ length: firstDay }).map((_, i) => <div key={`e-${i}`} className="kk kosong" />)}
            {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
              const evts = byDate[`${tahun}-${bulan}-${day}`] ?? []
              return (
                <button key={day} type="button" className={`kk${pilihHari === day ? ' pilih' : ''}${isThisMonth && day === today ? ' hariini' : ''}`} onClick={() => setSelected(day)} aria-label={`${day} ${MONTHS[bulan - 1]}${evts.length ? `, ${evts.length} acara` : ''}`}>
                  <span className="tg">{day}</span>
                  <span className="titik-ev">{evts.slice(0, 3).map(ev => <i key={ev.id} style={{ background: warnaEv(ev.tipe) }} />)}</span>
                  {evts[0] && <span className="lbl-ev">{evts[0].judul}</span>}
                </button>
              )
            })}
          </div>
          <div className="legenda-ev">{[['Event', 'var(--pink-candy)'], ['Ulang tahun', 'var(--accent)'], ['Deadline order', 'var(--kd-kuning)'], ['Hari libur', '#111111'], ['Pengingat', '#ffffff']].map(([n, w]) => <span key={n}><i style={{ background: w }} />{n}</span>)}</div>
        </div>
        <div className="kal-sisi">
          <div className="kartu" style={{ padding: 18, margin: 0 }}>
            <h3 style={{ margin: '0 0 10px' }}>{pilihHari ? tglPanjang(pilihHari) : 'Pilih tanggal'}</h3>
            {acaraHari.length ? acaraHari.map(ev => <KartuEv key={ev.id} ev={ev} />) : <p className="kosong" style={{ margin: 0 }}>{pilihHari ? 'Tidak ada acara di tanggal ini.' : 'Klik tanggal di kalender untuk melihat acaranya.'}</p>}
          </div>
          <div className="kartu" style={{ padding: 18, margin: 0 }}>
            <h3 style={{ margin: '0 0 10px' }}>Semua acara {MONTHS[bulan - 1]}</h3>
            {acaraBulan.length ? acaraBulan.map(ev => (
              <button key={ev.id} type="button" className="baris-ev" onClick={() => setSelected(new Date(ev.tanggal).getDate())}>
                <b>{new Date(ev.tanggal).getDate()}</b><span>{ev.judul}</span><i style={{ background: warnaEv(ev.tipe) }} />
              </button>
            )) : <p className="kosong" style={{ margin: 0 }}>{loading ? 'Memuat…' : 'Belum ada acara bulan ini.'}</p>}
          </div>
        </div>
      </div>
    </div>
  )
}
