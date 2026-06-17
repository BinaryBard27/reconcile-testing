import { useState } from 'react'
import DataConversionFlow from './reconciliation/DataConversionFlow'
import ManualRecoFlow from './reconciliation/ManualRecoFlow'

export default function Reconciliation() {
  const [mode, setMode] = useState<'HUB' | 'CONVERT' | 'MANUAL_RECO'>('HUB')

  if (mode === 'CONVERT') {
    return <DataConversionFlow onBack={() => setMode('HUB')} />
  }

  if (mode === 'MANUAL_RECO') {
    return <ManualRecoFlow onBack={() => setMode('HUB')} />
  }

  return (
    <div>
      <header className="app-header" style={{ marginBottom: 24 }}>
        <h1>LedgerMatch Hub</h1>
        <p>Convert ledger data or run advanced reconciliations.</p>
      </header>

      <div style={{ display: 'grid', gap: 20, gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
        <div className="card" style={{ cursor: 'pointer', transition: 'transform 0.2s' }} onClick={() => setMode('CONVERT')}>
          <div style={{ marginBottom: 12 }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><path d="M3 3v5h5"></path><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"></path><path d="M16 21v-5h5"></path></svg>
          </div>
          <h3>Convert File Format</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: 8 }}>
            Convert SAP, Tally or Zoho exports to standard format
          </p>
        </div>
        
        <div className="card" style={{ cursor: 'pointer', transition: 'transform 0.2s' }} onClick={() => setMode('MANUAL_RECO')}>
          <div style={{ marginBottom: 12 }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20"></path><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
          </div>
          <h3>Guided Reconciliation</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: 8 }}>
            Match your books against customer or vendor statements to identify mismatches and missing entries.
          </p>
        </div>
      </div>
    </div>
  )
}
