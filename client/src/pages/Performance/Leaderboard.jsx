import { useState } from 'react'
import { useApi } from '../../hooks/useApi'
import { formatRp, getBulanLabel } from '../../utils/format'
import { ECOSYSTEM_NAME_FULL } from '../../config/ecosystem'
import { fotoAtauStiker } from '../../components/layout/Topbar'

// Leaderboard sesuai desain yang disepakati (Karsa, 28 Nov 2026; desain/ringkasan/leaderboard.html).
// Data: GET /api/performance/leaderboard. Omset resmi dari Laporan Omset; akun jualan dari order web kerja harian.
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
const PLATFORM = ['VGen', 'Ko-fi', 'Artistree', 'Fiverr', 'Etsy', 'Komunitas', 'Lain-lain']
const WARNA_LAMBANG = ['var(--accent)', 'var(--pink-candy)', 'var(--kd-kuning)']
const usd = (n) => (n == null ? '—' : '$' + Math.round(n).toLocaleString('en-US'))
const skalaAtas = (m) => { if (m <= 0) return 4; const p = 10 ** Math.floor(Math.log10(m)); return Math.ceil(m / p) * p }

export default function Leaderboard({ bulan, tahun, onPilih, onNavigate }) {
  const { data, loading, error } = useApi(`/api/performance/leaderboard?bulan=${bulan}&tahun=${tahun}`, [bulan, tahun])
  const [lihatAkun, setLihatAkun] = useState(false)
  const now = new Date()
  const pilihan = Array.from({ length: 12 }, (_, i) => { const d = new Date(now.getFullYear(), now.getMonth() - i, 1); return { v: `${d.getFullYear()}-${d.getMonth() + 1}`, l: `${MONTHS[d.getMonth()]} ${d.getFullYear()}` } })
  const label = getBulanLabel(bulan, tahun)
  const kurs = data?.kurs ?? 17000
  const studio = data?.studio ?? []
  // Warna lambang mengikuti urutan nama (bukan peringkat) supaya tiap studio tetap warnanya.
  const urutNama = [...studio].sort((a, b) => a.nama.localeCompare(b.nama)).map(s => s.studioId)
  const warna = (id) => WARNA_LAMBANG[Math.max(0, urutNama.indexOf(id)) % 3]
  const total = data?.global?.totalUsd ?? 0
  const top = studio.find(s => s.usd > 0)
  const topAkun = (data?.akun ?? []).find(a => a.usd > 0)
  const maks = skalaAtas(Math.max(0, ...studio.map(s => s.usd)))
  const totalAkun = (data?.platformAkun ?? []).reduce((a, p) => a + p.usd, 0)
  const perPlatform = (nama) => {
    const daftar = data?.platformAkun ?? []
    const cocok = nama === 'Lain-lain'
      ? daftar.filter(p => !PLATFORM.slice(0, -1).some(x => x.toLowerCase() === String(p.platform).toLowerCase()))
      : daftar.filter(p => String(p.platform).toLowerCase() === nama.toLowerCase())
    return cocok.reduce((a, p) => ({ usd: a.usd + p.usd, akun: a.akun + p.jumlahAkun }), { usd: 0, akun: 0 })
  }

  return (
    <div className="kd">
      <div className="kepala">
        <h1>Leaderboard</h1>
        <span className="chip">{label}</span>
        <div className="pita"><span style={{ fontWeight: 600 }}>{studio.length} Studio</span>
          <select aria-label="Bulan" value={`${tahun}-${bulan}`} onChange={e => { const [t, b] = e.target.value.split('-').map(Number); onPilih(b, t) }}>
            {pilihan.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
          </select>
          <span className="lime" title={`Kurs Rp ${Math.round(kurs).toLocaleString('id-ID')} per USD`}>Rp {Math.round(kurs / 1000)}k</span>
        </div>
      </div>
      <p className="sub">Peringkat omset studio dan akun jualan {ECOSYSTEM_NAME_FULL}. Angka terhitung otomatis dari Daily Sheet tiap studio.</p>
      {error && <div className="login-error" style={{ marginBottom: 16 }}>{error}</div>}

      <div className="stats">
        <div className="stat lime"><span>Top Performing Studio<small className="arti">studio dengan omset tertinggi</small></span><b>{loading ? '…' : usd(top?.usd ?? 0)}</b>
          <div className="bawah">{top ? <span className="chip" style={{ color: 'var(--text)' }}>#1 {top.nama}</span> : <span>Belum ada omset</span>}</div></div>
        <div className="stat pink"><span>Top Market Account<small className="arti">akun jualan dengan omset tertinggi</small></span><b>{loading ? '…' : usd(topAkun?.usd ?? 0)}</b>
          <div className="bawah"><span>{topAkun ? `${topAkun.namaAkun} · ${topAkun.platform}${topAkun.studio ? ` · ${topAkun.studio}` : ''}` : 'Belum ada omset'}</span></div></div>
        <div className="stat"><span>Global Revenue<small className="arti">total omset semua studio</small></span><b>{loading ? '…' : usd(total)}</b>
          <div className="bawah"><span>{formatRp(data?.global?.totalIdr ?? 0)} · {label}</span></div></div>
      </div>

      <div className="kartu">
        <div className="judul-tabel"><div><h2>Studio Revenue ({label})<small className="arti">omset tiap studio bulan ini</small></h2></div><span className="ml chip">USD</span></div>
        <div className="kd-chart">
          <div className="sumbu">{[4, 3, 2, 1, 0].map(i => <span key={i}>{usd((maks * i) / 4)}</span>)}</div>
          <div className="batang" style={{ gridTemplateColumns: `repeat(${Math.max(studio.length, 1)}, 1fr)` }}>
            {studio.map(s => <i key={s.studioId} title={`${s.nama}: ${usd(s.usd)}`} style={{ height: `${Math.max(1, (s.usd / maks) * 100)}%`, background: 'var(--accent)' }} />)}
          </div>
          <div className="label-x" style={{ gridTemplateColumns: `repeat(${Math.max(studio.length, 1)}, 1fr)` }}>{studio.map(s => <span key={s.studioId}>{s.nama}</span>)}</div>
        </div>
      </div>

      <h2 style={{ margin: '0 0 12px', fontSize: 22 }}>Market Accounts<small className="arti">omset per platform jualan · share = porsi dari total omset</small></h2>
      <div className="kd-pasar">
        {PLATFORM.map(p => {
          const g = perPlatform(p)
          return (
            <div key={p} className={`k${g.akun ? ' ada' : ''}`}>
              <span>{p}<span aria-hidden="true">↗</span></span>
              <b>{usd(g.usd)}</b>
              <small>{g.akun} akun · {totalAkun > 0 ? Math.round((g.usd / totalAkun) * 100) : 0}% share</small>
            </div>
          )
        })}
      </div>

      <div className="kartu">
        <div className="judul-tabel">
          <div><h2>Studio Standings<small className="arti">peringkat studio</small></h2><p>ATH = omset bulanan tertinggi · ATL = omset bulanan terendah sejak studio mulai mencatat</p></div>
          <button type="button" className="tombol ml" onClick={() => setLihatAkun(v => !v)}>{lihatAkun ? 'Tutup daftar akun' : 'Inspect Accounts →'}</button>
        </div>
        {lihatAkun && (
          <div className="scroll" style={{ marginBottom: 12 }}><table className="hp">
            <thead><tr><th>Akun</th><th>Platform</th><th>Studio</th><th className="r">Order</th><th className="r">Omset</th></tr></thead>
            <tbody>
              {!(data?.akun ?? []).length && <tr><td colSpan={5} className="kosong">Belum ada akun jualan.</td></tr>}
              {(data?.akun ?? []).map(a => (
                <tr key={a.akunId}><td data-label="Akun" style={{ fontWeight: 600 }}>{a.namaAkun}</td><td data-label="Platform">{a.platform}</td><td data-label="Studio">{a.studio ?? '—'}</td>
                  <td className="r num" data-label="Order">{a.jumlahOrder}</td><td className="r num" data-label="Omset">{usd(a.usd)}<span className="usd">{formatRp(Math.round(a.usd * kurs))}</span></td></tr>
              ))}
            </tbody>
          </table></div>
        )}
        <div className="scroll"><table className="hp">
          <thead><tr><th>Rank</th><th>Studio</th><th>Markets<small className="arti">platform</small></th><th className="r">ATH / ATL</th><th className="r">Total Omset</th></tr></thead>
          <tbody>
            {loading && <tr><td colSpan={5} className="kosong">Memuat…</td></tr>}
            {studio.map((s, i) => (
              <tr key={s.studioId}>
                <td className="kd-peringkat" data-label="Rank">#{String(i + 1).padStart(2, '0')}</td>
                <td data-label="Studio"><div className="studio"><span className="lambang" style={{ background: warna(s.studioId) }}>{s.nama?.[0]?.toUpperCase()}</span>
                  <div>{s.nama}<div className="orang" style={{ gap: 6, fontWeight: 400, fontSize: 13, color: 'var(--text-muted)' }}>{s.koordinator && <img src={fotoAtauStiker(s.koordinator.split(',')[0], s.koordinatorFoto)} alt="" style={{ width: 22, height: 22 }} />}{s.koordinator ?? 'Belum ada koordinator'} · {s.jumlahAkun ?? 0} akun</div></div></div></td>
                <td data-label="Markets">{s.platform?.length ? s.platform.join(', ') : <span className="kosong">—</span>}</td>
                <td className="r num" data-label="ATH / ATL">ATH {usd(s.ath ?? 0)}<span className="usd">ATL {usd(s.atl ?? 0)}</span></td>
                <td className="r num" data-label="Total Omset">{usd(s.usd)}<span className="usd">{formatRp(s.idr)}</span></td>
              </tr>
            ))}
          </tbody>
        </table></div>
      </div>
    </div>
  )
}
