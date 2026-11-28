import { useAuth } from '../../context/AuthContext'
import { ECOSYSTEM_NAME, TELEGRAM_BOT } from '../../config/ecosystem'
import { alfa } from '../../utils/warna'
import { ALAMAT_TUMBUH } from '../Raport/PindahKeTumbuh'

const KEPALA_ROLES = ['ADVISOR', 'KEPALA_EKOSISTEM', 'KEPALA_CIRCLE', 'KEPALA_RUMAH_USAHA']
const ADMIN_ROLES  = ['ADMIN_FUNGSIONAL']
const KOOR_ROLES   = ['KOORDINATOR', 'PENDAMPING']

function getTier(roles = []) {
  if (roles.some(r => KEPALA_ROLES.includes(r.roleType))) return 'kepala'
  if (roles.some(r => KOOR_ROLES.includes(r.roleType)))  return 'koordinator'
  if (roles.some(r => ADMIN_ROLES.includes(r.roleType))) return 'admin'
  if (roles.some(r => KOOR_ROLES.includes(r.roleType)))  return 'koordinator'
  return 'dasar'
}

// Label ADVISOR "Super Admin" (bukan "Advisor" polos) -- samain ke getRoleLabel canonical di
// client/src/utils/roles.js, biar gak ketuker sama PENASIHAT ("Advisor" posisi studio, role beda).
function getRoleLabel(roleType) {
  const map = {
    ADVISOR: 'Super Admin', KEPALA_EKOSISTEM: 'Kepala Ekosistem',
    KEPALA_CIRCLE: 'Kepala Circle', KEPALA_RUMAH_USAHA: 'Kepala Rumah Usaha', ADMIN_FUNGSIONAL: 'Admin Fungsional',
    PENDAMPING: 'Pendamping', KOORDINATOR: 'Koordinator',
    KADER: 'Kader', KARYAWAN: 'Talent', MAGANG: 'Magang',
  }
  return map[roleType] ?? roleType
}

// `params` = tab tujuan di halaman hub (mis. { tab: 'koperasi' } di Keuangan).
function PageCard({ emoji, title, desc, page, params, onNavigate, color = 'var(--accent)' }) {
  return (
    <div style={{
      background: 'var(--bg-card)', border: '1px solid var(--border)',
      borderRadius: 12, padding: '16px 18px',
      display: 'flex', flexDirection: 'column', gap: 10,
      transition: 'all 0.2s', cursor: 'pointer',
    }}
      onClick={() => onNavigate(page, params)}
      onMouseEnter={e => { e.currentTarget.style.borderColor = color; e.currentTarget.style.transform = 'translateY(-2px)' }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.transform = '' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 22, lineHeight: 1 }}>{emoji}</span>
        <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>{title}</span>
      </div>
      <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>{desc}</p>
      <button onClick={e => { e.stopPropagation(); onNavigate(page, params) }}
        style={{ alignSelf: 'flex-start', fontSize: 12, fontWeight: 600, color, background: 'none',
          border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 4 }}>
        Buka halaman →
      </button>
    </div>
  )
}

function TaskItem({ freq, freqColor, title, desc }) {
  return (
    <div style={{ display: 'flex', gap: 14, paddingBottom: 16,
      borderBottom: '1px solid var(--border)', marginBottom: 4 }}>
      <div style={{ flexShrink: 0, paddingTop: 2 }}>
        <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
          background: alfa(freqColor, 13), color: freqColor, whiteSpace: 'nowrap' }}>
          {freq}
        </span>
      </div>
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>{title}</div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{desc}</div>
      </div>
    </div>
  )
}

// Isi panduan mengikuti menu ringkas (13 Okt 2026): Keuangan & SDM adalah hub bertab -- teks
// menyebut "Menu › Tab", dan kartu membuka tab yang tepat lewat `params`.
// Anak magang (temuan trial 22 Okt 2026): absen tetap di web circle, laporan harian di Jalur Tumbuh.
function TierDasar({ onNavigate, magang }) {
  return (
    <>
      <section>
        <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase',
          letterSpacing: '0.08em', marginBottom: 16 }}>Tugas Rutinmu</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {magang && <>
            <TaskItem freq="Setiap hari" freqColor="var(--red)"
              title="Absen masuk & pulang"
              desc="Absen di web circle seperti biasa: tekan Masuk saat mulai, Pulang saat selesai. Izin atau sakit juga dicatat di sana." />
            <TaskItem freq="Setiap hari" freqColor="var(--red)"
              title="Kirim laporan harian"
              desc={<>Laporan harian ditulis di <b>Jalur Tumbuh</b>: buka <a href={ALAMAT_TUMBUH} target="_blank" rel="noopener noreferrer">tumbuh.kariranak.com</a>, masuk dengan email &amp; sandi Ekosistem-mu, lalu klik <b>Tulis laporan</b> di Beranda — paling lambat jam 20.00. Ceritakan apa yang kamu kerjakan dan pelajari hari itu.</>} />
          </>}
          <TaskItem freq="Setiap bulan" freqColor="var(--cyan)"
            title="Lapor simpanan Koperasi"
            desc="Buka Keuangan › Koperasi → klik Lapor Setoran di baris namamu. Transfer dulu ke rekening koperasi, upload bukti ke Google Drive, tempel linknya." />
          <TaskItem freq="Kapan saja" freqColor="var(--green)"
            title="Lengkapi data diri di Profil"
            desc="Pastikan foto profil, nomor WA, rekening bank, dan data lainnya sudah terisi. Data ini dipakai untuk keperluan administrasi." />
          <TaskItem freq="Kapan saja" freqColor="var(--amber)"
            title="Baca Pengumuman"
            desc="Cek halaman Pengumuman secara berkala untuk info terbaru dari koordinator dan manajemen ekosistem." />
        </div>
      </section>

      <section style={{ marginTop: 32 }}>
        <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase',
          letterSpacing: '0.08em', marginBottom: 16 }}>Halaman yang Perlu Kamu Tahu</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
          <PageCard emoji="👤" title="Profil Saya" page="Profile" onNavigate={onNavigate} color="var(--green)"
            desc="Edit data diri, foto profil, nomor rekening, dan ganti password." />
          <PageCard emoji="🏦" title="Koperasi" page="Finance" params={{ tab: 'koperasi' }} onNavigate={onNavigate} color="var(--cyan)"
            desc="Ada di menu Keuangan. Lapor setoran simpanan bulanan, tempel bukti transfer, tunggu konfirmasi admin." />
          <PageCard emoji="📣" title="Pengumuman" page="Announcement" onNavigate={onNavigate} color="var(--amber)"
            desc="Baca info terbaru dari koordinator dan manajemen. Termasuk pengumuman ekosistem, circle, dan studio." />
          <PageCard emoji="📅" title="Kalender" page="Calendar" onNavigate={onNavigate} color="var(--pink)"
            desc="Lihat jadwal event ekosistem, deadline, dan kegiatan studio yang akan datang." />
        </div>
      </section>
    </>
  )
}

// "Angka uang: dari mana?" versi Karsa (28 Nov 2026): satu alur dari kerja harian sampai laporan.
const JALUR_UANG = [
  ['Omset', 'Daily Sheet (web kerja) → Keuangan › Laporan Omset, tombol Isi dari Daily Sheet, lalu kirim tiap Sabtu'],
  ['Kas + Ekuitas', 'Executive › Detail Kas + Ekuitas (saldo rekening + uang di marketplace/PayPal, dengan screenshot)'],
  ['CPM (biaya bulanan)', 'Executive › Financial Forecasting; kalau bulan itu belum diisi, dihitung otomatis dari gaji & biaya rutin'],
  ['Pengeluaran', 'Keuangan › Pengeluaran, per item'],
  ['Bonus, komisi, lembur', 'Daily Sheet › Performa, Bonus & Lembur → masuk slip gaji'],
]

function JalurUang() {
  return (
    <section style={{ marginTop: 32 }}>
      <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase',
        letterSpacing: '0.08em', marginBottom: 8 }}>Angka uang: dari mana?</h3>
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 12 }}>
        Semua angka di Leaderboard, Overview, dan laporan {ECOSYSTEM_NAME} berasal dari tempat-tempat ini.
      </p>
      <div className="list-ringkas" style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
        {JALUR_UANG.map(([apa, tempat]) => (
          <div key={apa} className="item-ringkas" style={{ padding: '10px 12px', fontSize: 13, lineHeight: 1.5 }}>
            <b>{apa}</b> <span style={{ color: 'var(--text-secondary)' }}>— {tempat}</span>
          </div>
        ))}
      </div>
    </section>
  )
}

// Panduan per peran versi Karsa (28 Nov 2026): kerja harian di web kerja (Daily Sheet), web pusat untuk ringkasan & data.
function Langkah({ judul, children }) {
  return (
    <section style={{ marginTop: 32 }}>
        <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase',
          letterSpacing: '0.08em', marginBottom: 16 }}>{judul}</h3>
      {children}
    </section>
  )
}

function TierKoordinator({ onNavigate, studioNama }) {
  const s = studioNama ? ` ${studioNama}` : ''
  return (
    <>
      <section>
        <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase',
          letterSpacing: '0.08em', marginBottom: 16 }}>Tugas Rutinmu</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          <TaskItem freq="Setiap hari" freqColor="var(--red)" title="Catat order & chat masuk di Daily Sheet"
            desc={`Di web kerja harian, menu Daily Sheet: tambah chat masuk (Inbox) dan order baru, lalu ubah statusnya (WIP, Revisi, Waitlist, Done) dan tandai Lunas saat klien sudah bayar. Semua laporan studio${s} terhitung dari sini.`} />
          <TaskItem freq="Setiap Sabtu ⚡" freqColor="var(--amber)" title="Kirim Laporan Omset mingguan"
            desc="Keuangan › Laporan Omset → klik Isi dari Daily Sheet, cek angkanya, lalu kirim." />
          <TaskItem freq="Saat saldo berubah" freqColor="var(--cyan)" title="Perbarui Detail Kas + Ekuitas"
            desc="Executive › Detail Kas + Ekuitas: isi saldo rekening dan uang di marketplace/PayPal, tempel screenshot saldonya (Ctrl+V). Kepala Circle yang mencentang VALID." />
          <TaskItem freq="Awal bulan" freqColor="var(--accent)" title="Isi Financial Forecasting"
            desc="Executive › Financial Forecasting: perkiraan pengeluaran bulan ini (gaji, operasional, langganan). Bisa disalin dari bulan lalu. Tandai Lunas setelah dibayar." />
          <TaskItem freq="Akhir bulan" freqColor="var(--green)" title="Bonus, komisi & lembur ke slip gaji"
            desc="Web kerja › Daily Sheet › Performa, Bonus & Lembur: isi target dan dana bonus, setujui lembur, lalu klik Masukkan bonus & komisi ke slip gaji." />
          <TaskItem freq="Kapan perlu" freqColor="var(--pink)" title="Tulis SOP studio & lengkapi data tim"
            desc="SOP ditulis di web kerja (menu SOP & Aturan). Kontrak, rekening, dan dokumen anggota diisi di web pusat › HR & Database." />
        </div>
      </section>
      <Langkah judul="Halaman yang Perlu Kamu Kuasai">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
          <PageCard emoji="🏆" title="Leaderboard" page="Performance" onNavigate={onNavigate} color="var(--accent)" desc="Studio & akun jualan terbaik bulan ini, omset per platform, bulan tertinggi & terendah." />
          <PageCard emoji="📊" title="Overview" page="Dashboard" onNavigate={onNavigate} color="var(--cyan)" desc="Kas + Ekuitas, CPM, dan Runway (kas cukup untuk berapa bulan) tiap studio." />
          <PageCard emoji="🏦" title="Detail Kas + Ekuitas" page="DetailKas" onNavigate={onNavigate} color="var(--green)" desc="Saldo semua rekening & pos uang studio, lengkap dengan screenshot." />
          <PageCard emoji="📈" title="Financial Forecasting" page="Forecasting" onNavigate={onNavigate} color="var(--amber)" desc="Perkiraan pengeluaran bulanan per kategori; totalnya jadi CPM." />
          <PageCard emoji="🗓️" title="Weekly & Monthly Report" page="LaporanMingguan" onNavigate={onNavigate} color="var(--pink)" desc="Laporan studio otomatis dari Daily Sheet. Bisa diunduh CSV atau dicetak PDF." />
          <PageCard emoji="📊" title="Laporan Omset" page="Finance" params={{ tab: 'omset' }} onNavigate={onNavigate} color="var(--red)" desc="Kirim setiap Sabtu. Tombol Isi dari Daily Sheet mengisi angkanya." />
          <PageCard emoji="🗂️" title="HR & Database" page="HrDatabase" onNavigate={onNavigate} color="var(--accent-light)" desc="Kontrak, rekening, dan 4 dokumen anggota studiomu." />
          <PageCard emoji="📣" title="Info & Dokumen" page="Announcement" onNavigate={onNavigate} color="var(--amber)" desc="Pengumuman, event (masuk kalender), kontrak, dan tautan Drive untuk tim." />
          <PageCard emoji="✨" title="Manifest" page="Manifest" onNavigate={onNavigate} color="var(--pink)" desc="Rekap manifestasi bulanan tim; bisa disalin ke WA." />
        </div>
      </Langkah>
    </>
  )
}

function TierKepala({ onNavigate }) {
  return (
    <>
      <section>
        <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase',
          letterSpacing: '0.08em', marginBottom: 16 }}>Tugas Rutinmu</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          <TaskItem freq="Setiap Senin" freqColor="var(--accent)" title="Cek Leaderboard & Overview"
            desc="Executive › Leaderboard untuk studio & akun terbaik; Overview untuk Kas + Ekuitas dan Runway tiap studio (lime ≥ 6 bulan, kuning 3–6, pink di bawah 3)." />
          <TaskItem freq="Setiap Sabtu" freqColor="var(--red)" title="Pantau Laporan Omset & Kepatuhan"
            desc="Pastikan tiap Koordinator sudah mengirim Laporan Omset (Isi dari Daily Sheet → kirim). Lihat siapa yang belum di Kepatuhan Laporan." />
          <TaskItem freq="Setelah koordinator update" freqColor="var(--green)" title="Centang VALID di Detail Kas + Ekuitas"
            desc="Cocokkan nominal dengan screenshot saldonya, lalu klik BELUM VALID → VALID. Kalau nominal diubah lagi, otomatis kembali belum valid." />
          <TaskItem freq="Awal bulan" freqColor="var(--cyan)" title="Tinjau Financial Forecasting & Monthly Report"
            desc="Pastikan tiap studio mengisi estimasi pengeluaran bulan ini. Monthly Report membandingkan omset dengan CPM dan sisa bersihnya." />
          <TaskItem freq="Tanggal 1" freqColor="var(--pink)" title="Rekap Manifest bulanan"
            desc="Menu Manifest: lihat siapa yang sudah menulis, lalu Salin format WA untuk grup." />
          <TaskItem freq="Kapan perlu" freqColor="var(--amber)" title="Kelola anggota & dokumen"
            desc="SDM untuk menambah anggota dan perannya; HR & Database untuk kontrak, rekening, dan dokumen (KTP, NDA, SKCK, buku rekening)." />
        </div>
      </section>
      <Langkah judul="Halaman yang Perlu Kamu Kuasai">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
          <PageCard emoji="🏆" title="Leaderboard" page="Performance" onNavigate={onNavigate} color="var(--accent)" desc="Top studio, top akun jualan, omset per platform, ATH/ATL." />
          <PageCard emoji="📊" title="Overview" page="Dashboard" onNavigate={onNavigate} color="var(--cyan)" desc="Kas + Ekuitas, CPM, Runway semua studio." />
          <PageCard emoji="🏦" title="Detail Kas + Ekuitas" page="DetailKas" onNavigate={onNavigate} color="var(--green)" desc="Saldo & screenshot; kamu yang mencentang VALID." />
          <PageCard emoji="📈" title="Financial Forecasting" page="Forecasting" onNavigate={onNavigate} color="var(--amber)" desc="Estimasi pengeluaran bulanan tiap studio." />
          <PageCard emoji="🗓️" title="Weekly Report" page="LaporanMingguan" onNavigate={onNavigate} color="var(--pink)" desc="Status order, omset mingguan, Admin PIC & aktivitas 7 hari." />
          <PageCard emoji="📅" title="Monthly Report" page="LaporanBulanan" onNavigate={onNavigate} color="var(--pink)" desc="Omset vs CPM, pertumbuhan, akun jualan, lempar kerjaan." />
          <PageCard emoji="🗂️" title="HR & Database" page="HrDatabase" onNavigate={onNavigate} color="var(--accent-light)" desc="Kartu anggota, kontrak, rekening, dokumen privat." />
          <PageCard emoji="📣" title="Info & Dokumen" page="Announcement" onNavigate={onNavigate} color="var(--amber)" desc="Pengumuman, event, kontrak, tautan Drive; tampil juga di web kerja." />
          <PageCard emoji="📅" title="Kalender" page="Calendar" onNavigate={onNavigate} color="var(--cyan)" desc="Event, acara web kerja, hari libur, ulang tahun." />
          <PageCard emoji="✨" title="Manifest" page="Manifest" onNavigate={onNavigate} color="var(--pink)" desc="Rekap manifestasi bulanan semua studio." />
          <PageCard emoji="📘" title="SOP & Aturan" page="Sop" onNavigate={onNavigate} color="var(--green)" desc="Lihat SOP tiap studio (ditulis Koordinator di web kerja)." />
          <PageCard emoji="📥" title="Unduh Laporan" page="Reports" onNavigate={onNavigate} color="var(--accent-light)" desc="Executive Summary PDF & laporan lain." />
        </div>
      </Langkah>
    </>
  )
}

function TierAdmin({ onNavigate }) {
  return (
    <>
      <section>
        <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase',
          letterSpacing: '0.08em', marginBottom: 16 }}>Tugas Rutinmu</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          <TaskItem freq="Setiap hari" freqColor="var(--red)" title="Kerja harian di web kerja"
            desc="Catat chat masuk dan order akun yang kamu pegang di Daily Sheet, ubah statusnya, dan tandai Lunas. Web pusat ini untuk melihat ringkasan." />
          <TaskItem freq="Setiap minggu" freqColor="var(--cyan)" title="Pantau Leaderboard & Weekly Report"
            desc="Lihat posisi akunmu di Leaderboard dan aktivitas 7 hari di Weekly Report." />
          <TaskItem freq="Kapan perlu" freqColor="var(--amber)" title="Baca Info & Kalender"
            desc="Pengumuman, event, dan dokumen dari Kepala Circle." />
        </div>
      </section>
      <Langkah judul="Halaman yang Perlu Kamu Kuasai">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
          <PageCard emoji="🏆" title="Leaderboard" page="Performance" onNavigate={onNavigate} color="var(--accent)" desc="Studio & akun jualan terbaik bulan ini." />
          <PageCard emoji="📊" title="Overview" page="Dashboard" onNavigate={onNavigate} color="var(--cyan)" desc="Ringkasan keuangan ekosistem." />
          <PageCard emoji="📣" title="Info & Dokumen" page="Announcement" onNavigate={onNavigate} color="var(--amber)" desc="Pengumuman, event, kontrak, tautan Drive." />
          <PageCard emoji="📅" title="Kalender" page="Calendar" onNavigate={onNavigate} color="var(--pink)" desc="Event, hari libur, ulang tahun." />
        </div>
      </Langkah>
    </>
  )
}

export default function Panduan({ onNavigate }) {
  const { user } = useAuth()
  const roles = user?.roles ?? []
  const tier  = getTier(roles)

  const primaryRole = roles[0]
  const roleLabel   = getRoleLabel(primaryRole?.roleType)
  const studioNama  = primaryRole?.studio?.nama ?? null
  const circleNama  = primaryRole?.circle?.nama ?? null

  const tierMeta = {
    kepala:      { label: 'Kepala',         color: 'var(--accent)',  bg: 'color-mix(in srgb, var(--accent) 12%, transparent)',  emoji: '🏛️' },
    admin:       { label: 'Admin',          color: 'var(--accent)',  bg: 'color-mix(in srgb, var(--accent) 12%, transparent)',  emoji: '🏛️' },
    koordinator: { label: 'Koordinator',    color: 'var(--cyan)',  bg: 'color-mix(in srgb, var(--cyan) 12%, transparent)',   emoji: '🎯' },
    dasar:       { label: 'Anggota',        color: 'var(--green)',  bg: 'color-mix(in srgb, var(--green) 12%, transparent)',  emoji: '👤' },
  }[tier]

  return (
    <>
      {/* Header */}
      <div className="page-header" style={{ marginBottom: 0 }}>
        <h1>Panduan Mulai dari Sini</h1>
        <p>Panduan lengkap penggunaan dashboard sesuai peranmu di ekosistem {ECOSYSTEM_NAME}</p>
      </div>

      {/* Welcome card */}
      <div style={{
        background: 'linear-gradient(135deg, color-mix(in srgb, var(--accent) 12%, transparent), color-mix(in srgb, var(--cyan) 6%, transparent))',
        border: '1px solid color-mix(in srgb, var(--accent) 20%, transparent)', borderRadius: 14,
        padding: '24px 28px', margin: '24px 0',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20,
      }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', marginBottom: 6 }}>
            Halo, {user?.nama?.split(' ')[0] ?? 'Anggota'}! 👋
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 12, fontWeight: 700, padding: '3px 12px', borderRadius: 20,
              background: tierMeta.bg, color: tierMeta.color }}>
              {tierMeta.emoji} {roleLabel}
            </span>
            {studioNama && (
              <span style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--text-muted)', display: 'inline-block' }} />
                {studioNama}
              </span>
            )}
            {circleNama && (
              <span style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--text-muted)', display: 'inline-block' }} />
                {circleNama}
              </span>
            )}
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 10, lineHeight: 1.6 }}>
            {tier === 'kepala'      && 'Kerja harian tim dicatat di web kerja harian (Daily Sheet). Web pusat ini merangkum semuanya: Leaderboard, Overview, kas, laporan, dan data tim.'}
            {tier === 'admin'       && 'Kerja harianmu ada di web kerja harian (Daily Sheet). Di web pusat ini kamu bisa melihat ringkasan dan info.'}
            {tier === 'koordinator' && 'Kamu CEO studiomu: catat kerja harian di Daily Sheet (web kerja), kirim Laporan Omset tiap Sabtu, perbarui kas, dan isi Financial Forecasting tiap bulan.'}
            {tier === 'dasar'       && `Panduan di bawah disesuaikan untukmu. Fokus utama: Koperasi dan Profil. Task Kanban studiomu bisa dicek lewat Telegram Bot (@${TELEGRAM_BOT}).`}
          </p>
        </div>
        <div style={{ fontSize: 56, opacity: 0.7, flexShrink: 0 }}>{tierMeta.emoji}</div>
      </div>

      {/* Tier content */}
      {tier === 'kepala'      && <TierKepala      onNavigate={onNavigate} />}
      {tier === 'admin'       && <TierAdmin       onNavigate={onNavigate} />}
      {tier === 'koordinator' && <TierKoordinator onNavigate={onNavigate} studioNama={studioNama} />}
      {(tier === 'kepala' || tier === 'koordinator') && <JalurUang />}
      {tier === 'dasar'       && <TierDasar       onNavigate={onNavigate} magang={roles.some(r => r.roleType === 'MAGANG')} />}

      {/* Footer note */}
      <div style={{ marginTop: 40, padding: '16px 20px', background: 'var(--bg-surface)',
        borderRadius: 10, border: '1px solid var(--border)' }}>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.8, margin: 0 }}>
          💡 <strong style={{ color: 'var(--text-secondary)' }}>Tips:</strong> Gunakan Telegram Bot <strong style={{ color: 'var(--text-secondary)' }}>@{TELEGRAM_BOT}</strong> untuk laporan omset, cek kas, dan status kanban langsung dari HP tanpa buka dashboard.
          Ketik <code style={{ background: 'var(--bg-card)', padding: '1px 6px', borderRadius: 4, fontSize: 11 }}>/help</code> di bot untuk lihat daftar perintah.
        </p>
      </div>
    </>
  )
}
