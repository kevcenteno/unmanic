import React, { useEffect, useState } from 'react'
import { Folder, ChevronRight, CornerLeftUp, X } from 'lucide-react'
import { api } from '../context/AuthContext'

interface FileBrowserItem {
  name: string
  path: string
}

interface FileBrowserResponse {
  current_path: string
  parent_path: string
  directories: FileBrowserItem[]
}

interface DirectoryPickerProps {
  initialPath?: string
  onSelect: (path: string) => void
  onClose: () => void
}

const DirectoryPicker: React.FC<DirectoryPickerProps> = ({ initialPath = '/', onSelect, onClose }) => {
  const [currentPath, setCurrentPath] = useState<string>(initialPath)
  const [data, setData] = useState<FileBrowserResponse | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  const fetchListing = async (path: string) => {
    setLoading(true)
    setError(null)
    try {
      const resp = await api.post<FileBrowserResponse>('/filebrowser/list', { current_path: path })
      setData(resp.data)
      setCurrentPath(resp.data.current_path)
    } catch (err: any) {
      console.error('Failed to fetch directory listing', err)
      setError('Failed to read directory. It might be inaccessible.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchListing(initialPath)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <>
      <div className="modal modal-blur fade show d-block" tabIndex={-1} role="dialog" style={{ zIndex: 1060 }}>
        <div className="modal-dialog modal-lg modal-dialog-centered" role="document">
          <div className="modal-content shadow-lg">
            <div className="modal-header">
              <h5 className="modal-title d-flex align-items-center">
                <Folder size={18} className="me-2" />
                Select System Directory
              </h5>
              <button type="button" className="btn-close" onClick={onClose} />
            </div>
            
            <div className="modal-body p-0">
              {/* Current Path Breadcrumb */}
              <div className="bg-light p-3 border-bottom">
                <div className="d-flex align-items-center">
                  <span className="text-muted me-2 small">Location:</span>
                  <code className="text-primary font-weight-bold">{currentPath}</code>
                </div>
              </div>

              <div className="list-group list-group-flush" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                {/* Parent Directory Link */}
                {data?.parent_path && (
                  <button
                    className="list-group-item list-group-item-action d-flex align-items-center py-2"
                    onClick={() => fetchListing(data.parent_path)}
                  >
                    <CornerLeftUp size={16} className="text-muted me-3" />
                    <span className="text-muted italic">.. (Parent Directory)</span>
                  </button>
                )}

                {loading ? (
                  <div className="p-5 text-center">
                    <div className="spinner-border text-primary" role="status"></div>
                    <div className="mt-2 text-muted">Scanning filesystem...</div>
                  </div>
                ) : error ? (
                  <div className="p-5 text-center text-danger">
                    <X size={48} className="mb-2" />
                    <div>{error}</div>
                  </div>
                ) : data?.directories.length === 0 ? (
                  <div className="p-5 text-center text-muted">
                    No subdirectories found in this location.
                  </div>
                ) : (
                  data?.directories.map((dir) => (
                    <button
                      key={dir.path}
                      className="list-group-item list-group-item-action d-flex align-items-center justify-content-between py-2"
                      onClick={() => fetchListing(dir.path)}
                    >
                      <div className="d-flex align-items-center">
                        <Folder size={18} className="text-yellow me-3" fill="currentColor" fillOpacity={0.2} />
                        <span>{dir.name}</span>
                      </div>
                      <ChevronRight size={14} className="text-muted" />
                    </button>
                  ))
                )}
              </div>
            </div>

            <div className="modal-footer bg-light border-top">
              <button type="button" className="btn btn-link link-secondary me-auto" onClick={onClose}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => onSelect(currentPath)}
                disabled={loading || !!error}
              >
                Select this directory
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop fade show" style={{ zIndex: 1050 }} />
    </>
  )
}

export default DirectoryPicker
