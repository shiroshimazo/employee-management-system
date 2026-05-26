import LoginPage from './pages/auth/LoginPage.jsx'
import RegistrationPage from './pages/auth/RegistrationPage.jsx'

function App() {
  const currentPath = window.location.pathname.toLowerCase()

  if (currentPath === '/register' || currentPath === '/signup') {
    return <RegistrationPage />
  }

  return <LoginPage />
}

export default App
