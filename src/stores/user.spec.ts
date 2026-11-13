import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_USER_NAME, MAX_NAME_LENGTH, serializeUser } from '../lib/profile'
import { STORAGE_KEYS } from '../lib/storage'
import { createFakeStorage } from '../test-utils/fakeStorage'
import { useUserStore } from './user'

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
})

describe('初始化', () => {
  it('没有本地数据时使用默认昵称', () => {
    const store = useUserStore()
    store.load()

    expect(store.name).toBe(DEFAULT_USER_NAME)
  })

  it('恢复本地保存的昵称', () => {
    localStorage.setItem(STORAGE_KEYS.user, serializeUser('李四'))

    const store = useUserStore()
    store.load()

    expect(store.name).toBe('李四')
  })

  it('本地数据损坏时回退到默认昵称', () => {
    localStorage.setItem(STORAGE_KEYS.user, '{oops')

    const store = useUserStore()
    store.load()

    expect(store.name).toBe(DEFAULT_USER_NAME)
  })
})

describe('rename', () => {
  it('保存去空白后的昵称', () => {
    const store = useUserStore()
    store.load()

    expect(store.rename('  李四  ')).toEqual({ ok: true, name: '李四', error: null })
    expect(store.name).toBe('李四')
    expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.user) ?? '{}')).toEqual({
      name: '李四',
    })
  })

  it('空昵称被拒绝且不改变状态', () => {
    const store = useUserStore()
    store.load()

    expect(store.rename('   ')).toEqual({ ok: false, name: '', error: '昵称不能为空' })
    expect(store.name).toBe(DEFAULT_USER_NAME)
    expect(localStorage.getItem(STORAGE_KEYS.user)).toBeNull()
  })

  it('超长昵称被拒绝', () => {
    const store = useUserStore()
    store.load()

    const result = store.rename('名'.repeat(MAX_NAME_LENGTH + 1))
    expect(result.ok).toBe(false)
    expect(result.error).toBe(`昵称最多 ${MAX_NAME_LENGTH} 个字符`)
    expect(store.name).toBe(DEFAULT_USER_NAME)
  })

  it('写入失败时仍更新内存昵称并标记失败', () => {
    const { storage, state } = createFakeStorage()
    vi.stubGlobal('localStorage', storage)

    const store = useUserStore()
    store.load()
    state.failWrites = true

    expect(store.rename('李四').ok).toBe(true)
    expect(store.name).toBe('李四')
    expect(store.writeFailed).toBe(true)
  })

  it('存储不可用时仍可修改昵称（仅本次会话生效）', () => {
    const { storage, state } = createFakeStorage()
    state.failWrites = true
    vi.stubGlobal('localStorage', storage)

    const store = useUserStore()
    store.load()

    expect(store.storageAvailable).toBe(false)
    expect(store.rename('李四').ok).toBe(true)
    expect(store.name).toBe('李四')
  })
})
