import { useState, useEffect, useRef } from 'react'
import Reconciliation from './components/Reconciliation'
import NumberToWords from './components/NumberToWords'
import GSTCalculator from './components/GSTCalculator'
import DateCalculator from './components/DateCalculator'
import PDFConverter from './components/PDFConverter'
import './App.css'
import './Header.css'

function App() {
  const [activeTab, setActiveTab] = useState('reconcile')
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('micro-theme') || 'light'
  })
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('micro-theme', theme)
  }, [theme])

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const toggleTheme = () => setTheme((t) => (t === 'light' ? 'dark' : 'light'))

  const handleToolSelect = (tab: string) => {
    setActiveTab(tab)
    setIsDropdownOpen(false)
  }

  return (
    <div className="app-layout">
      <header className="top-navbar">
        <div 
          className="navbar-brand" 
          onClick={() => setActiveTab('reconcile')}
          role="button"
          tabIndex={0}
        >
          <div className="navbar-brand-icon blue-icon">
             <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                <line x1="8" y1="21" x2="16" y2="21" />
                <line x1="12" y1="17" x2="12" y2="21" />
              </svg>
          </div>
          <span>MicroLedger</span>
        </div>

        <div className="navbar-right">
          <div className="dropdown-container" ref={dropdownRef}>
            <button 
              className="btn btn-secondary dropdown-trigger" 
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            >
              Free Tools {isDropdownOpen ? '▲' : '▼'}
            </button>
            
            {isDropdownOpen && (
              <div className="dropdown-menu">
                <button className="dropdown-item" onClick={() => handleToolSelect('gst')}>
                  <span className="nav-icon">🧮</span> GST Calculator
                </button>
                <button className="dropdown-item" onClick={() => handleToolSelect('datecalc')}>
                  <span className="nav-icon">📅</span> Date Calculator
                </button>
                <button className="dropdown-item" onClick={() => handleToolSelect('num2words')}>
                  <span className="nav-icon">📝</span> Number to Words
                </button>
                <button className="dropdown-item" onClick={() => handleToolSelect('pdfconverter')}>
                  <span className="nav-icon">📄</span> Bank Statement to PDF
                </button>
              </div>
            )}
          </div>

          <button className="theme-toggle-btn" onClick={toggleTheme} aria-label="Toggle Theme">
            {theme === 'light' ? '🌙' : '☀️'}
          </button>
        </div>
      </header>

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
