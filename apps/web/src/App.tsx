import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import './App.css'
import { AuthProvider } from './context/AuthContext'
import { TournamentPlayProvider } from './context/TournamentPlayContext'
import { TournamentPlayGuard } from './components/TournamentPlayGuard'
import { useOnlineTournamentPlayLock } from './lib/onlineTournamentPlayLock'

const AuthPage = lazy(() => import('./screens/AuthPage'))
const ForgotPasswordPage = lazy(() => import('./screens/ForgotPasswordPage'))
const GamesPage = lazy(() => import('./screens/GamesPage'))
const HomePage = lazy(() => import('./screens/HomePage'))
const LeaderboardPage = lazy(() => import('./screens/LeaderboardPage'))
const OnlineGamesPage = lazy(() => import('./screens/OnlineGamesPage'))
const ProfilePage = lazy(() => import('./screens/ProfilePage'))
const TournamentDetailPage = lazy(() => import('./screens/TournamentDetailPage'))
const TournamentsPage = lazy(() => import('./screens/TournamentsPage'))

function RouteLoading() {
  return <main className="route-loading" role="status">Loading JuChess…</main>
}

function NotFound() {
  const homeUrl = `${import.meta.env.BASE_URL}home`

  return (
    <main className="prototype-missing">
      <img src={`${import.meta.env.BASE_URL}juchess-logo.png`} alt="JuChess logo" />
      <h1>Screen not found</h1>
      <a href={homeUrl}>Open JuChess Home</a>
    </main>
  )
}

function ToolsRoute() {
  const playLock = useOnlineTournamentPlayLock()
  if (playLock) return <Navigate to={`/games?game=${encodeURIComponent(playLock.gameId)}`} replace />
  return <GamesPage />
}

function App() {
  return (
    <AuthProvider>
      <TournamentPlayProvider>
        <TournamentPlayGuard>
          <Suspense fallback={<RouteLoading />}>
            <Routes>
              <Route path="/" element={<Navigate to="/home" replace />} />
              <Route path="/home" element={<HomePage />} />
              <Route path="/tournaments" element={<TournamentsPage />} />
              <Route path="/tournament/:id" element={<TournamentDetailPage />} />
              <Route path="/sign-in" element={<AuthPage mode="sign-in" />} />
              <Route path="/sign-up" element={<AuthPage mode="sign-up" />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/games" element={<OnlineGamesPage />} />
              <Route path="/tools" element={<ToolsRoute />} />
              <Route path="/leaderboard" element={<LeaderboardPage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </TournamentPlayGuard>
      </TournamentPlayProvider>
    </AuthProvider>
  )
}

export default App
