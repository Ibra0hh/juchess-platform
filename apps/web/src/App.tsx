import { lazy, Suspense } from 'react'
import { Link, Navigate, Route, Routes } from 'react-router-dom'
import './App.css'
import { AuthProvider } from './context/AuthContext'
import { TournamentPlayProvider } from './context/TournamentPlayContext'
import { TournamentPlayGuard } from './components/TournamentPlayGuard'
import RouteSkeleton from './components/RouteSkeleton'
import { useOnlineTournamentPlayLock } from './lib/onlineTournamentPlayLock'

const AuthPage = lazy(() => import('./screens/AuthPage'))
const AttendanceConfirmPage = lazy(() => import('./screens/AttendanceConfirmPage'))
const ForgotPasswordPage = lazy(() => import('./screens/ForgotPasswordPage'))
const GamesPage = lazy(() => import('./screens/GamesPage'))
const HomePage = lazy(() => import('./screens/HomePage'))
const LeaderboardPage = lazy(() => import('./screens/LeaderboardPage'))
const OnlineGamesPage = lazy(() => import('./screens/OnlineGamesPage'))
const OAuthCallbackPage = lazy(() => import('./screens/OAuthCallbackPage'))
const CompleteProfilePage = lazy(() => import('./screens/CompleteProfilePage'))
const ProfilePage = lazy(() => import('./screens/ProfilePage'))
const TournamentDetailPage = lazy(() => import('./screens/TournamentDetailPage'))
const TournamentsPage = lazy(() => import('./screens/TournamentsPage'))
const VerifyEmailPage = lazy(() => import('./screens/VerifyEmailPage'))

function NotFound() {
  return (
    <main className="prototype-missing">
      <img src={`${import.meta.env.BASE_URL}juchess-logo.png`} alt="JuChess logo" />
      <h1>Screen not found</h1>
      <Link to="/home">Open JuChess Home</Link>
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
          <Suspense fallback={<RouteSkeleton />}>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/home" element={<HomePage />} />
              <Route path="/tournaments" element={<TournamentsPage />} />
              <Route path="/attendance-confirm" element={<AttendanceConfirmPage />} />
              <Route path="/tournament/:id" element={<TournamentDetailPage />} />
              <Route path="/sign-in" element={<AuthPage mode="sign-in" />} />
              <Route path="/sign-up" element={<AuthPage mode="sign-up" />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/verify-email" element={<VerifyEmailPage />} />
              <Route path="/auth/callback" element={<OAuthCallbackPage />} />
              <Route path="/complete-profile" element={<CompleteProfilePage />} />
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
