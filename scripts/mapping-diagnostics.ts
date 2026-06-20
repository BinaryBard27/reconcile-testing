import fs from 'fs'
import path from 'path'
import * as XLSX from 'xlsx'
import Papa from 'papaparse'
import { normalizeHeader } from '../src/components/reconciliation/utils.js'
import { detectFormatAndSuggestMapping, ColumnScore } from '../src/components/reconciliation/autoDetect.js'

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

const testDataDir = path.resolve('./test-data/ext/New folder')
const dirs = fs.readdirSync(testDataDir, { withFileTypes: true }).filter(d => d.isDirectory())

let report = `# Mapping Confidence Report\n\n`
report += `This diagnostic report tests the new Auto-Mapping Scoring Engine across all datasets.\n\n`

function printCandidates(candidates: ColumnScore[]) {
  if (!candidates || candidates.length === 0) return `*No candidates found.*\n`
  let md = `| Column Name | Score | Reason |\n`
  md += `|---|---|---|\n`
  candidates.forEach(c => {
    md += `| \`${c.columnName}\` | ${(c.score * 100).toFixed(1)}% | ${c.reason} |\n`
  })
  return md
}

for (const dir of dirs) {
  const dirPath = path.join(testDataDir, dir.name)
  const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.xlsx') || f.endsWith('.csv') || f.endsWith('.xls'))
  
  for (const f of files) {
    if (f.toLowerCase().includes('scrap') || f.toLowerCase().includes('working') || f.toLowerCase().includes('payment')) continue
    const fp = path.join(dirPath, f)
    const parsed = parseFileSync(fp)
    if (!parsed || parsed.headers.length === 0) continue

    const { format, suggestion, diagnostics } = detectFormatAndSuggestMapping(parsed.headers, parsed.rows)

    report += `\n---\n\n## Dataset: ${dir.name} - ${f}\n`
    report += `- **Detected Format:** ${format}\n`
    if (diagnostics.isConfidenceLow) {
      report += `> [!WARNING]\n> **Mapping Confidence Low** (Score: ${(diagnostics.confidenceScore * 100).toFixed(1)}%)\n\n`
    } else {
      report += `> [!TIP]\n> **Mapping Confidence High** (Score: ${(diagnostics.confidenceScore * 100).toFixed(1)}%)\n\n`
    }

    report += `### Final Selected Mapping\n`
    report += `- **Reference:** \`${suggestion.refNo || 'NOT MAPPED'}\`\n`
    report += `- **Amount:** \`${suggestion.amountINR || (suggestion.debitAmount + ' / ' + suggestion.creditAmount) || 'NOT MAPPED'}\`\n`
    report += `- **Date:** \`${suggestion.date || 'NOT MAPPED'}\`\n`
    report += `- **Entry Type:** \`${suggestion.entryType || 'NOT MAPPED'}\`\n\n`

    report += `### Top Reference Candidates\n`
    report += printCandidates(diagnostics.refNoCandidates.slice(0, 5)) + '\n'

    report += `### Top Amount Candidates\n`
    report += printCandidates(diagnostics.amountCandidates.slice(0, 5)) + '\n'

    report += `### Top Date Candidates\n`
    report += printCandidates(diagnostics.dateCandidates.slice(0, 5)) + '\n'

    report += `### Top Entry Type Candidates\n`
    report += printCandidates(diagnostics.entryTypeCandidates.slice(0, 5)) + '\n'
  }
}

fs.writeFileSync('C:\\Users\\SHERWIN\\.gemini\\antigravity\\brain\\1cd18666-b871-4fe7-82b0-123a533b9287\\mapping-confidence-report.md', report)
console.log('Mapping diagnostics generated.')
