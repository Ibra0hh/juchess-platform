import { Suspense, lazy } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import './App.css'
import { AuthProvider } from './context/AuthContext'
import AuthPage from './screens/AuthPage'
import ForgotPasswordPage from './screens/ForgotPasswordPage'
import GamesPage from './screens/GamesPage'
import HomePage from './screens/HomePage'
import LeaderboardPage from './screens/LeaderboardPage'
import OnlineGamesPage from './screens/OnlineGamesPage'
import ProfilePage from './screens/ProfilePage'
import TournamentDetailPage from './screens/TournamentDetailPage'
import TournamentsPage from './screens/TournamentsPage'

// Code-split: the Stockfish engine + review pipeline only load on /analysis.
const AnalysisPage = lazy(() => import('./screens/AnalysisPage'))

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

function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<Navigate to="/home" replace />} />
        <Route path="/home" element={<HomePage />} />
        <Route path="/tournaments" element={<TournamentsPage />} />
        <Route path="/tournament/:id" element={<TournamentDetailPage />} />
        <Route path="/sign-in" element={<AuthPage mode="sign-in" />} />
        <Route path="/sign-up" element={<AuthPage mode="sign-up" />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/games" element={<OnlineGamesPage />} />
        <Route
          path="/analysis"
          element={
            <Suspense fallback={<div style={{ minHeight: '100vh', background: '#1f1d1b' }} />}>
              <AnalysisPage />
            </Suspense>
          }
        />
        <Route path="/tools" element={<GamesPage />} />
        <Route path="/leaderboard" element={<LeaderboardPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AuthProvider>
  )
}

export default App
