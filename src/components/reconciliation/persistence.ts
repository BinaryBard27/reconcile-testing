export const STORAGE_KEY = 'micro-ledger-mappings'

export function saveMapping(partyName: string, fileLabel: string, currentHeaders: string[], mapping: any, entryTypeMap: any, mappingConfig: any) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const store = raw ? JSON.parse(raw) : {}
    
    const key = `mapping_${(currentHeaders || []).slice().sort().join('|').slice(0, 100)}`
    const headerHash = (currentHeaders || []).slice().sort().join('|')
    const finalConfig = { ...mappingConfig, headerHash }
    store[key] = { mapping, entryTypeMap, mappingConfig: finalConfig, timestamp: Date.now() }
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
  } catch (e) {
    console.error('Failed to save mapping', e)
  }
}

export function loadMapping(partyName: string, fileLabel: string, currentHeaders: string[]) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const store = JSON.parse(raw)
    const key = `mapping_${(currentHeaders || []).slice().sort().join('|').slice(0, 100)}`
    const cached = store[key] || null
    if (!cached) return null
    
    const currentHash = (currentHeaders || []).slice().sort().join('|')
    if (cached.mappingConfig?.headerHash !== currentHash) {
      return null
    }
    return cached
  } catch (e) {
    console.error('Failed to load mapping', e)
    return null
  }
}

export function deleteMapping(partyName: string, fileLabel: string, currentHeaders: string[]) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return
    const store = JSON.parse(raw)
    const key = `mapping_${(currentHeaders || []).slice().sort().join('|').slice(0, 100)}`
    if (key in store) {
      delete store[key]
      localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
    }
  } catch (e) {
    console.error('Failed to delete mapping', e)
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
