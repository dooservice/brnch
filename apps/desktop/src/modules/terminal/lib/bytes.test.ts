import { describe, expect, it } from 'vitest'
import { decodeBase64, encodeUtf8Base64 } from './bytes'

describe('terminal bytes', () => {
  it('round-trips text with accents and symbols', () => {
    const text = 'echo "añadir búsqueda → ok"\r'

    expect(new TextDecoder().decode(decodeBase64(encodeUtf8Base64(text)))).toBe(text)
  })
})
