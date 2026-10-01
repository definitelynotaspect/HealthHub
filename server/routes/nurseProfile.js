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

function mapProfile(row, gallery = [], stats = null) {
  return {
    id: row.id,
    fullName: row.full_name,
    role: row.role,
    email: row.email,
    contact: row.contact,
    employeeId: row.employee_id,
    shift: row.shift,
    department: row.department,
    assignedRoom: row.assigned_room,
    license: row.license,
    profileImage: row.profile_image || '',
    status: row.status,
    duties: parseDuties(row.duties_json),
    gallery,
    ...(stats ? { stats } : {}),
  }
}

function normalizeDuties(value) {
  if (Array.isArray(value)) {
    return value
      .map((item) => toNullableString(item))
      .filter(Boolean)
      .slice(0, 12)
  }

  const duty = toNullableString(value)
  return duty ? [duty] : []
}

export async function ensureGalleryTable() {
  if (galleryTableReady) return

  const [profileColumns] = await pool.execute('SHOW COLUMNS FROM nurse_profiles')
  const profileColumnNames = new Set(profileColumns.map((column) => column.Field))

  if (!profileColumnNames.has('profile_image')) {
    await pool.execute('ALTER TABLE nurse_profiles ADD COLUMN profile_image LONGTEXT NULL AFTER license')
  }

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
      data: mapProfile(profile, gallery, {
        students: Number(statsRows[0].students) || 0,
        visits: Number(statsRows[0].visits) || 0,
        active: Number(statsRows[0].active) || 0,
        discharged: Number(statsRows[0].discharged) || 0,
      }),
    })
  } catch (error) {
    next(error)
  }
})

router.put('/', async (req, res, next) => {
  try {
    const profile = await getPrimaryProfile()
    if (!profile) return res.status(404).json({ message: 'Nurse profile not found.' })

    const fullName = toNullableString(req.body.fullName)
    const role = toNullableString(req.body.role) || 'Clinic Nurse'
    const email = toNullableString(req.body.email)
    const contact = toNullableString(req.body.contact)
    const employeeId = toNullableString(req.body.employeeId)
    const shift = toNullableString(req.body.shift)
    const department = toNullableString(req.body.department)
    const assignedRoom = toNullableString(req.body.assignedRoom)
    const license = toNullableString(req.body.license)
    const profileImage = toNullableString(req.body.profileImage)
    const status = toNullableString(req.body.status) || 'On duty'
    const duties = normalizeDuties(req.body.duties)

    if (!fullName) {
      return res.status(400).json({ message: 'Full name is required.' })
    }

    if (profileImage && !profileImage.startsWith('data:image/')) {
      return res.status(400).json({ message: 'Please upload a valid profile photo.' })
    }

    if (profileImage && profileImage.length > MAX_GALLERY_IMAGE_LENGTH) {
      return res.status(413).json({ message: 'Please upload a profile photo smaller than 2 MB.' })
    }

    await pool.execute(
      `UPDATE nurse_profiles
       SET full_name = ?,
           role = ?,
           email = ?,
           contact = ?,
           employee_id = ?,
           shift = ?,
           department = ?,
           assigned_room = ?,
           license = ?,
           profile_image = ?,
           status = ?,
           duties_json = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        fullName,
        role,
        email,
        contact,
        employeeId,
        shift,
        department,
        assignedRoom,
        license,
        profileImage,
        status,
        JSON.stringify(duties),
        profile.id,
      ]
    )

    if (profile.user_id) {
      await pool.execute(
        'UPDATE users SET full_name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [fullName, profile.user_id]
      )
    }

    const [rows] = await pool.execute('SELECT * FROM nurse_profiles WHERE id = ?', [profile.id])
    const gallery = await getGalleryPhotos(profile.id)

    res.json({ data: mapProfile(rows[0], gallery) })
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
