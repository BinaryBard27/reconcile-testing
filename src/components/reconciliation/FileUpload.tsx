import { useId, useRef, useState } from 'react'
import Papa from 'papaparse'
import * as XLSX from 'xlsx'

type ParsedFile = {
  headers: string[]
  rows: Record<string, unknown>[]
  sheetNames?: string[]
  isExcel?: boolean
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

function parseExcel(file: File, sheetName?: string, headerRow = 1): Promise<ParsedFile> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const data = event.target?.result
        const wb = XLSX.read(data, { type: 'array' })
        const targetSheet = sheetName || wb.SheetNames[0]
        const ws = wb.Sheets[targetSheet]

        // header:1 gives AoA
        const aoa = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '' })
        const hrIdx = Math.max(0, headerRow - 1)
        const headers = (aoa?.[hrIdx] ?? []).map((h) => String(h ?? '').trim()).filter(Boolean)
        const dataRows = (aoa ?? []).slice(hrIdx + 1)

        const rows = dataRows
          .filter((r) => Array.isArray(r) && r.some((cell) => String(cell ?? '').trim() !== ''))
          .map((r) => {
            const obj: Record<string, unknown> = {}
            headers.forEach((h, idx) => {
              obj[h] = r?.[idx] ?? ''
            })
            return obj
          })

        resolve({ headers, rows, sheetNames: wb.SheetNames, isExcel: true })
      } catch (e) {
        reject(e)
      }
    }
    reader.onerror = reject
    reader.readAsArrayBuffer(file)
  })
}

async function parseFile(file: File, sheetName?: string, headerRow?: number): Promise<ParsedFile> {
  const name = String(file?.name ?? '').toLowerCase()
  if (name.endsWith('.csv')) return parseCsv(file)
  if (name.endsWith('.xlsx') || name.endsWith('.xls')) return parseExcel(file, sheetName, headerRow)
  throw new Error('Unsupported file type. Please upload CSV or Excel files.')
}

function UploadCard({ title, fileKey, onFileLoaded }) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [info, setInfo] = useState<{ name: string; rowCount: number; colsPreview: string[]; totalCols: number } | null>(null)
  const [error, setError] = useState('')
  const [dragOver, setDragOver] = useState(false)
  
  const [currentFile, setCurrentFile] = useState<File | null>(null)
  const [selectedSheet, setSelectedSheet] = useState('')
  const [headerRow, setHeaderRow] = useState(1)
  const [sheetNames, setSheetNames] = useState<string[]>([])
  const [isExcel, setIsExcel] = useState(false)
  
  const id = useId()

  async function handleFileDrop(file: File) {
    setCurrentFile(file)
    setSelectedSheet('')
    setHeaderRow(1)
    setSheetNames([])
    setIsExcel(false)
    await handleParse(file, '', 1)
  }

  async function handleParse(file: File, sheet: string, hr: number) {
    setError('')
    setInfo(null)
    if (!file) return
    try {
      const parsed = await parseFile(file, sheet, hr)
      if (parsed.isExcel) {
         setIsExcel(true)
         setSheetNames(parsed.sheetNames || [])
         setSelectedSheet(sheet || parsed.sheetNames?.[0] || '')
      } else {
         setIsExcel(false)
         setSheetNames([])
      }
      setInfo({
        name: file.name,
        rowCount: parsed.rows.length,
        colsPreview: parsed.headers.slice(0, 3),
        totalCols: parsed.headers.length,
      })
      onFileLoaded(fileKey, parsed.rows, parsed.headers, file)
    } catch (e: any) {
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
          if (f) handleFileDrop(f)
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
            if (f) handleFileDrop(f)
            e.target.value = ''
          }}
        />
      </div>

      {error && (
        <div className="tool-result warn" style={{ marginTop: 12 }}>
          {error}
        </div>
      )}

      {isExcel && info && (
        <div style={{ marginTop: 12, padding: 12, background: 'var(--bg-elevated)', borderRadius: 6, border: '1px solid var(--border-light)' }}>
          {sheetNames.length > 1 && (
            <label className="mapper-field" style={{ marginBottom: 8 }}>
              <span>Sheet</span>
              <select 
                value={selectedSheet} 
                onChange={(e) => {
                  const s = e.target.value
                  setSelectedSheet(s)
                  if (currentFile) handleParse(currentFile, s, headerRow)
                }}
              >
                {sheetNames.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
          )}
          <label className="mapper-field" style={{ marginBottom: 0 }}>
            <span>Header Row</span>
            <input 
              type="number" 
              min={1} 
              max={10} 
              value={headerRow} 
              onChange={(e) => {
                const hr = parseInt(e.target.value) || 1
                setHeaderRow(hr)
                if (currentFile) handleParse(currentFile, selectedSheet, hr)
              }}
            />
          </label>
        </div>
      )}

      {info && (
        <div style={{ marginTop: 10, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
          <div style={{ fontWeight: 700, color: 'var(--text-h)' }}>{info.name}</div>
          <div>{info.rowCount.toLocaleString('en-IN')} rows</div>
          <div>
            Columns: {info.colsPreview.join(', ')}
            {info.totalCols > 3 ? ` (+${info.totalCols - 3} more)` : ''}
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
