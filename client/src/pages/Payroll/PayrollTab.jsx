import { useState } from 'react'
import { useApi } from '../../hooks/useApi'
import { formatRp, formatTanggalPendek } from '../../utils/format'
import SlipModal from './SlipModal'

const MONTHS = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des']
const STATUS_CONFIG = {
  DRAFT:   { label: 'Draft',   color: 'var(--text-muted)' },
  FINAL:   { label: 'Final',   color: 'var(--amber)' },
  DIBAYAR: { label: 'Dibayar', color: 'var(--green)' },
}

const totalTunjangan = (p) => (p.tunjangan ?? []).reduce((s, t) => s + t.jumlah, 0)

// PEMANTAUAN PENGGAJIAN (18 Nov 2026, keputusan user): slip disiapkan, difinalkan, dan dibayar koordinator di web circle › Penggajian.
// Halaman ini hanya membaca tabel Penggajian yang sama — tanpa Generate/ubah/Final/Tandai dibayar (server menolak jalur tulis).
export default function PayrollTab({ studioId, currentUserId }) {
  const now = new Date()
  const [bulan, setBulan] = useState(now.getMonth() + 1)
  const [tahun, setTahun] = useState(now.getFullYear())
  const [slipId, setSlipId] = useState(null)

  const { data: rows, loading, error } = useApi(
    studioId ? `/api/payroll?studioId=${studioId}&bulan=${bulan}&tahun=${tahun}` : null, [studioId, bulan, tahun]
  )

  if (!studioId) {
    return <div className="card" style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>Pilih unit dulu di atas</div>
  }

  const daftar = rows ?? []
  const jumlah = (s) => daftar.filter(r => r.status === s).length
  const totalThp = daftar.reduce((s, r) => s + r.thp, 0)
  const sudahDibayar = daftar.filter(r => r.status === 'DIBAYAR').reduce((s, r) => s + r.thp, 0)

  return (
    <>
      <div className="page-header-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select className="form-input" style={{ padding: '6px 10px', width: 100, fontSize: 13 }}
            value={bulan} onChange={e => setBulan(Number(e.target.value))} aria-label="Bulan">
            {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
          <input type="number" className="form-input" style={{ padding: '6px 10px', width: 90, fontSize: 13 }}
            value={tahun} onChange={e => setTahun(Number(e.target.value))} aria-label="Tahun" />
        </div>
      </div>

      {error && <div className="login-error" style={{ marginBottom: 16 }}>{error}</div>}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)' }}>
          <div className="spinner" style={{ width: 24, height: 24, margin: '0 auto' }} />
        </div>
      ) : daftar.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '64px 0', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>💰</div>
          <div style={{ fontSize: 15, fontWeight: 600 }}>Belum ada slip gaji periode ini</div>
          <div style={{ fontSize: 12, marginTop: 4 }}>Slip disiapkan Koordinator unit di web circle › Penggajian.</div>
        </div>
      ) : (
        <>
          <div className="stat-grid" style={{ marginBottom: 16 }}>
            <div className="stat-card green">
              <div className="stat-label">Total THP {MONTHS[bulan - 1]} {tahun}</div>
              <div className="stat-value">{formatRp(totalThp)}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{daftar.length} slip</div>
            </div>
            <div className="stat-card purple">
              <div className="stat-label">Sudah dibayar</div>
              <div className="stat-value">{formatRp(sudahDibayar)}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{jumlah('DIBAYAR')} dibayar · {jumlah('FINAL')} final · {jumlah('DRAFT')} draft</div>
            </div>
          </div>
          <div className="card">
            <div className="table-wrap responsive-table" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
              <table>
                <thead style={{ position: 'sticky', top: 0, zIndex: 2 }}>
                  <tr style={{ background: 'var(--bg-card)' }}>
                    <th>Nama</th>
                    <th style={{ textAlign: 'right' }}>Gaji Pokok</th>
                    <th style={{ textAlign: 'right' }}>Bonus</th>
                    <th style={{ textAlign: 'right' }}>Komisi</th>
                    <th style={{ textAlign: 'right' }}>Lembur</th>
                    <th style={{ textAlign: 'right' }}>SHU</th>
                    <th style={{ textAlign: 'right' }}>Tunjangan</th>
                    <th style={{ textAlign: 'right' }}>Potongan</th>
                    <th style={{ textAlign: 'right' }}>THP</th>
                    <th style={{ textAlign: 'center' }}>Status</th>
                    <th style={{ textAlign: 'center' }}>Slip</th>
                  </tr>
                </thead>
                <tbody>
                  {daftar.map(row => (
                    <tr key={row.id}>
                      <td style={{ fontWeight: 600 }}>{row.user?.nama}{row.userId === currentUserId && <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}> (saya)</span>}</td>
                      <td style={{ textAlign: 'right', fontSize: 13 }}>{formatRp(row.gajiPokok)}</td>
                      <td style={{ textAlign: 'right', fontSize: 13 }}>{formatRp(row.bonus)}</td>
                      <td style={{ textAlign: 'right', fontSize: 13 }}>{formatRp(row.komisi)}</td>
                      <td style={{ textAlign: 'right', fontSize: 13 }}>{formatRp(row.lembur)}</td>
                      <td style={{ textAlign: 'right', fontSize: 13 }}>{formatRp(row.shu)}</td>
                      <td style={{ textAlign: 'right', fontSize: 13 }}>{formatRp(totalTunjangan(row))}</td>
                      <td style={{ textAlign: 'right', fontSize: 13, color: 'var(--red)' }}>{formatRp(row.potongan)}</td>
                      <td style={{ textAlign: 'right', fontSize: 13, fontWeight: 700, color: 'var(--green)' }}>{formatRp(row.thp)}</td>
                      <td style={{ textAlign: 'center' }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: STATUS_CONFIG[row.status]?.color }}>{STATUS_CONFIG[row.status]?.label ?? row.status}</span>
                        {row.tanggalBayar && (
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }} title={row.status === 'DIBAYAR' ? 'Tanggal dibayar' : 'Rencana tanggal gajian'}>
                            {row.status === 'DIBAYAR' ? 'dibayar ' : 'gajian '}{formatTanggalPendek(row.tanggalBayar)}
                          </div>
                        )}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button className="btn btn-ghost" style={{ fontSize: 11, padding: '4px 8px' }} onClick={() => setSlipId(row.id)}>Lihat</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {slipId && <SlipModal penggajianId={slipId} onClose={() => setSlipId(null)} />}
    </>
  )
}
