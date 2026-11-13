const MINUTE = 60 * 1000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

function pad(value: number): string {
  return value < 10 ? `0${value}` : String(value)
}

/** 完整时间：2026-01-02 03:04 */
export function formatFullTime(timestamp: number): string {
  const date = new Date(timestamp)
  const ymd = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
  return `${ymd} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/** 相对时间：刚刚 / x 分钟前 / x 小时前 / 昨天 / 前天 / 11月1日 / 2025年6月8日 */
export function formatRelativeTime(createdAt: number, now: number = Date.now()): string {
  const diff = Math.max(0, now - createdAt)

  if (diff < MINUTE) return '刚刚'
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)} 分钟前`
  if (diff < DAY) return `${Math.floor(diff / HOUR)} 小时前`

  const created = new Date(createdAt)
  const today = new Date(now)
  const startOfToday = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  ).getTime()
  const startOfCreatedDay = new Date(
    created.getFullYear(),
    created.getMonth(),
    created.getDate(),
  ).getTime()
  const dayGap = Math.round((startOfToday - startOfCreatedDay) / DAY)

  if (dayGap === 1) return '昨天'
  if (dayGap === 2) return '前天'
  if (created.getFullYear() === today.getFullYear()) {
    return `${created.getMonth() + 1}月${created.getDate()}日`
  }
  return `${created.getFullYear()}年${created.getMonth() + 1}月${created.getDate()}日`
}
