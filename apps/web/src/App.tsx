import { Navigate, Route, Routes } from 'react-router-dom'
import './App.css'
import { AuthProvider } from './context/AuthContext'
import AuthPage from './screens/AuthPage'
import ForgotPasswordPage from './screens/ForgotPasswordPage'
import GamesPage from './screens/GamesPage'
import HomePage from './screens/HomePage'
import LeaderboardPage from './screens/LeaderboardPage'
import ProfilePage from './screens/ProfilePage'
import ToolsPage from './screens/ToolsPage'
import TournamentDetailPage from './screens/TournamentDetailPage'
import TournamentsPage from './screens/TournamentsPage'

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
        <Route path="/games" element={<GamesPage />} />
        <Route path="/tools" element={<ToolsPage />} />
        <Route path="/leaderboard" element={<LeaderboardPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AuthProvider>
  )
}

export default App
