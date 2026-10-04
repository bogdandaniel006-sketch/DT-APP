/** Opens the native file dialog for a PDF. */
export const pickPdf = (): Promise<File | null> =>
  new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'application/pdf,.pdf'
    input.onchange = () => resolve(input.files?.[0] ?? null)
    input.oncancel = () => resolve(null)
    input.click()
  })
