import { Router } from 'express'
import { authenticate } from '../middleware/auth.js'
import { checkMinRole } from '../middleware/checkRole.js'
import { rekapManifest, lihatSop } from '../controllers/manifestSop.js'

// Web pusat: rekap Manifest & SOP lihat saja (Karsa, 27 Nov 2026). Isi per studio disaring kelolaStudio di controller.
export const manifestRouter = Router()
manifestRouter.get('/', authenticate, checkMinRole('KOORDINATOR'), rekapManifest)
export const sopRouter = Router()
sopRouter.get('/', authenticate, checkMinRole('KOORDINATOR'), lihatSop)
