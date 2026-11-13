import { describe, expect, it } from 'vitest'
import { clampText, countChars, initialOf } from './text'

describe('countChars', () => {
  it('统计英文字符数量', () => {
    expect(countChars('hello')).toBe(5)
  })

  it('统计中文字符数量', () => {
    expect(countChars('此刻的想法')).toBe(5)
  })

  it('把 emoji 记作一个字符', () => {
    expect(countChars('👍')).toBe(1)
    expect(countChars('👍🏽')).toBe(1)
  })

  it('把空值视为空字符串', () => {
    expect(countChars(null)).toBe(0)
    expect(countChars(undefined)).toBe(0)
    expect(countChars('')).toBe(0)
  })
})

describe('clampText', () => {
  it('不超过上限时原样返回', () => {
    expect(clampText('微语', 16)).toBe('微语')
  })

  it('按字符截断且不破坏 emoji', () => {
    expect(clampText('👍👍👍', 2)).toBe('👍👍')
  })

  it('空值返回空字符串', () => {
    expect(clampText(null, 3)).toBe('')
  })
})

describe('initialOf', () => {
  it('取首字符并大写', () => {
    expect(initialOf('alice')).toBe('A')
  })

  it('保留中文首字', () => {
    expect(initialOf('张三')).toBe('张')
  })

  it('忽略首尾空白', () => {
    expect(initialOf('  bob ')).toBe('B')
  })

  it('昵称为空时回退为「访」', () => {
    expect(initialOf('')).toBe('访')
    expect(initialOf('   ')).toBe('访')
    expect(initialOf(null)).toBe('访')
  })
})
