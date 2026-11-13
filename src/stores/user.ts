import { defineStore } from 'pinia'
import { ref } from 'vue'
import { ApiError, api } from '../lib/api'
import { DEFAULT_USER_NAME, inspectName } from '../lib/profile'

export interface RenameResult {
  ok: boolean
  /** 校验后的昵称（校验失败时为原始去空白值） */
  name: string
  error: string | null
}

function messageOf(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback
}

/**
 * 当前用户：昵称以服务端为准。
 * 重命名会同时更新服务端全部历史内容的作者，因此失败时本地昵称保持不变。
 */
export const useUserStore = defineStore('user', () => {
  const name = ref(DEFAULT_USER_NAME)
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function load(signal?: AbortSignal): Promise<boolean> {
    loading.value = true
    try {
      name.value = await api.getProfile(signal)
      error.value = null
      return true
    } catch (err) {
      error.value = messageOf(err, '昵称加载失败')
      return false
    } finally {
      loading.value = false
    }
  }

  /** 先做本地校验（不合法不发请求），再提交服务端。 */
  async function rename(raw: string): Promise<RenameResult> {
    const inspected = inspectName(raw)
    if (!inspected.isValid) {
      return { ok: false, name: inspected.name, error: inspected.error }
    }

    loading.value = true
    try {
      name.value = await api.setProfile(inspected.name)
      error.value = null
      return { ok: true, name: name.value, error: null }
    } catch (err) {
      const message = messageOf(err, '昵称保存失败')
      error.value = message
      return { ok: false, name: name.value, error: message }
    } finally {
      loading.value = false
    }
  }

  return { name, loading, error, load, rename }
})
