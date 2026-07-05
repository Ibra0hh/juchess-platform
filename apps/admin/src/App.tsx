import { Navigate, Route, Routes } from 'react-router-dom'
import './App.css'

function AdminPrototypeFrame() {
  const prototypeUrl = new URL(
    'prototype/ChessJU Admin.dc.html',
    new URL(import.meta.env.BASE_URL, window.location.origin),
  )

  return (
    <iframe
      className="prototype-frame"
      src={prototypeUrl.toString()}
      title="ChessJU Admin"
    />
  )
}

function AdminNotFound() {
  return (
    <main className="prototype-missing">
      <img src={`${import.meta.env.BASE_URL}juchess-logo.png`} alt="JuChess logo" />
      <h1>Admin screen not found</h1>
      <a href="/admin">Open Admin Panel</a>
    </main>
  )
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/admin" replace />} />
      <Route path="/admin" element={<AdminPrototypeFrame />} />
      <Route path="/admin/*" element={<AdminPrototypeFrame />} />
      <Route path="*" element={<AdminNotFound />} />
    </Routes>
  )
}

export default App
