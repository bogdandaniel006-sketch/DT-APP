/**
 * What the app runs on. Phones and tablets (Android, iPhone, iPad) get the touch controls:
 * gestures with the fingers and their help. Windows never does, touch screen or not: there the
 * app stays as it is, mouse and keyboard, without the extra listening.
 */
const nav = navigator as Navigator & { userAgentData?: { platform?: string } }

export const isWindows = nav.userAgentData?.platform === 'Windows' || /Windows/i.test(nav.userAgent)

export const touchDevice = !isWindows && (nav.maxTouchPoints > 0 || matchMedia('(pointer: coarse)').matches)

// For the styles: `touch:` utilities apply on these devices only.
if (touchDevice) document.documentElement.dataset.touch = 'true'
