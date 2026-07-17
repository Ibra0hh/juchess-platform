import { lazy, Suspense, useEffect } from 'react'
import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import './App.css'
import { AuthProvider } from './context/AuthContext'
import { TournamentPlayProvider } from './context/TournamentPlayContext'
import { TournamentPlayGuard } from './components/TournamentPlayGuard'
import { ProfileCompletionGuard } from './components/ProfileCompletionGuard'
import RouteSkeleton from './components/RouteSkeleton'
import RouteMetadata from './components/RouteMetadata'
import RouteErrorBoundary from './components/RouteErrorBoundary'
import { compactCrestUrl } from './lib/brand'
import { useOnlineTournamentPlayLock } from './lib/onlineTournamentPlayLock'

const AuthPage = lazy(() => import('./screens/AuthPage'))
const AttendanceConfirmPage = lazy(() => import('./screens/AttendanceConfirmPage'))
const ForgotPasswordPage = lazy(() => import('./screens/ForgotPasswordPage'))
const GamesPage = lazy(() => import('./screens/GamesPage'))
const HomePage = lazy(() => import('./screens/HomePage'))
const LeaderboardPage = lazy(() => import('./screens/LeaderboardPage'))
const LegalPage = lazy(() => import('./screens/LegalPage'))
const OnlineGamesPage = lazy(() => import('./screens/OnlineGamesPage'))
const OAuthCallbackPage = lazy(() => import('./screens/OAuthCallbackPage'))
const CompleteProfilePage = lazy(() => import('./screens/CompleteProfilePage'))
const ProfilePage = lazy(() => import('./screens/ProfilePage'))
const RecruitmentPage = lazy(() => import('./screens/RecruitmentPage'))
const TournamentDetailPage = lazy(() => import('./screens/TournamentDetailPage'))
const TournamentsPage = lazy(() => import('./screens/TournamentsPage'))
const VerifyEmailPage = lazy(() => import('./screens/VerifyEmailPage'))

function NotFound() {
  return (
    <main className="prototype-missing">
      <img src={compactCrestUrl} alt="JuChess logo" />
      <h1>Page not found</h1>
      <Link to="/home">Open JuChess Home</Link>
    </main>
  )
}

function ToolsRoute() {
  const playLock = useOnlineTournamentPlayLock()
  if (playLock) return <Navigate to={`/games?game=${encodeURIComponent(playLock.gameId)}`} replace />
  return <GamesPage />
}

function ScrollToTop() {
  const { pathname } = useLocation()

  useEffect(() => {
    window.scrollTo({ left: 0, top: 0 })
  }, [pathname])

  return null
}

function App() {
  return (
    <AuthProvider>
      <ScrollToTop />
      <ProfileCompletionGuard>
        <TournamentPlayProvider>
          <TournamentPlayGuard>
            <RouteMetadata />
            <RouteErrorBoundary>
              <Suspense fallback={<RouteSkeleton />}>
                <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/home" element={<HomePage />} />
              <Route path="/tournaments" element={<TournamentsPage />} />
              <Route path="/attendance-confirm" element={<AttendanceConfirmPage />} />
              <Route path="/tournament/:id" element={<TournamentDetailPage />} />
              <Route path="/sign-in" element={<AuthPage key="sign-in" mode="sign-in" />} />
              <Route path="/sign-up" element={<AuthPage key="sign-up" mode="sign-up" />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/verify-email" element={<VerifyEmailPage />} />
              <Route path="/auth/callback" element={<OAuthCallbackPage />} />
              <Route path="/complete-profile" element={<CompleteProfilePage />} />
              <Route path="/games" element={<OnlineGamesPage />} />
              <Route path="/tools" element={<ToolsRoute />} />
              <Route path="/leaderboard" element={<LeaderboardPage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/join-the-team" element={<RecruitmentPage />} />
              <Route path="/privacy" element={<LegalPage kind="privacy" />} />
              <Route path="/terms" element={<LegalPage kind="terms" />} />
              <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
            </RouteErrorBoundary>
          </TournamentPlayGuard>
        </TournamentPlayProvider>
      </ProfileCompletionGuard>
    </AuthProvider>
  )
}

export default App
