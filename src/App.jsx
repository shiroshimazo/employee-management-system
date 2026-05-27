import LoginPage from './pages/auth/LoginPage.jsx'
import RegistrationPage from './pages/auth/RegistrationPage.jsx'
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage.jsx'
import { useAuth } from './hooks/useAuth.js'

function App() {
  const { user, profile, loading, signOut } = useAuth()
  const currentPath = window.location.pathname.toLowerCase()

  if (loading) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-white [font-family:'Geist',sans-serif] text-[#4A5568]">
        Loading…
      </main>
    )
  }

  if (currentPath === '/register' || currentPath === '/signup') {
    return <RegistrationPage />
  }

  if (currentPath === '/forgot-password') {
    return <ForgotPasswordPage />
  }

  if (!user) {
    return <LoginPage />
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-white px-6 py-8 [font-family:'Geist',sans-serif]">
      <h1 className="m-0 text-3xl font-bold text-[#0F1419]">
        Signed in as {profile?.full_name || user.email}
      </h1>
      <p className="m-0 text-sm text-[#4A5568]">
        Role: <span className="font-semibold text-[#0F1419]">{profile?.role ?? 'unknown'}</span>
      </p>
      <button
        type="button"
        onClick={async () => {
          await signOut()
          window.location.assign('/login')
        }}
        className="cursor-pointer rounded-[10px] border-0 bg-[#2C5EF5] px-5 py-3 text-[0.95rem] font-semibold tracking-[0.08em] text-white transition-[background-color,box-shadow,transform] duration-150 hover:bg-[#1F4CE0] hover:shadow-[0_12px_30px_rgba(44,94,245,0.24)] active:scale-[0.98]"
      >
        SIGN OUT
      </button>
    </main>
  )
}

export default App
