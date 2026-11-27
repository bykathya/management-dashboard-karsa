import { useMemo } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useApi } from '../../hooks/useApi'
import { ROLE_FF } from '../../utils/roles'
import Estimasi from './Estimasi'

// Financial Forecasting sebagai menu sendiri di grup Executive (Karsa, 27 Nov 2026).
// Hanya Koordinator ke atas (ROLE_FF); Admin, Pendamping, Kader, Talent, Magang melihat pesan terkunci. Server juga memeriksa per unit.
// Versi lama (pages/Finance/Forecasting.jsx: tabel semua unit + Update Kas) digantikan Estimasi + Detail Kas + Ekuitas.
export default function ForecastingPage({ onNavigate }) {
  const { user } = useAuth()
  const roles = user?.roles ?? []
  const boleh = roles.some(r => ROLE_FF.includes(r.roleType))
  const { data } = useApi(boleh ? '/api/monthly-data/summary' : null)
  // Koordinator: hanya studionya sendiri; Kepala Circle ke atas: semua studio dalam wilayahnya
  const atasan = roles.some(r => ['ADVISOR', 'KEPALA_EKOSISTEM', 'KEPALA_CIRCLE', 'KEPALA_RUMAH_USAHA'].includes(r.roleType))
  const daftar = useMemo(() => (data?.perStudio ?? []).filter(s => s.kas !== null && (atasan || roles.some(r => r.roleType === 'KOORDINATOR' && r.studioId === s.studioId))), [data, atasan, roles])
  if (!boleh) {
    return <div className="card" style={{ padding: 24, color: 'var(--text-secondary)', lineHeight: 1.6 }}>🔒 Financial Forecasting hanya untuk Koordinator dan Kepala Circle.</div>
  }
  if (data && !daftar.length) return <div className="card" style={{ padding: 24 }}>Belum ada studio yang kamu kelola sebagai Koordinator.</div>
  return <Estimasi daftarStudio={daftar} onNavigate={onNavigate} />
}
