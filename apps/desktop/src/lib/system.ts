/** The operating system the window runs on, from what the web view reports. */
export function systemName(): 'Windows' | 'macOS' | 'Linux' | '' {
  const agent = navigator.userAgent
  return agent.includes('Windows') ? 'Windows' : agent.includes('Mac') ? 'macOS' : agent.includes('Linux') ? 'Linux' : ''
}

export function isWindows(): boolean {
  return systemName() === 'Windows'
}
