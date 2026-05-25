function InputField({
  id,
  label,
  labelAddon,
  leadingIcon,
  trailingAction,
  ...inputProps
}) {
  const inputClasses = [
    'min-h-11 w-full border-0 bg-transparent px-4 py-3 pl-10',
    'text-[0.95rem] text-[#0F1419] outline-none placeholder:text-[#4A5568]',
    trailingAction ? 'pr-10' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className="flex flex-col">
      <div
        className={
          labelAddon ? 'flex items-center justify-between gap-2' : undefined
        }
      >
        <label
          className="mb-2 block text-xs font-medium text-white [font-family:'Geist_Mono',monospace]"
          htmlFor={id}
        >
          {label}
        </label>
        {labelAddon}
      </div>

      <div className="relative rounded-[6px] border border-transparent bg-[#F1F3F5] transition-[border-color,box-shadow] duration-150 focus-within:border-[#2C5EF5] focus-within:shadow-[0_0_0_3px_rgba(44,94,245,0.15)]">
        <span
          className="pointer-events-none absolute left-3.5 top-1/2 flex -translate-y-1/2 items-center justify-center text-[#4A5568]"
          aria-hidden="true"
        >
          {leadingIcon}
        </span>
        <input id={id} className={inputClasses} {...inputProps} />
        {trailingAction ? (
          <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center justify-center">
            {trailingAction}
          </div>
        ) : null}
      </div>
    </div>
  )
}

export default InputField
