import { Router } from 'express'
import { authenticate } from '../middleware/auth.js'
import { checkMinRole } from '../middleware/checkRole.js'
import { uploadDokumenAnggota } from '../middleware/upload.js'
import * as H from '../controllers/hrDatabase.js'

// HR & Database (Karsa, 28 Nov 2026). Koordinator ke atas; per orang dicek kelolaStudio di controller.
const router = Router()
router.get('/',                 authenticate, checkMinRole('KOORDINATOR'), H.daftar)
router.get('/dokumen/:id',      authenticate, checkMinRole('KOORDINATOR'), H.lihatDokumen)
router.delete('/dokumen/:id',   authenticate, checkMinRole('KOORDINATOR'), H.hapusDokumen)
router.put('/:userId',          authenticate, checkMinRole('KOORDINATOR'), H.ubah)
router.post('/:userId/dokumen', authenticate, checkMinRole('KOORDINATOR'), uploadDokumenAnggota.single('berkas'), H.unggahDokumen)
export default router
