import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, beforeEach, vi } from 'vitest'

// jsdom has no layout engine, so the browser features the page relies on are replaced by simple stand-ins.

// IntersectionObserver: tests call intersect() to say "this element has scrolled into view".
let observers = []

class FakeIntersectionObserver {
  constructor(callback) {
    this.callback = callback
    this.elements = []
    observers.push(this)
  }

  observe(element) {
    this.elements.push(element)
  }

  unobserve() {}

  disconnect() {
    this.elements = []
    observers = observers.filter((observer) => observer !== this)
  }
}

export function intersect() {
  observers.forEach((observer) => {
    observer.callback(observer.elements.map((target) => ({ isIntersecting: true, target })), observer)
  })
}

// <dialog>: jsdom does not open or close it, so showModal and close are written out here.
function polyfillDialog() {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close = function close() {
    this.removeAttribute('open')
    this.dispatchEvent(new Event('close'))
  }
}

beforeEach(() => {
  observers = []
  vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver)
  window.matchMedia = vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }))
  window.scrollTo = vi.fn()
  window.scrollBy = vi.fn()
  polyfillDialog()
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})
