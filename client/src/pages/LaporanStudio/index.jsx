import { useCallback, useEffect, useMemo, useState } from 'react'
import { useApi } from '../../hooks/useApi'
import api from '../../services/api'
import { formatRp, formatUSD } from '../../utils/format'

// WEEKLY & MONTHLY REPORT per studio (Karsa, 27 Nov 2026): terbentuk otomatis dari Daily Sheet — tidak perlu diketik ulang.
// Unduh: CSV, atau Cetak/PDF dari peramban. Laporan PDF lengkap (Executive Summary) tetap di menu Unduh Laporan.
const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
const arti = { fontSize: 12, color: 'var(--text-muted)', fontWeight: 400, lineHeight: 1.5 }
const kotak = { border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', background: 'var(--bg-surface)', padding: 14, minWidth: 0 }
const judul = { fontFamily: 'var(--font-judul)', fontWeight: 600, fontSize: 16 }
const panah = { width: 28, height: 28, padding: 0, borderRadius: 8, border: '1px solid var(--border-hover)', background: 'var(--bg-card)', color: 'var(--text)', cursor: 'pointer' }
const pct = (v) => (v == null ? '—' : `${v > 0 ? '↗' : v < 0 ? '↘' : '→'} ${Math.abs(v)}%`)

function unduhCsv(nama, baris) {
  const isi = baris.map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')
  const url = URL.createObjectURL(new Blob(['﻿' + isi], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a'); a.href = url; a.download = nama; a.click(); URL.revokeObjectURL(url)
}

function Grafik({ data }) {
  const maks = Math.max(...data.map(d => d.v), 0)
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${data.length}, 1fr)`, gap: 10, alignItems: 'end', height: 170, paddingTop: 8 }}>
      {data.map(d => (
        <div key={d.l} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, height: '100%', justifyContent: 'flex-end' }}>
          <span style={{ fontSize: 11.5, fontWeight: 700 }}>{formatUSD(d.v)}</span>
          <div style={{ width: '70%', maxWidth: 56, height: `${maks ? Math.max(3, (d.v / maks) * 120) : 3}px`, background: d.aktif ? 'var(--accent)' : 'var(--pink-candy)', border: '1.5px solid var(--line)', borderRadius: '8px 8px 4px 4px' }} />
          <span style={arti}>{d.l}</span>
        </div>
      ))}
    </div>
  )
}
const Batang = ({ v, maks }) => <div style={{ height: 7, borderRadius: 99, background: 'var(--track)', marginTop: 4 }}><div style={{ width: `${maks ? Math.min(100, (v / maks) * 100) : 0}%`, height: '100%', borderRadius: 99, background: 'var(--accent)' }} /></div>

function Mingguan({ d, akun, setAkun }) {
  const pilih = akun ? d.akun.filter(a => a.akunId === akun) : d.akun
  const jml = (k) => pilih.reduce((s, a) => s + a[k], 0)
  const mi = d.minggu - 1, mingguUsd = pilih.reduce((s, a) => s + a.minggu[mi], 0), bulanUsd = jml('bulanUsd')
  const [skala, setSkala] = useState('minggu')
  const grafik = skala === 'minggu' ? ['W1', 'W2', 'W3', 'W4'].map((l, i) => ({ l, v: pilih.reduce((s, a) => s + a.minggu[i], 0), aktif: i === mi })) : d.tren.map((t, i) => ({ l: t.label, v: t.usd, aktif: i === d.tren.length - 1 }))
  const maks = Math.max(...d.akun.map(a => a.bulanUsd), 0)
  const kartu = [
    ['Total order aktif', jml('wip') + jml('revisi') + jml('waitlist'), 'WIP + Revisi + Waitlist', 'var(--bg-card)'],
    ['Sedang dikerjakan (WIP)', jml('wip'), 'sedang dikerjakan', 'var(--pink-subtle)'],
    ['Revisi', jml('revisi'), 'perlu penyesuaian', 'var(--amber-subtle)'],
    ['Waitlist / antre', jml('waitlist'), 'menunggu dikerjakan', 'var(--bg-card)'],
    [`Selesai minggu W${d.minggu}`, jml('doneMinggu'), `bulan ini: ${jml('doneBulan')}`, 'var(--accent-subtle)'],
    [`Omset minggu W${d.minggu}`, formatUSD(mingguUsd), `bulan ini: ${formatUSD(bulanUsd)}`, 'var(--bg-card)'],
  ]
  return (
    <>
      {d.akun.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
          <button type="button" className={`btn btn-sm ${!akun ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setAkun(null)}>Semua ({d.akun.length})</button>
          {d.akun.map(a => <button key={a.akunId} type="button" className={`btn btn-sm ${akun === a.akunId ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setAkun(a.akunId)}>{a.nama} · {formatUSD(a.bulanUsd)}</button>)}
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10, marginBottom: 16 }}>
        {kartu.map(([l, v, s, bg]) => <div key={l} style={{ ...kotak, background: bg }}><div style={arti}>{l}</div><div style={{ fontSize: 22, fontWeight: 800 }}>{v}</div><div style={arti}>{s}</div></div>)}
      </div>
      <div className="grid-2" style={{ marginBottom: 16 }}>
        <div className="card">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'space-between', alignItems: 'baseline' }}>
            <div><div style={judul}>Grafik omset studio</div><div style={arti}>{skala === 'minggu' ? 'omset per minggu W1–W4' : 'omset 4 bulan terakhir'}</div></div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button type="button" className={`btn btn-sm ${skala === 'minggu' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setSkala('minggu')}>Mingguan</button>
              <button type="button" className={`btn btn-sm ${skala === 'bulan' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setSkala('bulan')}>Bulanan</button>
            </div>
          </div>
          <Grafik data={grafik} />
        </div>
        <div className="card">
          <div style={judul}>Omset & antrean per akun</div><div style={{ ...arti, marginBottom: 10 }}>uang masuk bulan ini dan order yang masih aktif</div>
          {d.akun.length === 0 ? <div style={arti}>Studio ini belum punya akun jualan.</div> : d.akun.map((a, i) => (
            <div key={a.akunId} style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}><span><b>#{i + 1} {a.nama}</b> <span style={arti}>{a.platform}</span></span><span><span style={arti}>{a.wip + a.revisi + a.waitlist} aktif</span> <b>{formatUSD(a.bulanUsd)}</b></span></div>
              <Batang v={a.bulanUsd} maks={maks} />
            </div>
          ))}
        </div>
      </div>
      <div style={{ ...judul, marginBottom: 4 }}>Rincian per Admin PIC & aktivitas 7 hari</div>
      <div style={{ ...arti, marginBottom: 10 }}>PIC = admin penanggung jawab akun (dari Performa di Daily Sheet atau Admin Market unit)</div>
      {d.admin.length === 0 ? <div className="card" style={arti}>Studio ini belum punya admin PIC. Atur di Daily Sheet › Performa, Bonus & Lembur.</div> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
          {d.admin.map(a => (
            <div key={a.userId} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}><div><div style={arti}>ADMIN PIC</div><b>{a.nama}</b></div><div style={{ textAlign: 'right' }}><b style={{ fontFamily: 'var(--font-judul)' }}>{formatUSD(a.usd)}</b><div style={arti}>{a.persen}% studio</div></div></div>
              <div><div style={arti}>AKUN YANG DIPEGANG</div><div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>{a.akun.length ? a.akun.map(k => <span key={k.nama} className="ff-chip">{k.nama} · {formatUSD(k.usd)}</span>) : <span style={arti}>belum diatur</span>}</div></div>
              <div><div style={arti}>ORDER & ANTREAN</div><div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, fontSize: 12.5 }}>{[['WIP', a.wip], ['Revisi', a.revisi], ['Done', a.done], ['Antre', formatUSD(a.antreUsd)]].map(([l, v]) => <div key={l} style={{ ...kotak, padding: 6, textAlign: 'center' }}>{l}<div><b>{v}</b></div></div>)}</div></div>
              <div><div style={arti}>AKTIVITAS 7 HARI TERAKHIR</div><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 10px', fontSize: 13 }}><span>Chat baru: <b>{a.chatBaru}</b></span><span>Order baru: <b>{a.orderBaru}</b></span><span>Pembayaran: <b>{a.bayarBaru}</b></span><span>Selesai: <b>{a.selesai7} ({formatUSD(a.selesai7Usd)})</b></span></div></div>
            </div>
          ))}
        </div>
      )}
    </>
  )
}

function Bulanan({ d }) {
  const bar = d.cpm > 0 ? Math.min(100, Math.round((d.totalRp / d.cpm) * 100)) : 0
  const L = d.lempar
  return (
    <>
      <div className="grid-2" style={{ marginBottom: 16 }}>
        <div className="card">
          <div style={arti}>Total omset {BULAN[d.bulan - 1]} {d.tahun}</div>
          <div style={{ fontFamily: 'var(--font-judul)', fontSize: 26, fontWeight: 600 }}>{formatUSD(d.totalUsd)}</div>
          <div style={{ ...arti, display: 'flex', justifyContent: 'space-between' }}><span>{pct(d.perubahanPct)} dari bulan lalu</span><span>{formatRp(d.totalRp)}</span></div>
          <div style={{ ...kotak, marginTop: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>CPM (biaya bulanan)</span><b>{formatRp(d.cpm)}</b></div>
            <div style={{ height: 8, borderRadius: 99, background: 'var(--track)', margin: '6px 0' }}><div style={{ width: `${bar}%`, height: '100%', borderRadius: 99, background: bar >= 100 ? 'var(--accent)' : 'var(--pink-candy)' }} /></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Sisa setelah CPM</span><b style={{ color: d.surplusRp < 0 ? 'var(--red)' : 'var(--green)' }}>{d.surplusRp >= 0 ? '+' : ''}{formatRp(d.surplusRp)}</b></div>
            <div style={arti}>{d.cpmSumber === 'ff' ? 'CPM dari Financial Forecasting bulan ini.' : 'CPM hitungan otomatis (Financial Forecasting bulan ini belum diisi).'}</div>
          </div>
        </div>
        <div className="card">
          <div style={judul}>Pertumbuhan omset</div><div style={arti}>4 bulan terakhir</div>
          <Grafik data={d.tren.map((t, i) => ({ l: t.label, v: t.usd, aktif: i === d.tren.length - 1 }))} />
        </div>
      </div>
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
          <div><div style={judul}>Akun jualan & porsi omset</div><div style={arti}>omset tiap akun, progres W1–W4, dan nilai bersih setelah potongan platform</div></div>
          <span className="ff-chip">{d.akun.length} akun</span>
        </div>
        {d.akun.length === 0 ? <div style={arti}>Studio ini belum punya akun jualan.</div> : d.akun.map(a => {
          const maks = Math.max(...a.minggu, 0)
          return (
            <div key={a.akunId} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginBottom: 12 }}>
              <div style={kotak}><div style={{ display: 'flex', justifyContent: 'space-between' }}><b>{a.nama}</b><span style={arti}>{a.platform}</span></div><div style={{ fontFamily: 'var(--font-judul)', fontSize: 22, fontWeight: 600, marginTop: 4 }}>{formatUSD(a.usd)}</div><div style={arti}>{a.persen}% dari omset studio</div></div>
              <div style={kotak}><div style={{ display: 'flex', justifyContent: 'space-between' }}><b>Progres W1–W4</b><span style={arti}>{formatUSD(a.usd)} total</span></div>
                {a.minggu.map((w, i) => <div key={i} style={{ marginTop: 4 }}><div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5 }}><span>W{i + 1}</span><span>{formatUSD(w)}</span></div><Batang v={w} maks={maks} /></div>)}</div>
              <div style={kotak}><b>Potongan platform & nilai bersih</b>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginTop: 8 }}><span style={arti}>Potongan</span><span>{a.feePersen}%</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginTop: 4 }}><span style={arti}>Kurs</span><span>{formatRp(d.kurs)} / USD</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginTop: 4 }}><span style={arti}>Nilai bersih</span><b>{formatRp(a.bersihRp)}</b></div></div>
            </div>
          )
        })}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
          <span><span style={arti}>Total akun</span><br /><b>{formatUSD(d.totalUsd)}</b></span>
          <span><span style={arti}>CPM tertutup omset</span><br /><b>{d.cpmTertutupPct == null ? '—' : `${d.cpmTertutupPct}%`}</b></span>
          <span><span style={arti}>Selisih vs CPM</span><br /><b style={{ color: d.surplusRp < 0 ? 'var(--red)' : 'var(--green)' }}>{d.surplusRp >= 0 ? '+' : ''}{formatRp(d.surplusRp)}</b></span>
        </div>
      </div>
      <div className="card">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
          <div><div style={judul}>Rekap lempar kerjaan</div><div style={arti}>freelancer di order bulan ini</div></div>
          <span className="ff-chip" style={{ background: L.lewat30 ? 'var(--pink-candy)' : 'var(--accent)', color: L.lewat30 ? 'var(--on-pink)' : 'var(--on-accent)' }}>{L.lewat30 ? `${L.lewat30} lewat batas 30%` : 'Batas 30% aman'}</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10 }}>
          {[['Total fee ke freelancer', formatRp(L.totalRp), `${L.jumlah} kerjaan di ${L.akun} akun`], ['Sudah dibayar', formatRp(L.lunasRp), `${L.lunasJumlah} lunas`], ['Belum dibayar', formatRp(L.belumRp), `${L.belumJumlah} menunggu`], ['Dalam vs luar studio', `${L.dalam} : ${L.luar}`, 'freelancer studio ini : dari luar']].map(([l, v, s]) => (
            <div key={l} style={kotak}><div style={arti}>{l}</div><div style={{ fontSize: 19, fontWeight: 800 }}>{v}</div><div style={arti}>{s}</div></div>
          ))}
        </div>
      </div>
    </>
  )
}

export default function LaporanStudio({ jenis = 'mingguan' }) {
  const { data: ringkasan } = useApi('/api/monthly-data/summary')
  const daftar = useMemo(() => (ringkasan?.perStudio ?? []).filter(s => s.kas !== null), [ringkasan])
  const kini = new Date(Date.now() + 7 * 3600000)
  const [studioId, setStudioId] = useState(null)
  const [periode, setPeriode] = useState({ bulan: kini.getUTCMonth() + 1, tahun: kini.getUTCFullYear() })
  const [minggu, setMinggu] = useState(Math.min(4, Math.floor((kini.getUTCDate() - 1) / 7) + 1))
  const [akun, setAkun] = useState(null)
  const [d, setD] = useState(null), [galat, setGalat] = useState('')
  useEffect(() => { if (!studioId && daftar.length) setStudioId(daftar[0].studioId) }, [daftar, studioId])
  const muat = useCallback(async () => {
    if (!studioId) return
    setD(null)
    try { const r = await api.get(`/api/laporan-studio/${jenis}?studioId=${studioId}&bulan=${periode.bulan}&tahun=${periode.tahun}&minggu=${minggu}`); setD(r.data.data); setGalat('') } catch (e) { setGalat(e?.response?.data?.message ?? 'Gagal memuat laporan') }
  }, [studioId, periode, minggu, jenis])
  useEffect(() => { muat() }, [muat])
  useEffect(() => { setAkun(null) }, [studioId])
  const geserBulan = (n) => setPeriode(p => { const t = p.tahun * 12 + (p.bulan - 1) + n; return { bulan: (t % 12) + 1, tahun: Math.floor(t / 12) } })
  const label = `${BULAN[periode.bulan - 1]} ${periode.tahun}`
  const csv = () => {
    if (!d) return
    const nama = `${jenis === 'mingguan' ? 'weekly' : 'monthly'}-${(d.studio ?? 'studio').replace(/\s+/g, '-')}-${periode.tahun}-${String(periode.bulan).padStart(2, '0')}${jenis === 'mingguan' ? `-W${minggu}` : ''}.csv`
    if (jenis === 'mingguan') unduhCsv(nama, [['Akun', 'Platform', 'W1', 'W2', 'W3', 'W4', 'Bulan ini (USD)', 'WIP', 'Revisi', 'Waitlist', `Selesai W${minggu}`, 'Antre (USD)'], ...d.akun.map(a => [a.nama, a.platform, ...a.minggu, a.bulanUsd, a.wip, a.revisi, a.waitlist, a.doneMinggu, a.antreUsd])])
    else unduhCsv(nama, [['Akun', 'Platform', 'Omset (USD)', 'Porsi (%)', 'W1', 'W2', 'W3', 'W4', 'Potongan (%)', 'Nilai bersih (Rp)'], ...d.akun.map(a => [a.nama, a.platform, a.usd, a.persen, ...a.minggu, a.feePersen, a.bersihRp]), [], ['Total omset (USD)', d.totalUsd], ['CPM (Rp)', d.cpm], ['Sisa setelah CPM (Rp)', d.surplusRp]])
  }

  if (ringkasan && !daftar.length) return <div className="card" style={{ padding: 24 }}>Laporan studio hanya untuk pengelola studio.</div>
  return (
    <>
      <div className="page-header" style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1>{jenis === 'mingguan' ? 'Weekly Report' : 'Monthly Report'}</h1>
            <p>{jenis === 'mingguan' ? 'Laporan mingguan studio, terbentuk otomatis dari Daily Sheet. Tidak perlu diketik ulang.' : 'Rekap bulanan studio: omset dibanding biaya bulanan (CPM), pertumbuhan, akun jualan, dan lempar kerjaan. Terbentuk otomatis dari Daily Sheet.'}</p>
          </div>
          <div className="no-print" style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <select className="form-input" style={{ width: 160, paddingLeft: 10 }} value={studioId ?? ''} onChange={e => setStudioId(e.target.value)} aria-label="Studio">{daftar.map(s => <option key={s.studioId} value={s.studioId}>{s.nama}</option>)}</select>
            <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><button type="button" style={panah} onClick={() => geserBulan(-1)} aria-label="Bulan sebelumnya">‹</button><b style={{ fontSize: 13, minWidth: 110, textAlign: 'center' }}>{label}</b><button type="button" style={panah} onClick={() => geserBulan(1)} aria-label="Bulan berikutnya">›</button></span>
            {jenis === 'mingguan' && <select className="form-input" style={{ width: 80, paddingLeft: 10 }} value={minggu} onChange={e => setMinggu(Number(e.target.value))} aria-label="Minggu">{[1, 2, 3, 4].map(w => <option key={w} value={w}>W{w}</option>)}</select>}
            <button type="button" className="btn btn-secondary btn-sm" onClick={csv} disabled={!d}>Unduh CSV</button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => window.print()} disabled={!d}>Cetak / PDF</button>
          </div>
        </div>
        <div style={{ ...arti, marginTop: 6 }}>W1 = tanggal 1–7, W2 = 8–14, W3 = 15–21, W4 = 22 sampai akhir bulan. Omset = uang masuk (lunas, DP, dan tip). Laporan PDF lengkap (Executive Summary) tetap ada di menu Unduh Laporan.</div>
      </div>
      {galat && <div className="login-error" style={{ marginBottom: 12 }}>{galat}</div>}
      {!d ? (!galat && <div className="card" style={{ padding: 24, color: 'var(--text-muted)' }}>Memuat…</div>)
        : jenis === 'mingguan' ? <Mingguan d={d} akun={akun} setAkun={setAkun} /> : <Bulanan d={d} />}
    </>
  )
}
