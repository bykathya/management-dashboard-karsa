import { Router } from 'express'
import { daftar, centang, kas, catatSaldo, catatPakai, hapusPakai } from '../controllers/danaTengah.js'
import { authenticate } from '../middleware/auth.js'
import { checkRole } from '../middleware/checkRole.js'

const router = Router()
// Koordinator melihat status studionya; centang hanya Kepala Circle ke atas (dicek di controller lewat atasanStudio).
const boleh = checkRole(['ADVISOR', 'KEPALA_EKOSISTEM', 'KEPALA_CIRCLE', 'KEPALA_RUMAH_USAHA', 'KOORDINATOR', 'PENDAMPING'])

router.get('/', authenticate, boleh, daftar)
router.put('/', authenticate, boleh, centang)
// Saldo & pemakaian Dana Tengah (tahap 7): Koordinator ke atas boleh mencatat; nama pencatat tersimpan
router.get('/kas', authenticate, boleh, kas)
router.post('/saldo', authenticate, boleh, catatSaldo)
router.post('/pakai', authenticate, boleh, catatPakai)
router.delete('/pakai/:id', authenticate, boleh, hapusPakai)

export default router
