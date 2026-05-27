import LoginPage from './pages/auth/LoginPage.jsx'
import RegistrationPage from './pages/auth/RegistrationPage.jsx'
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage.jsx'
import ResetPasswordPage from './pages/auth/ResetPasswordPage.jsx'

function App() {
  const currentPath = window.location.pathname.toLowerCase()

  if (currentPath === '/register' || currentPath === '/signup') {
    return <RegistrationPage />
  }

  if (currentPath === '/forgot-password') {
    return <ForgotPasswordPage />
  }

  if (currentPath === '/reset-password') {
    return <ResetPasswordPage />
  }

  return <LoginPage />
}

export default App
