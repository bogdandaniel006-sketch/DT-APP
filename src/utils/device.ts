import { createStore } from '../state/createStore'

/**
 * What the app runs on. Phones, tablets and Android classroom panels (Android, iPhone, iPad) get
 * the touch controls: gestures with the fingers and their help. Computers do not, touch screen
 * or not (Windows, macOS, ChromeOS and Linux), unless someone turns them on: a computer touched
 * with two fingers offers them, for a laptop shown on a classroom touch screen.
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

/** A phone or a tablet: the touch controls are always on. */
const touchByNature = !isComputer && (nav.maxTouchPoints > 0 || matchMedia('(pointer: coarse)').matches)

const KEY = 'lamina:tactil'

/** What was answered on this computer: 'si' turned them on, 'no' declined the offer. */
const answered = (): string | null => {
  try {
    return localStorage.getItem(KEY)
  } catch {
    return null
  }
}

/** Whether the touch controls are on, and whether a computer has just been touched with two fingers. */
export const touchStore = createStore<{ on: boolean; offered: boolean }>({
  on: touchByNature || (isComputer && answered() === 'si'),
  offered: false,
})

const apply = (on: boolean) => {
  // For the styles: `touch:` utilities apply only while the controls are on.
  if (on) document.documentElement.dataset.touch = 'true'
  else delete document.documentElement.dataset.touch
}
apply(touchStore.get().on)

/** Read where the fingers are handled: the controls can be turned on while the app is open. */
export const touchOn = () => touchStore.get().on

/** Turns the touch controls of a computer on or off, remembered on it. */
export const setTouch = (on: boolean) => {
  touchStore.set({ on, offered: false })
  apply(on)
  try {
    localStorage.setItem(KEY, on ? 'si' : 'no')
  } catch {
    /* not remembered: it lasts until the page is closed */
  }
}

/** A computer touched with two fingers: offer the touch controls, once, unless already answered. */
export const offerTouch = () => {
  if (!isComputer || touchStore.get().on || touchStore.get().offered || answered()) return
  touchStore.set({ offered: true })
}

/** "Not now": the offer goes away and does not come back on this computer. */
export const declineTouch = () => setTouch(false)
