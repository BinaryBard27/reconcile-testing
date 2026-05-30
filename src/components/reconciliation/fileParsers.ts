import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import { normalizeHeader } from './utils'

export function parseFile(file) {
  return new Promise((resolve, reject) => {
    const fileName = String(file?.name ?? '').toLowerCase()

    if (fileName.endsWith('.csv')) {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          const headers = (results.meta.fields ?? []).map(normalizeHeader)
          const rows = results.data ?? []
          resolve({ headers, rows })
        },
        error: reject,
      })
      return
    }

    if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
      const reader = new FileReader()
      reader.onload = (event) => {
        const data = event.target?.result
        const workbook = XLSX.read(data, { type: 'array' })
        const firstSheet = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[firstSheet]
        const rows = XLSX.utils.sheet_to_json(worksheet, { defval: '', raw: true })
        const headers = rows.length > 0 ? Object.keys(rows[0]).map(normalizeHeader) : []
        resolve({ headers, rows })
      }
      reader.onerror = reject
      reader.readAsArrayBuffer(file)
      return
    }

    reject(new Error('Unsupported file type. Please upload CSV or Excel files.'))
  })
}

