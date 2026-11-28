import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useApi } from '../../hooks/useApi'
import api from '../../services/api'
import { formatRp, formatUSD } from '../../utils/format'
import { WEB_KERJA } from '../../config/ecosystem'
import { unduhCsv, unduhDoc, unduhPng } from '../../utils/eksporLaporan'

// WEEKLY & MONTHLY REPORT per studio sesuai desain yang disepakati (Karsa, 28 Nov 2026; desain/ringkasan/weekly.html & monthly.html).
// Terbentuk otomatis dari Daily Sheet, tidak perlu diketik ulang. Unduh: PNG, PDF (cetak), CSV, DOC.
const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
const pct = (v) => (v == null ? 'belum ada pembanding' : `${v > 0 ? '↗' : v < 0 ? '↘' : '→'} ${Math.abs(v)}% dari bulan lalu`)
const skalaAtas = (m) => { if (m <= 0) return 4; const p = 10 ** Math.floor(Math.log10(m)); return Math.ceil(m / p) * p }
const usd0 = (n) => '$' + Math.round(n ?? 0).toLocaleString('en-US')
const Bar = ({ v, maks, gaya }) => <div className="bar" style={gaya}><i style={{ width: `${maks > 0 ? Math.min(100, (v / maks) * 100) : 0}%` }} /></div>

function Grafik({ data }) {
  const maks = skalaAtas(Math.max(0, ...data.map(d => d.v)))
  const kolom = { gridTemplateColumns: `repeat(${data.length}, 1fr)` }
  return (
    <div className="kd-chart" style={{ padding: '6px 20px 20px' }}>
      <div className="sumbu">{[4, 3, 2, 1, 0].map(i => <span key={i}>{usd0((maks * i) / 4)}</span>)}</div>
      <div className="batang" style={kolom}>{data.map(d => <i key={d.l} title={`${d.l}: ${formatUSD(d.v)}`} style={{ height: `${Math.max(1, (d.v / maks) * 100)}%`, background: 'var(--accent)', opacity: d.aktif ? 1 : 0.75 }} />)}</div>
      <div className="label-x" style={kolom}>{data.map(d => <span key={d.l}>{d.l}</span>)}</div>
    </div>
  )
}

function Mingguan({ d, akun, setAkun }) {
  const pilih = akun ? d.akun.filter(a => a.akunId === akun) : d.akun
  const jml = (k) => pilih.reduce((s, a) => s + a[k], 0)
  const mi = d.minggu - 1, mingguUsd = pilih.reduce((s, a) => s + a.minggu[mi], 0), bulanUsd = jml('bulanUsd')
  const [skala, setSkala] = useState('minggu')
  const grafik = skala === 'minggu' ? ['W1', 'W2', 'W3', 'W4'].map((l, i) => ({ l, v: pilih.reduce((s, a) => s + a.minggu[i], 0), aktif: i === mi })) : d.tren.map((t, i) => ({ l: t.label, v: t.usd, aktif: i === d.tren.length - 1 }))
  const maks = Math.max(...d.akun.map(a => a.bulanUsd), 0)
  const rentangTren = d.tren.length ? `${d.tren[0].label}–${d.tren[d.tren.length - 1].label}` : ''
  return (
    <>
      {d.akun.length > 0 && (
        <div className="chips">
          <button type="button" className={!akun ? 'on' : ''} onClick={() => setAkun(null)}>Semua ({d.akun.length})</button>
          {d.akun.map(a => <button key={a.akunId} type="button" className={akun === a.akunId ? 'on' : ''} onClick={() => setAkun(a.akunId)}>{a.nama} · {usd0(a.bulanUsd)}</button>)}
        </div>
      )}
      <div className="enam">
        <div><span>Total order aktif</span><b>{jml('wip') + jml('revisi') + jml('waitlist')}</b><small>WIP + Revisi + Waitlist</small></div>
        <div style={{ background: 'var(--pink-candy)', color: '#111' }}><span>Sedang dikerjakan (WIP)</span><b>{jml('wip')}</b><small>Sedang dikerjakan</small></div>
        <div style={{ background: 'var(--kd-kuning)', color: '#111' }}><span>Revisi</span><b>{jml('revisi')}</b><small>Perlu penyesuaian</small></div>
        <div><span>Waitlist / antre</span><b>{jml('waitlist')}</b><small>Antrean slot aktif</small></div>
        <div style={{ background: 'var(--accent)', color: '#111' }}><span>Selesai (Done) W{d.minggu}</span><b>{jml('doneMinggu')}</b><small>Bulan ini: {jml('doneBulan')}</small></div>
        <div className="hitam"><span>Omset minggu ini (W{d.minggu})</span><b>{usd0(mingguUsd)}</b><small>Bulan ini: {usd0(bulanUsd)}</small></div>
      </div>
      <div className="dua">
        <div className="kartu" style={{ margin: 0 }}>
          <div className="judul-tabel"><div><h2>Studio Growth Chart<small className="arti">grafik omset studio</small></h2><p>{skala === 'minggu' ? `Omset per minggu W1–W4 · ${BULAN[d.bulan - 1]} ${d.tahun}` : `Omset per bulan · ${rentangTren}`}</p></div>
            <div className="chips ml no-print" style={{ margin: 0 }}>
              <button type="button" className={skala === 'minggu' ? 'on' : ''} onClick={() => setSkala('minggu')}>Mingguan (W1–W4)</button>
              <button type="button" className={skala === 'bulan' ? 'on' : ''} onClick={() => setSkala('bulan')}>Bulanan ({rentangTren})</button>
            </div></div>
          <Grafik data={grafik} />
        </div>
        <div className="kartu" style={{ margin: 0 }}>
          <div className="judul-tabel"><div><h2>Omset &amp; Beban per Akun</h2><p>Klik nama akun di atas untuk rinciannya</p></div><span className="chip ml">{d.akun.length} Akun</span></div>
          <div className="daftar-akun">
            {d.akun.length === 0 ? <p className="kosong">Studio ini belum punya akun jualan.</p> : d.akun.map((a, i) => (
              <div key={a.akunId}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}><span><b>#{i + 1} {a.nama}</b> <small className="kosong">{a.platform}</small></span><span><small className="kosong">{a.wip + a.revisi + a.waitlist} aktif</small> <b>{usd0(a.bulanUsd)}</b></span></div>
                <Bar v={a.bulanUsd} maks={maks} />
              </div>
            ))}
          </div>
        </div>
      </div>
      <h2 style={{ margin: '0 0 12px', fontSize: 22 }}>Rincian per Admin PIC &amp; Aktivitas 7 Hari<small className="arti">PIC = admin penanggung jawab akun (dari Performa di Daily Sheet atau Admin Market unit)</small></h2>
      {d.admin.length === 0 ? <p className="kosong">Studio ini belum punya admin. Atur di Daily Sheet › Performa, Bonus &amp; Lembur.</p> : (
        <div className="pic">
          {d.admin.map(a => (
            <div key={a.userId} className="k">
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}><div><small className="kosong">ADMIN PIC</small><div style={{ fontWeight: 700 }}>{a.nama}</div></div>
                <div style={{ textAlign: 'right' }}><b style={{ fontFamily: 'var(--font-judul)' }}>{usd0(a.usd)}</b><div><span className="chip" style={{ fontSize: 12, padding: '1px 8px' }}>{a.persen}% studio</span></div></div></div>
              <div><small className="kosong">AKUN YANG DIPEGANG</small><div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>{a.akun.length ? a.akun.map(k => <span key={k.nama} className="chip" style={{ fontSize: 12.5 }}>{k.nama} · {usd0(k.usd)}</span>) : <span className="chip" style={{ fontSize: 12.5 }}>—</span>}</div></div>
              <div><small className="kosong">ORDER &amp; ANTREAN</small><div className="kecil4">{[['WIP', a.wip], ['Revisi', a.revisi], ['Done', a.done], ['Antre $', usd0(a.antreUsd)]].map(([l, v]) => <div key={l}>{l}<b>{v}</b></div>)}</div></div>
              <div><small className="kosong">AKTIVITAS 7 HARI TERAKHIR</small><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 10px', fontSize: 13.5, marginTop: 4 }}><span>Chat baru: <b>{a.chatBaru}</b></span><span>Order baru: <b>{a.orderBaru}</b></span><span>Pembayaran baru: <b>{a.bayarBaru}</b></span><span>Selesai: <b>{a.selesai7} ({usd0(a.selesai7Usd)})</b></span></div></div>
            </div>
          ))}
        </div>
      )}
    </>
  )
}

function Bulanan({ d }) {
  const L = d.lempar
  const [tab, setTab] = useState('akun')
  const minggu = [0, 1, 2, 3].map(i => d.akun.reduce((s, a) => s + a.minggu[i], 0))
  const tertinggi = Math.max(0, ...minggu), rata = minggu.reduce((s, x) => s + x, 0) / 4
  const maksTren = Math.max(0, ...d.tren.map(t => t.usd))
  const pertumbuhan = d.tren.length > 1 ? d.tren[d.tren.length - 1].usd - d.tren[0].usd : 0
  const persenL = (x) => (L.jumlah ? Math.round((x / L.jumlah) * 100) : 0)
  const label = `${BULAN[d.bulan - 1].slice(0, 3)} ${d.tahun}`
  return (
    <>
      <div className="stats" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
        <div className="stat"><span>Total omset ({label})</span><b>{usd0(d.totalUsd)}</b><div className="bawah"><span>{pct(d.perubahanPct)}</span><span>{formatRp(d.totalRp)}</span></div>
          <div className="kotak-putih"><div style={{ display: 'flex', justifyContent: 'space-between' }}><span>CPM (biaya bulanan)</span><b>{formatRp(d.cpm)}</b></div><Bar v={d.totalRp} maks={d.cpm} />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}><span>Surplus bersih</span><b>{d.surplusRp >= 0 ? '+' : ''}{formatRp(d.surplusRp)}</b></div></div></div>
        <div className="stat"><span>Pertumbuhan omset</span><b>{pertumbuhan >= 0 ? '' : '-'}{usd0(Math.abs(pertumbuhan))}</b><div className="bawah"><span>{d.tren.length} bulan terakhir ({d.tren[0]?.label}–{d.tren[d.tren.length - 1]?.label})</span></div>
          <div className="mini-tren">{d.tren.map((t, i) => <div key={t.label}><div className="tiang" title={formatUSD(t.usd)}><i style={{ height: `${maksTren > 0 ? Math.max(3, (t.usd / maksTren) * 100) : 3}%`, background: i === d.tren.length - 1 ? 'var(--accent)' : '#111' }} /></div>{t.label}</div>)}</div></div>
        <div className="stat"><span>Minggu tertinggi</span><b>{usd0(tertinggi)}</b><div className="bawah"><span>Rata-rata {usd0(rata)} / minggu</span></div>
          <div className="titik-minggu">{minggu.map((v, i) => <span key={i} title={formatUSD(v)} style={{ color: v === tertinggi && v > 0 ? 'var(--text)' : undefined }}>●<br />W{i + 1}</span>)}</div></div>
        <div className="stat lime"><span>Target omset tercapai</span><b>{d.targetPct == null ? '—' : `${d.targetPct}%`}</b><div className="bawah"><span>{d.targetUsd > 0 ? `Target ${usd0(d.targetUsd)} dari Progres Omset` : 'Target belum diisi di Progres Omset'}</span></div><Bar v={d.totalUsd} maks={d.targetUsd} gaya={{ background: '#fff' }} /></div>
      </div>

      <div className="gelap">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', marginBottom: 14 }}>
          <h2 style={{ margin: 0, fontSize: 19 }}>Market Accounts &amp; Revenue Split<small className="arti">omset dan porsi tiap akun jualan</small></h2>
          <span className="chip gelap-chip">{d.akun.length} Akun</span>
          <div className="chips no-print" style={{ margin: '0 0 0 auto' }}>
            <button type="button" className={tab === 'akun' ? 'on' : ''} onClick={() => setTab('akun')}>Semua akun ({d.akun.length})</button>
            <button type="button" className={tab === 'matriks' ? 'on' : ''} onClick={() => setTab('matriks')}>Matriks mingguan</button>
            <button type="button" className={tab === 'cpm' ? 'on' : ''} onClick={() => setTab('cpm')}>CPM &amp; struktur biaya</button>
          </div>
        </div>
        {d.akun.length === 0 && <p className="mute">Studio ini belum punya akun jualan.</p>}
        {tab === 'akun' && d.akun.map(a => {
          const maks = Math.max(...a.minggu, 0)
          return (
            <div key={a.akunId} className="tiga">
              <div className="kotak"><div style={{ display: 'flex', justifyContent: 'space-between' }}><b>{a.nama}</b><span className="mute">{a.platform}</span></div><div style={{ fontFamily: 'var(--font-judul)', fontSize: 24, marginTop: 6 }}>{usd0(a.usd)}</div><small>{a.persen}% dari omset studio</small></div>
              <div className="kotak"><div style={{ display: 'flex', justifyContent: 'space-between' }}><b>Progres W1–W4</b><span className="mute">{usd0(a.usd)} total</span></div>
                {a.minggu.map((w, i) => <div key={i}><div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginTop: 6 }}><span>W{i + 1}</span><span>{usd0(w)} <small>({a.usd ? Math.round((w / a.usd) * 100) : 0}%)</small></span></div><Bar v={w} maks={maks} gaya={{ marginTop: 2 }} /></div>)}</div>
              <div className="kotak"><b>Potongan platform &amp; nilai bersih</b><div style={{ marginTop: 6 }}><span className="chip" style={{ fontSize: 12, padding: '1px 8px', color: 'var(--text)' }}>potongan {a.feePersen}% · {a.platform}</span></div>
                <div className="baris-uang"><span className="mute">Omset kotor</span><span>{usd0(a.usd)}</span></div>
                <div className="baris-uang"><span className="mute">Kurs</span><span>{formatRp(d.kurs)} / USD</span></div>
                <div className="baris-uang"><span className="mute">Nilai bersih</span><b style={{ color: 'var(--accent)' }}>{formatRp(a.bersihRp)}</b></div></div>
            </div>
          )
        })}
        {tab === 'matriks' && d.akun.length > 0 && (
          <div className="scroll" style={{ padding: 0 }}><table className="tabel-gelap">
            <thead><tr><th>Akun</th><th className="r">W1</th><th className="r">W2</th><th className="r">W3</th><th className="r">W4</th><th className="r">Total</th></tr></thead>
            <tbody>{d.akun.map(a => <tr key={a.akunId}><td><b>{a.nama}</b> <span className="mute">{a.platform}</span></td>{a.minggu.map((w, i) => <td key={i} className="r">{usd0(w)}</td>)}<td className="r"><b>{usd0(a.usd)}</b></td></tr>)}</tbody>
            <tfoot><tr><td>Total studio</td>{minggu.map((w, i) => <td key={i} className="r">{usd0(w)}</td>)}<td className="r">{usd0(d.totalUsd)}</td></tr></tfoot>
          </table></div>
        )}
        {tab === 'cpm' && (
          <div className="tiga">
            <div className="kotak"><b>Omset bulan ini</b><div style={{ fontFamily: 'var(--font-judul)', fontSize: 22, marginTop: 6 }}>{formatRp(d.totalRp)}</div><small>{usd0(d.totalUsd)} · kurs {formatRp(d.kurs)}</small></div>
            <div className="kotak"><b>Biaya bulanan (CPM)</b><div style={{ fontFamily: 'var(--font-judul)', fontSize: 22, marginTop: 6 }}>{formatRp(d.cpm)}</div><small>{d.cpmSumber === 'ff' ? 'dari Financial Forecasting bulan ini' : 'hitungan otomatis (Financial Forecasting belum diisi)'}</small></div>
            <div className="kotak"><b>Potongan platform</b><div style={{ fontFamily: 'var(--font-judul)', fontSize: 22, marginTop: 6 }}>{formatRp(d.akun.reduce((s, a) => s + (a.usd * d.kurs - a.bersihRp), 0))}</div><small>selisih omset kotor dan nilai bersih semua akun</small></div>
          </div>
        )}
        <div className="kaki-gelap">
          <span><small>Total akun</small><br /><b>{usd0(d.totalUsd)}</b></span>
          <span><small>CPM tertutup oleh omset</small><br /><b>{d.cpmTertutupPct == null ? '—' : `${d.cpmTertutupPct}%`}</b></span>
          <span><small>Selisih vs CPM studio</small><br /><b style={{ color: d.surplusRp < 0 ? 'var(--pink-candy)' : 'var(--accent)' }}>{d.surplusRp >= 0 ? '+' : ''}{formatRp(d.surplusRp)}</b></span>
          <a href={WEB_KERJA} target="_blank" rel="noopener noreferrer" className="tombol no-print" style={{ marginLeft: 'auto', textDecoration: 'none' }}>Buka Daily Sheet ↗</a>
        </div>
      </div>

      <div className="kartu">
        <div className="judul-tabel"><div><h2>Rekap Lempar Kerjaan</h2><p>Semua akun {d.studio} · {BULAN[d.bulan - 1]} {d.tahun}</p></div>
          <span className="chip ml">{L.jumlah} brief · {formatRp(L.totalRp)}</span>
          <span className={`pill ${L.lewat30 ? 'bahaya' : 'aman'}`}>{L.lewat30 ? `${L.lewat30} lewat batas 30%` : 'Batas 30% aman'}</span></div>
        <div className="enam" style={{ padding: '0 20px 20px', margin: 0, gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))' }}>
          <div><span>Total deal ke freelancer</span><b>{formatRp(L.totalRp)}</b><small>{L.jumlah} project di {L.akun} akun</small></div>
          <div><span>Sudah transfer</span><b>{formatRp(L.lunasRp)}</b><small>{L.lunasJumlah} brief lunas</small></div>
          <div><span>Belum transfer</span><b>{formatRp(L.belumRp)}</b><small>{L.belumJumlah} brief antre</small></div>
          <div><span>Dalam vs luar</span><b>{persenL(L.dalam)}% / {persenL(L.luar)}%</b><small>Dalam ({L.dalam}) · Luar ({L.luar})</small></div>
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
  const [d, setD] = useState(null), [galat, setGalat] = useState(''), [sibuk, setSibuk] = useState('')
  const isi = useRef(null)
  useEffect(() => { if (!studioId && daftar.length) setStudioId(daftar[0].studioId) }, [daftar, studioId])
  const muat = useCallback(async () => {
    if (!studioId) return
    setD(null)
    try { const r = await api.get(`/api/laporan-studio/${jenis}?studioId=${studioId}&bulan=${periode.bulan}&tahun=${periode.tahun}&minggu=${minggu}`); setD(r.data.data); setGalat('') } catch (e) { setGalat(e?.response?.data?.message ?? 'Gagal memuat laporan') }
  }, [studioId, periode, minggu, jenis])
  useEffect(() => { muat() }, [muat])
  useEffect(() => { setAkun(null) }, [studioId])
  const geserBulan = (n) => setPeriode(p => { const t = p.tahun * 12 + (p.bulan - 1) + n; return { bulan: (t % 12) + 1, tahun: Math.floor(t / 12) } })
  const judul = jenis === 'mingguan' ? 'Weekly Report' : 'Monthly Report'
  const namaStudio = d?.studio ?? daftar.find(s => s.studioId === studioId)?.nama ?? ''
  const dasarNama = `${jenis === 'mingguan' ? 'weekly' : 'monthly'}-${namaStudio.replace(/\s+/g, '-')}-${periode.tahun}-${String(periode.bulan).padStart(2, '0')}${jenis === 'mingguan' ? `-W${minggu}` : ''}`
  const ekspor = async (x) => {
    if (!d) return
    if (x === 'PDF') return window.print()
    if (x === 'CSV') {
      if (jenis === 'mingguan') return unduhCsv(`${dasarNama}.csv`, [['Akun', 'Platform', 'W1', 'W2', 'W3', 'W4', 'Bulan ini (USD)', 'WIP', 'Revisi', 'Waitlist', `Selesai W${minggu}`, 'Antre (USD)'], ...d.akun.map(a => [a.nama, a.platform, ...a.minggu, a.bulanUsd, a.wip, a.revisi, a.waitlist, a.doneMinggu, a.antreUsd])])
      return unduhCsv(`${dasarNama}.csv`, [['Akun', 'Platform', 'Omset (USD)', 'Porsi (%)', 'W1', 'W2', 'W3', 'W4', 'Potongan (%)', 'Nilai bersih (Rp)'], ...d.akun.map(a => [a.nama, a.platform, a.usd, a.persen, ...a.minggu, a.feePersen, a.bersihRp]), [], ['Total omset (USD)', d.totalUsd], ['CPM (Rp)', d.cpm], ['Sisa setelah CPM (Rp)', d.surplusRp]])
    }
    setSibuk(x)
    try { if (x === 'PNG') await unduhPng(isi.current, `${dasarNama}.png`); else unduhDoc(isi.current, `${dasarNama}.doc`, `${judul} ${namaStudio}`) }
    catch { setGalat('Gagal membuat berkas. Coba PDF atau CSV.') } finally { setSibuk('') }
  }

  if (ringkasan && !daftar.length) return <div className="kd"><div className="kartu" style={{ padding: 24 }}>Laporan studio hanya untuk pengelola studio.</div></div>
  return (
    <div className="kd" ref={isi}>
      <div className="kepala">
        <h1>{judul}</h1>
        <span className="chip">{namaStudio} · {BULAN[periode.bulan - 1]} {periode.tahun}</span>
        <div className="ekspor no-print">{['PNG', 'PDF', 'CSV', 'DOC'].map(x => <button key={x} type="button" title={`Unduh ${x}`} disabled={!d || !!sibuk} onClick={() => ekspor(x)}>{sibuk === x ? '…' : x}</button>)}</div>
        <div className="pita no-print">
          <select value={studioId ?? ''} onChange={e => setStudioId(e.target.value)} aria-label="Studio">{daftar.map(s => <option key={s.studioId} value={s.studioId}>{s.nama}</option>)}</select>
          <button type="button" className="pita-panah" onClick={() => geserBulan(-1)} aria-label="Bulan sebelumnya">‹</button>
          <span style={{ fontWeight: 600 }}>{BULAN[periode.bulan - 1].slice(0, 3)} {periode.tahun}</span>
          <button type="button" className="pita-panah" onClick={() => geserBulan(1)} aria-label="Bulan berikutnya">›</button>
          {jenis === 'mingguan' && <select value={minggu} onChange={e => setMinggu(Number(e.target.value))} aria-label="Minggu">{[1, 2, 3, 4].map(w => <option key={w} value={w}>W{w}</option>)}</select>}
          <span className="lime">{jenis === 'mingguan' && d?.kurs ? `Rp ${Math.round(d.kurs / 1000)}k` : 'USD'}</span>
        </div>
      </div>
      <p className="sub">{jenis === 'mingguan' ? 'Laporan mingguan studio, terbentuk otomatis dari Daily Sheet. Tidak perlu diketik ulang.' : 'Rekap bulanan studio: omset dibanding biaya bulanan (CPM), pertumbuhan, dan rekap Lempar Kerjaan. Terbentuk otomatis dari Daily Sheet.'}</p>
      {galat && <div className="login-error" style={{ marginBottom: 12 }}>{galat}</div>}
      {!d ? (!galat && <div className="kartu" style={{ padding: 24, color: 'var(--text-muted)' }}>Memuat…</div>)
        : jenis === 'mingguan' ? <Mingguan d={d} akun={akun} setAkun={setAkun} /> : <Bulanan d={d} />}
      <p className="catatan">W1 = tanggal 1–7, W2 = 8–14, W3 = 15–21, W4 = 22 sampai akhir bulan. Omset = uang masuk (lunas, DP, dan tip). Laporan PDF lengkap (Executive Summary) ada di menu Unduh Laporan.</p>
    </div>
  )
}
