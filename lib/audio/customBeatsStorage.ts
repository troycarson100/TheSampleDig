/**
 * IndexedDB storage for user custom drum loops. Persists blob + metadata so
 * custom beats appear in the beat list and survive refresh.
 */

import { getAudioContext } from "./audioContext"

const DB_NAME = "thesampledig-beats"
const STORE_NAME = "customBeats"
const DB_VERSION = 1

export interface CustomBeatMeta {
  id: string
  name: string
  originalBpm: number
  bars: number
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onerror = () => reject(req.error)
    req.onsuccess = () => resolve(req.result)
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME, { keyPath: "id" })
    }
  })
}

export async function listCustomBeats(): Promise<CustomBeatMeta[]> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly")
    const store = tx.objectStore(STORE_NAME)
    const req = store.getAll()
    req.onsuccess = () => {
      const rows = (req.result as { id: string; name: string; originalBpm: number; bars: number }[]) || []
      resolve(rows.map((r) => ({ id: r.id, name: r.name, originalBpm: r.originalBpm, bars: r.bars })))
    }
    req.onerror = () => reject(req.error)
    tx.oncomplete = () => db.close()
  })
}

export async function getCustomBeatBlob(id: string): Promise<Blob> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly")
    const req = tx.objectStore(STORE_NAME).get(id)
    req.onsuccess = () => {
      const row = req.result as { blob?: Blob } | undefined
      if (row?.blob) resolve(row.blob)
      else reject(new Error("Custom beat not found"))
    }
    req.onerror = () => reject(req.error)
    tx.oncomplete = () => db.close()
  })
}

export async function saveCustomBeat(params: {
  name: string
  originalBpm: number
  bars: number
  file: File
}): Promise<CustomBeatMeta> {
  const id = `custom-${crypto.randomUUID()}`
  const blob = await params.file.arrayBuffer().then((ab) => new Blob([ab], { type: params.file.type || "audio/mpeg" }))
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite")
    const store = tx.objectStore(STORE_NAME)
    store.put({
      id,
      name: params.name,
      originalBpm: params.originalBpm,
      bars: params.bars,
      blob,
    })
    tx.oncomplete = () => {
      db.close()
      resolve({ id, name: params.name, originalBpm: params.originalBpm, bars: params.bars })
    }
    tx.onerror = () => reject(tx.error)
  })
}

export async function deleteCustomBeat(id: string): Promise<void> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite")
    tx.objectStore(STORE_NAME).delete(id)
    tx.oncomplete = () => {
      db.close()
      resolve()
    }
    tx.onerror = () => reject(tx.error)
  })
}

/** Load a custom beat as an AudioBuffer (for playback). */
export async function loadCustomBeatAsBuffer(id: string): Promise<AudioBuffer> {
  const blob = await getCustomBeatBlob(id)
  const arrayBuffer = await blob.arrayBuffer()
  const ctx = getAudioContext()
  return ctx.decodeAudioData(arrayBuffer)
}
