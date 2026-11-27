import { useCallback, useEffect, useMemo, useState } from 'react'
import api from '../../services/api'
import { formatRp, formatUSD } from '../../utils/format'

// FINANCIAL FORECASTING baru (Karsa, 27 Nov 2026): estimasi pengeluaran bulanan studio per kategori → pos.
// Total = CPM di Overview & Runway. Setiap perubahan langsung tersimpan (penanda "Tersimpan · jam").
const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
const pesan = (e) => e?.response?.data?.message ?? 'Terjadi kesalahan, coba lagi'
const arti = { fontSize: 12, color: 'var(--text-muted)', fontWeight: 400, lineHeight: 1.5 }
const jumlah = (arr) => arr.reduce((s, i) => s + (i.rupiah || 0), 0)
const jamWib = () => new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' }).replace('.', ':')
const tombolKecil = { padding: '4px 10px', fontSize: 12 }
const panah = { width: 26, height: 26, padding: 0, borderRadius: 8, border: '1px solid var(--border-hover)', background: 'var(--bg-card)', color: 'var(--text)', cursor: 'pointer', fontSize: 12 }

function Pos({ i, n, total, simpan, aksi }) {
  return (
    <div className="ff-item">
      <span style={{ ...arti, width: 28 }}>#{n + 1}</span>
      <input className="form-input" style={{ paddingLeft: 10, minWidth: 0 }} defaultValue={i.nama} aria-label="Nama pos" onBlur={e => e.target.value.trim() && e.target.value !== i.nama && simpan(i, { nama: e.target.value })} />
      <input className="form-input" style={{ paddingLeft: 10, textAlign: 'right' }} type="number" min="0" step="1000" defaultValue={i.rupiah || ''} placeholder="0" aria-label="Nominal Rupiah" onBlur={e => Number(e.target.value || 0) !== i.rupiah && simpan(i, { rupiah: Number(e.target.value || 0) })} />
      <button type="button" onClick={() => simpan(i, { lunas: !i.lunas })} title="Klik untuk mengubah status bayar"
        style={{ ...tombolKecil, borderRadius: 'var(--pill)', border: '1.5px solid var(--line)', fontWeight: 700, cursor: 'pointer', background: i.lunas ? 'var(--accent)' : 'var(--pink-candy)', color: i.lunas ? 'var(--on-accent)' : 'var(--on-pink)', whiteSpace: 'nowrap', minWidth: 74 }}>{i.lunas ? 'Lunas ✓' : 'Belum'}</button>
      <span style={{ display: 'inline-flex', gap: 4 }}>
        <button type="button" style={panah} disabled={n === 0} aria-label="Pindah ke atas" onClick={() => aksi(() => api.post(`/api/ff/item/${i.id}/geser`, { arah: -1 }))}>↑</button>
        <button type="button" style={panah} disabled={n === total - 1} aria-label="Pindah ke bawah" onClick={() => aksi(() => api.post(`/api/ff/item/${i.id}/geser`, { arah: 1 }))}>↓</button>
        <button type="button" style={panah} aria-label="Hapus pos" onClick={() => window.confirm(`Hapus pos ${i.nama}?`) && aksi(() => api.delete(`/api/ff/item/${i.id}`))}>×</button>
      </span>
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

  return (
    <>
      <div className="page-header" style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1>Financial Forecasting</h1>
            <p>Perkiraan biaya bulanan studio (CPM) dibanding perkiraan omset. Totalnya otomatis jadi angka CPM dan Runway di Overview.</p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ ...arti, display: 'inline-flex', alignItems: 'center', gap: 6 }} title="Perubahan tersimpan otomatis"><i style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--green)', display: 'inline-block' }} />{jamSimpan ? `Tersimpan · ${jamSimpan} WIB` : 'Tersimpan otomatis'}</span>
            <select className="form-input" style={{ width: 170, paddingLeft: 10 }} value={studioId ?? ''} onChange={e => setStudioId(e.target.value)} aria-label="Studio">
              {daftarStudio.map(s => <option key={s.studioId} value={s.studioId}>{s.nama}</option>)}
            </select>
            <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
              <button type="button" style={panah} onClick={() => geserBulan(-1)} aria-label="Bulan sebelumnya">‹</button>
              <b style={{ fontSize: 13, minWidth: 110, textAlign: 'center' }}>{label}</b>
              <button type="button" style={panah} onClick={() => geserBulan(1)} aria-label="Bulan berikutnya">›</button>
            </span>
          </div>
        </div>
      </div>
      {galat && <div className="login-error" style={{ marginBottom: 12 }}>{galat}</div>}
      {info && <div style={{ marginBottom: 12, padding: '8px 12px', borderRadius: 8, background: 'var(--green-subtle)', color: 'var(--green)', fontSize: 13 }}>{info}</div>}
      {!d ? (!galat && <div className="card" style={{ padding: 24, color: 'var(--text-muted)' }}>Memuat…</div>) : (
        <>
          <div className="card" style={{ marginBottom: 16, display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
            <div><div style={arti}>Kas + Ekuitas ({d.studio})</div><div style={{ fontFamily: 'var(--font-judul)', fontSize: 22, fontWeight: 600 }}>{formatRp(d.kas.total)}</div></div>
            <span className="ff-chip">Kas: {formatRp(d.kas.kas)}</span><span className="ff-chip">Ekuitas: {formatRp(d.kas.ekuitas)}</span><span className="ff-chip">{d.kas.validPersen}% valid</span>
            {onNavigate && <button type="button" className="btn btn-secondary btn-sm" style={{ marginLeft: 'auto' }} onClick={() => onNavigate('DetailKas')}>Kelola Kas & Bukti SS →</button>}
          </div>

          {d.kategori.length === 0 ? (
            <div className="card" style={{ marginBottom: 16, padding: 24 }}>
              <h3 style={{ margin: '0 0 6px' }}>Belum ada estimasi untuk {label}</h3>
              <p style={{ ...arti, fontSize: 13, margin: '0 0 14px' }}>Mulai dari contoh (kategori tim diambil dari HR, kategori lain berisi pos umum yang bisa diubah), atau salin semua pos dari bulan lalu.</p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button type="button" className="btn btn-primary" onClick={() => aksi(() => api.post('/api/ff/mulai', { studioId, ...periode, dari: 'templat' }))}>Mulai dari contoh</button>
                {d.adaSebelum && <button type="button" className="btn btn-secondary" onClick={() => aksi(() => api.post('/api/ff/mulai', { studioId, ...periode, dari: 'salin' }), true)}>⟳ Salin dari bulan lalu</button>}
              </div>
            </div>
          ) : (
            <>
              <div className="card" style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                  <div style={{ marginRight: 'auto' }}><div style={{ fontFamily: 'var(--font-judul)', fontWeight: 600, fontSize: 16 }}>Estimasi Pengeluaran Bulanan</div><div style={arti}>{semua.length} pos · klik nama orang untuk membuka rinciannya · klik "Belum" kalau sudah dibayar</div></div>
                  <span className="ff-chip" style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}>Lunas: {formatRp(lunas)}</span>
                  <span className="ff-chip" style={{ background: 'var(--pink-candy)', color: 'var(--on-pink)' }}>Belum: {formatRp(total - lunas)}</span>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setFormKat(true)}>+ Kategori</button>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => { const buka = Object.values(tutup).some(Boolean); setTutup(Object.fromEntries(d.kategori.map(k => [k.id, !buka]))) }}>{Object.values(tutup).some(Boolean) ? 'Buka semua' : 'Lipat semua'}</button>
                </div>
                {formKat && (
                  <form style={{ display: 'flex', gap: 8, marginTop: 12 }} onSubmit={e => { e.preventDefault(); const nama = new FormData(e.target).get('nama'); aksi(() => api.post('/api/ff/kategori', { studioId, ...periode, nama })).then(() => setFormKat(false)) }}>
                    <input name="nama" className="form-input" style={{ flex: 1, paddingLeft: 10 }} required maxLength={80} placeholder="Nama kategori baru (mis. Marketing & Iklan)" autoFocus />
                    <button className="btn btn-primary btn-sm">Simpan</button><button type="button" className="btn btn-secondary btn-sm" onClick={() => setFormKat(false)}>Batal</button>
                  </form>
                )}
              </div>

              {d.kategori.map((k, ki) => {
                const kelompok = k.jenis === 'TIM'
                  ? [...k.item.reduce((m, i) => { const key = i.userId ?? ''; (m.get(key) ?? m.set(key, []).get(key)).push(i); return m }, new Map())].map(([uid, item]) => ({ uid, nama: uid ? item[0].namaOrang : '', item }))
                  : [{ uid: '', nama: '', item: k.item }]
                return (
                  <section key={k.id} className="card" style={{ marginBottom: 12, padding: 0, overflow: 'hidden' }}>
                    <div className="ff-kat-h">
                      <button type="button" style={panah} onClick={() => setTutup({ ...tutup, [k.id]: !tutup[k.id] })} aria-label={tutup[k.id] ? 'Buka' : 'Lipat'}>{tutup[k.id] ? '▸' : '▾'}</button>
                      <div style={{ flex: 1, minWidth: 160 }}>
                        <input className="ff-nama-kat" defaultValue={k.nama} aria-label="Nama kategori" onBlur={e => e.target.value.trim() && e.target.value !== k.nama && aksi(() => api.put(`/api/ff/kategori/${k.id}`, { nama: e.target.value }))} />
                        <div style={arti}>{k.item.length} pos · {k.item.filter(i => i.lunas).length}/{k.item.length} lunas</div>
                      </div>
                      <b style={{ whiteSpace: 'nowrap' }}>{formatRp(jumlah(k.item))}</b>
                      {k.jenis === 'TIM' && <button type="button" className="btn btn-secondary btn-sm" title="Orang baru di HR & Database otomatis ditambahkan dengan pos Gaji, Komisi, Bonus, dll." onClick={() => aksi(() => api.post(`/api/ff/kategori/${k.id}/sync-hr`), true)}>⟳ Sync dari HR</button>}
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => aksi(() => api.post('/api/ff/item', { kategoriId: k.id }))}>+ Pos</button>
                      <span style={{ display: 'inline-flex', gap: 4 }}>
                        <button type="button" style={panah} disabled={ki === 0} aria-label="Kategori ke atas" onClick={() => aksi(() => api.post(`/api/ff/kategori/${k.id}/geser`, { arah: -1 }))}>↑</button>
                        <button type="button" style={panah} disabled={ki === d.kategori.length - 1} aria-label="Kategori ke bawah" onClick={() => aksi(() => api.post(`/api/ff/kategori/${k.id}/geser`, { arah: 1 }))}>↓</button>
                        <button type="button" style={panah} aria-label="Hapus kategori" onClick={() => window.confirm(`Hapus kategori ${k.nama} beserta semua posnya?`) && aksi(() => api.delete(`/api/ff/kategori/${k.id}`))}>×</button>
                      </span>
                    </div>
                    {!tutup[k.id] && kelompok.map(g => {
                      const kunci = `${k.id}:${g.uid}`, buka = !g.uid || subBuka[kunci]
                      return (
                        <div key={kunci}>
                          {g.uid && (
                            <button type="button" className="ff-sub" onClick={() => setSubBuka({ ...subBuka, [kunci]: !subBuka[kunci] })}>
                              <span style={{ flex: 1, textAlign: 'left' }}>{buka ? '▾' : '▸'} <b>{g.nama}</b> <span style={arti}>{g.item.length} pos · {g.item.filter(i => i.lunas).length} lunas</span></span>
                              <span>Subtotal {formatRp(jumlah(g.item))}</span>
                            </button>
                          )}
                          {buka && <div style={{ padding: g.uid ? '4px 16px 10px 32px' : '6px 16px 12px' }}>
                            {g.item.map((i, n) => <Pos key={i.id} i={i} n={n} total={g.item.length} simpan={simpanItem} aksi={aksi} />)}
                            {g.uid && <button type="button" className="btn btn-secondary btn-sm" style={{ marginTop: 6 }} onClick={() => aksi(() => api.post('/api/ff/item', { kategoriId: k.id, userId: g.uid }))}>+ Pos untuk {g.nama}</button>}
                          </div>}
                        </div>
                      )
                    })}
                  </section>
                )
              })}
            </>
          )}

          <div className="card" style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
              <div><div style={{ fontFamily: 'var(--font-judul)', fontWeight: 600, fontSize: 16 }}>Progres Omset ({d.omset.length} akun)</div><div style={arti}>Terisi otomatis dari Daily Sheet · uang masuk W1–W4 bulan ini (W1 = tanggal 1–7)</div></div>
            </div>
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Akun</th><th>Platform</th><th style={{ textAlign: 'right' }}>W1 / W2 / W3 / W4</th><th style={{ textAlign: 'right' }}>Total (USD)</th><th style={{ textAlign: 'right' }}>Nominal (Rp)</th></tr></thead>
                <tbody>
                  {d.omset.length === 0 ? <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 20 }}>Studio ini belum punya akun jualan. Isi dulu di web kerja harian › Akun jualan.</td></tr>
                    : d.omset.map(a => <tr key={a.akunId}><td><b>{a.nama}</b></td><td>{a.platform}</td><td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>{a.minggu.map(w => formatUSD(w)).join(' / ')}</td><td style={{ textAlign: 'right' }}>{formatUSD(a.totalUsd)}</td><td style={{ textAlign: 'right' }}>{formatRp(a.totalUsd * d.kurs)}</td></tr>)}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card ff-kaki">
            <div><span style={arti}>Kas + Ekuitas</span><b>{formatRp(d.kas.total)}</b></div>
            <div><span style={arti}>Omset bulan ini</span><b>{formatUSD(omsetUsd)}</b><span style={arti}>{formatRp(omsetRp)}</span></div>
            <div><span style={arti}>Pengeluaran (CPM)</span><b>{formatRp(total)}</b></div>
            <div><span style={arti}>Sisa bersih</span><b style={{ color: sisa < 0 ? 'var(--red)' : 'var(--green)' }}>{formatRp(sisa)}</b></div>
            <div><span style={arti}>Runway</span><b>{runway == null ? '—' : `${(Math.round(runway * 10) / 10).toLocaleString('id-ID')} bln`}</b><span style={arti}>kas cukup untuk berapa bulan</span></div>
          </div>
        </>
      )}
    </>
  )
}
