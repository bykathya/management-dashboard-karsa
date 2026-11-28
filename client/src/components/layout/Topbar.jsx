export const PAGE_TITLES = {
  Dashboard:    'Overview',
  Forecasting:  'Financial Forecasting',
  DetailKas:    'Detail Kas + Ekuitas',
  Manifest:     'Manifest',
  HrDatabase:   'HR & Database',
  Sop:          'SOP & Aturan Studio',
  LaporanMingguan: 'Weekly Report',
  LaporanBulanan:  'Monthly Report',
  WeeklyReport: 'Laporan Omset',
  Finance:      'Keuangan',
  SDM:          'SDM',
  Members:      'Anggota',
  Announcement: 'Info & Dokumen',
  Health:       'Kepatuhan Laporan',
  Koperasi:     'Koperasi',
  Payroll:      'Payroll',
  Kader:        'Performa Kader',
  Performance:  'Leaderboard',
  WebCircle:    'Web Circle',
  Goals:        'Goals & Roadmap',
  Asset:        'Aset & Inventaris',
  Rekrutmen:    'Rekrutmen',
  Profile:      'Profil Saya',
  Milestone:    'Milestone',
  AI:           'AI Intelligence',
  MasterData:   'Unit Usaha',
  Calendar:     'Kalender Ekosistem',
  Reports:      'Unduh Laporan',
  Panduan:      'Panduan',
  Modul:        'Bank Modul',
  Sosmed:       'Direktori Sosmed',
  DanaPengembangan: 'Dana Pengembangan',
}

// Stiker maskot per nama (sama dengan contoh desain): nama yang sama selalu dapat stiker yang sama.
export function stikerNama(nama = '') { let h = 0; for (const c of nama) h = (h * 31 + c.charCodeAt(0)) >>> 0; return `/maskot/stiker-${(h % 8) + 1}.webp` }

// Bilah atas sesuai desain yang disepakati (28 Nov 2026): kotak cari kapsul (Ctrl K) + chip pengguna.
// Notifikasi lama digantikan angka di menu kiri (Keuangan, SDM).
export default function Topbar({ title, user, onProfile, onMenuOpen, onOpenSearch }) {
  return (
    <header className="kd-atas no-print" aria-label={PAGE_TITLES[title] ?? title}>
      <button className="hamburger-btn" onClick={onMenuOpen} aria-label="Menu">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <line x1="3" y1="6"  x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
        </svg>
      </button>
      <button type="button" className="kd-cari" onClick={onOpenSearch}>
        <span aria-hidden>⌕</span><span className="ph">Cari studio, anggota, menu…</span><kbd>Ctrl K</kbd>
      </button>
      {user && (
        <button type="button" className="kd-saya" title="Profil saya" onClick={onProfile}>
          <img src={stikerNama(user.nama)} alt="" />{user.nama}
        </button>
      )}
    </header>
  )
}
