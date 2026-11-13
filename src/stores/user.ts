import { defineStore } from 'pinia'
import { ref } from 'vue'
import {
  DEFAULT_USER_NAME,
  inspectName,
  parseStoredUser,
  serializeUser,
} from '../lib/profile'
import { STORAGE_KEYS, createStorageAdapter, resolveLocalStorage } from '../lib/storage'

export interface RenameResult {
  ok: boolean
  /** 校验后的昵称（校验失败时为原始去空白值） */
  name: string
  error: string | null
}

export const useUserStore = defineStore('user', () => {
  const adapter = createStorageAdapter(resolveLocalStorage())
  const storageAvailable = adapter.available

  const name = ref(DEFAULT_USER_NAME)
  const writeFailed = ref(false)

  function load(): { storageAvailable: boolean } {
    name.value = parseStoredUser(adapter.read(STORAGE_KEYS.user)).name
    return { storageAvailable }
  }

  function rename(raw: string): RenameResult {
    const result = inspectName(raw)
    if (!result.isValid) {
      return { ok: false, name: result.name, error: result.error }
    }

    name.value = result.name
    writeFailed.value = !adapter.write(STORAGE_KEYS.user, serializeUser(result.name))

    return { ok: true, name: result.name, error: null }
  }

  return { name, storageAvailable, writeFailed, load, rename }
})
