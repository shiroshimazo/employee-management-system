import LoginPage from './pages/auth/LoginPage.jsx'
import RegistrationPage from './pages/auth/RegistrationPage.jsx'
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage.jsx'

function App() {
  const currentPath = window.location.pathname.toLowerCase()

  if (currentPath === '/register' || currentPath === '/signup') {
    return <RegistrationPage />
  }

  if (currentPath === '/forgot-password') {
    return <ForgotPasswordPage />
  }

  return <LoginPage />
}

export default App
