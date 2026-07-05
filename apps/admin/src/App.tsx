import { useEffect } from 'react'
import './App.css'

function App() {
  useEffect(() => {
    window.location.replace('/prototype/ChessJU%20Admin.dc.html')
  }, [])

  return (
    <main className="prototype-handoff">
      <img src="/juchess-logo.png" alt="JuChess logo" />
      <h1>Opening ChessJU Admin</h1>
      <p>Loading the approved admin prototype...</p>
    </main>
  )
}

export default App
