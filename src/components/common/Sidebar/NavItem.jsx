import { motion } from 'framer-motion'

/**
 * NavItem — single sidebar link.
 *
 * Active state is driven by the `active` prop (the parent owns the truth from
 * window.location.pathname). Renders an `<a>` because we still navigate via
 * full page loads (matching App.jsx routing).
 */
function NavItem({ icon: Icon, label, href, active = false, badge }) {
  return (
    <a
      href={href}
      aria-current={active ? 'page' : undefined}
      className={`group relative flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-[0.95rem] font-medium leading-tight transition-[background-color,color] duration-150 ${
        active
          ? 'bg-[#2C5EF5] text-white shadow-[0_8px_22px_rgba(44,94,245,0.22)]'
          : 'text-[#4A5568] hover:bg-[#F1F3F5] hover:text-[#0F1419]'
      }`}
    >
      <span
        className={`flex h-5 w-5 flex-none items-center justify-center transition-colors duration-150 ${
          active ? 'text-white' : 'text-[#4A5568] group-hover:text-[#0F1419]'
        }`}
        aria-hidden="true"
      >
        <Icon size={18} strokeWidth={2} />
      </span>

      <span className="flex-1 truncate">{label}</span>

      {badge ? (
        <motion.span
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          className={`flex h-5 min-w-5 flex-none items-center justify-center rounded-full px-1.5 text-[0.7rem] font-semibold leading-none ${
            active
              ? 'bg-white/20 text-white'
              : 'bg-[#2C5EF5]/10 text-[#2C5EF5]'
          }`}
        >
          {badge}
        </motion.span>
      ) : null}
    </a>
  )
}

export default NavItem
