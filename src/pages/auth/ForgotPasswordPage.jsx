import { useState } from 'react'
import { Mail, MailCheck } from 'lucide-react'
import { motion } from 'framer-motion'
import { requestPasswordReset } from '../../services/auth.service.js'
import { fadeDown } from '../../lib/motion.js'

function ForgotPasswordPage() {
  const [formValues, setFormValues] = useState({
    email: '',
  })
  const [submitted, setSubmitted] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleChange = (event) => {
    const { name, value } = event.target

    setFormValues((currentValues) => ({
      ...currentValues,
      [name]: value,
    }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setSubmitError('')
    setIsSubmitting(true)

    const { error } = await requestPasswordReset(formValues.email)

    setIsSubmitting(false)

    if (error) {
      setSubmitError(error.message)
      return
    }

    setSubmitted(true)
  }

  const handleBackToLogin = () => {
    window.location.assign('/login')
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-white px-6 py-8 [font-family:'Geist',sans-serif]">
      {submitted ? (
        <motion.div
          {...fadeDown}
          className="w-full max-w-[360px] rounded-2xl border border-slate-200 bg-white p-8 shadow-[0_24px_70px_rgba(15,20,25,0.08)] max-[420px]:p-5"
          role="status"
          aria-live="polite"
        >
          <header className="mb-8 text-center">
            <div className="mb-4 flex justify-center text-[#2C5EF5]">
              <MailCheck size={40} strokeWidth={2} aria-hidden="true" />
            </div>
            <h1 className="m-0 text-4xl font-bold leading-[1.05] text-[#0F1419] max-[420px]:text-[2rem]">
              Check your email
            </h1>
            <p className="mb-0 mt-3 text-[0.95rem] font-normal leading-[1.45] text-[#4A5568]">
              We sent a password reset link to{' '}
              <span className="font-semibold text-[#0F1419]">
                {formValues.email}
              </span>
              .
            </p>
          </header>

          <button
            className="mt-2 w-full cursor-pointer rounded-[10px] border-0 bg-[#2C5EF5] p-3.5 text-[0.95rem] font-semibold tracking-[0.08em] text-white transition-[background-color,box-shadow,transform] duration-150 hover:bg-[#1F4CE0] hover:shadow-[0_12px_30px_rgba(44,94,245,0.24)] active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-[#2C5EF5]"
            type="button"
            onClick={handleBackToLogin}
          >
            BACK TO LOGIN
          </button>
        </motion.div>
      ) : (
        <motion.form
          {...fadeDown}
          className="w-full max-w-[360px] rounded-2xl border border-slate-200 bg-white p-8 shadow-[0_24px_70px_rgba(15,20,25,0.08)] max-[420px]:p-5"
          onSubmit={handleSubmit}
          aria-label="Forgot password form"
        >
          <header className="mb-8 text-center">
            <h1 className="m-0 text-4xl font-bold leading-[1.05] text-[#0F1419] max-[420px]:text-[2rem]">
              Forgot your password?
            </h1>
            <p className="mb-0 mt-3 text-[0.95rem] font-normal leading-[1.45] text-[#4A5568]">
              Enter your email and we'll send you
              <br />
              a reset link.
            </p>
          </header>

          <div className="flex flex-col gap-4">
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
                  value={formValues.email}
                  onChange={handleChange}
                  placeholder="juandelacruz@example.com"
                  autoComplete="email"
                  required
                />
              </div>
            </div>

            <button
              className="mt-2 w-full cursor-pointer rounded-[10px] border-0 bg-[#2C5EF5] p-3.5 text-[0.95rem] font-semibold tracking-[0.08em] text-white transition-[background-color,box-shadow,transform] duration-150 hover:bg-[#1F4CE0] hover:shadow-[0_12px_30px_rgba(44,94,245,0.24)] active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-[#2C5EF5] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-[#2C5EF5] disabled:hover:shadow-none"
              type="submit"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'SENDING…' : 'SEND RESET LINK'}
            </button>

            {submitError ? (
              <p
                className="mb-0 mt-1 text-center text-xs leading-snug text-[#B42318]"
                role="alert"
              >
                {submitError}
              </p>
            ) : null}
          </div>

          <p className="mb-0 mt-6 text-center text-[0.95rem] leading-[1.4] text-[#4A5568]">
            Remember your password?{' '}
            <a
              className="text-[#2C5EF5] no-underline hover:underline"
              href="/login"
            >
              Log in
            </a>
          </p>
        </motion.form>
      )}
    </main>
  )
}

export default ForgotPasswordPage
