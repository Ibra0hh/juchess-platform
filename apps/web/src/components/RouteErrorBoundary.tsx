import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { compactCrestUrl } from '../lib/brand'
import { routeBoundaryKey } from '../lib/routePath'

type BoundaryState = { failed: boolean }

class RouteErrorBoundaryInner extends Component<{ children: ReactNode }, BoundaryState> {
  state: BoundaryState = { failed: false }

  static getDerivedStateFromError(): BoundaryState {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('JuChess route render failed.', error, info)
  }

  render() {
    if (!this.state.failed) return this.props.children

    return (
      <main className="prototype-missing" role="alert">
        <img src={compactCrestUrl} alt="JuChess logo" />
        <h1>This page could not be loaded</h1>
        <p>Reload the latest JuChess files, or return home and try again.</p>
        <button type="button" onClick={() => window.location.reload()}>Reload page</button>
        <Link to="/home">Return to JuChess Home</Link>
      </main>
    )
  }
}

export default function RouteErrorBoundary({ children }: { children: ReactNode }) {
  const location = useLocation()
  return <RouteErrorBoundaryInner key={routeBoundaryKey(location.pathname)}>{children}</RouteErrorBoundaryInner>
}
