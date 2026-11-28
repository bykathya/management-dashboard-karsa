import multer from 'multer'
import path from 'path'
import { fileURLToPath } from 'url'
import { mkdirSync } from 'fs'
import { randomBytes } from 'crypto'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const kanbanDir = path.join(__dirname, '../../uploads/kanban')
mkdirSync(kanbanDir, { recursive: true })

const skbDir = path.join(__dirname, '../../uploads/skb')
mkdirSync(skbDir, { recursive: true })

const modulDir = path.join(__dirname, '../../uploads/modul')
mkdirSync(modulDir, { recursive: true })

// Penolakan upload yang pesannya MEMANG untuk pengguna (error handler di app.js menampilkannya apa adanya).
const tolak = (pesan) => Object.assign(new Error(pesan), { untukPengguna: true, status: 422 })

const makeStorage = (dir) => multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, dir),
  filename: (_req, file, cb) => {
    // /uploads di-serve tanpa auth (static, lihat app.js) — nama file ITU SENDIRI jadi satu-
    // satunya proteksi akses, jadi wajib acak kriptografis, bukan Math.random() yang predictable.
    const ext = path.extname(file.originalname).toLowerCase()
    cb(null, `${randomBytes(24).toString('hex')}${ext}`)
  },
})

const kanbanFilter = (_req, file, cb) => {
  const allowed = /\.(jpe?g|png|webp|gif|pdf)$/i
  if (allowed.test(path.extname(file.originalname))) cb(null, true)
  else cb(tolak('Tipe file tidak diizinkan. Gunakan JPG, PNG, WebP, GIF, atau PDF.'))
}

const pdfFilter = (_req, file, cb) => {
  if (path.extname(file.originalname).toLowerCase() === '.pdf') cb(null, true)
  else cb(tolak('Hanya file PDF yang diizinkan.'))
}

export const uploadKanban = multer({
  storage: makeStorage(kanbanDir),
  fileFilter: kanbanFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
})

export const uploadSkb = multer({
  storage: makeStorage(skbDir),
  fileFilter: pdfFilter,
  limits: { fileSize: 10 * 1024 * 1024 },
})

export const uploadModul = multer({
  storage: makeStorage(modulDir),
  fileFilter: pdfFilter,
  limits: { fileSize: 20 * 1024 * 1024 },
})

// Bukti saldo kas (Detail Kas + Ekuitas, 27 Nov 2026): folder PRIVAT (bukan /uploads yang terbuka tanpa login).
// Dibuka hanya lewat GET /api/kas-detail/bukti/:id yang memeriksa login & wewenang unit.
export const buktiKasDir = path.join(__dirname, '../../private/bukti-kas')
mkdirSync(buktiKasDir, { recursive: true })
const gambarFilter = (_req, file, cb) => {
  if (/^image\/(png|jpe?g|webp|gif)$/i.test(file.mimetype)) cb(null, true)
  else cb(tolak('Bukti harus gambar (PNG, JPG, WebP, atau GIF).'))
}
export const uploadBuktiKas = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, buktiKasDir),
    filename: (_req, file, cb) => cb(null, `${randomBytes(24).toString('hex')}${({ 'image/png': '.png', 'image/jpeg': '.jpg', 'image/jpg': '.jpg', 'image/webp': '.webp', 'image/gif': '.gif' })[file.mimetype.toLowerCase()] ?? ''}`),
  }),
  fileFilter: gambarFilter,
  limits: { fileSize: 5 * 1024 * 1024, files: 10 },
})

// Dokumen anggota HR (KTP, NDA, SKCK, buku rekening — 28 Nov 2026): folder PRIVAT, gambar atau PDF, maks 8 MB.
export const dokumenAnggotaDir = path.join(__dirname, '../../private/dokumen-anggota')
mkdirSync(dokumenAnggotaDir, { recursive: true })
const EKST_DOK = { 'image/png': '.png', 'image/jpeg': '.jpg', 'image/jpg': '.jpg', 'image/webp': '.webp', 'application/pdf': '.pdf' }
export const uploadDokumenAnggota = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, dokumenAnggotaDir),
    filename: (_req, file, cb) => cb(null, `${randomBytes(24).toString('hex')}${EKST_DOK[file.mimetype.toLowerCase()] ?? ''}`),
  }),
  fileFilter: (_req, file, cb) => (EKST_DOK[file.mimetype.toLowerCase()] ? cb(null, true) : cb(tolak('Dokumen harus gambar (PNG/JPG/WebP) atau PDF.'))),
  limits: { fileSize: 8 * 1024 * 1024, files: 1 },
})
