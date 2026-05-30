import { useState } from 'react'

const GST_RATES = [
  { value: 5, label: '5%' },
  { value: 12, label: '12%' },
  { value: 18, label: '18%' },
  { value: 28, label: '28%' },
]

export default function GSTCalculator() {
  const [amount, setAmount] = useState('')
  const [rate, setRate] = useState(18)
  const [mode, setMode] = useState('exclusive')

  const numAmount = parseFloat(amount) || 0

  const calculate = () => {
    if (numAmount <= 0) return null
    if (mode === 'exclusive') {
      const gst = (numAmount * rate) / 100
      return {
        base: numAmount,
        gst,
        total: numAmount + gst,
        label: 'Original Amount (Exclusive)',
      }
    }
    const base = (numAmount * 100) / (100 + rate)
    const gst = numAmount - base
    return {
      base,
      gst,
      total: numAmount,
      label: 'Total Amount (Inclusive)',
    }
  }

  const result = calculate()

  return (
    <div>
      <header className="app-header">
        <h1>GST Calculator</h1>
        <p>Calculate GST amounts for both exclusive and inclusive pricing.</p>
      </header>

      <div style={{ maxWidth: 500 }}>
        <div className="card" style={{ padding: 24 }}>
          <label>
            Amount
            <input
              type="text"
              inputMode="decimal"
              placeholder="Enter amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              style={{ marginTop: 6 }}
            />
          </label>

          <label>
            GST Rate
            <select value={rate} onChange={(e) => setRate(Number(e.target.value))} style={{ marginTop: 6 }}>
              {GST_RATES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>

          <label>
            <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
              <button
                type="button"
                className={`btn btn-sm ${mode === 'exclusive' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setMode('exclusive')}
              >
                Exclusive
              </button>
              <button
                type="button"
                className={`btn btn-sm ${mode === 'inclusive' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setMode('inclusive')}
              >
                Inclusive
              </button>
            </div>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 4 }}>
              {mode === 'exclusive'
                ? 'Amount is before GST'
                : 'Amount already includes GST'}
            </span>
          </label>

          {result && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 16 }}>
              <div className="tool-result" style={{ margin: 0 }}>
                <div className="result-label">{result.label}</div>
                <div className="result-value">
                  {'\u20B9'} {result.base.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
              <div className="tool-result warn" style={{ margin: 0 }}>
                <div className="result-label">GST @ {rate}%</div>
                <div className="result-value">
                  {'\u20B9'} {result.gst.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
              <div className="tool-result" style={{ margin: 0 }}>
                <div className="result-label">Total</div>
                <div className="result-value">
                  {'\u20B9'} {result.total.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
