// A fake @hermes/plugin-sdk with only the parts that the plugin uses. Tests
// drive it through `fake` and read what the plugin did from `fake.calls`.
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

export const fake = {
  calls: { request: [], insertText: [], submit: [], setDraft: [], notify: [], focus: 0 },
  draft: '',
  submitOk: true,
  insertOk: true,
  oneshot: async () => ({ text: 'ANSWER' }),
  reset() {
    this.calls = { request: [], insertText: [], submit: [], setDraft: [], notify: [], focus: 0 }
    this.draft = ''
    this.submitOk = true
    this.insertOk = true
    this.oneshot = async () => ({ text: 'ANSWER' })
    host.state.focusedStoredSessionId.set(null)
    host.state.focusedSessionId.set(null)
    host.state.busy.set(false)
  }
}

export const host = {
  state: {
    focusedStoredSessionId: atom(null),
    focusedSessionId: atom(null),
    busy: atom(false)
  },
  composer: {
    getDraft: async () => fake.draft,
    setDraft: async (id, text) => {
      fake.calls.setDraft.push({ id, text })
      fake.draft = text

      return true
    },
    insertText: async (id, text, opts) => {
      fake.calls.insertText.push({ id, text, mode: opts?.mode })

      return fake.insertOk
    },
    submit: (id, text) => {
      fake.calls.submit.push({ id, text })

      return fake.submitOk
    },
    focus: () => {
      fake.calls.focus++
    }
  },
  request: async (method, params, timeoutMs) => {
    fake.calls.request.push({ method, params, timeoutMs })

    if (method !== 'llm.oneshot') {
      throw new Error(`unexpected method ${method}`)
    }

    return fake.oneshot(params)
  },
  notify: note => {
    fake.calls.notify.push(note)
  }
}
