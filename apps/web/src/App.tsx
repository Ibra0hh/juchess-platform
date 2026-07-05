import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import './App.css'

type PrototypeScreen = {
  route: string
  title: string
  file: string
}

const prototypeScreens: PrototypeScreen[] = [
  { route: '/home', title: 'JuChess Home', file: 'Home.dc.html' },
  { route: '/tournaments', title: 'JuChess Tournaments', file: 'Tournaments.dc.html' },
  { route: '/tournament/:id', title: 'JuChess Tournament', file: 'Tournament.dc.html' },
  { route: '/games', title: 'JuChess Games', file: 'Games.dc.html' },
  { route: '/leaderboard', title: 'JuChess Leaderboard', file: 'Leaderboard.dc.html' },
  { route: '/profile', title: 'JuChess Profile', file: 'Profile.dc.html' },
  { route: '/tools', title: 'JuChess Tools', file: 'Tools.dc.html' },
  { route: '/sign-in', title: 'JuChess Sign In', file: 'Sign In.dc.html' },
  { route: '/sign-up', title: 'JuChess Sign Up', file: 'Sign Up.dc.html' },
  { route: '/forgot-password', title: 'JuChess Forgot Password', file: 'Forgot Password.dc.html' },
]

function PrototypeFrame({ screen }: { screen: PrototypeScreen }) {
  const location = useLocation()
  const prototypeUrl = new URL(
    `prototype/${screen.file}`,
    new URL(import.meta.env.BASE_URL, window.location.origin),
  )

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

function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/home" replace />} />
      {prototypeScreens.map((screen) => (
        <Route
          key={screen.route}
          path={screen.route}
          element={<PrototypeFrame screen={screen} />}
        />
      ))}
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}

export default App
