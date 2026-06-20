import fs from 'fs'
import path from 'path'
import * as XLSX from 'xlsx'
import Papa from 'papaparse'
import { normalizeHeader } from '../src/components/reconciliation/utils.js'
import { detectFormatAndSuggestMapping } from '../src/components/reconciliation/autoDetect.js'
import { normalizeRows, separateOpeningBalance } from '../src/components/reconciliation/NormalizationEngine.js'
import { reconcileInvoices, buildDetailedSummary } from '../src/components/reconciliation/ReconciliationEngine.js'

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
    const rows = (results.data ?? []).map((r: any) => {
      const nr: any = {}
      for (const [k, v] of Object.entries(r)) {
        nr[normalizeHeader(k)] = v
      }
      return nr
    })
    const headers = rows.length > 0 ? Object.keys(rows[0] as any) : []
    return { headers, rows }
  } else if (ext === '.xlsx' || ext === '.xls') {
    const data = fs.readFileSync(filePath)
    const workbook = XLSX.read(data, { type: 'buffer' })
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
    if (path.basename(path.dirname(filePath)).includes('SIDDHARTHA')) {
      // console.log('SIDDHARTHA partyData[0]:', rows[0])
    }
    const headers = rows.length > 0 ? Object.keys(rows[0] as any) : []
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
  if (!parsed || parsed.headers.length === 0) return null
  
  const { format, suggestion, diagnostics } = detectFormatAndSuggestMapping(parsed.headers, parsed.rows)
  const entryTypeMap = buildEntryTypeMap(suggestion, parsed.rows)
  
  const normalized = normalizeRows(parsed.rows, suggestion, entryTypeMap, { amountLogic: suggestion.amountLogic }, format)
  const { transactionRows, openingBalanceRows } = separateOpeningBalance(normalized)
  
  return {
    name: path.basename(filePath),
    format,
    mapping: suggestion,
    diagnostics,
    entryTypeMap,
    normalizedRows: transactionRows,
    openingBalance: openingBalanceRows,
    rawRowCount: parsed.rows.length
  }
}

const baseline: Record<string, any> = {
  "10. SHAH TC GLOBAL EXIM LLP": { exact: 0, coverage: 0.0 },
  "11. SCOPE LOGISTICS SERVICES INDIA PVT": { exact: 0, coverage: 0.0 },
  "12. STREAM LINE LOGISTICS PVT.LTD": { exact: 0, coverage: 0.0 },
  "15. SIDDHARTHA LOGISTICS FTWZ PRIVATE": { exact: 157, coverage: 77.0 },
  "16. SCOPE CHEMICALS PVT.LTD": { exact: 0, coverage: 0.0 },
  "19. BARNET INDIA PRIVATE LIMITED": { exact: 0, coverage: 0.0 },
  "22. DELIGHT LOGISTICS PRIVATE LIMITED": { exact: 0, coverage: 0.0 },
  "23. SML Limited": { exact: 0, coverage: 0.0 },
  "24. Hub Sports Ltd": { exact: 0, coverage: 0.0 },
  "4. BASF INDIA LIMITED": { exact: 0, coverage: 0.0 },
  "6. ONNSYNEX VENTURES PVT.LTD": { exact: 0, coverage: 0.0 },
  "7. SRIKARAM PRESCIENCE PVT. LTD": { exact: 0, coverage: 0.0 },
  "9. KUEHNE NAGEL PVT. LTD": { exact: 0, coverage: 0.0 }
};

const testDataDir = path.resolve('./test-data/ext/New folder')
const dirs = fs.readdirSync(testDataDir, { withFileTypes: true }).filter(d => d.isDirectory())

let report = `# MicroLedger Reconciliation Regression Report\n\n`
report += `| Dataset Name | Format (Ours/Party) | Confidence | Records | Invoices Extracted | Payments Extracted | Exact | Fuzzy | TDS | Missing (Party) | Missing (Ours) | Match Rate | Coverage | Δ Exact | Δ Coverage |\n`
report += `|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|\n`

const resultsList = [];

for (const dir of dirs) {
  const dirPath = path.join(testDataDir, dir.name)
  const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.xlsx') || f.endsWith('.csv') || f.endsWith('.xls'))
  
  let ourBooks = null
  let partyLedger = null
  
  for (const f of files) {
    if (f.toLowerCase().includes('scrap') || f.toLowerCase().includes('working') || f.toLowerCase().includes('payment')) continue
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

  if (!ourBooks || !partyLedger) continue

  if (dir.name.includes('SIDDHARTHA')) {
    console.log(`SIDDHARTHA DEBUG:`)
    console.log(`OurBooks mapping:`, ourBooks.mapping)
    console.log(`PartyLedger mapping:`, partyLedger.mapping)
    console.log(`PartyLedger format:`, partyLedger.format)
    console.log(`PartyLedger first row raw:`, partyLedger.normalizedRows[0]?.rawRow)
    console.log(`PartyLedger first row normalized:`, partyLedger.normalizedRows[0])
  }

  const results = reconcileInvoices(ourBooks.normalizedRows, partyLedger.normalizedRows)
  const summary = buildDetailedSummary(results, ourBooks.normalizedRows, partyLedger.normalizedRows, ourBooks.openingBalance, partyLedger.openingBalance)
  
  const ourInv = ourBooks.normalizedRows.filter(r => r.entryType === 'invoice').length
  const ourPay = ourBooks.normalizedRows.filter(r => r.entryType === 'payment').length
  const ptyInv = partyLedger.normalizedRows.filter(r => r.entryType === 'invoice').length
  const ptyPay = partyLedger.normalizedRows.filter(r => r.entryType === 'payment').length

  const matchRate = (summary.matched / Math.max(1, ourInv + ptyInv)) * 100
  const coverage = (summary.matched / Math.max(1, ourBooks.normalizedRows.length)) * 100

  const b = baseline[dir.name] || { exact: 0, coverage: 0.0 }
  const deltaExact = summary.matched - b.exact
  const deltaCoverage = coverage - b.coverage
  
  const formatStr = `${ourBooks.format.replace('Auto-detected: ', '').replace(' Format', '')} / ${partyLedger.format.replace('Auto-detected: ', '').replace(' Format', '')}`
  const avgConf = ((ourBooks.diagnostics.confidenceScore + partyLedger.diagnostics.confidenceScore) / 2 * 100).toFixed(1)

  resultsList.push({
    name: dir.name,
    formatStr,
    avgConf,
    recordsStr: `${ourBooks.rawRowCount}/${partyLedger.rawRowCount}`,
    invStr: `${ourInv}/${ptyInv}`,
    payStr: `${ourPay}/${ptyPay}`,
    exact: summary.matched,
    fuzzy: summary.fuzzyMatched || 0,
    tds: summary.tdsFlagged,
    missParty: summary.missingInParty,
    missOurs: summary.missingInOurs,
    matchRate: matchRate.toFixed(1),
    coverage: coverage.toFixed(1),
    deltaExact,
    deltaCoverage
  })
}

// Rank datasets by improvement (Delta Exact Matches desc)
resultsList.sort((a, b) => b.deltaExact - a.deltaExact)

for (const r of resultsList) {
  const deltaExactStr = r.deltaExact > 0 ? `+${r.deltaExact}` : r.deltaExact.toString()
  const deltaCovStr = r.deltaCoverage > 0 ? `+${r.deltaCoverage.toFixed(1)}%` : `${r.deltaCoverage.toFixed(1)}%`
  report += `| ${r.name} | ${r.formatStr} | ${r.avgConf}% | ${r.recordsStr} | ${r.invStr} | ${r.payStr} | ${r.exact} | ${r.fuzzy} | ${r.tds} | ${r.missParty} | ${r.missOurs} | ${r.matchRate}% | ${r.coverage}% | **${deltaExactStr}** | **${deltaCovStr}** |\n`
}

fs.writeFileSync('C:\\Users\\SHERWIN\\.gemini\\antigravity\\brain\\1cd18666-b871-4fe7-82b0-123a533b9287\\reconciliation-regression-report.md', report)
console.log('Regression report generated.')
