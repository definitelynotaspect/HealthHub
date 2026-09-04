import os from 'node:os'
import path from 'node:path'
import fs from 'node:fs/promises'
import multer from 'multer'

const allowedExtensions = new Set(['.csv', '.xlsx', '.xls'])
const allowedMimeTypes = new Set([
  'text/csv',
  'application/csv',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/octet-stream',
])

export function createImportUpload(resourceName) {
  const uploadDir = path.join(os.tmpdir(), `icf-healthhub-${resourceName}-imports`)
  const upload = multer({
    dest: uploadDir,
    limits: { fileSize: 8 * 1024 * 1024, files: 1 },
    fileFilter(req, file, cb) {
      void req
      const ext = path.extname(file.originalname).toLowerCase()
      const mimeType = String(file.mimetype || '').toLowerCase()

      if (!allowedExtensions.has(ext)) {
        cb(new Error('Only .csv, .xlsx, and .xls files can be imported.'))
        return
      }

      if (mimeType && !allowedMimeTypes.has(mimeType)) {
        cb(new Error('The uploaded file type is not supported.'))
        return
      }

      cb(null, true)
    },
  })

  return async (req, res, next) => {
    try {
      await fs.mkdir(uploadDir, { recursive: true })
    } catch {
      res.status(500).json({
        success: false,
        message: 'Unable to prepare the import upload directory.',
        errors: [],
      })
      return
    }

    upload.single('file')(req, res, (error) => {
      if (error) {
        res.status(400).json({
          success: false,
          message: error.message || 'Unable to upload import file.',
          errors: [],
        })
        return
      }
      next()
    })
  }
}
