import { Router } from 'express'
import { getLembur, getPenggajianList, getSlip, getLemburPresensi } from '../controllers/payroll.js'
import { authenticate } from '../middleware/auth.js'
import { checkRole, populateRoles } from '../middleware/checkRole.js'
import { STAFF_PLUS } from '../utils/roles.js'

// GET daftar & slip memakai `populateRoles` (controller menyaring: non-pengelola hanya slip sendiri); lembur Koordinator ke atas.
const router = Router()

// PAYROLL Ekosistem = BACA-SAJA (18 Nov 2026, keputusan user): penggajian dikelola koordinator di web circle › Penggajian
// (controllers/circleGaji.js, tabel Penggajian yang sama). Ekosistem hanya memantau. Dulu dua pintu tulis ke slip yang sama membuat:
// "Tandai dibayar" Ekosistem tanpa tanggal bayar (Tutup bulan circle tidak menganggap gaji dibayar), Generate Ekosistem tanpa rincian gaji tetap,
// dan lembur rate card (CatatanLembur) yang hanya masuk slip lewat Generate Ekosistem. Semua jalur tulis di bawah ditolak di sini;
// handler lama di controllers/payroll.js dibiarkan (generate dsb. tidak dipanggil lagi). lemburUntukSlip tetap dipakai circleGaji.
const bacaSaja = (req, res) => res.status(403).json({ success: false, message: 'Payroll di Ekosistem Dashboard hanya untuk memantau. Penggajian, lembur, dan pembayaran gaji dikelola koordinator di web circle › Penggajian.' })

router.post('/rate-card', authenticate, bacaSaja)
router.patch('/rate-card/:id', authenticate, bacaSaja)

router.get('/lembur',  authenticate, checkRole(STAFF_PLUS), getLembur)
router.get('/lembur-presensi', authenticate, checkRole(STAFF_PLUS), getLemburPresensi)
router.put('/tarif-lembur', authenticate, bacaSaja)
router.post('/lembur', authenticate, bacaSaja)

router.post('/tunjangan-template', authenticate, bacaSaja)
router.patch('/tunjangan-template/:id', authenticate, bacaSaja)

router.post('/generate', authenticate, bacaSaja)

router.get('/',  authenticate, populateRoles, getPenggajianList)
router.patch('/:id', authenticate, bacaSaja)
router.post('/:id/finalize', authenticate, bacaSaja)
router.post('/:id/tandai-dibayar', authenticate, bacaSaja)
router.get('/:id/slip', authenticate, populateRoles, getSlip)

router.post('/:id/tunjangan', authenticate, bacaSaja)
router.patch('/tunjangan/:id', authenticate, bacaSaja)
router.delete('/tunjangan/:id', authenticate, bacaSaja)

export default router
