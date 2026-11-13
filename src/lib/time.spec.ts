import { describe, expect, it } from 'vitest'
import { formatFullTime, formatRelativeTime } from './time'

const MINUTE = 60 * 1000
const HOUR = 60 * MINUTE

/** 本地时间 2026-11-13 09:05 */
const NOW = new Date(2026, 10, 13, 9, 5, 0).getTime()

describe('formatRelativeTime', () => {
  it('一分钟内显示「刚刚」', () => {
    expect(formatRelativeTime(NOW - 20 * 1000, NOW)).toBe('刚刚')
  })

  it('一小时内显示分钟', () => {
    expect(formatRelativeTime(NOW - 5 * MINUTE, NOW)).toBe('5 分钟前')
    expect(formatRelativeTime(NOW - 59 * MINUTE, NOW)).toBe('59 分钟前')
  })

  it('一天内显示小时', () => {
    expect(formatRelativeTime(NOW - 3 * HOUR, NOW)).toBe('3 小时前')
  })

  it('超过一天且相差一个自然日显示「昨天」', () => {
    const yesterday = new Date(2026, 10, 12, 8, 0).getTime()
    expect(formatRelativeTime(yesterday, NOW)).toBe('昨天')
  })

  it('不足 24 小时优先显示小时，即使已跨自然日', () => {
    const lastNight = new Date(2026, 10, 12, 20, 0).getTime()
    expect(formatRelativeTime(lastNight, NOW)).toBe('13 小时前')
  })

  it('跨两天显示「前天」', () => {
    const beforeYesterday = new Date(2026, 10, 11, 20, 0).getTime()
    expect(formatRelativeTime(beforeYesterday, NOW)).toBe('前天')
  })

  it('同年更早显示月日', () => {
    const earlier = new Date(2026, 10, 1, 20, 0).getTime()
    expect(formatRelativeTime(earlier, NOW)).toBe('11月1日')
  })

  it('跨年显示年月日', () => {
    const lastYear = new Date(2025, 5, 8, 20, 0).getTime()
    expect(formatRelativeTime(lastYear, NOW)).toBe('2025年6月8日')
  })

  it('未来时间按「刚刚」处理', () => {
    expect(formatRelativeTime(NOW + 10 * MINUTE, NOW)).toBe('刚刚')
  })
})

describe('formatFullTime', () => {
  it('补零并输出「年-月-日 时:分」', () => {
    const ts = new Date(2026, 0, 2, 3, 4).getTime()
    expect(formatFullTime(ts)).toBe('2026-01-02 03:04')
  })
})
