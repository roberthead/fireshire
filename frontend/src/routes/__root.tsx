import { createRootRoute, Outlet } from '@tanstack/react-router'

export const Route = createRootRoute({
  component: () => (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header style={{ padding: '0.5rem 1rem', background: '#1a1a1a', color: '#fff' }}>
        <h1 style={{ margin: 0, fontSize: '1.25rem' }}>Fireshire</h1>
      </header>
      <main style={{ flex: 1, position: 'relative' }}>
        <Outlet />
      </main>
    </div>
  ),
})
