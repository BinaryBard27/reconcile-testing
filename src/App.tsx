import { useState, useEffect } from 'react'
import Reconciliation from './components/Reconciliation'
import NumberToWords from './components/NumberToWords'
import GSTCalculator from './components/GSTCalculator'
import DateCalculator from './components/DateCalculator'
import PDFConverter from './components/PDFConverter'
import './App.css'

const NAV_ITEMS = [
  { id: 'reconcile', label: 'Reconciliation', icon: '⚖️', section: 'Core' },
  { id: 'pdfconverter', label: 'Bank Statement to PDF Converter', icon: '📄', section: 'Tools' },
  { id: 'num2words', label: 'Number to Words', icon: '🔢', section: 'Tools' },
  { id: 'gst', label: 'GST Calculator', icon: '📈', section: 'Tools' },
  { id: 'datecalc', label: 'Date Calculator', icon: '📅', section: 'Tools' },
]

function App() {
  const [activeTab, setActiveTab] = useState('reconcile')
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
          <div className="sidebar-brand-icon">{'\uD83D\uDCCA'}</div>
          <span>MicroLedger</span>
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
          }, [])}
        </nav>

        <div className="sidebar-footer">
          <button className="theme-toggle" onClick={toggleTheme}>
            <span className="nav-icon">{theme === 'light' ? '\uD83C\uDF19' : '\u2600\uFE0F'}</span>
            <span>{theme === 'light' ? 'Dark Mode' : 'Light Mode'}</span>
          </button>
        </div>
      </aside>

      <main className="main-content">
        {activeTab === 'reconcile' && <Reconciliation />}
        {activeTab === 'pdfconverter' && <PDFConverter />}
        {activeTab === 'num2words' && <NumberToWords />}
        {activeTab === 'gst' && <GSTCalculator />}
        {activeTab === 'datecalc' && <DateCalculator />}
      </main>
    </div>
  )
}

export default App
