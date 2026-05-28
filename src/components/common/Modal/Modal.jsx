import { useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'

/**
 * Modal — accessible, animated overlay shell.
 *
 * Renders nothing when closed; mounts a backdrop + centered card when open.
 * Closes on backdrop click and Escape. The card itself stops propagation
 * so clicks inside don't dismiss. We don't use a portal here because the
 * app's layout doesn't have stacking-context fights — if it grows one,
 * swap to createPortal(document.body) without changing the API.
 *
 * Props:
 *   - open: boolean
 *   - onClose: () => void
 *   - title, description: header text (optional)
 *   - footer: ReactNode rendered in the sticky footer slot (optional)
 *   - size: 'sm' | 'md' | 'lg' (controls max-width)
 *   - children: body content
 */
const SIZE = {
  sm: 'max-w-md',
  md: 'max-w-xl',
  lg: 'max-w-3xl',
}

function Modal({
  open,
  onClose,
  title,
  description,
  footer,
  size = 'md',
  children,
}) {
  // Escape-to-close. Bound only while open so we don't hold listeners on
  // closed modals. Also locks body scroll while the overlay is up.
  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.()
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[1000] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          aria-modal="true"
          role="dialog"
          aria-labelledby={title ? 'modal-title' : undefined}
        >
          <div
            className="absolute inset-0 bg-[#0F1419]/40 backdrop-blur-sm"
            onClick={onClose}
            aria-hidden="true"
          />
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            className={`relative z-10 flex max-h-[90vh] w-full flex-col overflow-hidden rounded-[16px] border border-slate-200 bg-white shadow-[0_24px_60px_rgba(15,20,25,0.18)] ${SIZE[size]}`}
            onClick={(e) => e.stopPropagation()}
          >
            {(title || description) && (
              <header className="flex items-start justify-between gap-3 border-b border-slate-200 px-6 py-4">
                <div className="min-w-0">
                  {title ? (
                    <h2
                      id="modal-title"
                      className="m-0 text-[1.05rem] font-semibold text-[#0F1419]"
                    >
                      {title}
                    </h2>
                  ) : null}
                  {description ? (
                    <p className="m-0 mt-1 text-[0.85rem] text-[#4A5568]">
                      {description}
                    </p>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close"
                  className="-m-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] text-[#4A5568] transition-colors hover:bg-slate-100 hover:text-[#0F1419]"
                >
                  <X size={16} strokeWidth={2.25} />
                </button>
              </header>
            )}

            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
              {children}
            </div>

            {footer ? (
              <footer className="flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50/60 px-6 py-3">
                {footer}
              </footer>
            ) : null}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}

export default Modal
