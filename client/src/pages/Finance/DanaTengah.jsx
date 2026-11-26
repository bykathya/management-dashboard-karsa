import { useState, useEffect, useCallback } from 'react'
import api from '../../services/api'
import { formatRp } from '../../utils/format'

// ── Tab Dana Tengah (hub Keuangan, Karsa Circle 26 Nov 2026) ───────────
// Setiap studio menyetor jumlah tetap ke circle tiap bulan. Kepala Circle cukup mencentang studio yang sudah setor.
// Koordinator melihat status studionya sendiri (tanpa bisa mencentang). API: GET/PUT /api/dana-tengah.
// Tahap 7: saldo rekening Dana Tengah (riwayat) + catatan pemakaian — Kepala Circle & Koordinator boleh mencatat (/api/dana-tengah/kas).

const MONTHS = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember']
const pad = n => String(n).padStart(2, '0')

export default function DanaTengah() {
  const kini = new Date()
  const [bulan, setBulan] = useState(kini.getMonth() + 1)
  const [tahun, setTahun] = useState(kini.getFullYear())
  const [data, setData] = useState(null)
  const [galat, setGalat] = useState('')
  const [sibuk, setSibuk] = useState(null)
  const kunci = `${tahun}-${pad(bulan)}`

  const muat = useCallback(() => {
    setGalat('')
    api.get('/api/dana-tengah', { params: { bulan: kunci } })
      .then(r => setData(r.data.data))
      .catch(e => setGalat(e.response?.data?.message || 'Gagal memuat Dana Tengah'))
  }, [kunci])
  useEffect(() => { muat() }, [muat])

  const geser = (n) => {
    const t = tahun * 12 + (bulan - 1) + n
    setBulan((t % 12) + 1); setTahun(Math.floor(t / 12))
  }
  const centang = async (b) => {
    setSibuk(b.studioId); setGalat('')
    try { await api.put('/api/dana-tengah', { studioId: b.studioId, bulan: kunci, sudah: !b.sudah }); muat() }
    catch (e) { setGalat(e.response?.data?.message || 'Gagal menyimpan') }
    finally { setSibuk(null) }
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <button type="button" className="btn btn-ghost" onClick={() => geser(-1)} aria-label="Bulan sebelumnya">‹</button>
        <b style={{ minWidth: 140, textAlign: 'center' }}>{MONTHS[bulan - 1]} {tahun}</b>
        <button type="button" className="btn btn-ghost" onClick={() => geser(1)} aria-label="Bulan berikutnya">›</button>
      </div>

      {galat && <div className="card" style={{ color: 'var(--red)', marginBottom: 16 }}>{galat}</div>}
      {!data ? <div style={{ color: 'var(--text-muted)' }}>Memuat…</div> : (
        <>
          <div className="stat-grid" style={{ marginBottom: 16 }}>
            <div className="stat-card purple">
              <div className="stat-label">Terkumpul {MONTHS[bulan - 1]}</div>
              <div className="stat-value">{formatRp(data.ringkasan.terkumpul)}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>dari {formatRp(data.ringkasan.target)} · {formatRp(data.nominal)} per studio</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Sudah setor</div>
              <div className="stat-value">{data.ringkasan.sudah} / {data.ringkasan.studio}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{data.ringkasan.belum ? `${data.ringkasan.belum} studio belum` : 'Semua studio sudah setor'}</div>
            </div>
          </div>

          {data.baris.length === 0 ? <div className="card" style={{ color: 'var(--text-muted)' }}>Belum ada studio di wilayahmu.</div> : (
            <div className="card table-wrap" style={{ padding: 0 }}>
              <table>
                <thead><tr><th>Sudah setor</th><th>Studio</th><th>Circle</th><th>Dicentang oleh</th></tr></thead>
                <tbody>
                  {data.baris.map(b => (
                    <tr key={b.studioId}>
                      <td>
                        <input type="checkbox" checked={b.sudah} disabled={!b.bolehCentang || sibuk === b.studioId}
                          onChange={() => centang(b)} aria-label={`${b.nama} sudah setor ${MONTHS[bulan - 1]}`}
                          style={{ width: 18, height: 18, accentColor: 'var(--accent)' }} />
                      </td>
                      <td><b>{b.nama}</b></td>
                      <td>{b.circle ?? '—'}</td>
                      <td style={{ color: 'var(--text-muted)' }}>{b.sudah ? `${b.oleh ?? '—'} · ${new Date(b.pada).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
      <KasDanaTengah />
    </div>
  )
}

const hariIni = () => new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10)
const tgl = (t) => new Date(t + 'T00:00:00Z').toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
const angka = (v) => Number(String(v ?? '').replace(/\D/g, '')) || 0

function KasDanaTengah() {
  const [d, setD] = useState(null), [galat, setGalat] = useState('')
  const [fs, setFs] = useState(null), [fp, setFp] = useState(null), [riwayat, setRiwayat] = useState(false)
  const muat = useCallback(() => api.get('/api/dana-tengah/kas').then(r => { setD(r.data.data); setGalat('') }).catch(e => setGalat(e.response?.data?.message || 'Gagal memuat saldo')), [])
  useEffect(() => { muat() }, [muat])
  const kirim = async (fn) => { setGalat(''); try { await fn(); await muat() } catch (e) { setGalat(e.response?.data?.message || 'Gagal menyimpan') } }
  if (!d) return galat ? <div className="card" style={{ color: 'var(--red)', marginTop: 16 }}>{galat}</div> : null
  const s = d.saldoTerakhir
  return (
    <div style={{ marginTop: 24, display: 'grid', gap: 16 }}>
      {galat && <div className="card" style={{ color: 'var(--red)' }}>{galat}</div>}
      <div className="card" style={{ background: 'var(--accent)', color: '#111' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>Saldo Dana Tengah di bank</div>
            <div style={{ fontSize: 28, fontWeight: 700, fontFamily: 'var(--font-judul)' }}>{s ? formatRp(s.jumlah) : '—'}</div>
            <div style={{ fontSize: 12 }}>{s ? `per ${tgl(s.tanggal)} · dicatat ${s.oleh ?? '—'}` : 'Belum pernah dicatat'}</div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="btn btn-ghost" style={{ background: 'var(--bg-card)' }} onClick={() => setFs({ tanggal: hariIni(), jumlah: '', catatan: '' })}>Perbarui saldo</button>
            {d.riwayatSaldo.length > 1 && <button type="button" className="btn btn-ghost" style={{ background: 'var(--bg-card)' }} onClick={() => setRiwayat(!riwayat)}>{riwayat ? 'Tutup riwayat' : 'Riwayat'}</button>}
          </div>
        </div>
        {fs && (
          <form style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12, alignItems: 'end' }} onSubmit={e => { e.preventDefault(); kirim(async () => { await api.post('/api/dana-tengah/saldo', { tanggal: fs.tanggal, jumlah: angka(fs.jumlah), catatan: fs.catatan }); setFs(null) }) }}>
            <label style={{ display: 'grid', fontSize: 12 }}>Tanggal<input className="form-input" type="date" value={fs.tanggal} onChange={e => setFs({ ...fs, tanggal: e.target.value })} required /></label>
            <label style={{ display: 'grid', fontSize: 12 }}>Saldo sekarang (Rp)<input className="form-input" inputMode="numeric" value={fs.jumlah} onChange={e => setFs({ ...fs, jumlah: e.target.value })} required placeholder="mis. 12750000" /></label>
            <label style={{ display: 'grid', fontSize: 12, flex: 1, minWidth: 160 }}>Catatan (opsional)<input className="form-input" value={fs.catatan} onChange={e => setFs({ ...fs, catatan: e.target.value })} maxLength={200} /></label>
            <button className="btn btn-primary">Simpan</button><button type="button" className="btn btn-ghost" onClick={() => setFs(null)}>Batal</button>
          </form>
        )}
        {riwayat && <div style={{ marginTop: 12, fontSize: 13 }}>{d.riwayatSaldo.map(r => <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(0,0,0,.15)', padding: '6px 0' }}><span>{tgl(r.tanggal)} · {r.oleh ?? '—'}{r.catatan ? ` · ${r.catatan}` : ''}</span><b>{formatRp(r.jumlah)}</b></div>)}</div>}
      </div>

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
          <h3 style={{ margin: 0 }}>Pemakaian Dana Tengah</h3>
          {!fp && <button type="button" className="btn btn-primary" onClick={() => setFp({ tanggal: hariIni(), keperluan: '', jumlah: '' })}>+ Catat pemakaian</button>}
        </div>
        {fp && (
          <form style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12, alignItems: 'end' }} onSubmit={e => { e.preventDefault(); kirim(async () => { await api.post('/api/dana-tengah/pakai', { tanggal: fp.tanggal, keperluan: fp.keperluan, jumlah: angka(fp.jumlah) }); setFp(null) }) }}>
            <label style={{ display: 'grid', fontSize: 12 }}>Tanggal<input className="form-input" type="date" value={fp.tanggal} onChange={e => setFp({ ...fp, tanggal: e.target.value })} required /></label>
            <label style={{ display: 'grid', fontSize: 12, flex: 1, minWidth: 180 }}>Dipakai untuk<input className="form-input" value={fp.keperluan} onChange={e => setFp({ ...fp, keperluan: e.target.value })} required maxLength={200} placeholder="mis. sewa booth event" /></label>
            <label style={{ display: 'grid', fontSize: 12 }}>Jumlah (Rp)<input className="form-input" inputMode="numeric" value={fp.jumlah} onChange={e => setFp({ ...fp, jumlah: e.target.value })} required /></label>
            <button className="btn btn-primary">Simpan</button><button type="button" className="btn btn-ghost" onClick={() => setFp(null)}>Batal</button>
          </form>
        )}
        {d.pakai.length === 0 ? <div style={{ color: 'var(--text-muted)' }}>Belum ada pemakaian yang dicatat.</div> : (
          <div className="table-wrap"><table>
            <thead><tr><th>Tanggal</th><th>Dipakai untuk</th><th style={{ textAlign: 'right' }}>Jumlah</th><th>Dicatat oleh</th><th /></tr></thead>
            <tbody>{d.pakai.map(p => <tr key={p.id}><td>{tgl(p.tanggal)}</td><td>{p.keperluan}</td><td style={{ textAlign: 'right' }}>{formatRp(p.jumlah)}</td><td style={{ color: 'var(--text-muted)' }}>{p.oleh ?? '—'}</td>
              <td style={{ textAlign: 'right' }}>{p.bisaHapus && <button type="button" className="btn btn-ghost" onClick={() => window.confirm(`Hapus catatan "${p.keperluan}"?`) && kirim(() => api.delete(`/api/dana-tengah/pakai/${p.id}`))}>Hapus</button>}</td></tr>)}</tbody>
          </table></div>
        )}
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>Kepala Circle dan Koordinator boleh mencatat. Nama pencatat tersimpan otomatis.</p>
      </div>
    </div>
  )
}
