function classNames(...values) {
  return values.filter(Boolean).join(' ')
}

function LoadingBars({
  className = '',
  bars = 3,
  label = 'Loading',
  decorative = false,
  ...props
}) {
  const accessibilityProps = decorative
    ? { 'aria-hidden': true }
    : { role: 'status', 'aria-live': 'polite', 'aria-label': label }
  const barCount = Math.max(1, Math.floor(Number(bars) || 3))

  return (
    <span
      className={classNames('loading-bars inline-flex items-stretch gap-[5%]', className)}
      {...accessibilityProps}
      {...props}
    >
      {Array.from({ length: barCount }, (_, index) => (
        <span
          key={index}
          aria-hidden="true"
          className="loading-bars__bar inline-block h-full rounded-[1px] bg-current"
          style={{
            width: `${100 / barCount}%`,
            animationDelay: `calc(var(--delay, 0.2s) * ${index})`,
          }}
        />
      ))}
      {!decorative ? <span className="sr-only">{label}</span> : null}
    </span>
  )
}

function LoadingState({
  label = 'Loading',
  className = '',
  barsClassName = 'h-4 w-6',
}) {
  return (
    <span
      role="status"
      aria-live="polite"
      className={classNames('inline-flex items-center justify-center gap-2', className)}
    >
      <LoadingBars decorative className={barsClassName} />
      <span>{label}</span>
    </span>
  )
}

function LoadingButtonLabel({ label, className = '', barsClassName = 'h-3.5 w-5' }) {
  return (
    <span className={classNames('inline-flex items-center justify-center gap-2', className)}>
      <LoadingBars decorative className={barsClassName} />
      <span>{label}</span>
    </span>
  )
}

export { LoadingBars, LoadingButtonLabel, LoadingState }
