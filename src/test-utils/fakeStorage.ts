import type { StorageLike } from '../lib/storage'

export interface FakeStorageState {
  /** 模拟隐私模式/配额超限：写入抛异常 */
  failWrites: boolean
  /** 模拟读取受限 */
  failReads: boolean
}

export interface FakeStorage extends StorageLike {
  snapshot(): Record<string, string>
}

/**
 * 测试用内存存储：可随时模拟写入失败，用于验证存储受限时的降级行为。
 */
export function createFakeStorage(initial: Record<string, string> = {}): {
  storage: FakeStorage
  state: FakeStorageState
} {
  const data = new Map(Object.entries(initial))
  const state: FakeStorageState = { failWrites: false, failReads: false }

  const storage: FakeStorage = {
    getItem(key) {
      if (state.failReads) throw new Error('SecurityError')
      return data.get(key) ?? null
    },
    setItem(key, value) {
      if (state.failWrites) throw new Error('QuotaExceededError')
      data.set(key, value)
    },
    removeItem(key) {
      data.delete(key)
    },
    snapshot() {
      return Object.fromEntries(data)
    },
  }

  return { storage, state }
}
