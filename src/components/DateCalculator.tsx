import { useState } from 'react'

function daysBetween(a, b) {
  const da = new Date(a.getFullYear(), a.getMonth(), a.getDate())
  const db = new Date(b.getFullYear(), b.getMonth(), b.getDate())
  return Math.round((db.getTime() - da.getTime()) / (1000 * 60 * 60 * 24))
}

function addDays(date, n) {
  const d = new Date(date)
  d.setDate(d.getDate() + n)
  return d
}

function format(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function getDayName(d) {
  return d.toLocaleDateString('en-US', { weekday: 'long' })
}

export default function DateCalculator() {
  const today = format(new Date())
  const [date1, setDate1] = useState(today)
  const [date2, setDate2] = useState(today)
  const [operation, setOperation] = useState('difference')
  const [daysInput, setDaysInput] = useState('30')
  const [startDate, setStartDate] = useState(today)

  const d1 = new Date(date1 + 'T00:00:00')
  const d2 = new Date(date2 + 'T00:00:00')
  const sd = new Date(startDate + 'T00:00:00')

  const diff = !isNaN(d1.getTime()) && !isNaN(d2.getTime()) ? daysBetween(d1, d2) : null
  const addedDate = !isNaN(sd.getTime()) && !isNaN(parseInt(daysInput))
    ? addDays(sd, parseInt(daysInput))
    : null

  return (
    <div>
      <header className="app-header">
        <h1>Date Calculator</h1>
        <p>Calculate days between dates or add/subtract days from a date.</p>
      </header>

      <div style={{ maxWidth: 500 }}>
        <div className="card" style={{ padding: 24 }}>
          <label style={{ marginBottom: 16 }}>
            <span style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
              <button
                type="button"
                className={`btn btn-sm ${operation === 'difference' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setOperation('difference')}
              >
                Date Difference
              </button>
              <button
                type="button"
                className={`btn btn-sm ${operation === 'add' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setOperation('add')}
              >
                Add / Subtract Days
              </button>
            </span>
          </label>

          {operation === 'difference' ? (
            <>
              <label>
                Start Date
                <input
                  type="date"
                  value={date1}
                  onChange={(e) => setDate1(e.target.value)}
                  style={{ marginTop: 6 }}
                />
              </label>
              <label>
                End Date
                <input
                  type="date"
                  value={date2}
                  onChange={(e) => setDate2(e.target.value)}
                  style={{ marginTop: 6 }}
                />
              </label>
              {diff !== null && (
                <>
                  <div className="tool-result" style={{ marginTop: 16 }}>
                    <div className="result-label">Days Between</div>
                    <div className="result-value">
                      {Math.abs(diff)} day{diff !== 1 ? 's' : ''}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 4 }}>
                      {getDayName(d1)} &rarr; {getDayName(d2)}
                      {diff < 0 ? ' (end date is earlier)' : diff > 0 ? '' : ' (same day)'}
                    </div>
                  </div>
                </>
              )}
            </>
          ) : (
            <>
              <label>
                Start Date
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  style={{ marginTop: 6 }}
                />
              </label>
              <label>
                Days to Add / Subtract
                <input
                  type="number"
                  value={daysInput}
                  onChange={(e) => setDaysInput(e.target.value)}
                  placeholder="e.g. 30 or -15"
                  style={{ marginTop: 6 }}
                />
                <span style={{ fontSize: '0.73rem', color: 'var(--text-muted)', marginTop: 2 }}>
                  Use negative numbers to subtract days.
                </span>
              </label>
              {addedDate && !isNaN(addedDate.getTime()) && (
                <div className="tool-result" style={{ marginTop: 16 }}>
                  <div className="result-label">
                    {parseInt(daysInput) >= 0 ? 'Resulting Date' : 'Resulting Date'}
                  </div>
                  <div className="result-value">
                    {format(addedDate)}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 4 }}>
                    {getDayName(addedDate)}
                    {' \u2022 '}
                    {parseInt(daysInput) >= 0 ? '+' : ''}{daysInput} day{Math.abs(parseInt(daysInput)) !== 1 ? 's' : ''}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
