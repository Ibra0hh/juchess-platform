import { useEffect } from 'react'
import './App.css'

function App() {
  useEffect(() => {
    window.location.replace(new URL('prototype/Home.dc.html', window.location.href).toString())
  }, [])

  return (
    <main className="prototype-handoff">
      <img src={`${import.meta.env.BASE_URL}juchess-logo.png`} alt="JuChess logo" />
      <h1>Opening JuChess</h1>
      <p>Loading the approved web prototype...</p>
    </main>
  )
}

export default App
