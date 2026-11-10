const FAKE_SDK = new URL('./fake-sdk.mjs', import.meta.url).href

export async function resolve(specifier, context, next) {
  if (specifier === '@hermes/plugin-sdk') {
    return { url: FAKE_SDK, shortCircuit: true }
  }

  return next(specifier, context)
}
