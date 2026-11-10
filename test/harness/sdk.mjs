// A stand-in for @hermes/plugin-sdk that runs in a plain browser. The harness
// page wires `host` to a mock chat, so the real desktop/plugin.js can be seen
// and used with real layout, real selections and real CSS.
import { useSyncExternalStore } from 'react'

export function atom(initial) {
  let value = initial
  const listeners = new Set()

  return {
    get: () => value,
    set: next => {
      value = next
      listeners.forEach(listener => listener(value))
    },
    subscribe: listener => {
      listeners.add(listener)

      return () => listeners.delete(listener)
    }
  }
}

export const useValue = store => useSyncExternalStore(store.subscribe, store.get, store.get)

export const KEYBINDS_AREA = 'keybinds'
export const PALETTE_AREA = 'palette'

// The page replaces these with its own behaviour.
export const mock = {
  getDraft: () => '',
  setDraft: () => true,
  insertText: () => true,
  submit: () => true,
  focus: () => {},
  oneshot: async () => ({ text: '' }),
  notify: () => {}
}

export const host = {
  state: {
    focusedStoredSessionId: atom('demo-session'),
    focusedSessionId: atom('demo-runtime'),
    busy: atom(false)
  },
  composer: {
    getDraft: async () => mock.getDraft(),
    setDraft: async (id, text) => mock.setDraft(text),
    insertText: async (id, text, opts) => mock.insertText(text, opts),
    submit: (id, text) => mock.submit(text),
    focus: () => mock.focus()
  },
  request: async (method, params) => {
    if (method !== 'llm.oneshot') {
      throw new Error(`unexpected method ${method}`)
    }

    return mock.oneshot(params)
  },
  notify: note => mock.notify(note)
}
