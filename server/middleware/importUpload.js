import os from 'node:os'
import path from 'node:path'
import fs from 'node:fs/promises'
import multer from 'multer'

const spreadsheetExtensions = ['.csv', '.xlsx', '.xls']
const spreadsheetMimeTypes = [
  'text/csv',
  'application/csv',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/octet-stream',
]

export function createImportUpload(resourceName, options = {}) {
  const allowedExtensions = new Set(options.extensions || spreadsheetExtensions)
  const allowedMimeTypes = new Set(options.mimeTypes || spreadsheetMimeTypes)
  const allowedDescription = options.description || '.csv, .xlsx, and .xls files'
  const uploadDir = path.join(os.tmpdir(), `icf-healthhub-${resourceName}-imports`)
  const upload = multer({
    dest: uploadDir,
    limits: { fileSize: options.fileSize || 8 * 1024 * 1024, files: options.files || 1 },
    fileFilter(req, file, cb) {
      void req
      const ext = path.extname(file.originalname).toLowerCase()
      const mimeType = String(file.mimetype || '').toLowerCase()

      if (!allowedExtensions.has(ext)) {
        cb(new Error(`Only ${allowedDescription} can be imported.`))
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

    const uploadHandler = (options.files || 1) > 1 ? upload.array('files', options.files) : upload.single('file')

    uploadHandler(req, res, (error) => {
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
