import { useState } from 'react'
import FileUpload from './FileUpload'
import ColumnMapper from './ColumnMapper'
import { normalizeRows } from './NormalizationEngine'
import * as XLSX from 'xlsx'

export default function DataConversionFlow({ onBack }: { onBack: () => void }) {
  const [rawRows, setRawRows] = useState<any[] | null>(null)
  const [headers, setHeaders] = useState<string[] | null>(null)
  const [fileName, setFileName] = useState('')

  function handleFileLoaded(fileKey: string, parsedRows: any[], headers: string[], fileObj: File) {
    setRawRows(parsedRows)
    setHeaders(headers)
    setFileName(fileObj.name)
  }

  function handleMappingComplete(mapping: any, entryTypeMap: any, mappingConfig: any) {
    const normalized = normalizeRows(rawRows, mapping, entryTypeMap, mappingConfig)
    
    // Export normalized rows to Base Format Excel
    const baseFormatRows = normalized.map((r: any) => ({
      'Date': r.date ? new Date(r.date).toISOString().split('T')[0] : '',
      'Reference': r.refNo,
      'Entry Type': r.entryType,
      'Amount': r.amount,
      'Description': r.narration,
    }))

    const ws = XLSX.utils.json_to_sheet(baseFormatRows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Converted Data')
    XLSX.writeFile(wb, `converted_${fileName || 'data'}.xlsx`)
  }

  if (!rawRows) {
    return (
      <div className="card">
        <button className="btn btn-secondary" onClick={onBack} style={{ marginBottom: 16 }}>Back</button>
        <h2>Data Conversion</h2>
        <p>Upload Tally, SAP, or Zoho data to convert it into LedgerMatch Base Format.</p>
        <FileUpload onFileLoaded={handleFileLoaded} />
      </div>
    )
  }

  return (
    <div className="card">
      <button className="btn btn-secondary" onClick={() => setRawRows(null)} style={{ marginBottom: 16 }}>Cancel</button>
      <ColumnMapper
        headers={headers}
        rawRows={rawRows}
        fileLabel="Data Conversion Mapping"
        onMappingComplete={handleMappingComplete}
      />
    </div>
  )
}
