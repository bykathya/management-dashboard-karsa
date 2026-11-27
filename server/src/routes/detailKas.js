import { Router } from 'express'
import { authenticate } from '../middleware/auth.js'
import { populateRoles } from '../middleware/checkRole.js'
import { uploadBuktiKas } from '../middleware/upload.js'
import * as K from '../controllers/detailKas.js'

// Detail Kas + Ekuitas (Karsa, 27 Nov 2026). Wewenang per unit dicek di controller (kelolaStudio / atasanStudio).
const router = Router()
router.get('/',               authenticate, populateRoles, K.muat)
router.post('/rekening',      authenticate, populateRoles, K.tambahRekening)
router.put('/rekening/:id',   authenticate, populateRoles, K.ubahRekening)
router.post('/pos',           authenticate, populateRoles, K.tambahPos)
router.put('/pos/:id',        authenticate, populateRoles, K.ubahPos)
router.delete('/pos/:id',     authenticate, populateRoles, K.hapusPos)
router.put('/valid',          authenticate, populateRoles, K.aturValid)
router.post('/bukti',         authenticate, uploadBuktiKas.array('berkas', 10), populateRoles, K.unggahBukti)
router.get('/bukti/:id',      authenticate, populateRoles, K.lihatBukti)
router.delete('/bukti/:id',   authenticate, populateRoles, K.hapusBukti)
export default router
