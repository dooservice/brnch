import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

// jsdom lacks these browser APIs; the palette's list needs them.
globalThis.ResizeObserver = ResizeObserverStub
window.HTMLElement.prototype.scrollIntoView = () => {}

afterEach(cleanup)
