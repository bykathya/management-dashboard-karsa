import { Router } from 'express'
import { daftar, centang } from '../controllers/danaTengah.js'
import { authenticate } from '../middleware/auth.js'
import { checkRole } from '../middleware/checkRole.js'

const router = Router()
// Koordinator melihat status studionya; centang hanya Kepala Circle ke atas (dicek di controller lewat atasanStudio).
const boleh = checkRole(['ADVISOR', 'KEPALA_EKOSISTEM', 'KEPALA_CIRCLE', 'KEPALA_RUMAH_USAHA', 'KOORDINATOR', 'PENDAMPING'])

router.get('/', authenticate, boleh, daftar)
router.put('/', authenticate, boleh, centang)

export default router
