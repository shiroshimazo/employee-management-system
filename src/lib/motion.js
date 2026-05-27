// Shared motion presets for the auth pages so timing/easing stay identical
// across Login / Registration / ForgotPassword / ResetPassword. Import the
// preset and spread it onto a `motion.*` element.
//
// Usage:
//   import { motion } from 'framer-motion'
//   import { fadeDown } from '../../lib/motion.js'
//   <motion.form {...fadeDown} ... />

export const fadeDown = {
  initial: { opacity: 0, y: -16 },
  animate: { opacity: 1, y: 0 },
  // ease-out-quint — a touch of acceleration that feels intentional but
  // never pushy on auth screens.
  transition: { duration: 1.5, ease: [0.22, 1, 0.36, 1] },
}
