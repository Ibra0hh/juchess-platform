import { useEffect } from 'react'
import './App.css'

function App() {
  useEffect(() => {
    window.location.replace('/prototype/Home.dc.html')
  }, [])

  return (
    <main className="prototype-handoff">
      <img src="/juchess-logo.png" alt="JuChess logo" />
      <h1>Opening JuChess</h1>
      <p>Loading the approved web prototype...</p>
    </main>
  )
}

export default App
