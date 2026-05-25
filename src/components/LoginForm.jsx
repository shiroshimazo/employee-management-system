import { useState } from 'react'
import { Eye, EyeOff, Lock, Mail } from 'lucide-react'
import InputField from './InputField.jsx'

function LoginForm() {
  const [showPassword, setShowPassword] = useState(false)
  const [formValues, setFormValues] = useState({
    email: '',
    password: '',
  })

  const handleChange = (event) => {
    const { name, value } = event.target

    setFormValues((currentValues) => ({
      ...currentValues,
      [name]: value,
    }))
  }

  const handleSubmit = (event) => {
    event.preventDefault()
  }

  return (
    <section
      className="flex min-h-screen items-center justify-center bg-[#0F1419] px-4 py-6 [font-family:'Geist',sans-serif]"
      aria-label="Employee login"
    >
      <form
        className="w-full max-w-[424px] rounded-2xl border border-white/[0.08] bg-[#0F1419] p-8 max-[420px]:p-5"
        onSubmit={handleSubmit}
      >
        <header className="mb-8 text-center">
          <h1 className="m-0 text-4xl font-bold leading-[1.05] text-white max-[420px]:text-[2rem]">
            Login to your account
          </h1>
          <p className="mt-3 mb-0 text-[0.95rem] font-normal leading-[1.45] text-[#4A5568]">
            Enter your email below
            <br />
            to login to your account
          </p>
        </header>

        <div className="flex flex-col gap-4">
          <InputField
            id="email"
            name="email"
            label="Email"
            type="email"
            value={formValues.email}
            onChange={handleChange}
            placeholder="m@example.com"
            autoComplete="email"
            leadingIcon={<Mail size={16} strokeWidth={2} />}
          />

          <InputField
            id="password"
            name="password"
            label="Password"
            type={showPassword ? 'text' : 'password'}
            value={formValues.password}
            onChange={handleChange}
            placeholder="••••••••"
            autoComplete="current-password"
            leadingIcon={<Lock size={16} strokeWidth={2} />}
            labelAddon={
              <a
                className="mb-2 whitespace-nowrap text-xs text-[#2C5EF5] no-underline hover:underline"
                href="/forgot-password"
              >
                Forgot your password?
              </a>
            }
            trailingAction={
              <button
                type="button"
                className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-[6px] border-0 bg-transparent p-0 text-[#4A5568] transition-colors duration-150 hover:text-[#0F1419] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2C5EF5]"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                onClick={() => setShowPassword((isVisible) => !isVisible)}
              >
                {showPassword ? (
                  <EyeOff size={16} strokeWidth={2} aria-hidden="true" />
                ) : (
                  <Eye size={16} strokeWidth={2} aria-hidden="true" />
                )}
              </button>
            }
          />

          <button
            className="mt-2 w-full cursor-pointer rounded-[10px] border-0 bg-white p-3.5 text-[0.95rem] font-semibold text-[#0F1419] transition-[background-color,box-shadow,transform] duration-150 hover:bg-[#F1F3F5] hover:shadow-[0_12px_30px_rgba(0,0,0,0.18)] active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-[#2C5EF5]"
            type="submit"
          >
            LOGIN
          </button>
        </div>

        <p className="mt-6 mb-0 text-center text-[0.95rem] leading-[1.4] text-[#4A5568]">
          Don't have an account?{' '}
          <a className="text-[#2C5EF5] no-underline hover:underline" href="/signup">
            Sign up
          </a>
        </p>
      </form>
    </section>
  )
}

export default LoginForm
