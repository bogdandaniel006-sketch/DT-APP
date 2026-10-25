/**
 * What the app runs on. Phones, tablets and Android classroom panels (Android, iPhone, iPad) get
 * the touch controls: gestures with the fingers and their help. Computers never do, touch screen
 * or not: Windows, macOS, ChromeOS and Linux stay as they are, mouse and keyboard, without the
 * extra listening.
 */
const nav = navigator as Navigator & { userAgentData?: { platform?: string } }
const ua = nav.userAgent
const platform = nav.userAgentData?.platform ?? nav.platform ?? ''

const isWindows = platform === 'Windows' || /Windows/i.test(ua)
/** A Mac without a touch screen: an iPad asking for the desktop site also says "Macintosh", but has one. */
const isMac = /Macintosh|Mac OS X/i.test(ua) && nav.maxTouchPoints === 0
const isChromeOS = /CrOS/.test(ua) || platform === 'Chrome OS'
/**
 * Linux on a computer. Android says Linux too, and its browsers say only "Linux" when asked for
 * the desktop site, but they run on ARM chips (armv8l, aarch64), which computers seldom do.
 */
const isLinuxComputer = !/Android/i.test(ua) && /Linux|X11/.test(ua) && !/arm|aarch64/i.test(nav.platform ?? '')

export const isComputer = isWindows || isMac || isChromeOS || isLinuxComputer

export const touchDevice = !isComputer && (nav.maxTouchPoints > 0 || matchMedia('(pointer: coarse)').matches)

// For the styles: `touch:` utilities apply on these devices only.
if (touchDevice) document.documentElement.dataset.touch = 'true'
