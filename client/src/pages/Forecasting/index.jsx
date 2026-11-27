import { lazy, Suspense } from 'react'
import { useAuth } from '../../context/AuthContext'
import { ROLE_FF } from '../../utils/roles'

// Financial Forecasting sebagai menu sendiri di grup Executive (Karsa, 27 Nov 2026).
// Hanya Koordinator ke atas (ROLE_FF); Admin, Pendamping, Kader, Talent, Magang melihat pesan terkunci.
const Forecasting = lazy(() => import('../Finance/Forecasting'))

export default function ForecastingPage({ onNavigate }) {
  const { user } = useAuth()
  const boleh = user?.roles?.some(r => ROLE_FF.includes(r.roleType))
  if (!boleh) {
    return (
      <div className="card" style={{ padding: 24, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
        🔒 Financial Forecasting hanya untuk Koordinator dan Kepala Circle.
      </div>
    )
  }
  return (
    <>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 0 16px', lineHeight: 1.6 }}>
        Kas, CPM (biaya rutin per bulan), omset, dan target tiap studio dalam satu layar.
        Runway = kas cukup untuk berapa bulan.
      </p>
      <Suspense fallback={<div style={{ padding: 48, textAlign: 'center' }}><div className="spinner" /></div>}>
        <Forecasting user={user} onNavigate={onNavigate} />
      </Suspense>
    </>
  )
}
