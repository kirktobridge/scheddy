import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { createPortal } from 'react-dom'

/** Distance (px) the sheet must be dragged down to dismiss on release. */
const DISMISS_PX = 80

/**
 * Mobile slide-up sheet — pure CSS transition + pointer events, no library.
 * Dismiss via backdrop tap, handle tap, swipe-down, or Escape. Content mounts
 * synchronously while open; only the exit transition delays unmount.
 */
export default function BottomSheet({
  open,
  onClose,
  children,
}: {
  open: boolean
  onClose: () => void
  children: React.ReactNode
}) {
  const [mounted, setMounted] = useState(open)
  const [shown, setShown] = useState(false)
  const [dragY, setDragY] = useState(0)
  const dragRef = useRef<{ startY: number } | null>(null)
  const sheetRef = useRef<HTMLDivElement>(null)
  const restoreFocus = useRef<HTMLElement | null>(null)

  // Drive mount/animate. Open → mount now, slide in next frame. Close → slide
  // out, unmount on transition end (handled below).
  useEffect(() => {
    if (open) {
      setMounted(true)
      setDragY(0)
      const id = requestAnimationFrame(() => setShown(true))
      return () => cancelAnimationFrame(id)
    }
    setShown(false)
  }, [open])

  // Focus management + Escape + body scroll lock while mounted.
  useEffect(() => {
    if (!mounted) return
    restoreFocus.current = document.activeElement as HTMLElement | null
    sheetRef.current?.focus()
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
        return
      }
      if (e.key !== 'Tab') return
      const focusables = sheetRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])',
      )
      if (!focusables || focusables.length === 0) {
        e.preventDefault()
        sheetRef.current?.focus()
        return
      }
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
      restoreFocus.current?.focus?.()
    }
  }, [mounted, onClose])

  if (!mounted) return null

  const startDrag = (e: ReactPointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    dragRef.current = { startY: e.clientY }
  }
  const onDrag = (e: ReactPointerEvent) => {
    if (!dragRef.current) return
    setDragY(Math.max(0, e.clientY - dragRef.current.startY))
  }
  const endDrag = (e: ReactPointerEvent) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
    const dragged = dragRef.current
    dragRef.current = null
    if (dragged && dragY > DISMISS_PX) onClose()
    else setDragY(0)
  }

  // While shown and not dragging, sit at 0; otherwise offscreen / follow finger.
  const translate = !shown ? '100%' : dragY > 0 ? `${dragY}px` : '0px'

  return createPortal(
    <div className="fixed inset-0 z-40">
      <div
        className={`absolute inset-0 bg-black/40 transition-opacity duration-300 ${shown ? 'opacity-100' : 'opacity-0'}`}
        onClick={onClose}
        aria-hidden
      />
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        onTransitionEnd={() => {
          if (!shown && !open) setMounted(false)
        }}
        style={{ transform: `translateY(${translate})`, transition: dragRef.current ? 'none' : undefined }}
        className="absolute inset-x-0 bottom-0 z-50 max-h-[85vh] overflow-y-auto rounded-t-2xl bg-white shadow-xl outline-none transition-transform duration-300 dark:bg-slate-900"
      >
        <div
          className="flex cursor-grab touch-none justify-center py-2 active:cursor-grabbing"
          onPointerDown={startDrag}
          onPointerMove={onDrag}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onClick={onClose}
          aria-label="Close"
          role="button"
        >
          <span className="h-1.5 w-10 rounded-full bg-slate-300 dark:bg-slate-600" />
        </div>
        <div className="px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">{children}</div>
      </div>
    </div>,
    document.body,
  )
}
