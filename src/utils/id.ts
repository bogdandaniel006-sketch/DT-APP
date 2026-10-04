let counter = 0

export const newId = (): string => {
  counter = (counter + 1) % 1e6
  return `${Date.now().toString(36)}${counter.toString(36)}${Math.random().toString(36).slice(2, 6)}`
}
