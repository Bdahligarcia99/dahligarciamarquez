import { Request, Response, NextFunction } from 'express'
import { Readable } from 'stream'

/**
 * Extended request interface with file data
 */
export interface MulterRequest extends Request {
  file?: Express.Multer.File
  body: any
}

/**
 * Simple multipart parser middleware (alternative to multer)
 */
export function parseMultipartForm(req: MulterRequest, res: Response, next: NextFunction): void {
  const contentType = req.headers['content-type']
  
  if (!contentType || !contentType.includes('multipart/form-data')) {
    return next()
  }

  // Extract boundary
  const boundary = contentType.split('boundary=')[1]
  if (!boundary) {
    return res.status(400).json({ error: 'Invalid multipart boundary' })
  }

  let body = Buffer.alloc(0)
  const maxSize = 10 * 1024 * 1024 // 10MB max request size

  req.on('data', (chunk: Buffer) => {
    body = Buffer.concat([body, chunk])
    if (body.length > maxSize) {
      return res.status(413).json({ error: 'Request too large' })
    }
  })

  req.on('end', () => {
    try {
      const parsed = parseMultipartBody(body, boundary)
      req.body = parsed.fields
      req.file = parsed.file
      next()
    } catch (error: any) {
      console.error('Multipart parsing error:', error)
      res.status(400).json({ error: 'Invalid multipart data' })
    }
  })

  req.on('error', (error) => {
    console.error('Request error:', error)
    res.status(400).json({ error: 'Request error' })
  })
}

/**
 * Parses multipart body manually
 */
function parseMultipartBody(body: Buffer, boundary: string): { fields: any; file?: Express.Multer.File } {
  const fields: any = {}
  let file: Express.Multer.File | undefined

  const boundaryBuffer = Buffer.from(`--${boundary}`)
  const parts = splitBuffer(body, boundaryBuffer)

  for (const part of parts) {
    if (part.length === 0) continue

    const headerEndIndex = part.indexOf('\r\n\r\n')
    if (headerEndIndex === -1) continue

    const headerSection = part.slice(0, headerEndIndex).toString()
    const contentSection = part.slice(headerEndIndex + 4)

    // Parse Content-Disposition header
    const dispositionMatch = headerSection.match(/Content-Disposition:\s*form-data;\s*name="([^"]+)"(?:;\s*filename="([^"]+)")?/i)
    if (!dispositionMatch) continue

    const fieldName = dispositionMatch[1]
    const filename = dispositionMatch[2]

    if (filename) {
      // This is a file field
      const contentTypeMatch = headerSection.match(/Content-Type:\s*([^\r\n]+)/i)
      const mimeType = contentTypeMatch ? contentTypeMatch[1].trim() : 'application/octet-stream'

      file = {
        fieldname: fieldName,
        originalname: filename,
        encoding: '7bit',
        mimetype: mimeType,
        buffer: contentSection,
        size: contentSection.length,
        destination: '',
        filename: '',
        path: '',
        stream: new Readable()
      }
    } else {
      // This is a regular field
      fields[fieldName] = contentSection.toString('utf8').trim()
    }
  }

  return { fields, file }
}

/**
 * Splits buffer by delimiter
 */
function splitBuffer(buffer: Buffer, delimiter: Buffer): Buffer[] {
  const parts: Buffer[] = []
  let start = 0
  let index = 0

  while (index < buffer.length) {
    const foundIndex = buffer.indexOf(delimiter, index)
    if (foundIndex === -1) {
      // Last part
      if (start < buffer.length) {
        parts.push(buffer.slice(start))
      }
      break
    }

    // Add part (excluding delimiter)
    if (foundIndex > start) {
      parts.push(buffer.slice(start, foundIndex))
    }

    start = foundIndex + delimiter.length
    index = start
  }

  return parts
}
