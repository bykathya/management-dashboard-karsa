import { useCallback, useEffect, useMemo, useState } from 'react'
import api from '../../services/api'
import { formatRp, formatUSD } from '../../utils/format'
import { WEB_KERJA } from '../../config/ecosystem'

// FINANCIAL FORECASTING baru (Karsa, 27 Nov 2026): estimasi pengeluaran bulanan studio per kategori → pos.
// Total = CPM di Overview & Runway. Setiap perubahan langsung tersimpan (penanda "Tersimpan · jam").
const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
const pesan = (e) => e?.response?.data?.message ?? 'Terjadi kesalahan, coba lagi'
const jumlah = (arr) => arr.reduce((s, i) => s + (i.rupiah || 0), 0)
const jamWib = () => new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' }).replace('.', ':')

function Pos({ i, n, total, simpan, aksi }) {
  return (
    <div className="item">
      <span className="nm">#{n + 1}</span>
      <input defaultValue={i.nama} aria-label="Nama pos" onBlur={e => e.target.value.trim() && e.target.value !== i.nama && simpan(i, { nama: e.target.value })} />
      <span className="rpw"><input className="rp" type="number" min="0" step="1000" inputMode="numeric" defaultValue={i.rupiah || ''} placeholder="0" aria-label="Nominal Rupiah" onBlur={e => Number(e.target.value || 0) !== i.rupiah && simpan(i, { rupiah: Number(e.target.value || 0) })} /></span>
      <button type="button" className={`bayar${i.lunas ? ' ya' : ''}`} onClick={() => simpan(i, { lunas: !i.lunas })} title="Klik untuk mengubah status bayar">{i.lunas ? 'Lunas ✓' : 'Belum'}</button>
      <span className="urut">
        <button type="button" disabled={n === 0} aria-label="Pindah ke atas" onClick={() => aksi(() => api.post(`/api/ff/item/${i.id}/geser`, { arah: -1 }))}>↑</button>
        <button type="button" disabled={n === total - 1} aria-label="Pindah ke bawah" onClick={() => aksi(() => api.post(`/api/ff/item/${i.id}/geser`, { arah: 1 }))}>↓</button>
      </span>
      <button type="button" className="ikon-b" aria-label="Hapus pos" onClick={() => window.confirm(`Hapus pos ${i.nama}?`) && aksi(() => api.delete(`/api/ff/item/${i.id}`))}>×</button>
    </div>
  )
}

export default function Estimasi({ daftarStudio, onNavigate }) {
  const kini = new Date(Date.now() + 7 * 3600000)
  const [periode, setPeriode] = useState({ bulan: kini.getUTCMonth() + 1, tahun: kini.getUTCFullYear() })
  const [studioId, setStudioId] = useState(null)
  useEffect(() => { if (!studioId && daftarStudio.length) setStudioId(daftarStudio[0].studioId) }, [daftarStudio, studioId])
  const [d, setD] = useState(null), [galat, setGalat] = useState(''), [info, setInfo] = useState(''), [jamSimpan, setJamSimpan] = useState(null)
  const [tutup, setTutup] = useState({}), [subBuka, setSubBuka] = useState({}), [formKat, setFormKat] = useState(false)
  const muat = useCallback(async () => {
    if (!studioId) return
    try { const r = await api.get(`/api/ff?studioId=${studioId}&bulan=${periode.bulan}&tahun=${periode.tahun}`); setD(r.data.data); setGalat('') } catch (e) { setGalat(pesan(e)); setD(null) }
  }, [studioId, periode])
  useEffect(() => { setD(null); muat() }, [muat])
  const aksi = async (fn, lalu) => { setGalat(''); try { const r = await fn(); setJamSimpan(jamWib()); if (r?.data?.message && lalu) setInfo(r.data.message); await muat() } catch (e) { setGalat(pesan(e)) } }
  const simpanItem = (i, body) => aksi(() => api.put(`/api/ff/item/${i.id}`, body))
  const geserBulan = (n) => setPeriode(p => { const t = p.tahun * 12 + (p.bulan - 1) + n; return { bulan: (t % 12) + 1, tahun: Math.floor(t / 12) } })

  const semua = useMemo(() => (d?.kategori ?? []).flatMap(k => k.item), [d])
  const total = jumlah(semua), lunas = jumlah(semua.filter(i => i.lunas))
  const omsetUsd = (d?.omset ?? []).reduce((s, a) => s + a.totalUsd, 0)
  const omsetRp = omsetUsd * (d?.kurs ?? 0)
  const sisa = omsetRp - total
  const runway = total > 0 && d ? d.kas.total / total : null
  const label = `${BULAN[periode.bulan - 1]} ${periode.tahun}`

  const namaStudio = d?.studio ?? daftarStudio.find(x => x.studioId === studioId)?.nama ?? ''
  const kurs = d?.kurs ?? 0

  return (
    <div className="kd">
      <div className="kepala">
        <h1>Financial Forecasting</h1>
        <span className="chip">{namaStudio} · {label}</span>
        <span className="tersimpan" title="Perubahan tersimpan otomatis"><i />{jamSimpan ? `Tersimpan · ${jamSimpan} WIB` : 'Tersimpan otomatis'}</span>
        <div className="pita">
          <select value={studioId ?? ''} onChange={e => setStudioId(e.target.value)} aria-label="Studio">
            {daftarStudio.map(x => <option key={x.studioId} value={x.studioId}>{x.nama}</option>)}
          </select>
          <button type="button" className="pita-panah" onClick={() => geserBulan(-1)} aria-label="Bulan sebelumnya">‹</button>
          <span style={{ fontWeight: 600 }}>{BULAN[periode.bulan - 1].slice(0, 3)} {periode.tahun}</span>
          <button type="button" className="pita-panah" onClick={() => geserBulan(1)} aria-label="Bulan berikutnya">›</button>
          {kurs > 0 && <span className="lime" title={`Kurs Rp ${kurs.toLocaleString('id-ID')} per USD`}>Rp {Math.round(kurs / 1000)}k</span>}
        </div>
      </div>
      <p className="sub">Perkiraan biaya bulanan studio (CPM) dibanding perkiraan omset. Totalnya otomatis jadi angka <b>CPM</b> dan <b>Runway</b> di Overview. Hanya bisa dibuka Koordinator (studionya sendiri), Kepala Circle, dan Super Admin.</p>
      {galat && <div className="login-error" style={{ marginBottom: 12 }}>{galat}</div>}
      {info && <div className="kartu" style={{ marginBottom: 12, padding: '10px 16px', background: 'color-mix(in srgb, var(--accent) 28%, var(--bg-card))' }}>{info}</div>}
      {!d ? (!galat && <div className="kartu" style={{ padding: 24, color: 'var(--text-muted)' }}>Memuat…</div>) : (
        <>
          <div className="ff-top">
            <div><small className="arti" style={{ margin: 0 }}>Kas + Ekuitas terverifikasi ({d.studio})</small><b className="besar">{formatRp(d.kas.total)}</b></div>
            <span className="chip">Kas: {formatRp(d.kas.kas)}</span><span className="chip">Ekuitas: {formatRp(d.kas.ekuitas)}</span><span className="chip">{d.kas.validPersen}% valid</span>
            {onNavigate && <button type="button" className="tombol ml" onClick={() => onNavigate('DetailKas')}>Kelola Kas &amp; Bukti SS →</button>}
          </div>

          {d.kategori.length === 0 ? (
            <div className="kat" style={{ padding: 22 }}>
              <h2 style={{ margin: '0 0 6px', fontSize: 18 }}>Belum ada estimasi untuk {label}</h2>
              <p style={{ margin: '0 0 14px', color: 'var(--text-secondary)', fontSize: 14.5 }}>Mulai dari contoh (kategori tim diambil dari HR, kategori lain berisi pos umum yang bisa diubah), atau salin semua pos dari bulan lalu.</p>
              <div className="baris">
                <button type="button" className="tombol p" onClick={() => aksi(() => api.post('/api/ff/mulai', { studioId, ...periode, dari: 'templat' }))}>Mulai dari contoh</button>
                {d.adaSebelum && <button type="button" className="tombol" onClick={() => aksi(() => api.post('/api/ff/mulai', { studioId, ...periode, dari: 'salin' }), true)}>⟳ Salin dari {BULAN[(periode.bulan + 10) % 12]}</button>}
              </div>
            </div>
          ) : (
            <>
              <div className="kat">
                <div className="kat-h" style={{ borderBottom: formKat ? undefined : 0 }}>
                  <h2>Estimasi Pengeluaran Bulanan <small className="arti">{semua.length} pos · klik nama orang untuk membuka rinciannya · klik "Belum" kalau sudah dibayar</small></h2>
                  <span className="chip" style={{ background: 'var(--accent)', color: '#111' }}>Lunas: {formatRp(lunas)}</span>
                  <span className="chip" style={{ background: 'var(--pink-candy)', color: '#111' }}>Belum: {formatRp(total - lunas)}</span>
                  <button type="button" className="kecil" onClick={() => setFormKat(true)}>+ Kategori</button>
                  <button type="button" className="kecil" onClick={() => { const buka = Object.values(tutup).some(Boolean); setTutup(Object.fromEntries(d.kategori.map(k => [k.id, !buka]))) }}>{Object.values(tutup).some(Boolean) ? 'Buka semua' : 'Lipat semua'}</button>
                </div>
                {formKat && (
                  <form style={{ display: 'flex', gap: 8, padding: '12px 18px' }} onSubmit={e => { e.preventDefault(); const nama = new FormData(e.target).get('nama'); aksi(() => api.post('/api/ff/kategori', { studioId, ...periode, nama })).then(() => setFormKat(false)) }}>
                    <input name="nama" className="kat-baru" required maxLength={80} placeholder="Nama kategori baru (mis. Marketing & Iklan)" autoFocus />
                    <button className="kecil p">Simpan</button><button type="button" className="kecil" onClick={() => setFormKat(false)}>Batal</button>
                  </form>
                )}
              </div>

              {d.kategori.map((k, ki) => {
                const kelompok = k.jenis === 'TIM'
                  ? [...k.item.reduce((m, i) => { const key = i.userId ?? ''; (m.get(key) ?? m.set(key, []).get(key)).push(i); return m }, new Map())].map(([uid, item]) => ({ uid, nama: uid ? item[0].namaOrang : '', item }))
                  : [{ uid: '', nama: '', item: k.item }]
                return (
                  <section key={k.id} className="kat">
                    <div className="kat-h">
                      <button type="button" className="ikon-b" onClick={() => setTutup({ ...tutup, [k.id]: !tutup[k.id] })} aria-label={tutup[k.id] ? 'Buka' : 'Lipat'}>{tutup[k.id] ? '▸' : '▾'}</button>
                      <h2 style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}><span>{ki + 1}.</span>
                        <span style={{ flex: 1, minWidth: 140 }}><input className="ff-nama-kat" defaultValue={k.nama} aria-label="Nama kategori" onBlur={e => e.target.value.trim() && e.target.value !== k.nama && aksi(() => api.put(`/api/ff/kategori/${k.id}`, { nama: e.target.value }))} />
                          <small className="arti">{k.item.length} pos · {k.item.filter(i => i.lunas).length}/{k.item.length} lunas</small></span></h2>
                      <b>{formatRp(jumlah(k.item))}</b>
                      {k.jenis === 'TIM' && <button type="button" className="kecil" title="Orang baru di HR & Database otomatis ditambahkan dengan pos Gaji, Komisi, Bonus, dll." onClick={() => aksi(() => api.post(`/api/ff/kategori/${k.id}/sync-hr`), true)}>⟳ Sync dari HR</button>}
                      <button type="button" className="kecil" onClick={() => aksi(() => api.post('/api/ff/item', { kategoriId: k.id }))}>+ Pos</button>
                      <span className="urut">
                        <button type="button" disabled={ki === 0} aria-label="Kategori ke atas" onClick={() => aksi(() => api.post(`/api/ff/kategori/${k.id}/geser`, { arah: -1 }))}>↑</button>
                        <button type="button" disabled={ki === d.kategori.length - 1} aria-label="Kategori ke bawah" onClick={() => aksi(() => api.post(`/api/ff/kategori/${k.id}/geser`, { arah: 1 }))}>↓</button>
                      </span>
                      <button type="button" className="ikon-b" aria-label="Hapus kategori" onClick={() => window.confirm(`Hapus kategori ${k.nama} beserta semua posnya?`) && aksi(() => api.delete(`/api/ff/kategori/${k.id}`))}>×</button>
                    </div>
                    {!tutup[k.id] && kelompok.map(g => {
                      const kunci = `${k.id}:${g.uid}`, buka = !g.uid || subBuka[kunci]
                      return (
                        <div key={kunci}>
                          {g.uid && (
                            <button type="button" className="sub-h" onClick={() => setSubBuka({ ...subBuka, [kunci]: !subBuka[kunci] })}>
                              <span style={{ flex: 1, textAlign: 'left' }}>{buka ? '▾' : '▸'} {g.nama} <small className="arti" style={{ display: 'inline' }}>{g.item.length} pos</small></span>
                              <span>Subtotal {formatRp(jumlah(g.item))}</span>
                            </button>
                          )}
                          {buka && <>
                            {g.item.map((i, n) => <Pos key={i.id} i={i} n={n} total={g.item.length} simpan={simpanItem} aksi={aksi} />)}
                            {g.uid && <div style={{ padding: '8px 18px' }}><button type="button" className="kecil" onClick={() => aksi(() => api.post('/api/ff/item', { kategoriId: k.id, userId: g.uid }))}>+ Pos untuk {g.nama}</button></div>}
                          </>}
                        </div>
                      )
                    })}
                  </section>
                )
              })}
            </>
          )}

          <div className="kartu" style={{ marginTop: 2 }}>
            <div className="judul-tabel"><div><h2>Progres Omset &amp; Estimasi Pendapatan ({d.omset.length} akun)</h2><p>Terisi otomatis dari Daily Sheet · uang masuk W1–W4 bulan ini (W1 = tanggal 1–7)</p></div>
              <a className="tombol ml" href={WEB_KERJA} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>Buka Daily Sheet ↗</a></div>
            <div className="scroll"><table className="hp">
              <thead><tr><th>Akun</th><th>Platform</th><th className="r">W1–W4</th><th className="r">Total (USD)</th><th className="r">Nominal (Rp)</th></tr></thead>
              <tbody>
                {d.omset.length === 0 ? <tr><td colSpan={5} className="kosong" style={{ textAlign: 'center', padding: 22 }}>Studio ini belum punya akun jualan. Isi dulu di web kerja harian › Akun jualan.</td></tr>
                  : d.omset.map(a => <tr key={a.akunId}><td data-label="Akun"><b>{a.nama}</b></td><td data-label="Platform">{a.platform}</td><td className="r" data-label="W1–W4">{a.minggu.map(w => formatUSD(w)).join(' / ')}</td><td className="r num" data-label="Total (USD)">{formatUSD(a.totalUsd)}</td><td className="r num" data-label="Nominal (Rp)">{formatRp(a.totalUsd * d.kurs)}</td></tr>)}
              </tbody>
            </table></div>
          </div>

          <div className="kaki">
            <span><small>Total ekuitas</small><b>{formatRp(d.kas.total)}</b></span>
            <span><small>Omset bulanan</small><b>{formatUSD(omsetUsd)} ({formatRp(omsetRp)})</b></span>
            <span><small>Pengeluaran</small><b>{formatRp(total)}</b></span>
            <span><small>Sisa bersih</small><b className={sisa < 0 ? 'minus' : 'plus'}>{formatRp(sisa)}</b></span>
            <span><small>Runway</small><b>{runway == null ? '—' : `${(Math.round(runway * 10) / 10).toLocaleString('id-ID')} bln`}</b></span>
            <button type="button" className="tombol p" style={{ marginLeft: 'auto' }} title="Perubahan sudah tersimpan otomatis. Tombol ini memuat ulang angka CPM & Runway." onClick={() => aksi(async () => null)}>Simpan &amp; perbarui</button>
          </div>
        </>
      )}
    </div>
  )
}
