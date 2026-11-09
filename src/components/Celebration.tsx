import { useEffect, useState } from 'react'
import { classStore } from '../state/classes'
import { useStore } from '../state/createStore'

/**
 * A wish for one class on given days (a teacher's birthday), shown beside the author's credit to
 * everyone in that class, teacher and pupils, and gone by itself once the days are over. Small and
 * quiet: it never covers the sheet.
 */
interface Wish {
  /** The class, by name. */
  className: string
  text: string
  /** From and until when, as instants (Spanish midnights written in UTC). */
  from: string
  until: string
}

const WISHES: readonly Wish[] = [
  // 9 and 10 November 2026: Eduardo Bastos's birthday, for his DT2 class.
  { className: 'DT2 - Eduardo Bastos - 26/27', text: '¡Felicidades, Eduardo Bastos!', from: '2026-11-08T23:00:00Z', until: '2026-11-10T23:00:00Z' },
]

/** A class name as compared: no accents, capitals, spaces or signs. */
const plain = (name: string) =>
  name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')

export const Celebration = ({ className = '' }: { className?: string }) => {
  const names = useStore(classStore, (s) => [...s.teacher, ...s.pupil].map((c) => plain(c.name)).join('|'))
  // Looked at again now and then, so it goes away on time even with the page left open.
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 10 * 60 * 1000)
    return () => clearInterval(timer)
  }, [])

  const mine = new Set(names.split('|'))
  const wish = WISHES.find((w) => mine.has(plain(w.className)) && now >= Date.parse(w.from) && now < Date.parse(w.until))
  if (!wish) return null
  return (
    <span
      role="status"
      className={`animate-pop pointer-events-none inline-flex select-none items-center gap-1.5 whitespace-nowrap rounded-full bg-accent-soft px-2.5 py-0.5 font-medium text-accent ${className}`}
    >
      <span aria-hidden>🎉</span>
      {wish.text}
      <span aria-hidden>🎂</span>
    </span>
  )
}
