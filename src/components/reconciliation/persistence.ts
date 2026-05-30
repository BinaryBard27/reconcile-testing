export const STORAGE_KEY = 'micro-ledger-mappings'

export function saveMapping(partyName: string, fileLabel: string, mapping: any, entryTypeMap: any, mappingConfig: any) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const store = raw ? JSON.parse(raw) : {}
    
    const key = `${partyName || 'default'}_${fileLabel}`
    store[key] = { mapping, entryTypeMap, mappingConfig, timestamp: Date.now() }
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
  } catch (e) {
    console.error('Failed to save mapping', e)
  }
}

export function loadMapping(partyName: string, fileLabel: string) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const store = JSON.parse(raw)
    const key = `${partyName || 'default'}_${fileLabel}`
    return store[key] || null
  } catch (e) {
    console.error('Failed to load mapping', e)
    return null
  }
}

export function getAllSavedMappings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    return JSON.parse(raw)
  } catch (e) {
    console.error('Failed to load all mappings', e)
    return {}
  }
}
