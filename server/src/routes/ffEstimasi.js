import { Router } from 'express'
import { authenticate } from '../middleware/auth.js'
import { populateRoles } from '../middleware/checkRole.js'
import * as F from '../controllers/ffEstimasi.js'

// Financial Forecasting baru (Karsa, 27 Nov 2026). Wewenang per unit dicek di controller (bolehFf).
const router = Router()
router.get('/',                      authenticate, populateRoles, F.muat)
router.post('/mulai',                authenticate, populateRoles, F.mulai)
router.post('/kategori',             authenticate, populateRoles, F.tambahKategori)
router.post('/mentor',               authenticate, populateRoles, F.tambahMentor)
router.put('/kategori/:id',          authenticate, populateRoles, F.ubahKategori)
router.delete('/kategori/:id',       authenticate, populateRoles, F.hapusKategori)
router.post('/kategori/:id/geser',   authenticate, populateRoles, F.geserKategori)
router.post('/kategori/:id/sync-hr', authenticate, populateRoles, F.syncHr)
router.post('/item',                 authenticate, populateRoles, F.tambahItem)
router.put('/item/:id',              authenticate, populateRoles, F.ubahItem)
router.delete('/item/:id',           authenticate, populateRoles, F.hapusItem)
router.post('/item/:id/geser',       authenticate, populateRoles, F.geserItem)
export default router
