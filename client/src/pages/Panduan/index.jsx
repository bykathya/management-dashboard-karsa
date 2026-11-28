import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { WEB_KERJA } from '../../config/ecosystem'

// MULAI DARI SINI sesuai desain yang disepakati (Karsa, 28 Nov 2026; desain/ringkasan/mulai.html):
// tugas rutin per peran, dikelompokkan menurut waktu. Klik tugas = buka halamannya (web pusat) atau web kerja harian.
const P = 'pusat', K = 'kerja'
// [judul, keterangan, web, halaman (id halaman web pusat, atau '#install')]
const PANDUAN = {
  'Kepala Circle': [
    ['Sekali di awal', 'Menyiapkan circle', [['Pastikan semua anggota punya akun', 'Cek kartu tiap studio, lengkapi data & dokumen', P, 'HrDatabase'], ['Isi hari libur di Kalender', 'Supaya kalender & pengingat tepat', P, 'Calendar'], ['Pasang web sebagai aplikasi', 'Tombol Install App di menu kiri bawah', P, '#install']]],
    ['Tiap minggu', 'Memantau', [['Cek Leaderboard', 'Studio & akun dengan omset tertinggi', P, 'Performance'], ['Cek Overview & Runway', 'Kas cukup untuk berapa bulan', P, 'Dashboard'], ['Cek Financial Forecasting', 'Biaya vs omset tiap studio', P, 'Forecasting'], ['Baca Weekly Report tiap studio', 'Order, omset per akun, aktivitas admin', P, 'LaporanMingguan']]],
    ['Tiap bulan', 'Menutup bulan', [['Validasi Detail Kas + Ekuitas', 'Cocokkan screenshot, centang Valid', P, 'DetailKas'], ['Cek Manifest & salin ke WA', 'Batas tiap tanggal 1', P, 'Manifest'], ['Baca Monthly Report', 'Omset vs CPM, pertumbuhan', P, 'LaporanBulanan'], ['Unduh Executive Summary', 'PDF untuk rapat', P, 'Reports']]],
    ['Kapan saja', 'Komunikasi', [['Buat pengumuman atau event', 'Tampil juga di web kerja harian', P, 'Announcement'], ['Baca SOP semua studio', 'Pilih studio di pojok kanan', P, 'Sop']]],
  ],
  Koordinator: [
    ['Sekali di awal', 'Menyiapkan studio', [['Isi akun jualan', 'VGen, Ko-fi, Artistree, Komunitas…', K], ['Lengkapi data & dokumen anggota', 'Kontrak, rekening, KTP, NDA', P, 'HrDatabase'], ['Tulis SOP studio', 'Di web kerja harian, menu SOP & Aturan', K], ['Atur target & bonus pool', 'Daily Sheet › Performa, Bonus & Lembur', K]]],
    ['Tiap hari', 'Menjalankan studio', [['Pantau Daily Sheet', 'Inbox, order, lempar kerjaan', K], ['Setujui lembur', 'Daily Sheet › Performa, Bonus & Lembur', K]]],
    ['Tiap minggu', 'Memantau', [['Cek Weekly Report studiomu', 'Angka otomatis dari Daily Sheet', P, 'LaporanMingguan']]],
    ['Tiap bulan', 'Menutup bulan', [['Isi Financial Forecasting', 'Estimasi biaya bulan depan, tandai yang sudah lunas', P, 'Forecasting'], ['Isi Detail Kas + Ekuitas', 'Pos saldo + screenshot bukti', P, 'DetailKas'], ['Tutup bulan & penggajian', 'Bonus & komisi admin masuk slip otomatis', K], ['Ingatkan tim menulis Manifest', 'Batas tanggal 1', K]]],
  ],
  Admin: [
    ['Tiap hari', 'Di web kerja harian', [['Catat chat masuk (Inbox)', 'Daily Sheet › Inbox & Order Progress', K], ['Catat order & pembayaran', 'Termasuk DP, tip, dan jalur bayar', K], ['Lempar kerjaan ke freelancer', 'Daily Sheet › Lempar Kerjaan', K]]],
    ['Tiap bulan', 'Di web kerja harian', [['Tulis Manifest', 'Sebelum tanggal 1', K], ['Lihat target & bonusmu', 'Daily Sheet › Performa, Bonus & Lembur', K]]],
    ['Kapan saja', 'Di web kerja harian', [['Baca SOP & pengumuman', 'Menu SOP & Aturan, Info & Kalender', K], ['Lengkapi Profil saya', 'Bio tampil di kartu Tim', K]]],
  ],
  Talent: [
    ['Tiap hari', 'Di web kerja harian', [['Kerjakan order yang diberikan', 'Lihat Daily Sheet › Order Progress', K], ['Catat lembur bila ada', 'Disetujui koordinator', K]]],
    ['Tiap bulan', 'Di web kerja harian', [['Tulis Manifest', 'Sebelum tanggal 1', K], ['Lihat Slip saya', 'Setelah gaji difinalkan', K]]],
    ['Kapan saja', 'Di web kerja harian', [['Lengkapi Profil saya', 'Bio, keahlian, Instagram', K], ['Baca SOP, pengumuman & kalender', 'Menu SOP & Aturan, Info & Kalender', K]]],
  ],
}
const ATASAN = ['ADVISOR', 'KEPALA_EKOSISTEM', 'KEPALA_CIRCLE', 'KEPALA_RUMAH_USAHA']

export default function Panduan({ onNavigate }) {
  const { user } = useAuth()
  const punya = (r) => user?.roles?.some(x => r.includes(x.roleType))
  const [peran, setPeran] = useState(punya(ATASAN) ? 'Kepala Circle' : punya(['KOORDINATOR', 'PENDAMPING']) ? 'Koordinator' : punya(['ADMIN_FUNGSIONAL']) ? 'Admin' : 'Kepala Circle')
  const [info, setInfo] = useState('')
  let n = 0
  return (
    <div className="kd">
      <div className="kepala"><h1>Mulai dari Sini</h1><span className="chip">Panduan per peran</span></div>
      <p className="sub">Pilih peran untuk melihat tugas rutinnya. Klik tugas untuk langsung membuka halamannya. Label <span className="ke web-p">Pusat</span> = web pusat, <span className="ke web-k">Kerja</span> = web kerja harian.</p>
      <div className="chips">{Object.keys(PANDUAN).map(p => <button key={p} type="button" className={p === peran ? 'on' : ''} onClick={() => { setPeran(p); setInfo('') }}>{p}</button>)}</div>
      {(peran === 'Admin' || peran === 'Talent') && <p className="catatan" style={{ margin: '-6px 0 14px' }}>{peran} tidak bisa masuk ke web pusat. Panduan yang sama tampil untuk mereka di menu <b>Mulai di sini</b> web kerja harian.</p>}
      {info && <div className="kartu" style={{ padding: '12px 16px', marginBottom: 12, background: 'color-mix(in srgb, var(--accent) 28%, var(--bg-card))' }}>{info}</div>}
      <div className="waktu">
        {PANDUAN[peran].map(([w, ket, isi]) => (
          <div key={w} className="k">
            <h2>{w}</h2><small className="arti">{ket}</small>
            <div className="tugas">
              {isi.map(([j, k, web, hal]) => {
                n++
                const isiBaris = <><span className="n">{n}</span><span><b>{j}</b><small>{k}</small></span><span className={`ke ${web === K ? 'web-k' : 'web-p'}`}>{web === K ? 'Kerja' : 'Pusat'}</span></>
                if (web === K) return <a key={j} href={WEB_KERJA} target="_blank" rel="noopener noreferrer">{isiBaris}</a>
                return <button key={j} type="button" onClick={() => hal === '#install' ? setInfo('Klik ⤓ Install App di menu kiri bawah, lalu ikuti petunjuknya.') : onNavigate?.(hal)}>{isiBaris}</button>
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
