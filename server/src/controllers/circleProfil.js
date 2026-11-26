// PROFIL SAYA & KARTU TIM (Karsa Circle, tahap 6, 26 Nov 2026).
// - "Tentang aku" (ProfilAnggota) diisi sendiri, boleh kosong, tanpa unggahan berkas (foto = tautan http/https).
// - Kartu Tim: semua anggota studio melihat nama, peran, dan "Tentang aku" sesama anggota. Tanpa angka uang, tanpa data resmi.
// - Tautan NDA hanya dikirim ke orangnya sendiri dan pengelola unit (Koordinator ke atas, kelolaStudio); diisi oleh pengelola.
// - Data resmi (email, HP, rekening 4 digit akhir) hanya untuk dirinya sendiri, lihat saja; diubah koordinator di web pusat › SDM.
import prisma from '../prisma.js'
import { studioBolehDilihat, peranKerja } from './circle.js'
import { kelolaStudio } from '../utils/roles.js'

const gagal = (res, kode, pesan) => res.status(kode).json({ success: false, message: pesan })
const wrap = (isi) => async (req, res) => { try { return await isi(req, res) } catch { return gagal(res, 500, 'Terjadi kesalahan, coba lagi') } }
const PERAN = { KOORDINATOR: 'Koordinator', PENDAMPING: 'Pendamping', KADER: 'Kader', KARYAWAN: 'Karyawan', MAGANG: 'Magang', ADMIN_FUNGSIONAL: 'Admin', KEPALA_CIRCLE: 'Kepala Circle' }
const URUT = ['KEPALA_CIRCLE', 'KOORDINATOR', 'PENDAMPING', 'ADMIN_FUNGSIONAL', 'KADER', 'KARYAWAN', 'MAGANG']
const STATUS = ['JOMBLO', 'TAKEN', 'RAHASIA']
const ZODIAK = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagitarius', 'Capricorn', 'Aquarius', 'Pisces']
const tautanSah = (s) => /^https?:\/\/[^\s]+$/i.test(s)
const teks = (v, n) => { const t = String(v ?? '').trim(); return t ? t.slice(0, n) : null }
const empatAkhir = (s) => (s ? String(s).replace(/\s/g, '').slice(-4) : null)
const FUN = { fotoUrl: true, bio: true, keahlian: true, zodiak: true, ulangTahun: true, jamAktif: true, status: true, instagram: true }

function rapikanProfil(body) {
  const out = {}
  const foto = teks(body.fotoUrl, 500); if (foto && !tautanSah(foto)) return { galat: 'Foto harus berupa tautan yang diawali http:// atau https://' }; out.fotoUrl = foto
  out.bio = teks(body.bio, 300)
  out.keahlian = teks(body.keahlian, 200)
  const z = teks(body.zodiak, 20); if (z && !ZODIAK.includes(z)) return { galat: 'Zodiak tidak dikenal' }; out.zodiak = z
  const u = teks(body.ulangTahun, 5); if (u && !/^(0[1-9]|[12]\d|3[01])-(0[1-9]|1[0-2])$/.test(u)) return { galat: 'Ulang tahun ditulis HH-BB, mis. 21-03' }; out.ulangTahun = u
  out.jamAktif = teks(body.jamAktif, 60)
  const st = teks(body.status, 10); if (st && !STATUS.includes(st)) return { galat: 'Status tidak dikenal' }; out.status = st
  const ig = teks(body.instagram, 60); out.instagram = ig ? ig.replace(/^@/, '').replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').replace(/\/.*$/, '') || null : null
  if (out.instagram && !/^[A-Za-z0-9._]{1,30}$/.test(out.instagram)) return { galat: 'Username Instagram tidak sah' }
  return { data: out }
}

// GET /api/circle/profil-saya
export const getProfilSaya = wrap(async (req, res) => {
  const [u, p] = await Promise.all([
    prisma.user.findUnique({ where: { id: req.user.id }, select: { nama: true, email: true, nomorWa: true, posisi: true, tanggalLahir: true, namaBank: true, noRekening: true, atasNamaRekening: true } }),
    prisma.profilAnggota.findUnique({ where: { userId: req.user.id } }),
  ])
  if (!u) return gagal(res, 404, 'Pengguna tidak ditemukan')
  return res.json({ success: true, data: {
    tentang: Object.fromEntries(Object.keys(FUN).map(k => [k, p?.[k] ?? ''])),
    ndaUrl: p?.ndaUrl ?? null,
    resmi: { nama: u.nama, email: u.email, nomorWa: u.nomorWa, posisi: u.posisi, tanggalLahir: u.tanggalLahir, bank: u.namaBank, rekening4: empatAkhir(u.noRekening), atasNama: u.atasNamaRekening },
    pilihan: { zodiak: ZODIAK, status: STATUS },
  } })
})

// PUT /api/circle/profil-saya { fotoUrl, bio, keahlian, zodiak, ulangTahun, jamAktif, status, instagram }
export const simpanProfilSaya = wrap(async (req, res) => {
  const { galat, data } = rapikanProfil(req.body ?? {})
  if (galat) return gagal(res, 422, galat)
  await prisma.profilAnggota.upsert({ where: { userId: req.user.id }, update: data, create: { userId: req.user.id, ...data } })
  return res.json({ success: true, message: 'Profil disimpan' })
})

// GET /api/circle/tim-kartu?studioId=… — semua anggota studio itu (yang boleh melihat studio ini)
export const getTimKartu = wrap(async (req, res) => {
  const { studioId } = req.query
  if (!studioId || !(await studioBolehDilihat(req, studioId))) return gagal(res, 403, 'Bukan studio dalam wewenangmu')
  const pengelola = await kelolaStudio(peranKerja(req), studioId)
  const peran = await prisma.userRole.findMany({ where: { studioId, roleType: { not: 'DIGNITY' }, user: { statusAktif: true } }, select: { roleType: true, user: { select: { id: true, nama: true, posisi: true } } } })
  const orang = new Map()
  for (const r of peran) { const x = orang.get(r.user.id) ?? { ...r.user, peran: [] }; x.peran.push(r.roleType); orang.set(r.user.id, x) }
  const profil = new Map((await prisma.profilAnggota.findMany({ where: { userId: { in: [...orang.keys()] } } })).map(p => [p.userId, p]))
  const urut = (x) => Math.min(...x.peran.map(p => (URUT.indexOf(p) + 1) || 99))
  const anggota = [...orang.values()].sort((a, b) => urut(a) - urut(b) || a.nama.localeCompare(b.nama, 'id')).map(x => {
    const p = profil.get(x.id), bolehNda = pengelola || x.id === req.user.id
    return {
      userId: x.id, nama: x.nama, peran: x.posisi || PERAN[x.peran.sort((a, b) => URUT.indexOf(a) - URUT.indexOf(b))[0]] || 'Anggota', saya: x.id === req.user.id,
      ...Object.fromEntries(Object.keys(FUN).map(k => [k, p?.[k] ?? null])),
      ...(bolehNda ? { ndaUrl: p?.ndaUrl ?? null, ndaBisaUbah: pengelola } : {}),
    }
  })
  return res.json({ success: true, data: { anggota } })
})

// PUT /api/circle/tim-kartu/:userId/nda { studioId, ndaUrl } — pengelola unit (Koordinator ke atas); orangnya harus anggota studio itu
export const simpanNda = wrap(async (req, res) => {
  const { studioId } = req.body ?? {}
  if (!studioId || !(await studioBolehDilihat(req, studioId))) return gagal(res, 403, 'Bukan studio dalam wewenangmu')
  if (!(await kelolaStudio(peranKerja(req), studioId))) return gagal(res, 403, 'Hanya Koordinator unit yang bisa mengisi tautan NDA')
  const anggota = await prisma.userRole.findFirst({ where: { studioId, userId: req.params.userId, roleType: { not: 'DIGNITY' } }, select: { id: true } })
  if (!anggota) return gagal(res, 404, 'Orang itu bukan anggota studio ini')
  const url = teks(req.body.ndaUrl, 500)
  if (url && !tautanSah(url)) return gagal(res, 422, 'Tautan NDA harus diawali http:// atau https://')
  const oleh = (await prisma.user.findUnique({ where: { id: req.user.id }, select: { nama: true } }))?.nama ?? null
  await prisma.profilAnggota.upsert({ where: { userId: req.params.userId }, update: { ndaUrl: url, ndaOleh: oleh }, create: { userId: req.params.userId, ndaUrl: url, ndaOleh: oleh } })
  return res.json({ success: true, message: url ? 'Tautan NDA disimpan' : 'Tautan NDA dihapus' })
})
