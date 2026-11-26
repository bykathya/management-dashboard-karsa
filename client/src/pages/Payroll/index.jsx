import { useState } from 'react'
import { useApi } from '../../hooks/useApi'
import { useAuth } from '../../context/AuthContext'
import PayrollTab from './PayrollTab'
import LemburTab from './LemburTab'

const TABS = [
  { id: 'payroll', label: '💰 Slip gaji' },
  { id: 'lembur', label: '🕒 Lembur' },
]

// PAYROLL Ekosistem = PEMANTAUAN (18 Nov 2026, keputusan user). Penggajian dikelola Koordinator unit di web circle › Penggajian;
// di sini Super Admin/Kepala Ekosistem memantau slip & lembur semua unit (tab SDM › Payroll). Server menolak semua jalur tulis
// (routes/payroll.js). Rate card & template tunjangan lama tidak ditampilkan lagi (hanya dipakai Generate Ekosistem yang sudah dihapus).
export default function Payroll() {
  const { user } = useAuth()
  const { data: studios } = useApi('/api/kanban/studios')

  const isEkosistemAdmin = ['ADVISOR', 'KEPALA_EKOSISTEM'].some(r => user?.roles?.some(ur => ur.roleType === r))
  const selectableStudios = isEkosistemAdmin
    ? (studios ?? [])
    : (studios ?? []).filter(s => user?.roles?.some(r => r.studioId === s.id))

  const [activeTab, setActiveTab] = useState('payroll')
  const [pilihan, setStudioId] = useState('')
  const studioId = pilihan || selectableStudios[0]?.id || '' // daftar unit datang async

  return (
    <>
      <div className="page-header" style={{ marginBottom: 16 }}>
        <div className="page-header-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1>Payroll</h1>
            <p>Pantauan slip gaji &amp; lembur per unit</p>
          </div>
          <select className="form-input" style={{ paddingLeft: 10, width: 220 }}
            value={studioId} onChange={e => setStudioId(e.target.value)} aria-label="Unit">
            <option value="">— Pilih Unit —</option>
            {selectableStudios.map(s => <option key={s.id} value={s.id}>{s.nama}</option>)}
          </select>
        </div>
      </div>

      <div style={{ fontSize: 13, color: 'var(--text-secondary)', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px', marginBottom: 16, lineHeight: 1.6 }}>
        👀 <strong>Hanya untuk memantau.</strong> Slip gaji disiapkan, difinalkan, dan ditandai dibayar oleh Koordinator unit di
        {' '}<strong>web circle › Penggajian</strong>. Aturan dan persetujuan lembur ada di web circle › Kehadiran › Jam kerja &amp; lembur.
      </div>

      <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: 'var(--bg-surface)', borderRadius: 10, padding: 4, width: 'fit-content' }}>
        {TABS.map(t => (
          <button key={t.id}
            onClick={() => setActiveTab(t.id)}
            style={{ padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer',
              background: activeTab === t.id ? 'var(--bg-card)' : 'none',
              color: activeTab === t.id ? 'var(--text)' : 'var(--text-secondary)',
              boxShadow: activeTab === t.id ? '0 1px 4px var(--hover-strong)' : 'none',
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'payroll' && <PayrollTab studioId={studioId} currentUserId={user?.id} />}
      {activeTab === 'lembur' && <LemburTab studioId={studioId} />}
    </>
  )
}
