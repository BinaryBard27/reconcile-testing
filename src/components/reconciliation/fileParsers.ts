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
          const rows = (results.data ?? []).map((r: any) => {
            const nr: any = {}
            for (const [k, v] of Object.entries(r)) {
              nr[normalizeHeader(k)] = v
            }
            return nr
          })
          const headers = rows.length > 0 ? Object.keys(rows[0]) : []
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
        const rawRows = XLSX.utils.sheet_to_json(worksheet, { defval: '', raw: true })
        const rows = rawRows.map((r: any) => {
          const nr: any = {}
          for (const [k, v] of Object.entries(r)) {
            nr[normalizeHeader(k)] = v
          }
          return nr
        })
        const headers = rows.length > 0 ? Object.keys(rows[0]) : []
        resolve({ headers, rows })
      }
      reader.onerror = reject
      reader.readAsArrayBuffer(file)
      return
    }

    reject(new Error('Unsupported file type. Please upload CSV or Excel files.'))
  })
}

