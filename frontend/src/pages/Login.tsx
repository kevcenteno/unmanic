import React, { useContext, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import AuthContext, { baseApi } from '../context/AuthContext'

interface LoginPayload {
  username: string
  password: string
}

const Login: React.FC = () => {
  const navigate = useNavigate()
  const { login } = useContext(AuthContext)

  const [form, setForm] = useState<LoginPayload>({ username: '', password: '' })
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const resp = await baseApi.post('/login', form)
      const token = resp?.data?.token
      if (!token) {
        setError('No token returned from server')
        setLoading(false)
        return
      }
      login(token)
      navigate('/dashboard')
    } catch (err: any) {
      if (axios.isAxiosError(err)) {
        if (err.response?.status === 401) {
          setError('Invalid credentials')
        } else if (err.response?.data?.message) {
          setError(err.response.data.message)
        } else {
          setError('Login failed. Please try again.')
        }
      } else {
        setError('An unexpected error occurred')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container-tight d-flex align-items-center justify-content-center" style={{ minHeight: '100vh' }}>
      <div className="card card-md">
        <div className="card-body">
          <h2 className="card-title text-center mb-4">Sign in to your account</h2>

          {error && (
            <div className="alert alert-danger" role="alert">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="mb-3">
              <label className="form-label">Username</label>
              <input
                name="username"
                value={form.username}
                onChange={handleChange}
                className="form-control"
                placeholder="Enter username"
                autoComplete="username"
                required
              />
            </div>

            <div className="mb-3">
              <label className="form-label">Password</label>
              <input
                name="password"
                value={form.password}
                onChange={handleChange}
                type="password"
                className="form-control"
                placeholder="Enter password"
                autoComplete="current-password"
                required
              />
            </div>

            <div className="form-footer">
              <button type="submit" className="btn btn-primary w-100" disabled={loading}>
                {loading ? 'Signing in...' : 'Sign in'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default Login
