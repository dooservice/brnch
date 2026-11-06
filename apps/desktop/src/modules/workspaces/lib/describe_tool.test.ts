import { describe, expect, it } from 'vitest'
import { describeTool } from './describe_tool'

describe('describeTool', () => {
  it('names the action and shows what it touched instead of the raw input', () => {
    expect(describeTool('Read', '{"file_path":"src/a.ts"}')).toEqual({ verb: 'read', target: 'src/a.ts' })
    expect(describeTool('Write', '{"file_path":"src/new.ts","content":"x"}')).toEqual({ verb: 'create', target: 'src/new.ts' })
    expect(describeTool('Bash', '{"command":"npm test -- search"}')).toEqual({ verb: 'run', target: 'npm test -- search' })
  })

  it('keeps an unknown tool and a cut-off input readable', () => {
    expect(describeTool('Mystery', '{"a":1}')).toEqual({ verb: 'other', target: '{"a":1}' })
    expect(describeTool('Edit', '{"file_path":"src/long/path/to/fi')).toEqual({ verb: 'edit', target: 'src/long/path/to/fi' })
  })
})
