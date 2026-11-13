const FALLBACK_INITIAL = '访'

/**
 * 按「用户感知的字符」（字素簇）切分：
 * emoji、emoji + 肤色修饰符、组合音标都只算一个字符。
 */
const segmenter =
  typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function'
    ? new Intl.Segmenter(undefined, { granularity: 'grapheme' })
    : null

export function splitChars(text: string | null | undefined): string[] {
  const value = String(text ?? '')
  if (!segmenter) return Array.from(value)
  return Array.from(segmenter.segment(value), (part) => part.segment)
}

/** 统计字符数，emoji 只算一个字符。 */
export function countChars(text: string | null | undefined): number {
  return splitChars(text).length
}

/** 按字符截断，保证不会切坏 emoji。 */
export function clampText(text: string | null | undefined, max: number): string {
  return splitChars(text).slice(0, Math.max(0, max)).join('')
}

/** 头像首字：取昵称第一个字符并大写，空昵称回退为「访」。 */
export function initialOf(name: string | null | undefined): string {
  const [first] = splitChars(String(name ?? '').trim())
  return first ? first.toUpperCase() : FALLBACK_INITIAL
}
