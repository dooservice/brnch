import { beforeEach, describe, expect, it } from 'vitest'
import { OpenFilesStore } from './open_files'

describe('OpenFilesStore', () => {
  beforeEach(() => window.localStorage.clear())

  it('opens files in tabs, brings one to the front and closes the active one onto its neighbour', () => {
    const store = new OpenFilesStore()
    store.open('w', 'a.ts')
    store.open('w', 'b.ts')
    store.open('w', 'c.ts')
    store.open('w', 'a.ts')

    expect(store.get('w')).toEqual({ paths: ['a.ts', 'b.ts', 'c.ts'], active: 'a.ts' })
    store.activate('w', 'b.ts')
    store.close('w', 'b.ts')

    expect(store.get('w')).toEqual({ paths: ['a.ts', 'c.ts'], active: 'c.ts' })
  })

  it('keeps each workspace apart and finds the same tabs after a restart', () => {
    new OpenFilesStore().open('w1', 'x.ts')

    const restarted = new OpenFilesStore()

    expect(restarted.get('w1')).toEqual({ paths: ['x.ts'], active: 'x.ts' })
    expect(restarted.get('w2')).toEqual({ paths: [], active: null })
  })
})
