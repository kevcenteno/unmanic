import React, { useState, useEffect } from 'react'
import { RefreshCw } from 'lucide-react'
import { useWebSocket } from '../context/WebSocketContext'

const LibraryScanStatus: React.FC = () => {
  const { status } = useWebSocket()
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = React.useRef<HTMLDivElement>(null)

  const scanStatus = status?.scanner

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  if (!scanStatus || !scanStatus.is_scanning) {
    return null
  }

  const percentage = scanStatus.total_files > 0 
    ? Math.round((scanStatus.files_probed / scanStatus.total_files) * 100) 
    : 0

  return (
    <div className="nav-item dropdown" ref={dropdownRef} style={{ position: 'relative' }}>
      <a 
        href="#" 
        className={`nav-link px-0 ${isOpen ? 'show' : ''}`}
        onClick={(e) => {
          e.preventDefault()
          setIsOpen(!isOpen)
        }}
        title="Library Scan in Progress"
      >
        <RefreshCw size={20} className="animate-spin text-primary" />
      </a>
      <div 
        className={`dropdown-menu dropdown-menu-arrow p-3 ${isOpen ? 'show' : ''}`} 
        style={{ 
          width: '250px', 
          position: 'absolute', 
          top: '100%',
          left: '50%',
          transform: 'translateX(-50%)',
          display: isOpen ? 'block' : 'none',
          zIndex: 1000,
          marginTop: '10px'
        }}
      >
        <div className="dropdown-header px-0 mb-2">
          <h3 className="dropdown-title">Library Scan</h3>
        </div>
        
        <div className="mb-2">
          <div className="small text-muted mb-1">Scanning:</div>
          <div className="fw-bold text-truncate" title={scanStatus.current_library || 'Starting...'}>
            {scanStatus.current_library || 'Discovery...'}
          </div>
        </div>

        <div className="mb-3">
          <div className="d-flex justify-content-between mb-1">
            <span className="small text-muted">Progress</span>
            <span className="small fw-bold">{percentage}%</span>
          </div>
          <div className="progress progress-sm">
            <div 
              className="progress-bar bg-primary" 
              style={{ width: `${percentage}%` }} 
              role="progressbar" 
              aria-valuenow={percentage} 
              aria-valuemin={0} 
              aria-valuemax={100}
            ></div>
          </div>
        </div>

        <div className="row g-2">
          <div className="col-6">
            <div className="border rounded p-2 text-center bg-light">
              <div className="small text-muted">Probed</div>
              <div className="fw-bold">{scanStatus.files_probed}</div>
            </div>
          </div>
          <div className="col-6">
            <div className="border rounded p-2 text-center bg-light">
              <div className="small text-muted">Tasks</div>
              <div className="fw-bold text-success">{scanStatus.tasks_created}</div>
            </div>
          </div>
        </div>
        
        {scanStatus.total_files > 0 && (
          <div className="mt-2 text-center small text-muted">
            {scanStatus.files_probed} of {scanStatus.total_files} files
          </div>
        )}
      </div>
    </div>
  )
}

export default LibraryScanStatus
