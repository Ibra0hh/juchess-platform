import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import './App.css'
import { AuthProvider } from './context/AuthContext'
import AuthPage from './screens/AuthPage'
import ForgotPasswordPage from './screens/ForgotPasswordPage'
import TournamentDetailPage from './screens/TournamentDetailPage'
import TournamentsPage from './screens/TournamentsPage'

type PrototypeScreen = {
  route: string
  title: string
  file: string
}

const prototypeScreens: PrototypeScreen[] = [
  { route: '/home', title: 'JuChess Home', file: 'Home.dc.html' },
  { route: '/games', title: 'JuChess Games', file: 'Games.dc.html' },
  { route: '/leaderboard', title: 'JuChess Leaderboard', file: 'Leaderboard.dc.html' },
  { route: '/profile', title: 'JuChess Profile', file: 'Profile.dc.html' },
  { route: '/tools', title: 'JuChess Tools', file: 'Tools.dc.html' },
]

function PrototypeFrame({ screen }: { screen: PrototypeScreen }) {
  const location = useLocation()
  const preview = previewSessionFromSearch(location.search)
  const prototypeUrl = new URL(
    `prototype/${screen.file}`,
    new URL(import.meta.env.BASE_URL, window.location.origin),
  )

  if (preview) {
    preview.searchParams.forEach((value, key) => {
      prototypeUrl.searchParams.set(key, value)
    })
  }

  if (screen.file === 'Tournament.dc.html' && location.pathname.includes('/tournament/')) {
    const id = location.pathname.split('/').filter(Boolean).at(-1)
    if (id) {
      prototypeUrl.searchParams.set('id', id)
    }
  }

  return (
    <iframe
      className="prototype-frame"
      src={prototypeUrl.toString()}
      title={screen.title}
    />
  )
}

function NotFound() {
  return (
    <main className="prototype-missing">
      <img src={`${import.meta.env.BASE_URL}juchess-logo.png`} alt="JuChess logo" />
      <h1>Screen not found</h1>
      <a href="/home">Open JuChess Home</a>
    </main>
  )
}

function previewSessionFromSearch(search: string) {
  const searchParams = new URLSearchParams(search)
  if (searchParams.get('adminPreview') !== '1') return null

  return { searchParams }
}

function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<Navigate to="/home" replace />} />
        <Route path="/tournaments" element={<TournamentsPage />} />
        <Route path="/tournament/:id" element={<TournamentDetailPage />} />
        <Route path="/sign-in" element={<AuthPage mode="sign-in" />} />
        <Route path="/sign-up" element={<AuthPage mode="sign-up" />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        {prototypeScreens.map((screen) => (
          <Route
            key={screen.route}
            path={screen.route}
            element={<PrototypeFrame screen={screen} />}
          />
        ))}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AuthProvider>
  )
}

export default App
