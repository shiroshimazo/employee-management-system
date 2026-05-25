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
    <main className="flex min-h-dvh items-center justify-center bg-white px-6 py-8 [font-family:'Geist',sans-serif]">
      <form
        className="w-full max-w-[360px] rounded-2xl border border-slate-200 bg-white p-8 shadow-[0_24px_70px_rgba(15,20,25,0.08)] max-[420px]:p-5"
        onSubmit={handleSubmit}
        aria-label="Login form"
      >
        <header className="mb-8 text-center">
          <h1 className="m-0 text-4xl font-bold leading-[1.05] text-[#0F1419] max-[420px]:text-[2rem]">
            Login to your account
          </h1>
          <p className="mb-0 mt-3 text-[0.95rem] font-normal leading-[1.45] text-[#4A5568]">
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
                className="mb-2 whitespace-nowrap text-xs leading-tight text-[#2C5EF5] no-underline hover:underline"
                href="/forgot-password"
              >
                Forgot your password?
              </a>
            }
            trailingAction={
              <button
                type="button"
                className="inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-[6px] border-0 bg-transparent p-0 text-[#4A5568] transition-colors duration-150 hover:text-[#0F1419] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#2C5EF5]"
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
            className="mt-2 w-full cursor-pointer rounded-[10px] border-0 bg-[#2C5EF5] p-3.5 text-[0.95rem] font-semibold tracking-[0.08em] text-white transition-[background-color,box-shadow,transform] duration-150 hover:bg-[#1F4CE0] hover:shadow-[0_12px_30px_rgba(44,94,245,0.24)] active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-[#2C5EF5]"
            type="submit"
          >
            LOGIN
          </button>
        </div>

        <p className="mb-0 mt-6 text-center text-[0.95rem] leading-[1.4] text-[#4A5568]">
          Don't have an account?{' '}
          <a
            className="text-[#2C5EF5] no-underline hover:underline"
            href="/signup"
          >
            Sign up
          </a>
        </p>
      </form>
    </main>
  )
}

export default LoginForm
