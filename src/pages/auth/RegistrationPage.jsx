import { useState } from 'react'
import { Eye, EyeOff, Lock, Mail, User } from 'lucide-react'

const fieldNames = ['fullName', 'email', 'password', 'confirmPassword']

const initialFormState = {
  fullName: '',
  email: '',
  password: '',
  confirmPassword: '',
  showPassword: false,
  showConfirmPassword: false,
}

const initialTouchedState = fieldNames.reduce((fields, fieldName) => {
  fields[fieldName] = false
  return fields
}, {})

function validateRegistration(values) {
  const errors = {}
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

  if (!values.fullName.trim()) {
    errors.fullName = 'Full name is required.'
  } else if (values.fullName.trim().split(/\s+/).length < 2) {
    errors.fullName = 'Enter your first and last name.'
  }

  if (!values.email.trim()) {
    errors.email = 'Email is required.'
  } else if (!emailPattern.test(values.email)) {
    errors.email = 'Enter a valid email address.'
  }

  if (!values.password) {
    errors.password = 'Password is required.'
  } else if (values.password.length < 8) {
    errors.password = 'Password must be at least 8 characters.'
  }

  if (!values.confirmPassword) {
    errors.confirmPassword = 'Confirm your password.'
  } else if (values.password && values.confirmPassword !== values.password) {
    errors.confirmPassword = 'Passwords must match.'
  }

  return errors
}

function RegistrationPage() {
  const [formState, setFormState] = useState(initialFormState)
  const [touchedFields, setTouchedFields] = useState(initialTouchedState)
  const [hasSubmitted, setHasSubmitted] = useState(false)
  const errors = validateRegistration(formState)

  const handleChange = (event) => {
    const { name, value } = event.target

    setFormState((currentState) => ({
      ...currentState,
      [name]: value,
    }))
  }

  const handleBlur = (event) => {
    const { name } = event.target

    setTouchedFields((currentFields) => ({
      ...currentFields,
      [name]: true,
    }))
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    setHasSubmitted(true)
    setTouchedFields(
      fieldNames.reduce((fields, fieldName) => {
        fields[fieldName] = true
        return fields
      }, {}),
    )

    const firstInvalidField = fieldNames.find((fieldName) => errors[fieldName])

    if (firstInvalidField) {
      document.getElementById(firstInvalidField)?.focus()
    }
  }

  const shouldShowError = (fieldName) =>
    Boolean(errors[fieldName] && (touchedFields[fieldName] || hasSubmitted))

  return (
    <main className="flex min-h-dvh items-center justify-center bg-white px-6 py-8 [font-family:'Geist',sans-serif]">
      <form
        className="w-full max-w-[360px] rounded-2xl border border-slate-200 bg-white p-8 shadow-[0_24px_70px_rgba(15,20,25,0.08)] max-[420px]:p-5"
        onSubmit={handleSubmit}
        aria-label="Registration form"
        noValidate
      >
        <header className="mb-8 text-center">
          <h1 className="m-0 text-4xl font-bold leading-[1.05] text-[#0F1419] max-[420px]:text-[2rem]">
            Create your account
          </h1>
          <p className="mb-0 mt-3 text-[0.95rem] font-normal leading-[1.45] text-[#4A5568]">
            Enter your details below
            <br />
            to create your account
          </p>
        </header>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col">
            <label
              className="mb-2 block text-xs font-medium leading-tight text-[#0F1419] [font-family:'Geist_Mono',monospace]"
              htmlFor="fullName"
            >
              Full Name
            </label>
            <div className="relative rounded-[6px] border border-transparent bg-[#F1F3F5] transition-[border-color,box-shadow] duration-150 focus-within:border-[#2C5EF5] focus-within:shadow-[0_0_0_3px_rgba(44,94,245,0.15)]">
              <span
                className="pointer-events-none absolute left-3.5 top-1/2 flex -translate-y-1/2 items-center justify-center text-[#4A5568]"
                aria-hidden="true"
              >
                <User size={16} strokeWidth={2} />
              </span>
              <input
                id="fullName"
                name="fullName"
                className="min-h-11 w-full border-0 bg-transparent px-4 py-3 pl-10 text-[0.95rem] text-[#0F1419] outline-none placeholder:text-[#4A5568]"
                type="text"
                value={formState.fullName}
                onChange={handleChange}
                onBlur={handleBlur}
                placeholder="Juan dela Cruz"
                autoComplete="name"
                required
                aria-invalid={shouldShowError('fullName')}
                aria-describedby={
                  shouldShowError('fullName') ? 'fullName-error' : undefined
                }
              />
            </div>
            {shouldShowError('fullName') ? (
              <p
                id="fullName-error"
                className="mb-0 mt-2 text-xs leading-snug text-[#B42318]"
                role="alert"
              >
                {errors.fullName}
              </p>
            ) : null}
          </div>

          <div className="flex flex-col">
            <label
              className="mb-2 block text-xs font-medium leading-tight text-[#0F1419] [font-family:'Geist_Mono',monospace]"
              htmlFor="email"
            >
              Email
            </label>
            <div className="relative rounded-[6px] border border-transparent bg-[#F1F3F5] transition-[border-color,box-shadow] duration-150 focus-within:border-[#2C5EF5] focus-within:shadow-[0_0_0_3px_rgba(44,94,245,0.15)]">
              <span
                className="pointer-events-none absolute left-3.5 top-1/2 flex -translate-y-1/2 items-center justify-center text-[#4A5568]"
                aria-hidden="true"
              >
                <Mail size={16} strokeWidth={2} />
              </span>
              <input
                id="email"
                name="email"
                className="min-h-11 w-full border-0 bg-transparent px-4 py-3 pl-10 text-[0.95rem] text-[#0F1419] outline-none placeholder:text-[#4A5568]"
                type="email"
                value={formState.email}
                onChange={handleChange}
                onBlur={handleBlur}
                placeholder="juandelacruz@example.com"
                autoComplete="email"
                required
                aria-invalid={shouldShowError('email')}
                aria-describedby={
                  shouldShowError('email') ? 'email-error' : undefined
                }
              />
            </div>
            {shouldShowError('email') ? (
              <p
                id="email-error"
                className="mb-0 mt-2 text-xs leading-snug text-[#B42318]"
                role="alert"
              >
                {errors.email}
              </p>
            ) : null}
          </div>

          <div className="flex flex-col">
            <label
              className="mb-2 block text-xs font-medium leading-tight text-[#0F1419] [font-family:'Geist_Mono',monospace]"
              htmlFor="password"
            >
              Password
            </label>
            <div className="relative rounded-[6px] border border-transparent bg-[#F1F3F5] transition-[border-color,box-shadow] duration-150 focus-within:border-[#2C5EF5] focus-within:shadow-[0_0_0_3px_rgba(44,94,245,0.15)]">
              <span
                className="pointer-events-none absolute left-3.5 top-1/2 flex -translate-y-1/2 items-center justify-center text-[#4A5568]"
                aria-hidden="true"
              >
                <Lock size={16} strokeWidth={2} />
              </span>
              <input
                id="password"
                name="password"
                className="min-h-11 w-full border-0 bg-transparent px-4 py-3 pl-10 pr-12 text-[0.95rem] text-[#0F1419] outline-none placeholder:text-[#4A5568]"
                type={formState.showPassword ? 'text' : 'password'}
                value={formState.password}
                onChange={handleChange}
                onBlur={handleBlur}
                placeholder="••••••••"
                autoComplete="new-password"
                required
                aria-invalid={shouldShowError('password')}
                aria-describedby={
                  shouldShowError('password') ? 'password-error' : undefined
                }
              />
              <div className="absolute right-0 top-1/2 flex -translate-y-1/2 items-center justify-center">
                <button
                  type="button"
                  className="inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-[6px] border-0 bg-transparent p-0 text-[#4A5568] transition-colors duration-150 hover:text-[#0F1419] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#2C5EF5]"
                  aria-label={
                    formState.showPassword ? 'Hide password' : 'Show password'
                  }
                  onClick={() =>
                    setFormState((currentState) => ({
                      ...currentState,
                      showPassword: !currentState.showPassword,
                    }))
                  }
                >
                  {formState.showPassword ? (
                    <EyeOff size={16} strokeWidth={2} aria-hidden="true" />
                  ) : (
                    <Eye size={16} strokeWidth={2} aria-hidden="true" />
                  )}
                </button>
              </div>
            </div>
            {shouldShowError('password') ? (
              <p
                id="password-error"
                className="mb-0 mt-2 text-xs leading-snug text-[#B42318]"
                role="alert"
              >
                {errors.password}
              </p>
            ) : null}
          </div>

          <div className="flex flex-col">
            <label
              className="mb-2 block text-xs font-medium leading-tight text-[#0F1419] [font-family:'Geist_Mono',monospace]"
              htmlFor="confirmPassword"
            >
              Confirm Password
            </label>
            <div className="relative rounded-[6px] border border-transparent bg-[#F1F3F5] transition-[border-color,box-shadow] duration-150 focus-within:border-[#2C5EF5] focus-within:shadow-[0_0_0_3px_rgba(44,94,245,0.15)]">
              <span
                className="pointer-events-none absolute left-3.5 top-1/2 flex -translate-y-1/2 items-center justify-center text-[#4A5568]"
                aria-hidden="true"
              >
                <Lock size={16} strokeWidth={2} />
              </span>
              <input
                id="confirmPassword"
                name="confirmPassword"
                className="min-h-11 w-full border-0 bg-transparent px-4 py-3 pl-10 pr-12 text-[0.95rem] text-[#0F1419] outline-none placeholder:text-[#4A5568]"
                type={formState.showConfirmPassword ? 'text' : 'password'}
                value={formState.confirmPassword}
                onChange={handleChange}
                onBlur={handleBlur}
                placeholder="••••••••"
                autoComplete="new-password"
                required
                aria-invalid={shouldShowError('confirmPassword')}
                aria-describedby={
                  shouldShowError('confirmPassword')
                    ? 'confirmPassword-error'
                    : undefined
                }
              />
              <div className="absolute right-0 top-1/2 flex -translate-y-1/2 items-center justify-center">
                <button
                  type="button"
                  className="inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-[6px] border-0 bg-transparent p-0 text-[#4A5568] transition-colors duration-150 hover:text-[#0F1419] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#2C5EF5]"
                  aria-label={
                    formState.showConfirmPassword
                      ? 'Hide password'
                      : 'Show password'
                  }
                  onClick={() =>
                    setFormState((currentState) => ({
                      ...currentState,
                      showConfirmPassword: !currentState.showConfirmPassword,
                    }))
                  }
                >
                  {formState.showConfirmPassword ? (
                    <EyeOff size={16} strokeWidth={2} aria-hidden="true" />
                  ) : (
                    <Eye size={16} strokeWidth={2} aria-hidden="true" />
                  )}
                </button>
              </div>
            </div>
            {shouldShowError('confirmPassword') ? (
              <p
                id="confirmPassword-error"
                className="mb-0 mt-2 text-xs leading-snug text-[#B42318]"
                role="alert"
              >
                {errors.confirmPassword}
              </p>
            ) : null}
          </div>

          <button
            className="mt-2 w-full cursor-pointer rounded-[10px] border-0 bg-[#2C5EF5] p-3.5 text-[0.95rem] font-semibold tracking-[0.08em] text-white transition-[background-color,box-shadow,transform] duration-150 hover:bg-[#1F4CE0] hover:shadow-[0_12px_30px_rgba(44,94,245,0.24)] active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-[#2C5EF5]"
            type="submit"
          >
            SIGN UP
          </button>
        </div>

        <p className="mb-0 mt-6 text-center text-[0.95rem] leading-[1.4] text-[#4A5568]">
          Already have an account?{' '}
          <a
            className="text-[#2C5EF5] no-underline hover:underline"
            href="/login"
          >
            Log in
          </a>
        </p>
      </form>
    </main>
  )
}

export default RegistrationPage
