<script setup lang="ts">
import { computed, shallowRef, useTemplateRef, watch } from 'vue'
import { MAX_CONTENT_LENGTH, analyzeContent } from '../lib/post'
import { initialOf } from '../lib/text'

const props = withDefaults(
  defineProps<{
    authorName: string
    /** 发布请求进行中：禁用发布按钮，避免重复提交 */
    publishing?: boolean
  }>(),
  { publishing: false },
)

const emit = defineEmits<{
  publish: [content: string]
}>()

const draft = shallowRef('')
const hint = shallowRef('')

const textarea = useTemplateRef<HTMLTextAreaElement>('textarea')

const analysis = computed(() => analyzeContent(draft.value))
const initial = computed(() => initialOf(props.authorName))
const hintText = computed(() => hint.value || analysis.value.hint)
const counterText = computed(() => `${analysis.value.length} / ${MAX_CONTENT_LENGTH}`)
const counterClasses = computed(() => ({
  'is-warn': analysis.value.isNearLimit,
  'is-over': analysis.value.isOverLimit,
}))

watch(draft, () => {
  if (hint.value && !analysis.value.isOverLimit) hint.value = ''
})

function focusInput(): void {
  textarea.value?.focus()
}

function submit(): void {
  if (analysis.value.isBlank) {
    hint.value = '说点什么再发布吧'
    focusInput()
    return
  }

  if (!analysis.value.canPublish) {
    hint.value = analysis.value.hint
    return
  }

  emit('publish', draft.value.trim())
  draft.value = ''
  hint.value = ''
  focusInput()
}
</script>

<template>
  <section class="composer" aria-labelledby="composer-title">
    <h1 id="composer-title" class="visually-hidden">发布新内容</h1>

    <div class="avatar avatar-lg" data-testid="composer-avatar" aria-hidden="true">
      {{ initial }}
    </div>

    <form class="composer-main" data-testid="composer-form" novalidate @submit.prevent="submit">
      <label class="visually-hidden" for="composer-text">内容</label>
      <textarea
        id="composer-text"
        ref="textarea"
        v-model="draft"
        class="composer-input"
        rows="3"
        placeholder="此刻的想法…"
        autocomplete="off"
        spellcheck="false"
        aria-describedby="composer-counter"
        @keydown.enter.ctrl.prevent="submit"
        @keydown.enter.meta.prevent="submit"
      ></textarea>

      <div class="composer-footer">
        <p
          id="composer-hint"
          class="composer-hint"
          data-testid="composer-hint"
          aria-live="polite"
          :class="{ 'is-visible': hintText !== '' }"
        >
          {{ hintText }}
        </p>

        <div class="composer-tools">
          <span
            id="composer-counter"
            class="counter"
            data-testid="composer-counter"
            :class="counterClasses"
          >
            {{ counterText }}
          </span>
          <button
            type="submit"
            class="btn btn-primary"
            data-testid="publish-button"
            :disabled="!analysis.canPublish || publishing"
          >
            <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
              <path
                d="M10 16V5m0 0L5.5 9.5M10 5l4.5 4.5"
                fill="none"
                stroke="currentColor"
                stroke-width="1.9"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
            <span>发布</span>
          </button>
        </div>
      </div>
    </form>
  </section>
</template>

<style scoped>
.composer {
  display: flex;
  gap: 12px;
  padding: 16px;
  border: 1px solid rgba(17, 24, 39, 0.05);
  border-radius: var(--r-lg);
  background: var(--c-surface);
  box-shadow: var(--shadow-md);
  transition:
    box-shadow var(--t-fast) var(--ease),
    border-color var(--t-fast) var(--ease);
}

.composer:focus-within {
  border-color: rgba(99, 102, 241, 0.35);
  box-shadow: var(--shadow-lg), var(--ring);
}

.composer-main {
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex: 1;
  min-width: 0;
}

.composer-input {
  width: 100%;
  min-height: 76px;
  max-height: 320px;
  padding: 2px 0;
  border: none;
  background: transparent;
  font-size: 15.5px;
  line-height: 1.7;
  color: var(--c-text);
  resize: vertical;
  outline: none;
}

.composer-input::placeholder {
  color: var(--c-text-dim);
}

.composer-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 36px;
}

.composer-hint {
  min-width: 0;
  font-size: 12.5px;
  color: var(--c-danger);
  opacity: 0;
  transform: translateY(-2px);
  transition:
    opacity var(--t-fast) var(--ease),
    transform var(--t-fast) var(--ease);
}

.composer-hint.is-visible {
  opacity: 1;
  transform: translateY(0);
}

.composer-tools {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-left: auto;
}

.counter {
  font-size: 12.5px;
  font-variant-numeric: tabular-nums;
  color: var(--c-text-dim);
  transition: color var(--t-fast) var(--ease);
}

.counter.is-warn {
  color: var(--c-warn);
}

.counter.is-over {
  color: var(--c-danger);
  font-weight: 600;
}

@media (max-width: 560px) {
  .composer {
    padding: 14px;
    gap: 10px;
  }

  .composer-input {
    min-height: 64px;
    font-size: 15px;
  }
}
</style>
