import React, { createContext, useState, useMemo, ReactNode, useEffect, useCallback } from 'react'
import axios from 'axios'

export interface AuthContextState {
  token: string | null
  login: (token: string) => void
  logout: () => void
  isAuthenticated: boolean
  isInitialized: boolean | null
  checkInit: () => Promise<void>
}

const getBaseUrl = () => {
  if (import.meta.env.DEV) {
    return 'http://localhost:8080'
  }
  return ''
}

// Axios API instance configured with base URL
export const api = axios.create({
  baseURL: `${getBaseUrl()}/api/v1`
})

// Base axios instance for unauthenticated requests
export const baseApi = axios.create({
  baseURL: `${getBaseUrl()}/api`
})

// Attach request interceptor to include token from localStorage
api.interceptors.request.use(
  (config) => {
    try {
      const token = localStorage.getItem('token')
      if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`
      }
    } catch (e) {
      // ignore localStorage errors
    }
    return config
  },
  (error) => Promise.reject(error)
)

const defaultState: AuthContextState = {
  token: null,
  login: () => {},
  logout: () => {},
  isAuthenticated: false,
  isInitialized: null,
  checkInit: async () => {}
}

export const AuthContext = createContext<AuthContextState>(defaultState)

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(() => {
    try {
      return localStorage.getItem('token')
    } catch (e) {
      return null
    }
  })
  const [isInitialized, setIsInitialized] = useState<boolean | null>(null)

  const checkInit = useCallback(async () => {
    try {
      const resp = await baseApi.get('/system/status')
      setIsInitialized(resp.data.initialized)
    } catch (e) {
      console.error('Failed to check system status', e)
      setIsInitialized(true) // Fallback to true to avoid locking UI if server is down/broken
    }
  }, [])

  useEffect(() => {
    checkInit()
  }, [checkInit])

  const login = (newToken: string) => {
    setToken(newToken)
    try {
      localStorage.setItem('token', newToken)
    } catch (e) {
      // ignore
    }
  }

  const logout = () => {
    setToken(null)
    try {
      localStorage.removeItem('token')
    } catch (e) {
      // ignore
    }
  }

  const value = useMemo(
    () => ({ token, login, logout, isAuthenticated: Boolean(token), isInitialized, checkInit }),
    [token, isInitialized, checkInit]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export default AuthContext
