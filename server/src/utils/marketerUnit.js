import prisma from '../prisma.js'
import { masihDiUnit } from './fungsi.js'

// Marketer unit = fungsi MARKETER yang orangnya MASIH berperan di unit itu (9 Nov 2026). SATU sumber untuk Marketing (rencana, analisis,
// penugasan akun) dan pemegang order (18 Nov 2026: isian "Marketer pemegang" di Tambah order & detail order).
export const marketerUnit = async (studioId) => (await prisma.fungsiAnggota.findMany({ where: { studioId, fungsi: 'MARKETER', user: masihDiUnit(studioId) }, select: { user: { select: { id: true, nama: true } } }, orderBy: { user: { nama: 'asc' } } })).map(f => f.user)
