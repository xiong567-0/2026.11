import { describe, expect, it } from 'vitest'
import { MAX_NAME_LENGTH, inspectName } from './profile'

describe('inspectName', () => {
  it('去掉首尾空白并判定合法', () => {
    expect(inspectName('  张三  ')).toEqual({
      name: '张三',
      isValid: true,
      error: null,
    })
  })

  it('空昵称给出错误提示', () => {
    expect(inspectName('   ')).toEqual({
      name: '',
      isValid: false,
      error: '昵称不能为空',
    })
  })

  it('超过 16 个字符给出错误提示', () => {
    const result = inspectName('名'.repeat(MAX_NAME_LENGTH + 1))
    expect(result.isValid).toBe(false)
    expect(result.error).toBe(`昵称最多 ${MAX_NAME_LENGTH} 个字符`)
  })

  it('emoji 按一个字符计算边界', () => {
    expect(inspectName('👍'.repeat(MAX_NAME_LENGTH)).isValid).toBe(true)
    expect(inspectName('👍'.repeat(MAX_NAME_LENGTH + 1)).isValid).toBe(false)
  })
})
