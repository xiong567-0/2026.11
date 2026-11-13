/** localStorage 的最小接口，便于在测试中替换为内存实现。 */
export interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export interface StorageAdapter {
  /** 存储是否可写（隐私模式 / 禁用存储时为 false） */
  readonly available: boolean
  read(key: string): string | null
  write(key: string, value: string): boolean
}

/** 键名带版本号，兼容旧版本数据 */
export const STORAGE_KEYS = {
  posts: 'weiyu:posts:v1',
  user: 'weiyu:user:v1',
} as const

const PROBE_KEY = 'weiyu:__probe__'

/**
 * 探测存储是否真的可写：隐私模式下 localStorage 存在但写入会抛异常。
 */
export function probeStorage(candidate: StorageLike | null | undefined): StorageLike | null {
  if (!candidate) return null

  try {
    candidate.setItem(PROBE_KEY, '1')
    candidate.removeItem(PROBE_KEY)
    return candidate
  } catch {
    return null
  }
}

export function createStorageAdapter(
  storage: StorageLike | null | undefined,
): StorageAdapter {
  return {
    available: Boolean(storage),
    read(key) {
      if (!storage) return null
      try {
        return storage.getItem(key)
      } catch {
        return null
      }
    },
    write(key, value) {
      if (!storage) return false
      try {
        storage.setItem(key, value)
        return true
      } catch {
        // 常见原因：QuotaExceededError / 隐私模式限制
        return false
      }
    },
  }
}

/**
 * 在浏览器环境中取得可用的 localStorage；不可用时返回 null，调用方退化为纯内存运行。
 */
export function resolveLocalStorage(): StorageLike | null {
  try {
    return probeStorage(globalThis.localStorage)
  } catch {
    return null
  }
}
