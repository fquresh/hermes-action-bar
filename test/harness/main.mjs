// Browser harness: a mock Hermes chat that loads the real desktop/plugin.js.
// It is a development aid. It is not part of the plugin.
import { createElement } from 'react'
import { createRoot } from 'react-dom/client'

import plugin from '../../desktop/plugin.js'
import { host, mock } from './sdk.mjs'

const $ = id => document.getElementById(id)
const transcript = $('transcript')
const input = $('composer-input')
const toasts = $('toasts')
const log = []

window.__harness = { log, host, mock }

// -- mock model -------------------------------------------------------------

const CANNED = {
  Explain:
    '**Streaming replication** sends each change from the old server to the new one as it happens.\n\n- The **replica** is the copy on the new server.\n- **Replication lag** is how far the replica is behind the old server.\n\nWhen the lag is near zero, the two servers hold the same data, and the switch is safe.',
  Summarize:
    '- Copy the database to the new server while the old one runs.\n- Keep the copy current with streaming replication.\n- Stop writes for a short time, then switch the application.',
  'Fact-check':
    '1. *pg_basebackup makes a full copy while the database runs* - **Supported**. This is its documented purpose.\n2. *The downtime is usually one to five minutes* - **Doubtful**. It depends on the application and on the lag.\n3. *The same major version is necessary* - **Supported** for streaming replication.\n\nVerify claim 2 with a test cutover on a copy of your system.'
}

mock.oneshot = async params => {
  log.push({ type: 'oneshot', params })
  await new Promise(resolve => setTimeout(resolve, window.__harness.delay ?? 900))

  if (window.__harness.fail) {
    throw new Error('one-shot generation failed: no provider configured')
  }

  const question = params.input.match(/<question>\n([\s\S]*?)\n<\/question>/)?.[1] ?? ''
  const key = Object.keys(CANNED).find(name => question.toLowerCase().startsWith(name.toLowerCase().slice(0, 7)))

  return { text: key ? CANNED[key] : `A short answer to: *${question}*\n\nSee [the source](https://example.com/source) for more.` }
}

// -- mock composer ----------------------------------------------------------

const draft = () => input.innerText.replace(/\n$/, '')

function addMessage(role, text) {
  const row = document.createElement('div')

  row.className = `msg ${role}`
  row.dataset.role = role

  for (const block of text.split('\n\n')) {
    const p = document.createElement(block.startsWith('> ') ? 'blockquote' : 'p')

    p.textContent = block.replace(/^> ?/gm, '')
    row.append(p)
  }

  transcript.append(row)
  row.scrollIntoView({ block: 'end' })
}

mock.getDraft = draft
mock.setDraft = text => {
  input.innerText = text

  return true
}
mock.insertText = text => {
  input.innerText = draft() ? `${draft()}\n\n${text}` : text
  log.push({ type: 'insertText', text })

  return true
}
mock.focus = () => input.focus()
mock.notify = note => {
  const toast = document.createElement('div')

  toast.className = `toast ${note.kind}`
  toast.textContent = note.message
  toasts.append(toast)
  setTimeout(() => toast.remove(), 3500)
}

const contributions = []
const disposers = []

async function send(text) {
  let current = { text }

  for (const contribution of contributions.filter(item => item.area === 'composer.middleware')) {
    current = await contribution.data.handler(current)

    if (current === null) {
      return false
    }
  }

  log.push({ type: 'send', text: current.text })
  addMessage('user', current.text)

  return true
}

// Like Hermes: a submit is accepted at once, and the middleware runs after.
mock.submit = text => {
  void send(text)

  return true
}

input.addEventListener('keydown', event => {
  if (event.key !== 'Enter' || event.shiftKey) {
    return
  }

  event.preventDefault()

  // Like Hermes: Enter in an empty composer does nothing.
  if (!draft().trim()) {
    return
  }

  const text = draft()

  input.innerText = ''
  void send(text)
})

// -- load the plugin --------------------------------------------------------

const storage = {
  get: (key, fallback) => {
    try {
      return JSON.parse(localStorage.getItem(`harness.${key}`)) ?? fallback
    } catch {
      return fallback
    }
  },
  set: (key, value) => localStorage.setItem(`harness.${key}`, JSON.stringify(value)),
  remove: key => localStorage.removeItem(`harness.${key}`)
}

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

    return () => clearTimeout(id)
  },
  addEventListener: (target, type, listener, options) => {
    target.addEventListener(type, listener, options)

    return () => target.removeEventListener(type, listener, options)
  },
  os: {
    writeClipboard: async text => {
      log.push({ type: 'clipboard', text })

      return true
    },
    openExternal: async url => {
      log.push({ type: 'open', url })

      return true
    }
  },
  storage
}

plugin.register(ctx)

for (const contribution of contributions.filter(item => item.area === 'composer.top')) {
  createRoot($('composer-top')).render(createElement(contribution.render))
}

createRoot($('settings-slot')).render(createElement(settingsPage.render))

// -- page controls ----------------------------------------------------------

$('theme').addEventListener('click', () => document.documentElement.classList.toggle('dark'))
$('busy').addEventListener('click', () => host.state.busy.set(!host.state.busy.get()))
$('settings').addEventListener('click', () => $('settings-panel').toggleAttribute('hidden'))

for (const contribution of contributions.filter(item => item.area === 'keybinds')) {
  const chord = contribution.data.defaults[0].split('+')
  const key = chord.at(-1)

  window.addEventListener('keydown', event => {
    if (event.metaKey && event.altKey && event.code === `Key${key.toUpperCase()}`) {
      event.preventDefault()
      contribution.data.run()
    }
  })
}
