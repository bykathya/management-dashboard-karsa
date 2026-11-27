import { Router } from 'express'
import { authenticate } from '../middleware/auth.js'
import { populateRoles } from '../middleware/checkRole.js'
import { mingguan, bulanan } from '../controllers/laporanStudio.js'

// Weekly & Monthly Report per studio dari Daily Sheet (Karsa, 27 Nov 2026). Wewenang dicek di controller (kelolaStudio).
const router = Router()
router.get('/mingguan', authenticate, populateRoles, mingguan)
router.get('/bulanan',  authenticate, populateRoles, bulanan)
export default router
