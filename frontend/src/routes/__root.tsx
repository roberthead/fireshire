import { createRootRoute, Outlet, Link } from '@tanstack/react-router'

export const Route = createRootRoute({
  component: () => (
    <div className="app-layout">
      <header className="app-header">
        <div className="app-header__inner">
          <h1 className="app-header__wordmark">
            <Link to="/" className="app-header__link">
              <span className="app-header__fire">Fire</span>
              <span className="app-header__shire">Shire</span>
            </Link>
          </h1>
          <nav className="app-nav">
            <Link to="/" className="app-nav__link" activeProps={{ className: 'app-nav__link app-nav__link--active' }}>
              Map
            </Link>
            <Link to="/prepare" className="app-nav__link" activeProps={{ className: 'app-nav__link app-nav__link--active' }}>
              Get Fire Ready
            </Link>
          </nav>
        </div>
      </header>
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  ),
});
