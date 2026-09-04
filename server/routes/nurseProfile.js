import express from 'express'
import { pool } from '../db.js'
import { fromMysqlDateTime, toNullableString } from '../utils/format.js'

const router = express.Router()
const MAX_GALLERY_IMAGE_LENGTH = 3_000_000
let galleryTableReady = false

function parseDuties(value) {
  if (Array.isArray(value)) return value
  if (!value) return []
  try {
    return JSON.parse(value)
  } catch {
    return []
  }
}

function mapGalleryPhoto(row) {
  return {
    id: row.id,
    image: row.image,
    caption: row.caption || '',
    createdAt: fromMysqlDateTime(row.created_at),
  }
}

async function ensureGalleryTable() {
  if (galleryTableReady) return

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS nurse_gallery_photos (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      nurse_profile_id INT UNSIGNED NOT NULL,
      image LONGTEXT NOT NULL,
      caption VARCHAR(191) NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY nurse_gallery_profile_index (nurse_profile_id),
      CONSTRAINT nurse_gallery_profile_fk
        FOREIGN KEY (nurse_profile_id)
        REFERENCES nurse_profiles (id)
        ON DELETE CASCADE
    )
  `)
  galleryTableReady = true
}

async function getPrimaryProfile() {
  const [profiles] = await pool.execute('SELECT * FROM nurse_profiles ORDER BY id ASC LIMIT 1')
  return profiles[0] || null
}

async function getGalleryPhotos(nurseProfileId) {
  await ensureGalleryTable()
  const [rows] = await pool.execute(
    'SELECT * FROM nurse_gallery_photos WHERE nurse_profile_id = ? ORDER BY created_at DESC, id DESC',
    [nurseProfileId]
  )
  return rows.map(mapGalleryPhoto)
}

router.get('/', async (req, res, next) => {
  try {
    const [profile, [statsRows]] = await Promise.all([
      getPrimaryProfile(),
      pool.execute(
        `SELECT
           (SELECT COUNT(*) FROM patient_records) AS students,
           (SELECT COUNT(*) FROM visits) AS visits,
           (SELECT COUNT(*) FROM visits WHERE discharged_at IS NULL) AS active,
           (SELECT COUNT(*) FROM visits WHERE discharged_at IS NOT NULL) AS discharged`
      ),
    ])

    if (!profile) return res.status(404).json({ message: 'Nurse profile not found.' })
    const gallery = await getGalleryPhotos(profile.id)

    res.json({
      data: {
        id: profile.id,
        fullName: profile.full_name,
        role: profile.role,
        email: profile.email,
        contact: profile.contact,
        employeeId: profile.employee_id,
        shift: profile.shift,
        department: profile.department,
        assignedRoom: profile.assigned_room,
        license: profile.license,
        status: profile.status,
        duties: parseDuties(profile.duties_json),
        gallery,
        stats: {
          students: Number(statsRows[0].students) || 0,
          visits: Number(statsRows[0].visits) || 0,
          active: Number(statsRows[0].active) || 0,
          discharged: Number(statsRows[0].discharged) || 0,
        },
      },
    })
  } catch (error) {
    next(error)
  }
})

router.post('/gallery', async (req, res, next) => {
  try {
    const profile = await getPrimaryProfile()
    if (!profile) return res.status(404).json({ message: 'Nurse profile not found.' })

    const image = toNullableString(req.body.image)
    const caption = toNullableString(req.body.caption)

    if (!image || !image.startsWith('data:image/')) {
      return res.status(400).json({ message: 'Please upload a valid image.' })
    }

    if (image.length > MAX_GALLERY_IMAGE_LENGTH) {
      return res.status(413).json({ message: 'Please upload an image smaller than 2 MB.' })
    }

    await ensureGalleryTable()
    const [result] = await pool.execute(
      'INSERT INTO nurse_gallery_photos (nurse_profile_id, image, caption) VALUES (?, ?, ?)',
      [profile.id, image, caption]
    )
    const [rows] = await pool.execute('SELECT * FROM nurse_gallery_photos WHERE id = ?', [result.insertId])

    res.status(201).json({ data: mapGalleryPhoto(rows[0]) })
  } catch (error) {
    next(error)
  }
})

router.delete('/gallery/:id', async (req, res, next) => {
  try {
    const profile = await getPrimaryProfile()
    if (!profile) return res.status(404).json({ message: 'Nurse profile not found.' })

    await ensureGalleryTable()
    const [result] = await pool.execute(
      'DELETE FROM nurse_gallery_photos WHERE id = ? AND nurse_profile_id = ?',
      [req.params.id, profile.id]
    )
    if (!result.affectedRows) return res.status(404).json({ message: 'Gallery photo not found.' })

    res.status(204).end()
  } catch (error) {
    next(error)
  }
})

export default router
