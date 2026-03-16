import React, { useContext } from 'react'
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom'
import { Home, Folder, List, Settings, Search, Bell, LogOut, User as UserIcon, Workflow } from 'lucide-react'
import AuthContext from '../context/AuthContext'
import LibraryScanStatus from '../components/LibraryScanStatus'
import '@tabler/core/dist/css/tabler.min.css'

const AdminLayout: React.FC = () => {
  const auth = useContext(AuthContext)
  const navigate = useNavigate()
  const location = useLocation()

  const handleLogout = () => {
    try {
      auth.logout()
    } finally {
      navigate('/login')
    }
  }

  const navItems = [
    { label: 'Dashboard', path: '/dashboard', icon: <Home size={20} /> },
    { label: 'Libraries', path: '/libraries', icon: <Folder size={20} /> },
    { label: 'Pipelines', path: '/pipelines', icon: <Workflow size={20} /> },
    { label: 'Tasks', path: '/tasks', icon: <List size={20} /> },
    { label: 'Settings', path: '/settings', icon: <Settings size={20} /> },
  ]

  return (
    <div className="page">
      {/* Sidebar */}
      <aside className="navbar navbar-vertical navbar-expand-lg" data-bs-theme="dark">
        <div className="container-fluid">
          <button
            className="navbar-toggler"
            type="button"
            data-bs-toggle="collapse"
            data-bs-target="#sidebar-menu"
            aria-controls="sidebar-menu"
            aria-expanded="false"
            aria-label="Toggle navigation"
          >
            <span className="navbar-toggler-icon" />
          </button>

          <h1 className="navbar-brand navbar-brand-autodark">
            <Link to="/dashboard" className="text-decoration-none d-flex align-items-center">
              <span className="h2 mb-0 text-white">MuxMill</span>
            </Link>
          </h1>

          <div className="navbar-nav flex-row d-lg-none">
            <LibraryScanStatus />
            <div className="nav-item dropdown">
              <a href="#" className="nav-link d-flex lh-1 text-reset p-0" data-bs-toggle="dropdown">
                <span className="avatar avatar-sm"><UserIcon size={16} /></span>
              </a>
              <div className="dropdown-menu dropdown-menu-end dropdown-menu-arrow">
                <button onClick={handleLogout} className="dropdown-item">Logout</button>
              </div>
            </div>
          </div>

          <div className="collapse navbar-collapse" id="sidebar-menu">
            <ul className="navbar-nav pt-lg-3">
              {navItems.map((item) => (
                <li key={item.path} className={`nav-item ${location.pathname === item.path ? 'active' : ''}`}>
                  <Link to={item.path} className="nav-link">
                    <span className="nav-link-icon d-md-none d-lg-inline-block">
                      {item.icon}
                    </span>
                    <span className="nav-link-title">{item.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </aside>

      {/* Page wrapper */}
      <div className="page-wrapper">
        {/* Header */}
        <header className="navbar navbar-expand-md d-none d-lg-flex d-print-none sticky-top">
          <div className="container-xl">
            <button className="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbar-menu">
              <span className="navbar-toggler-icon"></span>
            </button>
            <div className="navbar-nav flex-row order-md-last">
              <div className="d-none d-md-flex me-3">
                <LibraryScanStatus />
              </div>
              <div className="nav-item dropdown">
                <a href="#" className="nav-link d-flex lh-1 text-reset p-0" data-bs-toggle="dropdown" aria-label="Open user menu">
                  <span className="avatar avatar-sm"><UserIcon size={16} /></span>
                  <div className="d-none d-xl-block ps-2">
                    <div>Admin User</div>
                    <div className="mt-1 small text-muted">Administrator</div>
                  </div>
                </a>
                <div className="dropdown-menu dropdown-menu-end dropdown-menu-arrow">
                  <a href="#" className="dropdown-item">Profile</a>
                  <div className="dropdown-divider"></div>
                  <button onClick={handleLogout} className="dropdown-item text-danger">
                    <LogOut size={16} className="me-2" />
                    Logout
                  </button>
                </div>
              </div>
            </div>
            <div className="collapse navbar-collapse" id="navbar-menu">
              <div>
                <form action="./" method="get" autoComplete="off" noValidate>
                  <div className="input-icon">
                    <span className="input-icon-addon">
                      <Search size={18} />
                    </span>
                    <input type="text" value="" className="form-control" placeholder="Search..." aria-label="Search in website" readOnly />
                  </div>
                </form>
              </div>
            </div>
          </div>
        </header>

        {/* Page body */}
        <div className="page-body">
          <div className="container-xl">
            <Outlet />
          </div>
        </div>

        {/* Footer */}
        <footer className="footer footer-transparent d-print-none">
          <div className="container-xl">
            <div className="row text-center align-items-center flex-row-reverse">
              <div className="col-12 col-lg-auto mt-3 mt-lg-0">
                <ul className="list-inline list-inline-dots mb-0">
                  <li className="list-inline-item">
                    MuxMill
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </div>
  )
}

export default AdminLayout