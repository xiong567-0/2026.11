import { countChars } from './text'

export const DEFAULT_USER_NAME = '访客'
export const MAX_NAME_LENGTH = 16

export interface NameInspection {
  /** 去掉首尾空白后的昵称 */
  name: string
  isValid: boolean
  /** 校验失败时的可读提示，通过时为 null */
  error: string | null
}

/** 昵称校验规则：非空、去空白、最多 16 个字符。 */
export function inspectName(raw: string | null | undefined): NameInspection {
  const name = String(raw ?? '').trim()

  if (!name) {
    return { name, isValid: false, error: '昵称不能为空' }
  }

  if (countChars(name) > MAX_NAME_LENGTH) {
    return {
      name,
      isValid: false,
      error: `昵称最多 ${MAX_NAME_LENGTH} 个字符`,
    }
  }

  return { name, isValid: true, error: null }
}
