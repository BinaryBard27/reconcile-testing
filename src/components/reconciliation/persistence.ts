export const STORAGE_KEY = 'micro-ledger-mappings'

function headerHash(headers: string[]): string {
  return [...headers].sort().join('|').replace(/\s+/g, '').slice(0, 120)
}

function cacheKey(fileLabel: string, headers: string[]): string {
  return `hdr_${headerHash(headers || [])}_${fileLabel}`
}

export function saveMapping(partyName: string, fileLabel: string, headers: string[], mapping: any, entryTypeMap: any, mappingConfig: any) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const store = raw ? JSON.parse(raw) : {}

    const key = cacheKey(fileLabel, headers)
    store[key] = { mapping, entryTypeMap, mappingConfig, timestamp: Date.now() }

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
    const key = cacheKey(fileLabel, currentHeaders)
    return store[key] || null
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
    const key = cacheKey(fileLabel, currentHeaders)
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
