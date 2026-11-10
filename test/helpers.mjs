// One fresh page and one plugin load per test, like an app reload.
import { JSDOM } from 'jsdom'

import { fake } from './fake-sdk.mjs'

// react-dom decides at import time if a DOM exists, so a window comes first.
const boot = new JSDOM('<!doctype html><body></body>')

Object.assign(globalThis, { window: boot.window, document: boot.window.document, IS_REACT_ACT_ENVIRONMENT: true })

const { act } = await import('react')
const { createRoot } = await import('react-dom/client')
const mod = await import('../desktop/plugin.js')

export { fake, mod }
export const plugin = mod.default

export const tick = (ms = 5) => new Promise(resolve => setTimeout(resolve, ms))

// jsdom has no layout. Electron gives real rectangles.
export const RECT = { top: 300, bottom: 320, left: 100, right: 300, width: 200, height: 20 }

export const CHAT = `
  <aside id="sidebar"><p id="side">Sidebar text that is not a chat message.</p></aside>
  <main data-chat-surface="">
    <div id="msg">
      <p id="p1">Backup the database before you move it to the new server.</p>
      <p id="p2">Logical replication copies each change to the new server.</p>
    </div>
    <div id="composer" contenteditable="true">my draft</div>
  </main>
`

export function setup(html = CHAT, { highlights = false, storage = {} } = {}) {
  fake.reset()

  const dom = new JSDOM(`<!doctype html><html><head></head><body>${html}</body></html>`, { pretendToBeVisual: true })
  const { window } = dom
  const doc = window.document

  Object.assign(globalThis, { window, document: doc })
  window.Range.prototype.getClientRects = () => [RECT]
  window.Range.prototype.getBoundingClientRect = () => RECT
  Object.defineProperty(window, 'innerWidth', { value: 1200, configurable: true })
  Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true })

  if (highlights) {
    window.CSS = { highlights: new Map() }
    window.Highlight = class {
      constructor(...ranges) {
        this.ranges = ranges
      }
    }
  }

  const contributions = []
  const disposers = []
  const clipboard = []
  const opened = []
  const store = { ...storage }
  let settingsPage = null

  const ctx = {
    register: contribution => {
      contributions.push(contribution)

      return () => {}
    },
    registerSettingsPage: page => {
      settingsPage = page
    },
    onDispose: fn => disposers.push(fn),
    setTimeout: (fn, ms) => {
      const id = setTimeout(fn, ms)
      const stop = () => clearTimeout(id)

      disposers.push(stop)

      return stop
    },
    addEventListener: (target, type, listener, options) => {
      target.addEventListener(type, listener, options)
      disposers.push(() => target.removeEventListener(type, listener, options))
    },
    os: {
      writeClipboard: async text => {
        clipboard.push(text)

        return true
      },
      openExternal: async url => {
        opened.push(url)

        return true
      }
    },
    storage: {
      get: (key, fallback) => (key in store ? store[key] : fallback),
      set: (key, value) => {
        store[key] = value
      },
      remove: key => {
        delete store[key]
      }
    }
  }

  plugin.register(ctx)

  const byId = id => doc.getElementById(id)
  const roots = []
  const area = name => contributions.filter(contribution => contribution.area === name)
  const bar = () => doc.querySelector('[data-sidenote="bar"]')
  const card = () => doc.querySelector('[data-sidenote="card"]')
  const fire = (target, type, init = {}) => {
    const Event = type.startsWith('key') ? window.KeyboardEvent : type === 'input' ? window.Event : window.MouseEvent
    const event = new Event(type, { bubbles: true, cancelable: true, ...init })

    target.dispatchEvent(event)

    return event
  }

  const page = {
    doc,
    window,
    ctx,
    contributions,
    clipboard,
    opened,
    store,
    byId,
    area,
    bar,
    card,
    fire,
    settingsPage: () => settingsPage,
    barVisible: () => bar()?.style.display === 'flex',
    barLabels: () => [...bar().querySelectorAll('button')].map(b => b.textContent || b.getAttribute('aria-label')),
    button: (root, label) =>
      [...root.querySelectorAll('button')].find(b => b.textContent === label || b.getAttribute('aria-label') === label),
    select(node, start, end) {
      const range = doc.createRange()

      if (start === undefined) {
        range.selectNodeContents(node)
      } else {
        range.setStart(node.firstChild, start)
        range.setEnd(node.firstChild, end)
      }

      const selection = window.getSelection()

      selection.removeAllRanges()
      selection.addRange(range)
    },
    // Select a node and release the mouse, as a user does.
    async highlight(node, start, end) {
      page.select(node, start, end)
      fire(node, 'mouseup')
      await tick()
    },
    async click(node) {
      fire(node, 'mousedown')
      fire(node, 'click')
      await tick()
    },
    async type(input, text, { enter = true } = {}) {
      input.value = text
      fire(input, 'input')

      if (enter) {
        fire(input, 'keydown', { key: 'Enter' })
      }

      await tick()
    },
    // Mount a render-slot contribution (the reply strip, the settings page).
    async mount(render) {
      const container = doc.createElement('div')

      doc.body.append(container)

      const root = createRoot(container)

      roots.push(root)
      await act(async () => root.render(render()))

      return container
    },
    act: fn => act(async () => fn()),
    async dispose() {
      await act(async () => roots.forEach(root => root.unmount()))
      disposers.forEach(fn => fn())
      window.close()
    }
  }

  return page
}
