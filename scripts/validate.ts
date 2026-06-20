import fs from 'fs'
import path from 'path'
import * as XLSX from 'xlsx'
import Papa from 'papaparse'
import { normalizeHeader } from '../src/components/reconciliation/utils.js'
import { detectFormatAndSuggestMapping } from '../src/components/reconciliation/autoDetect.js'
import { normalizeRows, separateOpeningBalance } from '../src/components/reconciliation/NormalizationEngine.js'
import { reconcileInvoices, buildDetailedSummary } from '../src/components/reconciliation/ReconciliationEngine.js'
import { ENTRY_TYPES } from '../src/components/reconciliation/constants.js'

function smartDefaultForValue(value: string, narrationSamples: string[]): string {
  const s = String(value).toLowerCase().trim()
  const tdsKeywords = ['tds', '194c', '194j', '194h', '194i', '194q', 'tax deducted', 'tax deduction', 'withheld']
  const hasTDSInValue = tdsKeywords.some(k => s.includes(k))
  const hasTDSInNarration = (narrationSamples || []).some(n => 
    tdsKeywords.some(k => String(n).toLowerCase().includes(k))
  )
  if (hasTDSInValue || hasTDSInNarration) return 'tds'
  if (['dz', 'kz', 'payment', 'receipt', 'pay', 'bank', 'cash'].some(x => s.includes(x))) return 'payment'
  if (['dr', 'rv', 'sales', 'invoice', 'inv', 'purchase invoice'].some(x => s.includes(x))) return 'invoice'
  if (['dg', 'credit note', 'cn', 'debit note'].some(x => s.includes(x))) return 'credit_note'
  if (['dy', 'da', 'xc', 'sa', 'journal', 'adj', 'knock', 'contra'].some(x => s.includes(x))) return 'adjustment'
  return 'ignore'
}

function uniq(arr: any[]) {
  return [...new Set(arr.map(x => String(x ?? '').trim()).filter(Boolean))]
}

function parseFileSync(filePath: string) {
  const ext = path.extname(filePath).toLowerCase()
  if (ext === '.csv') {
    const content = fs.readFileSync(filePath, 'utf-8')
    const results = Papa.parse(content, { header: true, skipEmptyLines: true })
    const headers = (results.meta.fields ?? []).map(normalizeHeader)
    return { headers, rows: results.data }
  } else if (ext === '.xlsx' || ext === '.xls') {
    const data = fs.readFileSync(filePath)
    const workbook = XLSX.read(data, { type: 'buffer' })
    const firstSheet = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[firstSheet]
    const rows = XLSX.utils.sheet_to_json(worksheet, { defval: '', raw: true })
    const headers = rows.length > 0 ? Object.keys(rows[0] as any).map(normalizeHeader) : []
    return { headers, rows }
  }
  return null
}

function buildEntryTypeMap(mapping: any, rawRows: any[]) {
  const map: Record<string, string> = {}
  if (!mapping.entryType) return map
  
  const vals = rawRows.map(r => r?.[mapping.entryType])
  const uniqueVals = uniq(vals)
  
  for (const v of uniqueVals) {
    let sampleNarrations: string[] = []
    if (mapping.narration) {
      const rowsWithValue = rawRows.filter(r => r?.[mapping.entryType] === v)
      sampleNarrations = rowsWithValue.slice(0, 5).map(r => r?.[mapping.narration]).filter(Boolean) as string[]
    }
    map[v] = smartDefaultForValue(v, sampleNarrations)
  }
  return map
}

function processFile(filePath: string) {
  const parsed = parseFileSync(filePath)
  if (!parsed) return null
  
  const { format, suggestion } = detectFormatAndSuggestMapping(parsed.headers, parsed.rows)
  const entryTypeMap = buildEntryTypeMap(suggestion, parsed.rows)
  
  const normalized = normalizeRows(parsed.rows, suggestion, entryTypeMap, { amountLogic: suggestion.amountLogic })
  const { transactionRows, openingBalanceRows } = separateOpeningBalance(normalized)
  
  return {
    name: path.basename(filePath),
    format,
    mapping: suggestion,
    entryTypeMap,
    normalizedRows: transactionRows,
    openingBalance: openingBalanceRows
  }
}

const testDataDir = path.resolve('./test-data/ext/New folder')
if (!fs.existsSync(testDataDir)) {
  console.error("Test data not found. Please extract 'New folder.zip' to 'test-data/ext/'.")
  process.exit(1)
}

const dirs = fs.readdirSync(testDataDir, { withFileTypes: true }).filter(d => d.isDirectory())

console.log('--- MICROLEDGER VALIDATION FRAMEWORK ---')

let totalProcessed = 0
let totalMatched = 0
let totalTDS = 0
let totalMismatch = 0

for (const dir of dirs) {
  const dirPath = path.join(testDataDir, dir.name)
  const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.xlsx') || f.endsWith('.csv') || f.endsWith('.xls'))
  
  let ourBooks = null
  let partyLedger = null
  
  for (const f of files) {
    // Skip known purely supplementary files based on name heuristic
    if (f.toLowerCase().includes('scrap') || f.toLowerCase().includes('working') || f.toLowerCase().includes('payment')) {
      continue
    }
    
    const fp = path.join(dirPath, f)
    const result = processFile(fp)
    if (!result) continue
    
    if (String(result.format).includes('SAP')) {
      if (!ourBooks) ourBooks = result
    } else {
      if (!partyLedger) partyLedger = result
    }
  }
  
  if (!ourBooks && files.length >= 2) {
    ourBooks = processFile(path.join(dirPath, files[0]))
    partyLedger = processFile(path.join(dirPath, files[1]))
  }

  if (!ourBooks || !partyLedger) {
    console.log(`\n[SKIPPED] ${dir.name} - Could not identify Our Books vs Party Ledger`)
    continue
  }

  console.log(`\n[DATASET] ${dir.name}`)
  console.log(`  Our Books: ${ourBooks.name} (${ourBooks.format}) - ${ourBooks.normalizedRows.length} rows`)
  console.log(`  Party Ledger: ${partyLedger.name} (${partyLedger.format}) - ${partyLedger.normalizedRows.length} rows`)

  const results = reconcileInvoices(ourBooks.normalizedRows, partyLedger.normalizedRows)
  const summary = buildDetailedSummary(results, ourBooks.normalizedRows, partyLedger.normalizedRows, ourBooks.openingBalance, partyLedger.openingBalance)
  
  console.log(`  Metrics:`)
  console.log(`    Total Reconciled: ${summary.totalRows}`)
  console.log(`    Matched: ${summary.matched}`)
  console.log(`    TDS Flagged: ${summary.tdsFlagged}`)
  console.log(`    Amount Mismatches: ${summary.mismatch}`)
  console.log(`    Missing in Ours: ${summary.missingInOurs}`)
  console.log(`    Missing in Party: ${summary.missingInParty}`)
  
  totalProcessed++
  totalMatched += summary.matched
  totalTDS += summary.tdsFlagged
  totalMismatch += summary.mismatch
}

console.log('\n--- SUMMARY ---')
console.log(`Datasets Processed: ${totalProcessed}`)
console.log(`Total Matched Invoices: ${totalMatched}`)
console.log(`Total TDS Detections: ${totalTDS}`)
console.log(`Total Amount Mismatches: ${totalMismatch}`)
