/**
 * Spinner utility
 *
 * Wraps @clack/prompts spinner for ora-like API compatibility.
 */

import { spinner as clackSpinner } from '@clack/prompts'

export interface Spinner {
  start(message?: string): void
  stop(): void
  succeed(message: string): void
  fail(message: string): void
  text: string
}

export function createSpinner(): Spinner {
  let currentSpinner: ReturnType<typeof clackSpinner> | null = null
  let currentMessage = ''

  return {
    start(message = '') {
      currentMessage = message
      currentSpinner = clackSpinner()
      currentSpinner.start(message)
    },
    stop() {
      currentSpinner?.stop()
      currentSpinner = null
    },
    succeed(message: string) {
      currentSpinner?.stop(message)
      currentSpinner = null
    },
    fail(message: string) {
      currentSpinner?.stop(message)
      currentSpinner = null
    },
    get text() {
      return currentMessage
    },
    set text(value: string) {
      currentMessage = value
      currentSpinner?.message(value)
    },
  }
}
