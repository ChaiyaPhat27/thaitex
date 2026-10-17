import Path from 'node:path'
import fs from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'
import logger from '@overleaf/logger'
import Settings from '@overleaf/settings'
import { expressify } from '@overleaf/promise-utils'
import SessionManager from '../../../../app/src/Features/Authentication/SessionManager.mjs'
import AdminAuthorizationHelper from '../../../../app/src/Features/Helpers/AdminAuthorizationHelper.mjs'
import { multerUploadHandler } from '../../../../app/src/infrastructure/Multer.mjs'

const { hasAdminAccess } = AdminAuthorizationHelper
const execFileAsync = promisify(execFile)
const __dirname = Path.dirname(fileURLToPath(import.meta.url))

// Fonts in this folder are picked up by fontconfig (see
// server-ce/config/fontconfig-user-fonts.conf), so XeLaTeX and LuaLaTeX can use
// them by family name in every project.
const FONTS_DIR =
  Settings.fontManager?.dir ||
  process.env.OVERLEAF_FONTS_DIR ||
  '/var/lib/overleaf/data/fonts'
const UPLOAD_TMP_DIR = Path.join(Path.dirname(FONTS_DIR), 'fonts-upload-tmp')
const MAX_FONT_SIZE = 50 * 1024 * 1024
const MAX_FILES_PER_UPLOAD = 20
const FONT_EXTENSIONS = new Set(['.ttf', '.otf', '.ttc', '.otc'])

// sfnt magic numbers: TrueType, OpenType CFF, Apple TrueType, collections
const FONT_SIGNATURES = [
  Buffer.from([0x00, 0x01, 0x00, 0x00]),
  Buffer.from('OTTO'),
  Buffer.from('true'),
  Buffer.from('ttcf'),
]

const upload = multerUploadHandler({
  dest: UPLOAD_TMP_DIR,
  limits: { fileSize: MAX_FONT_SIZE, files: MAX_FILES_PER_UPLOAD },
}).array('fonts', MAX_FILES_PER_UPLOAD)

async function ensureDirs() {
  await fs.mkdir(FONTS_DIR, { recursive: true })
  await fs.mkdir(UPLOAD_TMP_DIR, { recursive: true })
}

function sanitizeFileName(originalName) {
  const base = Path.basename(originalName || '')
  const ext = Path.extname(base).toLowerCase()
  const stem = Path.basename(base, Path.extname(base))
    .normalize('NFC')
    .replace(/[^\p{L}\p{N} ._-]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120)
  if (!stem || stem.startsWith('.')) return null
  return `${stem}${ext}`
}

async function hasFontSignature(filePath) {
  const handle = await fs.open(filePath, 'r')
  try {
    const buf = Buffer.alloc(4)
    await handle.read(buf, 0, 4, 0)
    return FONT_SIGNATURES.some(sig => sig.equals(buf))
  } finally {
    await handle.close()
  }
}

async function describeFont(filePath) {
  try {
    const { stdout } = await execFileAsync(
      'fc-scan',
      ['--format', '%{family[0]}\t%{style[0]}\n', filePath],
      { timeout: 10000 }
    )
    const faces = stdout
      .split('\n')
      .filter(Boolean)
      .map(line => {
        const [family, style] = line.split('\t')
        return { family, style }
      })
    return faces
  } catch (err) {
    logger.warn({ err, filePath }, 'fc-scan failed for uploaded font')
    return []
  }
}

async function listFonts() {
  await ensureDirs()
  const entries = await fs.readdir(FONTS_DIR, { withFileTypes: true })
  const fonts = []
  for (const entry of entries) {
    if (!entry.isFile()) continue
    if (!FONT_EXTENSIONS.has(Path.extname(entry.name).toLowerCase())) continue
    const filePath = Path.join(FONTS_DIR, entry.name)
    const stat = await fs.stat(filePath)
    const faces = await describeFont(filePath)
    fonts.push({
      fileName: entry.name,
      size: stat.size,
      uploadedAt: stat.mtime,
      family: faces[0]?.family || Path.basename(entry.name, Path.extname(entry.name)),
      styles: [...new Set(faces.map(face => face.style).filter(Boolean))],
    })
  }
  fonts.sort((a, b) => a.family.localeCompare(b.family))
  return fonts
}

async function refreshFontCache() {
  try {
    await execFileAsync('fc-cache', ['-f', FONTS_DIR], { timeout: 120000 })
  } catch (err) {
    // fontconfig rescans folders whose mtime changed, so a failed cache
    // refresh only makes the next compile slower
    logger.warn({ err }, 'fc-cache failed after font change')
  }
}

async function moveFile(from, to) {
  try {
    await fs.rename(from, to)
  } catch (err) {
    if (err.code !== 'EXDEV') throw err
    await fs.copyFile(from, to)
    await fs.unlink(from)
  }
}

async function fontsPage(req, res) {
  const user = SessionManager.getSessionUser(req.session)
  const fonts = await listFonts()
  res.render(Path.resolve(__dirname, '../views/fonts'), {
    title: 'Fonts',
    fonts,
    canManageFonts: hasAdminAccess(user),
    maxFontSizeMb: MAX_FONT_SIZE / 1024 / 1024,
  })
}

async function listFontsJson(req, res) {
  res.json({ fonts: await listFonts() })
}

function uploadMiddleware(req, res, next) {
  ensureDirs()
    .then(() => {
      upload(req, res, err => {
        if (!err) return next()
        logger.warn({ err }, 'font upload rejected')
        const message =
          err.code === 'LIMIT_FILE_SIZE'
            ? `Font files must be smaller than ${MAX_FONT_SIZE / 1024 / 1024} MB`
            : err.code === 'LIMIT_FILE_COUNT' ||
                err.code === 'LIMIT_UNEXPECTED_FILE'
              ? `Upload at most ${MAX_FILES_PER_UPLOAD} fonts at a time`
              : 'Upload failed'
        res.status(422).json({ message })
      })
    })
    .catch(next)
}

async function uploadFonts(req, res) {
  const files = req.files || []
  const added = []
  const rejected = []
  try {
    for (const file of files) {
      const fileName = sanitizeFileName(file.originalname)
      const ext = fileName && Path.extname(fileName).toLowerCase()
      if (!fileName || !FONT_EXTENSIONS.has(ext)) {
        rejected.push({
          name: file.originalname,
          reason: 'Only .ttf, .otf, .ttc and .otc files are supported',
        })
        continue
      }
      if (!(await hasFontSignature(file.path))) {
        rejected.push({
          name: file.originalname,
          reason: 'This file is not a valid font',
        })
        continue
      }
      await moveFile(file.path, Path.join(FONTS_DIR, fileName))
      added.push(fileName)
    }
  } finally {
    await Promise.all(
      files.map(file => fs.rm(file.path, { force: true }).catch(() => {}))
    )
  }
  if (added.length > 0) {
    await refreshFontCache()
  }
  res.status(added.length === 0 && rejected.length > 0 ? 422 : 200).json({
    added,
    rejected,
    fonts: await listFonts(),
  })
}

async function isListedFont(fileName) {
  const entries = await fs.readdir(FONTS_DIR).catch(() => [])
  return (
    entries.includes(fileName) &&
    FONT_EXTENSIONS.has(Path.extname(fileName).toLowerCase())
  )
}

async function serveFont(req, res) {
  const fileName = req.params.fileName
  if (!(await isListedFont(fileName))) {
    return res.sendStatus(404)
  }
  res.setHeader('Cache-Control', 'private, max-age=3600')
  res.setHeader('Content-Type', 'application/octet-stream')
  res.sendFile(Path.join(FONTS_DIR, fileName))
}

async function deleteFont(req, res) {
  const fileName = req.params.fileName
  if (!(await isListedFont(fileName))) {
    return res.status(404).json({ message: 'Font not found' })
  }
  await fs.unlink(Path.join(FONTS_DIR, fileName))
  await refreshFontCache()
  res.json({ fonts: await listFonts() })
}

export default {
  fontsPage: expressify(fontsPage),
  listFontsJson: expressify(listFontsJson),
  uploadMiddleware,
  serveFont: expressify(serveFont),
  uploadFonts: expressify(uploadFonts),
  deleteFont: expressify(deleteFont),
}
