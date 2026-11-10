// Points `@hermes/plugin-sdk` at the fake SDK, so the tests load the real
// desktop/plugin.js file unchanged.
import { register } from 'node:module'

register('./hooks.mjs', import.meta.url)
