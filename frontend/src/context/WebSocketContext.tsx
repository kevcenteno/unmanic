import React, { createContext, useContext, useEffect, useState, useRef } from 'react'
import AuthContext from './AuthContext'

export interface ScanStatus {
  is_scanning: boolean
  total_files: number
  files_probed: number
  tasks_created: number
  current_library: string
}

export interface WorkerStatus {
  active: number
  idle: number
}

export interface Task {
  id: number
  abspath: string
  status: string
  priority: number
}

export interface CompletedTask {
  id: number
  task_label: string
  abspath: string
  task_success: boolean
  finish_time: string
}

export interface FullStatus {
  scanner: ScanStatus
  workers: WorkerStatus
  pending: Task[]
  history: CompletedTask[]
  timestamp: string
}

interface WebSocketEvent {
  type: string
  data: any
}

interface WebSocketContextState {
  status: FullStatus | null
  isConnected: boolean
  lastEvent: WebSocketEvent | null
}

const WebSocketContext = createContext<WebSocketContextState>({
  status: null,
  isConnected: false,
  lastEvent: null
})

export const WebSocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { token, isAuthenticated } = useContext(AuthContext)
  const [status, setStatus] = useState<FullStatus | null>(null)
  const [lastEvent, setLastEvent] = useState<WebSocketEvent | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const socketRef = useRef<WebSocket | null>(null)

  useEffect(() => {
    if (!isAuthenticated || !token) {
      if (socketRef.current) {
        socketRef.current.close()
      }
      return
    }

    const connect = () => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      const host = import.meta.env.DEV ? 'localhost:8080' : window.location.host
      const url = `${protocol}//${host}/api/v1/ws?token=${token}`

      const socket = new WebSocket(url)
      socketRef.current = socket

      socket.onopen = () => {
        setIsConnected(true)
        console.log('WS Connected')
      }

      socket.onmessage = (event) => {
        try {
          const wsEvent: WebSocketEvent = JSON.parse(event.data)
          setLastEvent(wsEvent)

          switch (wsEvent.type) {
            case 'FULL_STATUS':
              setStatus(wsEvent.data)
              break
            case 'SCAN_PROGRESS':
              setStatus(prev => prev ? { ...prev, scanner: wsEvent.data, timestamp: new Date().toISOString() } : null)
              break
            case 'WORKER_UPDATE':
              setStatus(prev => prev ? { ...prev, workers: wsEvent.data, timestamp: new Date().toISOString() } : null)
              break
            case 'TASKS_UPDATE':
              setStatus(prev => prev ? { 
                ...prev, 
                pending: wsEvent.data.pending, 
                history: wsEvent.data.history,
                timestamp: new Date().toISOString() 
              } : null)
              break
          }
        } catch (err) {
          console.error('WS Parse Error', err)
        }
      }

      socket.onclose = () => {
        setIsConnected(false)
        console.log('WS Disconnected')
        setTimeout(() => {
          if (isAuthenticated) connect()
        }, 3000)
      }

      socket.onerror = (err) => {
        console.error('WS Error', err)
        socket.close()
      }
    }

    connect()

    return () => {
      if (socketRef.current) {
        socketRef.current.close()
      }
    }
  }, [isAuthenticated, token])

  return (
    <WebSocketContext.Provider value={{ status, isConnected, lastEvent }}>
      {children}
    </WebSocketContext.Provider>
  )
}

export const useWebSocket = () => useContext(WebSocketContext)

export default WebSocketContext
