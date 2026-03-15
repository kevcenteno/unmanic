import React, { useState, useContext } from 'react'
import { useNavigate } from 'react-router-dom'
import { baseApi, AuthContext } from '../context/AuthContext'
import { User, Lock, Rocket, ShieldCheck } from 'lucide-react'

const Welcome: React.FC = () => {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()
  const { checkInit } = useContext(AuthContext)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setLoading(true)
    try {
      await baseApi.post('/register', { username, password })
      await checkInit() // Refresh initialization status
      navigate('/login')
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to create admin user')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page page-center">
      <div className="container container-tight py-4">
        <div className="text-center mb-4">
          <div className="navbar-brand navbar-brand-autodark">
            <h1 className="h1 text-primary d-flex align-items-center justify-content-center">
              <Rocket size={32} className="me-2" /> MuxMill
            </h1>
          </div>
        </div>
        <div className="card card-md">
          <div className="card-body">
            <h2 className="card-title text-center mb-4">Welcome to MuxMill!</h2>
            <p className="text-muted mb-4 text-center">
              It looks like this is your first time running MuxMill. 
              Please create your administrator account to get started.
            </p>
            <form onSubmit={handleSubmit} autoComplete="off" noValidate>
              {error && (
                <div className="alert alert-danger mb-3" role="alert">
                  {error}
                </div>
              )}
              <div className="mb-3">
                <label className="form-label">Admin Username</label>
                <div className="input-icon">
                  <span className="input-icon-addon">
                    <User size={18} />
                  </span>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. admin"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="mb-3">
                <label className="form-label">Password</label>
                <div className="input-icon">
                  <span className="input-icon-addon">
                    <Lock size={18} />
                  </span>
                  <input
                    type="password"
                    className="form-control"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="mb-3">
                <label className="form-label">Confirm Password</label>
                <div className="input-icon">
                  <span className="input-icon-addon">
                    <ShieldCheck size={18} />
                  </span>
                  <input
                    type="password"
                    className="form-control"
                    placeholder="Confirm Password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="form-footer">
                <button type="submit" className="btn btn-primary w-100" disabled={loading}>
                  {loading ? 'Creating Account...' : 'Initialize MuxMill'}
                </button>
              </div>
            </form>
          </div>
        </div>
        <div className="text-center text-muted mt-3">
          MuxMill - Automated Media Processing
        </div>
      </div>
    </div>
  )
}

export default Welcome
