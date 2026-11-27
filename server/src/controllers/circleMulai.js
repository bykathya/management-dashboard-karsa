import prisma from '../prisma.js'
import rateLimit from 'express-rate-limit'
import { resolveWeb, whereLingkup } from '../utils/web.js'
import { studioBolehDilihat, peranStudio, peranKerja } from './circle.js'
import { anggotaStudio } from '../utils/penugasanDb.js'
import { hariIniWIB } from '../utils/kehadiran.js'
import { SUPER_ADMIN, hasAnyRole, atasanLingkup } from '../utils/roles.js'
import { buatKode, hashKode, MASA_BERLAKU_MS } from '../utils/telegramKode.js'
import { gajiShuBio } from './circleBuku.js'

// "MULAI DI SINI" v2 (21 Okt 2026): daftar kesiapan yang DIHITUNG dari data (bukan sekadar 3 centang), terbagi tiga:
//   wajib      — 3 hal sebelum unit bisa bekerja (tim, akun jualan, alur kerja — alur kini tersimpan di server, bukan di peramban)
//   disarankan — hal-hal agar fitur baru benar-benar jalan (keahlian, target, marketer, buku besar, Telegram, posisi SDM)
//   lingkup    — pengaturan circle (Kepala Circle ke atas / Super Admin): kalender libur, pemetaan kategori biaya, target semua unit
// plus tabel kesiapan semua unit untuk Kepala Circle ke atas. Kompatibel: akun / timTerkonfirmasi / order tetap dikirim.
const gagal = (res, kode, pesan) => res.status(kode).json({ success: false, message: pesan })
const wrap = (isi) => async (req, res) => { try { return await isi(req, res) } catch { return gagal(res, 500, 'Terjadi kesalahan, coba lagi') } }
const AKUN_OTOMATIS = 'Order Internal'
const atasan = (req, web) => atasanLingkup(peranKerja(req), web.lingkup) // Kepala Circle/Rumah Usaha alamat INI ke atas (21 Okt 2026)
const superAdmin = (req) => hasAnyRole(peranKerja(req), SUPER_ADMIN)
const langkah = (kunci, judul, ket, tab, selesai, rinci = null, extra = {}) => ({ kunci, judul, ket, tab, selesai, rinci, ...extra })
async function sesi(req, res) {
  const web = await resolveWeb(req)
  if (web.aud !== 'circle') { gagal(res, 403, 'Hanya untuk web circle'); return null }
  if (req.user?.aud === 'circle' && req.user.cs !== web.lingkup.slug) { gagal(res, 403, 'Token bukan untuk alamat ini'); return null }
  return web
}
async function kesiapanUnit(studioId, hari) {
  const bulan = Number(hari.slice(5, 7)), tahun = Number(hari.slice(0, 4))
  const [akun, anggota, atur, ahli, aturanLembur] = await Promise.all([
    prisma.akunProduksi.findMany({ where: { studioId, namaAkun: { not: AKUN_OTOMATIS } }, select: { id: true } }),
    anggotaStudio(studioId),
    prisma.pengaturanPenugasan.findUnique({ where: { studioId } }),
    prisma.keahlianTahap.count({ where: { studioId } }),
    prisma.pengaturanLembur.findUnique({ where: { studioId }, select: { mode: true } }),
  ])
  const ids = [...anggota.keys()]
  // Konfirmasi Tim hanya untuk PERAN KERJA (12 Nov 2026, laporan Najuwa: halaman Tim "7 dari 7", Mulai di sini "7 dari 10") — Pendamping/
  // Penasihat/Kepala tidak perlu fungsi kerja (sama dengan Susunan tim & layar Tim). Telegram & posisi tetap menghitung semua anggota.
  const idsKerja = [...new Set((await prisma.userRole.findMany({ where: { studioId, userId: { in: ids }, roleType: { in: ['KOORDINATOR', 'KADER', 'KARYAWAN', 'MAGANG'] } }, select: { userId: true } })).map(r => r.userId))]
  const [terkonfirmasi, tAkun, tUnit, marketer, penugasan, itemTetap, status, telegram, posisi, rekening, rutinBio, admin, bio] = await Promise.all([
    prisma.fungsiAnggota.findMany({ where: { studioId, terkonfirmasi: true, userId: { in: idsKerja } }, select: { userId: true }, distinct: ['userId'] }),
    prisma.targetOmsetAkun.count({ where: { akunId: { in: akun.map(a => a.id) }, tahun, bulan } }),
    prisma.targetOmsetUnit.count({ where: { studioId, tahun, bulan } }),
    prisma.fungsiAnggota.findMany({ where: { studioId, fungsi: 'MARKETER', userId: { in: ids } }, select: { userId: true }, distinct: ['userId'] }),
    prisma.penugasanAkunMarketer.findMany({ where: { akun: { studioId } }, select: { userId: true }, distinct: ['userId'] }),
    prisma.itemTetap.count({ where: { aktif: true, OR: [{ studioId }, { studioId: null }] } }),
    prisma.statusBulan.findMany({ where: { studioId }, select: { bulan: true, status: true, kasAwalManual: true } }),
    prisma.user.count({ where: { id: { in: ids }, telegramId: { not: null } } }),
    // posisi terisi = ditetapkan manual ATAU Koordinator unit ini (posisi otomatis dari peran Ekosistem, 12 Nov 2026)
    Promise.all([prisma.profilSdm.findMany({ where: { userId: { in: ids }, posisiSekarang: { not: null } }, select: { userId: true } }), prisma.userRole.findMany({ where: { studioId, roleType: 'KOORDINATOR', userId: { in: ids } }, select: { userId: true } })]).then(([a, b]) => new Set([...a, ...b].map(x => x.userId)).size),
    // Bio studio = sumber (12 Nov 2026): rekening, pengeluaran rutin, THP (gaji & Dignity), SHU dibaca buku besar circle
    prisma.studioRekening.count({ where: { studioId } }),
    prisma.studioPengeluaranRutin.count({ where: { studioId, jumlah: { gt: 0 } } }),
    prisma.produksiAdminMarket.findMany({ where: { studioId }, select: { akunIds: true } }),
    gajiShuBio(studioId, hari.slice(0, 7)),
  ])
  const profil = await prisma.profilAnggota.count({ where: { userId: { in: ids }, bio: { not: null } } })
  const dipegang = new Set(penugasan.map(p => p.userId))
  const marketerTanpaAkun = marketer.filter(m => !dipegang.has(m.userId)).length
  const kasSiap = status.some(s => s.kasAwalManual != null || s.status === 'DITUTUP')
  const n = ids.length
  return { akun: akun.length, n, nKerja: idsKerja.length, timOk: terkonfirmasi.length, alur: !!atur?.alurDisetujui, ahli, lembur: aturanLembur?.mode ?? null, targetAda: tAkun + tUnit > 0, marketer: marketer.length, marketerTanpaAkun, itemTetap, kasSiap, telegram, posisi, rekening, rutinBio, thpBio: bio.gaji.filter(g => g.dari === 'Bio' || g.dari === 'slip').length, shuBio: bio.shu > 0, admin: admin.length, adminBerakun: admin.filter(a => a.akunIds.length).length, profil }
}

// "Mulai di sini" pribadi (11 Nov 2026) — marketer & talent. `disarankan` = kebiasaan harian yang dicentang dari datanya SENDIRI;
// `panduan` = petunjuk menu (tanpa centang). Tidak ada angka uang & tidak ada data orang lain.
async function mulaiPribadi(req, studioId, p) {
  // Karsa Circle (27 Nov 2026): alur order (Tugas saya, Kehadiran, Marketing, Produksi) disembunyikan — order dicatat Koordinator/Admin
  // di menu Pemasukan. Anggota cukup melengkapi profil, mengenal timnya, dan melihat slip. (Versi template ada di riwayat git.)
  const uid = req.user.id
  const [profil, slipFinal] = await Promise.all([
    prisma.profilAnggota.findUnique({ where: { userId: uid }, select: { bio: true } }),
    prisma.penggajian.count({ where: { userId: uid, studioId, status: { in: ['FINAL', 'DIBAYAR'] } } }),
  ])
  const disarankan = [langkah('profil', 'Lengkapi profilmu', 'Isi bio singkat, keahlian, jam aktif, dan Instagram di Profil saya. Profilmu tampil di kartu Tim supaya teman satu circle kenal kamu.', 'profil', !!profil?.bio, profil?.bio ? 'bio sudah diisi' : 'bio belum diisi')]
  const panduan = [
    langkah('kru', 'Tim', 'Kenali teman satu studio: klik kartunya untuk membaca bio mereka.', 'kru', null),
    langkah('slip', 'Slip saya', 'Slip gaji muncul setelah difinalkan Koordinator, dan bisa diunduh PDF.', 'slip', null, slipFinal > 0 ? `${slipFinal} slip tersedia` : 'belum ada slip'),
  ]
  return { peran: p.marketer ? 'marketer' : 'talent', wajib: [], wajibSelesai: true, disarankan, panduan, disarankanSelesai: disarankan.filter(l => l.selesai).length, disarankanTotal: disarankan.length }
}

export const getMulai = wrap(async (req, res) => {
  const { studioId } = req.query
  const web = await sesi(req, res); if (!web) return
  if (!studioId || !(await studioBolehDilihat(req, studioId))) return gagal(res, 403, 'Bukan studio dalam wewenangmu')
  // 11 Nov 2026: "Mulai di sini" untuk SEMUA peran. Koordinator (pengelola unit; pemilik ikut melihat) → daftar kesiapan unit.
  // Marketer & talent → panduan kerja pribadi (dicentang otomatis dari datanya sendiri). Admin Market memakai daftar marketer/talent.
  const p = await peranStudio(req, studioId)
  if (!(p.manajer && !p.adminMarket)) return res.json({ success: true, data: await mulaiPribadi(req, studioId, p) })
  const hari = hariIniWIB(), k = await kesiapanUnit(studioId, hari)
  const slipBulanIni = await prisma.penggajian.count({ where: { studioId, bulan: Number(hari.slice(5, 7)), tahun: Number(hari.slice(0, 4)) } })
  const order = await prisma.orderProduksi.count({ where: { studioId } })
  // Karsa Circle (27 Nov 2026): order dicatat di menu Pemasukan (bukan alur tahapan), jadi Konfirmasi Tim, Alur kerja, keahlian,
  // penerbit invoice, marketer, lembur, Telegram, dan posisi tidak ditanyakan — menunya disembunyikan. Versi template ada di riwayat git.
  const wajib = [
    langkah('akun', 'Isi akun jualan', 'Akun tempat studio berjualan (Fiverr, Etsy, VGen, Instagram, dll.). Setiap pemasukan wajib memilih akunnya, jadi isi minimal satu. Tiap akun: platform, nama akun, dan potongan platform (boleh 0%).', 'akun', k.akun > 0, k.akun > 0 ? `${k.akun} akun` : 'belum ada akun'),
  ]
  const disarankan = [
    langkah('bio', 'Lengkapi Bio studio (web pusat)', 'Web kerja membaca Bio studio dari web pusat: THP tiap anggota (jadi gaji di Tutup bulan), rekening bank (kas per rekening), dan pengeluaran rutin. Isi sekali di web pusat → Bio studio, tidak perlu diketik ulang di sini.', 'buku', k.thpBio > 0 && k.rekening > 0, `${k.thpBio} orang ber-THP · ${k.rekening} rekening · ${k.rutinBio} pengeluaran rutin`, { tombol: 'Lihat hasilnya' }),
    langkah('buku', 'Saldo awal kas', k.rekening > 0
      ? 'Sekali di bulan pertama: Tutup bulan → Kas per rekening → Atur saldo awal → "Isi dari saldo Bio Ekosistem", periksa, lalu Simpan. Bulan berikutnya otomatis dari tutup bulan.'
      : 'Sekali di bulan pertama: isi kas awal di Tutup bulan → Ringkasan. (Rekening bank belum ada di Bio studio — tambahkan di web pusat supaya kas terlihat per rekening.)',
      'buku', k.kasSiap, k.kasSiap ? 'saldo awal sudah diisi' : 'saldo awal belum diisi'),
    langkah('gaji', 'Penggajian bulan ini', 'Sekali di awal: Atur rincian. Tiap bulan: Siapkan slip → isi bonus/potongan → Finalkan → Tandai dibayar. Anggota melihat slipnya di "Slip saya" setelah final. Honor mentor juga diatur di sini.', 'gaji', slipBulanIni > 0, slipBulanIni > 0 ? `${slipBulanIni} slip bulan ini` : 'slip bulan ini belum disiapkan'),
    langkah('target', 'Target omset bulan ini', 'Supaya Progres Omset bisa menunjukkan pencapaian. Diisi Koordinator di Progres Omset → Atur target.', 'penjualan', k.targetAda, k.targetAda ? 'sudah ada' : 'belum ada target bulan ini'),
    langkah('profil', 'Profil anggota', 'Tiap anggota mengisi sendiri bionya di menu Profil saya; hasilnya tampil di kartu Tim. Ingatkan yang belum.', 'kru', k.n > 0 && k.profil >= k.n, `${k.profil} dari ${k.n} anggota sudah mengisi bio`, { tombol: 'Lihat Tim' }),
  ]
  const data = { akun: k.akun, timTerkonfirmasi: k.timOk, order, alurDisetujui: k.alur, wajib, disarankan, wajibSelesai: wajib.every(l => l.selesai), disarankanSelesai: disarankan.filter(l => l.selesai).length, disarankanTotal: disarankan.length, atasan: atasan(req, web), superAdmin: superAdmin(req) }
  if (atasan(req, web)) {
    const kunci = whereLingkup(web.lingkup)
    const semua = await prisma.studio.findMany({ where: { ...kunci, statusAktif: true }, select: { id: true, nama: true, hitungDiEkosistem: true }, orderBy: { nama: 'asc' } })
    const unit = []; for (const s of semua) if (await studioBolehDilihat(req, s.id)) unit.push(s)
    const tahun = Number(hari.slice(0, 4)), bulan = Number(hari.slice(5, 7))
    const baris = []
    for (const s of unit) { const x = await kesiapanUnit(s.id, hari); baris.push({ studioId: s.id, nama: s.nama.trim(), akun: x.akun, anggota: x.n, kasSiap: x.kasSiap, target: x.targetAda, siap: x.akun > 0 }) }
    const [libur, belumPeta, totalKategori] = await Promise.all([
      prisma.hariLiburKerja.count({ where: { jenis: 'LIBUR', tanggal: { gte: new Date(`${tahun}-01-01T00:00:00Z`), lt: new Date(`${tahun + 1}-01-01T00:00:00Z`) } } }),
      prisma.kategoriBiaya.count({ where: { aktif: true, kategoriLedgerId: null } }),
      prisma.kategoriBiaya.count({ where: { aktif: true } }),
    ])
    const tanpaTarget = baris.filter(b => !b.target).length
    data.lingkup = [
      langkah('libur', `Kalender kerja ${tahun}: hari libur`, 'Jam kerja bersih (Analitik, Rekap kerja, Kinerja) menganggap hari libur nasional sebagai hari kerja kalau belum diisi. Super Admin mengisinya di Analitik → Kalender kerja.', 'analitik', libur > 0, libur > 0 ? `${libur} hari libur terisi` : 'belum ada hari libur', { khusus: 'Super Admin' }),
      langkah('pemetaan', 'Pasangkan kategori biaya → laporan keuangan', 'Biaya yang disetujui tapi kategorinya belum dipasangkan TIDAK ikut Laba rugi / Tutup bulan. Super Admin: Tutup bulan → Atur kategori.', 'buku', totalKategori > 0 && belumPeta === 0, totalKategori ? `${belumPeta} dari ${totalKategori} kategori belum dipasangkan` : 'belum ada kategori biaya', { khusus: 'Super Admin' }),
      langkah('targetSemua', 'Target omset semua unit bulan ini', 'Target diisi Koordinator tiap unit (CEO unitnya) per akun di Penjualan → Atur target; di sini dipantau unit mana yang belum mengisi.', 'penjualan', baris.length > 0 && tanpaTarget === 0, baris.length ? `${baris.length - tanpaTarget} dari ${baris.length} unit punya target` : '—'),
    ]
    data.unitSiap = baris.sort((a, b) => Number(a.siap) - Number(b.siap) || a.nama.localeCompare(b.nama, 'id'))
    data.pengingatAktif = process.env.OTOMASI_AKTIF === '1'
  }
  return res.json({ success: true, data })
})

export const setAlurDisetujui = wrap(async (req, res) => {
  const { studioId, setuju } = req.body ?? {}
  if (!(await sesi(req, res))) return
  if (!studioId || !(await studioBolehDilihat(req, studioId))) return gagal(res, 403, 'Bukan studio dalam wewenangmu')
  if (!(await peranStudio(req, studioId)).manajer) return gagal(res, 403, 'Hanya Koordinator ke atas')
  const v = !!setuju
  await prisma.pengaturanPenugasan.upsert({ where: { studioId }, update: { alurDisetujui: v }, create: { studioId, alurDisetujui: v } })
  return res.json({ success: true, data: { alurDisetujui: v } })
})

// ── Telegram: tautkan dari web circle (pekerja circle tak punya halaman Profil Ekosistem). Mekanisme sama persis dengan Profil Ekosistem ──
export const kodeLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 5, keyGenerator: (req) => `kode-telegram:${req.user.id}`, standardHeaders: true, legacyHeaders: false, message: { success: false, message: 'Terlalu banyak permintaan kode, coba lagi dalam 15 menit' } })
export const getTelegram = wrap(async (req, res) => {
  if (!(await sesi(req, res))) return
  const u = await prisma.user.findUnique({ where: { id: req.user.id }, select: { telegramId: true, telegramKodeHash: true, telegramKodeKadaluarsa: true } })
  return res.json({ success: true, data: { tertaut: !!u?.telegramId, kodeAktif: !!u?.telegramKodeHash && !!u.telegramKodeKadaluarsa && u.telegramKodeKadaluarsa > new Date(), bot: process.env.TELEGRAM_BOT_USERNAME || 'nama_bot_anda' } })
})
export const buatKodeTelegram = wrap(async (req, res) => {
  if (!(await sesi(req, res))) return
  if (req.user?.imp) return gagal(res, 403, 'Tidak bisa saat menyamar')
  const kode = buatKode(), kadaluarsa = new Date(Date.now() + MASA_BERLAKU_MS)
  await prisma.user.update({ where: { id: req.user.id }, data: { telegramKodeHash: hashKode(kode), telegramKodeKadaluarsa: kadaluarsa } })
  res.set('Cache-Control', 'no-store')
  return res.json({ success: true, data: { kode, kadaluarsa, bot: process.env.TELEGRAM_BOT_USERNAME || 'nama_bot_anda' } })
})
export const putuskanTelegram = wrap(async (req, res) => {
  if (!(await sesi(req, res))) return
  if (req.user?.imp) return gagal(res, 403, 'Tidak bisa saat menyamar')
  await prisma.user.update({ where: { id: req.user.id }, data: { telegramId: null, telegramKodeHash: null, telegramKodeKadaluarsa: null } })
  return res.json({ success: true, message: 'Tautan Telegram diputus' })
})
