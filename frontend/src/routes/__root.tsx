import { createRootRoute, Outlet } from '@tanstack/react-router'

export const Route = createRootRoute({
  component: () => (
    <div className="app-layout">
      <header className="app-header">
        <h1 className="app-header__wordmark">
          <span className="app-header__fire">Fire</span>
          <span className="app-header__shire">Shire</span>
        </h1>
      </header>
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  ),
});
