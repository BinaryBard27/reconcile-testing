import { useState } from 'react'
import FileUpload from './FileUpload'
import ColumnMapper from './ColumnMapper'
import { detectFormatAndSuggestMapping } from './autoDetect'
import { normalizeRows } from './NormalizationEngine'
import * as XLSX from 'xlsx'

const STANDARD_COLUMNS = [
  'Reference No',
  'Entry Type',
  'Date',
  'Amount',
  'Currency',
  'Narration'
]

function formatDate(d: any): string {
  if (!d) return ''
  try {
    const dt = d instanceof Date ? d : new Date(d)
    if (isNaN(dt.getTime())) return ''
    const y = dt.getFullYear()
    const m = String(dt.getMonth() + 1).padStart(2, '0')
    const day = String(dt.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  } catch {
    return ''
  }
}

function StandardPreviewTable({ rows }: { rows: any[] }) {
  const preview = rows.slice(0, 10)

  return (
    <div style={{ overflowX: 'auto', marginTop: 20 }}>
      <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8 }}>
        Preview — First {Math.min(10, rows.length)} of {rows.length} rows
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 800 }}>
        <thead>
          <tr>
            {STANDARD_COLUMNS.map(col => (
              <th key={col} style={{
                background: 'var(--bg-elevated)', padding: '10px 14px',
                fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase',
                letterSpacing: '0.04em', color: 'var(--text-muted)', textAlign: 'left',
                borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap',
              }}>{col}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {preview.map((row, idx) => (
            <tr key={idx} style={{ borderBottom: '1px solid var(--border-light)' }}>
              <td style={{ padding: '10px 14px', fontSize: '0.85rem', fontWeight: 700 }}>{row['Reference No']}</td>
              <td style={{ padding: '10px 14px', fontSize: '0.85rem' }}>{row['Entry Type']}</td>
              <td style={{ padding: '10px 14px', fontSize: '0.85rem' }}>{row['Date']}</td>
              <td style={{ padding: '10px 14px', fontSize: '0.85rem', fontVariantNumeric: 'tabular-nums' }}>
                {row['Amount'] ? Number(row['Amount']).toLocaleString('en-IN', { maximumFractionDigits: 2 }) : ''}
              </td>
              <td style={{ padding: '10px 14px', fontSize: '0.85rem' }}>{row['Currency']}</td>
              <td style={{ padding: '10px 14px', fontSize: '0.85rem', maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row['Narration']}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function DataConversionFlow({ onBack }: { onBack: () => void }) {
  const [step, setStep] = useState<'UPLOAD' | 'MAP' | 'PREVIEW'>('UPLOAD')
  const [rawRows, setRawRows] = useState<any[] | null>(null)
  const [headers, setHeaders] = useState<string[]>([])
  const [fileName, setFileName] = useState('')
  const [standardRows, setStandardRows] = useState<any[]>([])
  const [detectedFormat, setDetectedFormat] = useState('')

  function handleFileLoaded(_fileKey: string, parsedRows: any[], fileHeaders: string[], file: File) {
    setRawRows(parsedRows)
    setHeaders(fileHeaders)
    setFileName(file.name)

    const { format } = detectFormatAndSuggestMapping(fileHeaders, parsedRows)
    setDetectedFormat(format)
    setStep('MAP')
  }

  function handleMappingComplete(mapping: any, entryTypeMap: any, mappingConfig: any) {
    const normalized = normalizeRows(rawRows, mapping, entryTypeMap, mappingConfig)
    
    const stdRows = normalized.map((r: any) => ({
      'Reference No': r.rawRefNo || r.refNo || '',
      'Entry Type': r.entryType || '',
      'Date': formatDate(r.date),
      'Amount': r.amount || '',
      'Currency': r.detectedCurrency || 'INR',
      'Narration': r.narration || ''
    }))
    
    setStandardRows(stdRows)
    setStep('PREVIEW')
  }

  function downloadStandardFormat() {
    const ws = XLSX.utils.json_to_sheet(standardRows, { header: STANDARD_COLUMNS })

    // Set column widths
    ws['!cols'] = STANDARD_COLUMNS.map(col => ({
      wch: col === 'Narration' ? 40 : col === 'Reference No' ? 20 : 16
    }))

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'LedgerMatch Standard Format')

    const baseName = fileName.replace(/\.(csv|xlsx?)/i, '')
    XLSX.writeFile(wb, `${baseName}_standard_format.xlsx`)
  }

  if (step === 'PREVIEW' && standardRows.length > 0) {
    return (
      <div className="card">
        <button className="btn btn-secondary" onClick={() => setStep('MAP')} style={{ marginBottom: 16 }}>Back to Mapping</button>
        
        <header className="app-header" style={{ marginBottom: 16 }}>
          <h1 style={{ fontSize: '1.25rem' }}>Standard Format Preview</h1>
          <p>
            Converted <strong>{fileName}</strong> ({detectedFormat} format) — <strong>{standardRows.length}</strong> rows standardized
          </p>
        </header>

        <div className="results" style={{ marginBottom: 20 }}>
          <StandardPreviewTable rows={standardRows} />
        </div>

        <div className="actions" style={{ justifyContent: 'flex-end' }}>
          <button className="btn btn-success" onClick={downloadStandardFormat}>
            Download Standard Format
          </button>
        </div>
      </div>
    )
  }

  if (step === 'MAP' && rawRows) {
    return (
      <div className="card">
        <button className="btn btn-secondary" onClick={() => { setStep('UPLOAD'); setRawRows(null) }} style={{ marginBottom: 16 }}>Back</button>
        
        {detectedFormat && (
          <div style={{ marginBottom: 16 }}>
            <div className={`detection-panel ${detectedFormat !== 'CUSTOM' && detectedFormat !== 'GENERIC' ? 'detection-success' : 'detection-warning'}`}>
              <div>🔍 Format detected: <strong>{detectedFormat === 'CUSTOM' || detectedFormat === 'GENERIC' ? 'Custom / Unknown' : `${detectedFormat} Ledger`}</strong></div>
              <div>📊 {rawRows.length.toLocaleString('en-IN')} rows loaded from <strong>{fileName}</strong></div>
              <div>💡 Verify the mapping below and click Confirm</div>
            </div>
          </div>
        )}

        <ColumnMapper
          headers={headers}
          rawRows={rawRows}
          fileLabel="Quick Convert"
          onMappingComplete={handleMappingComplete}
        />
      </div>
    )
  }

  return (
    <div className="card">
      <button className="btn btn-secondary" onClick={onBack} style={{ marginBottom: 16 }}>Back</button>
      <header className="app-header" style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: '1.25rem' }}>Upload Ledger File</h1>
        <p>Upload any SAP, Tally, Zoho or custom ledger export (CSV, XLS, XLSX)</p>
      </header>
      <FileUpload onFileLoaded={handleFileLoaded} singleMode title="Upload Ledger File" fileKey="quick" />
    </div>
  )
}
