import { useState, useEffect } from 'react'
import Home from './components/Home'
import Reconciliation from './components/Reconciliation'
import NumberToWords from './components/NumberToWords'
import GSTCalculator from './components/GSTCalculator'
import DateCalculator from './components/DateCalculator'
import PDFConverter from './components/PDFConverter'
import './App.css'
import './Header.css'

const NAV_ITEMS = [
  { id: 'home', label: 'Home', icon: '🏠', section: 'MAIN' },
  { id: 'reconcile', label: 'Match Transactions (PO Calculator)', icon: '🧾', section: 'TOOLS' },
  { id: 'bankmatch', label: 'Bank to Bank Match', icon: '🏦', section: 'TOOLS' },
  { id: 'getcalc', label: 'Get Calculator', icon: '🧮', section: 'TOOLS' },
  { id: 'casecalc', label: 'Case Calculator', icon: '📅', section: 'TOOLS' },
]

function App() {
  const [activeTab, setActiveTab] = useState('home')
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('micro-theme') || 'light'
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('micro-theme', theme)
  }, [theme])

  const toggleTheme = () => setTheme((t) => (t === 'light' ? 'dark' : 'light'))

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="sidebar-brand-icon blue-icon">
             <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                <line x1="8" y1="21" x2="16" y2="21" />
                <line x1="12" y1="17" x2="12" y2="21" />
              </svg>
          </div>
          <span>MixLedger</span>
        </div>

        <nav className="sidebar-nav">
          {NAV_ITEMS.reduce((acc, item, i, arr) => {
            const prev = arr[i - 1]
            if (!prev || prev.section !== item.section) {
              acc.push(
                <div key={`section-${item.section}`} className="nav-section-label">
                  {item.section}
                </div>
              )
            }
            acc.push(
              <button
                key={item.id}
                className={`nav-item${activeTab === item.id ? ' active' : ''}`}
                onClick={() => setActiveTab(item.id)}
              >
                <span className="nav-icon">{item.icon}</span>
                <span>{item.label}</span>
              </button>
            )
            return acc
          }, [] as React.ReactNode[])}
        </nav>
      </aside>

      <main className="main-content">
        <div className="top-header">
           <div className="top-header-right">
             <button className="theme-toggle-btn" onClick={toggleTheme}>
               {theme === 'light' ? '🌙' : '☀️'}
             </button>
           </div>
        </div>
        {activeTab === 'home' && <Home onNavigate={setActiveTab} />}
        {activeTab === 'reconcile' && <Reconciliation />}
        {activeTab === 'pdfconverter' && <PDFConverter />}
        {activeTab === 'num2words' && <NumberToWords />}
        {activeTab === 'gst' && <GSTCalculator />}
        {activeTab === 'datecalc' && <DateCalculator />}
        {activeTab === 'bankmatch' && <div className="page-title"><h1>Bank to Bank Match</h1><p>Tool under construction</p></div>}
        {activeTab === 'getcalc' && <div className="page-title"><h1>Get Calculator</h1><p>Tool under construction</p></div>}
        {activeTab === 'casecalc' && <div className="page-title"><h1>Case Calculator</h1><p>Tool under construction</p></div>}
      </main>
    </div>
  )
}

export default App
