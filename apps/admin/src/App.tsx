import { useEffect } from 'react'
import './App.css'

function App() {
  useEffect(() => {
    window.location.replace(new URL('prototype/ChessJU%20Admin.dc.html', window.location.href).toString())
  }, [])

  return (
    <main className="prototype-handoff">
      <img src={`${import.meta.env.BASE_URL}juchess-logo.png`} alt="JuChess logo" />
      <h1>Opening ChessJU Admin</h1>
      <p>Loading the approved admin prototype...</p>
    </main>
  )
}

export default App
