import { useState } from 'react'

const WORDS = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
  'Seventeen', 'Eighteen', 'Nineteen',
]
const TENS = [
  '', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety',
]
const SCALES = ['', 'Thousand', 'Million', 'Billion', 'Trillion']

function convertHundreds(n) {
  const result = []
  if (n >= 100) {
    result.push(WORDS[Math.floor(n / 100)], 'Hundred')
    n %= 100
  }
  if (n >= 20) {
    result.push(TENS[Math.floor(n / 10)])
    n %= 10
  }
  if (n > 0) {
    result.push(WORDS[n])
  }
  return result.join(' ')
}

function numberToWords(num) {
  if (num === 0) return 'Zero'
  const isNegative = num < 0
  num = Math.abs(num)
  const [intPart, decPart] = String(num.toFixed(2)).split('.')
  const intNum = parseInt(intPart, 10)

  let result = ''
  let scaleIndex = 0
  let remaining = intNum

  while (remaining > 0) {
    const chunk = remaining % 1000
    if (chunk > 0) {
      const chunkWords = convertHundreds(chunk)
      result = chunkWords + (SCALES[scaleIndex] ? ' ' + SCALES[scaleIndex] : '') + (result ? ' ' + result : '')
    }
    remaining = Math.floor(remaining / 1000)
    scaleIndex++
  }

  if (isNegative) result = 'Negative ' + result

  const decNum = parseInt(decPart, 10)
  if (decNum > 0) {
    result += ' And ' + convertHundreds(decNum) + ' Cents'
  }

  return result
}

export default function NumberToWords() {
  const [input, setInput] = useState('')
  const amount = parseFloat(input) || 0

  return (
    <div>
      <header className="app-header">
        <h1>Number to Words</h1>
        <p>Convert numeric amounts to words &mdash; useful for checks, invoices, and legal documents.</p>
      </header>

      <div style={{ maxWidth: 500 }}>
        <div className="card" style={{ padding: 24 }}>
          <label>
            Enter Amount
            <input
              type="text"
              inputMode="decimal"
              placeholder="e.g. 1250.75"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              style={{ marginTop: 6 }}
            />
          </label>

          {input && (
            <div className="tool-result">
              <div className="result-label">In Words</div>
              <div className="result-value">{numberToWords(amount)}</div>
            </div>
          )}

          {input && !isNaN(amount) && amount > 0 && (
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 12 }}>
              Numeric value: {amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
