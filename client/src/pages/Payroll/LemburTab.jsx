import { useState } from 'react'
import { useApi } from '../../hooks/useApi'
import { formatRp, formatTanggalPendek } from '../../utils/format'

const MONTHS = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des']

// Lembur dari PRESENSI web circle (menit setelah jam kerja). 21 Okt 2026: dihitung dengan ATURAN LEMBUR UNIT yang diatur koordinator di web circle
// (Kehadiran › Jam kerja & lembur). Hanya lembur DISETUJUI milik unit ini yang masuk slip, saat koordinator menyiapkan slip di web circle › Penggajian.
const LABEL_MODE = { PER_JAM: 'per jam', BERTINGKAT: 'bertingkat', PER_HARI: 'per hari lembur', TIDAK_DIBAYAR: 'tidak dibayar' }
function LemburPresensi({ studioId, bulan, tahun }) {
  const { data, loading } = useApi(`/api/payroll/lembur-presensi?studioId=${studioId}&bulan=${bulan}&tahun=${tahun}`, [studioId, bulan, tahun])
  const jam = (x) => `${x.jam} jam · ${x.hari} hari`
  return (
    <div className="card" style={{ marginBottom: 20 }}>
      <div className="card-header"><span className="card-title">Lembur dari presensi web circle</span></div>
      <div style={{ padding: '0 16px 16px' }}>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>
          Menit kerja setelah jam resmi yang tercatat di presensi (otomatis dari jam pulang, atau dicatat manual). Yang belum masuk slip akan ditambahkan saat Koordinator menyiapkan slip di web circle › Penggajian.
        </div>
        <div style={{ fontSize: 13, marginBottom: 12 }}>
          Aturan lembur unit: <b>{data?.mode ? LABEL_MODE[data.mode] ?? data.mode : 'belum diatur'}</b>{data?.mode === 'PER_JAM' && data?.tarifPerJam ? ` · Rp ${Number(data.tarifPerJam).toLocaleString('id-ID')}/jam` : ''}
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}> — diatur Koordinator unit di web circle (Kehadiran › Jam kerja & lembur), termasuk persetujuan lembur manual.</span>
        </div>
        {loading ? <div className="spinner" /> : !data?.orang?.length ? (
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Tidak ada lembur presensi pada periode ini.</div>
        ) : (
          <div className="table-wrap responsive-table">
            <table>
              <thead><tr><th>Nama</th><th>Total disetujui</th><th>Sudah masuk slip</th><th>Belum masuk slip</th><th>Menunggu persetujuan</th><th style={{ textAlign: 'right' }}>Estimasi belum masuk</th></tr></thead>
              <tbody>
                {data.orang.map(o => (
                  <tr key={o.userId}>
                    <td style={{ fontWeight: 600 }}>{o.nama}</td>
                    <td style={{ fontSize: 12 }}>{jam(o.total)}</td>
                    <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{o.sudahMasukSlip.menit ? jam(o.sudahMasukSlip) : '—'}</td>
                    <td style={{ fontSize: 12 }}>{o.belumMasukSlip.menit ? jam(o.belumMasukSlip) : '—'}</td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{o.menungguPersetujuan ? `${o.menungguPersetujuan} catatan` : '—'}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: data.otomatis ? 'var(--green)' : 'var(--text-muted)' }}>{data.otomatis ? formatRp(o.belumMasukSlip.uang) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data?.catatan && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>{data.catatan}</div>}
      </div>
    </div>
  )
}

// Tab Lembur (pemantauan, 18 Nov 2026): lembur presensi web circle + ARSIP catatan lembur lama (progres × rate card, modul Produksi Ekosistem
// yang sudah dihapus). Catatan lembur baru tidak bisa dibuat lagi; lembur sekarang dicatat & disetujui di web circle.
export default function LemburTab({ studioId }) {
  const now = new Date()
  const [bulan, setBulan] = useState(now.getMonth() + 1)
  const [tahun, setTahun] = useState(now.getFullYear())

  const { data: lemburList, loading, error } = useApi(
    studioId ? `/api/payroll/lembur?studioId=${studioId}&bulan=${bulan}&tahun=${tahun}` : null, [studioId, bulan, tahun]
  )

  if (!studioId) {
    return <div className="card" style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>Pilih unit dulu di atas</div>
  }

  return (
    <>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16 }}>
        <select className="form-input" style={{ padding: '6px 10px', width: 100, fontSize: 13 }}
          value={bulan} onChange={e => setBulan(Number(e.target.value))} aria-label="Bulan">
          {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
        </select>
        <input type="number" className="form-input" style={{ padding: '6px 10px', width: 90, fontSize: 13 }}
          value={tahun} onChange={e => setTahun(Number(e.target.value))} aria-label="Tahun" />
      </div>

      <LemburPresensi studioId={studioId} bulan={bulan} tahun={tahun} />

      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', margin: '4px 0 8px' }}>Arsip catatan lembur lama (progres × rate card)</div>
      {error && <div className="login-error" style={{ marginBottom: 16 }}>{error}</div>}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)' }}>
          <div className="spinner" style={{ width: 24, height: 24, margin: '0 auto' }} />
        </div>
      ) : (lemburList ?? []).length === 0 ? (
        <div style={{ textAlign: 'center', padding: '64px 0', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🕒</div>
          <div style={{ fontSize: 15, fontWeight: 600 }}>Tidak ada catatan lembur lama periode ini</div>
        </div>
      ) : (
        <div className="card">
          <div className="table-wrap responsive-table" style={{ maxHeight: '65vh', overflowY: 'auto' }}>
            <table>
              <thead style={{ position: 'sticky', top: 0, zIndex: 2 }}>
                <tr style={{ background: 'var(--bg-card)' }}>
                  <th>Nama</th><th>Rate Card</th><th>Tanggal</th>
                  <th style={{ textAlign: 'center' }}>Progres</th>
                  <th style={{ textAlign: 'right' }}>Fee Akhir</th>
                  <th style={{ textAlign: 'center' }}>Status Payroll</th>
                </tr>
              </thead>
              <tbody>
                {lemburList.map(c => (
                  <tr key={c.id}>
                    <td style={{ fontWeight: 600 }}>{c.user?.nama}{(c.briefName || c.klien) && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{c.briefName || c.klien}</div>}</td>
                    <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{c.rateCard?.level}</td>
                    <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{formatTanggalPendek(c.tanggal)}</td>
                    <td style={{ textAlign: 'center', fontSize: 12 }}>{Math.round(c.progresAwal * 100)}% → {Math.round(c.progresAkhir * 100)}%</td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--green)' }}>{formatRp(c.feeAkhir)}</td>
                    <td style={{ textAlign: 'center' }}>
                      <span className={`badge ${c.penggajianId ? 'success' : 'warning'}`} style={{ fontSize: 10 }}>
                        {c.penggajianId ? 'Sudah masuk payroll' : 'Belum masuk payroll'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  )
}
