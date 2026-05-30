import { useId, useRef, useState } from 'react'
import Papa from 'papaparse'
import * as XLSX from 'xlsx'

type ParsedFile = {
  headers: string[]
  rows: Record<string, unknown>[]
}

function parseCsv(file: File): Promise<ParsedFile> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const headers = results.meta?.fields ?? []
        const rows = (results.data ?? []) as Record<string, unknown>[]
        resolve({ headers, rows })
      },
      error: reject,
    })
  })
}

function parseExcel(file: File): Promise<ParsedFile> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const data = event.target?.result
        const wb = XLSX.read(data, { type: 'array' })
        const sheetName = wb.SheetNames[0]
        const ws = wb.Sheets[sheetName]

        // header:1 gives AoA; row[0] is headers
        const aoa = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '' })
        const headers = (aoa?.[0] ?? []).map((h) => String(h ?? '').trim()).filter(Boolean)
        const dataRows = (aoa ?? []).slice(1)

        const rows = dataRows
          .filter((r) => Array.isArray(r) && r.some((cell) => String(cell ?? '').trim() !== ''))
          .map((r) => {
            const obj: Record<string, unknown> = {}
            headers.forEach((h, idx) => {
              obj[h] = r?.[idx] ?? ''
            })
            return obj
          })

        resolve({ headers, rows })
      } catch (e) {
        reject(e)
      }
    }
    reader.onerror = reject
    reader.readAsArrayBuffer(file)
  })
}

async function parseFile(file: File): Promise<ParsedFile> {
  const name = String(file?.name ?? '').toLowerCase()
  if (name.endsWith('.csv')) return parseCsv(file)
  if (name.endsWith('.xlsx') || name.endsWith('.xls')) return parseExcel(file)
  throw new Error('Unsupported file type. Please upload CSV or Excel files.')
}

function UploadCard({ title, fileKey, onFileLoaded }) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [info, setInfo] = useState<{ name: string; rowCount: number; colsPreview: string[] } | null>(null)
  const [error, setError] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const id = useId()

  async function handleFile(file) {
    setError('')
    setInfo(null)
    if (!file) return
    try {
      const parsed = await parseFile(file)
      setInfo({
        name: file.name,
        rowCount: parsed.rows.length,
        colsPreview: parsed.headers.slice(0, 3),
      })
      onFileLoaded(fileKey, parsed.rows, parsed.headers, file)
    } catch (e) {
      setError(e?.message ?? String(e))
    }
  }

  return (
    <div>
      <div
        className={`upload-card ${dragOver ? '' : ''}`}
        style={dragOver ? { borderColor: 'var(--accent)', boxShadow: 'var(--accent-glow) 0 0 0 4px' } : undefined}
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragOver(false)
          const f = e.dataTransfer.files?.[0]
          if (f) handleFile(f)
        }}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click()
        }}
        aria-label={`${title} upload`}
      >
        <div className="upload-icon">{info ? '✓' : '⬆'}</div>
        <span>{title}</span>
        <small>Drag & drop or click to upload (CSV/XLS/XLSX)</small>
        <input
          ref={inputRef}
          id={id}
          type="file"
          accept=".csv,.xlsx,.xls"
          style={{ display: 'none' }}
          onChange={(e) => {
            const f = e.target.files?.[0] ?? null
            handleFile(f)
            e.target.value = ''
          }}
        />
      </div>

      {error && (
        <div className="tool-result warn" style={{ marginTop: 12 }}>
          {error}
        </div>
      )}

      {info && (
        <div style={{ marginTop: 10, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
          <div style={{ fontWeight: 700, color: 'var(--text-h)' }}>{info.name}</div>
          <div>{info.rowCount.toLocaleString('en-IN')} rows</div>
          <div>
            Columns: {info.colsPreview.join(', ')}
            {info.rowCount > 0 && info.colsPreview.length === 3 ? '…' : ''}
          </div>
        </div>
      )}
    </div>
  )
}

export default function FileUpload({ onFileLoaded }) {
  return (
    <div>
      <div className="upload-grid">
        <UploadCard title="Upload Our Books" fileKey="our" onFileLoaded={onFileLoaded} />
        <UploadCard title="Upload Customer/Party Books" fileKey="party" onFileLoaded={onFileLoaded} />
      </div>
    </div>
  )
}
