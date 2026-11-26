import { useState, useEffect, useCallback } from 'react'
import api from '../../services/api'
import { formatRp } from '../../utils/format'

// ── Tab Dana Tengah (hub Keuangan, Karsa Circle 26 Nov 2026) ───────────
// Setiap studio menyetor jumlah tetap ke circle tiap bulan. Kepala Circle cukup mencentang studio yang sudah setor.
// Koordinator melihat status studionya sendiri (tanpa bisa mencentang). API: GET/PUT /api/dana-tengah.

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
    </div>
  )
}
