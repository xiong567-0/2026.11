import { describe, expect, it } from 'vitest'
import {
  STORAGE_KEYS,
  createStorageAdapter,
  probeStorage,
  type StorageLike,
} from './storage'

function createMemoryStorage(initial: Record<string, string> = {}): StorageLike & {
  snapshot: () => Record<string, string>
} {
  const data = new Map(Object.entries(initial))
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
    snapshot: () => Object.fromEntries(data),
  }
}

function createBrokenStorage(): StorageLike {
  return {
    getItem() {
      throw new Error('SecurityError')
    },
    setItem() {
      throw new Error('QuotaExceededError')
    },
    removeItem() {
      throw new Error('SecurityError')
    },
  }
}

describe('STORAGE_KEYS', () => {
  it('保持 v1 键名，兼容旧版本数据', () => {
    expect(STORAGE_KEYS).toEqual({
      posts: 'weiyu:posts:v1',
      user: 'weiyu:user:v1',
    })
  })
})

describe('createStorageAdapter', () => {
  it('存储缺失时标记为不可用', () => {
    const adapter = createStorageAdapter(null)
    expect(adapter.available).toBe(false)
    expect(adapter.read(STORAGE_KEYS.posts)).toBeNull()
    expect(adapter.write(STORAGE_KEYS.posts, '[]')).toBe(false)
  })

  it('读写字符串', () => {
    const raw = createMemoryStorage()
    const adapter = createStorageAdapter(raw)

    expect(adapter.available).toBe(true)
    expect(adapter.write(STORAGE_KEYS.user, '{"name":"张三"}')).toBe(true)
    expect(adapter.read(STORAGE_KEYS.user)).toBe('{"name":"张三"}')
  })

  it('读取抛异常时返回 null 而不崩溃', () => {
    const adapter = createStorageAdapter(createBrokenStorage())
    expect(adapter.read(STORAGE_KEYS.posts)).toBeNull()
  })

  it('写入失败（如超出配额）时返回 false', () => {
    const adapter = createStorageAdapter(createBrokenStorage())
    expect(adapter.write(STORAGE_KEYS.posts, '[]')).toBe(false)
  })

  it('未写入过的键返回 null', () => {
    const adapter = createStorageAdapter(createMemoryStorage())
    expect(adapter.read(STORAGE_KEYS.posts)).toBeNull()
  })
})

describe('probeStorage', () => {
  it('可写入时返回该存储', () => {
    const raw = createMemoryStorage()
    expect(probeStorage(raw)).toBe(raw)
  })

  it('写入受限时返回 null，且不残留探测键', () => {
    const storage = createBrokenStorage()
    expect(probeStorage(storage)).toBeNull()
  })

  it('存储为 undefined 时返回 null', () => {
    expect(probeStorage(undefined)).toBeNull()
  })
})
