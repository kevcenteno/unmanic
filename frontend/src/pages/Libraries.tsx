import React, { useEffect, useState } from 'react'
import { Plus, Trash, Folder, AlertTriangle, RefreshCcw, CheckCircle, Workflow } from 'lucide-react'
import { api } from '../context/AuthContext'
import DirectoryPicker from '../components/DirectoryPicker'

interface Library {
  id: number
  name: string
  path: string
  enable_scanner: boolean
  enable_inotify: boolean
  enable_remote_only: boolean
  priority_score: number
  pipeline_id: number | null
  pipeline?: { name: string }
}

interface Pipeline {
  id: number
  name: string
}

const Libraries: React.FC = () => {
  const [libraries, setLibraries] = useState<Library[]>([])
  const [pipelines, setPipelines] = useState<Pipeline[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [deleting, setDeleting] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [showAddModal, setShowAddModal] = useState<boolean>(false)
  const [isEditing, setIsEditing] = useState<boolean>(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [scanning, setScanning] = useState<boolean>(false)
  
  // Modal Form State
  const [formState, setFormState] = useState({
    name: '',
    path: '',
    enable_scanner: true,
    enable_inotify: false,
    enable_remote_only: false,
    priority_score: 0,
    pipeline_id: 0
  })

  const [submitting, setSubmitting] = useState<boolean>(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [showPicker, setShowPicker] = useState<boolean>(false)

  const fetchLibraries = async () => {
    setLoading(true)
    setError(null)
    try {
      const [libResp, pipeResp] = await Promise.all([
        api.get<Library[]>('/libraries'),
        api.get<Pipeline[]>('/pipelines')
      ])
      setLibraries(libResp?.data ?? [])
      setPipelines(pipeResp?.data ?? [])
    } catch (err) {
      console.error('Failed to fetch data', err)
      setError('Failed to load libraries or pipelines')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchLibraries()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const resetForm = () => {
    setFormState({
      name: '',
      path: '',
      enable_scanner: true,
      enable_inotify: false,
      enable_remote_only: false,
      priority_score: 0,
      pipeline_id: 0
    })
    setIsEditing(false)
    setEditId(null)
    setSubmitError(null)
  }

  const handleEdit = (lib: Library) => {
    setFormState({
      name: lib.name,
      path: lib.path,
      enable_scanner: lib.enable_scanner,
      enable_inotify: lib.enable_inotify,
      enable_remote_only: lib.enable_remote_only,
      priority_score: lib.priority_score,
      pipeline_id: lib.pipeline_id || 0
    })
    setEditId(lib.id)
    setIsEditing(true)
    setShowAddModal(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitError(null)
    if (!formState.name.trim() || !formState.path.trim()) {
      setSubmitError('Name and Path are required')
      return
    }
    
    // Ensure pipeline_id is treated as uint/null
    const payload = {
      ...formState,
      pipeline_id: formState.pipeline_id === 0 ? null : formState.pipeline_id
    }

    setSubmitting(true)
    try {
      if (isEditing && editId) {
        await api.put(`/libraries/${editId}`, payload)
      } else {
        await api.post('/libraries', payload)
      }
      await fetchLibraries()
      setShowAddModal(false)
      resetForm()
      setSuccess('Library saved successfully')
      setTimeout(() => setSuccess(null), 3000)
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Failed to save library'
      setSubmitError(String(msg))
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!window.confirm('Delete this library? This action cannot be undone.')) return
    setDeleting(id)
    try {
      await api.delete(`/libraries/${id}`)
      await fetchLibraries()
      setSuccess('Library deleted successfully')
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      setError('Failed to delete library')
    } finally {
      setDeleting(null)
    }
  }

  const handleTriggerScan = async () => {
    setScanning(true)
    setError(null)
    try {
      await api.post('/libraries/rescan')
      setSuccess('Library rescan triggered successfully')
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      console.error('Failed to trigger scan', err)
      setError('Failed to trigger library rescan')
    } finally {
      setScanning(false)
    }
  }

  return (
    <div className="container-xl">
      {/* Page Header */}
      <div className="page-header d-print-none mb-4">
        <div className="row align-items-center">
          <div className="col">
            <div className="page-pretitle">Administration</div>
            <h2 className="page-title">Media Libraries</h2>
          </div>
          <div className="col-auto ms-auto">
            <div className="btn-list">
              <button 
                className="btn btn-outline-primary d-none d-sm-inline-block" 
                onClick={handleTriggerScan}
                disabled={scanning}
              >
                <RefreshCcw size={18} className={`me-2 ${scanning ? 'animate-spin' : ''}`} />
                Scan Now
              </button>
              <button className="btn btn-primary d-none d-sm-inline-block" onClick={() => { resetForm(); setShowAddModal(true); }}>
                <Plus size={18} className="me-2" />
                Add Library
              </button>
              <button className="btn btn-primary d-sm-none btn-icon" onClick={() => { resetForm(); setShowAddModal(true); }} aria-label="Add Library">
                <Plus size={18} />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="row row-cards">
        <div className="col-12">
          {error && (
            <div className="alert alert-danger" role="alert">
              <div className="d-flex">
                <AlertTriangle className="me-2" />
                <div>{error}</div>
              </div>
            </div>
          )}

          {success && (
            <div className="alert alert-success" role="alert">
              <div className="d-flex">
                <CheckCircle size={18} className="me-2" />
                <div>{success}</div>
              </div>
            </div>
          )}

          {loading ? (
            <div className="card">
              <div className="card-body">
                <div className="progress progress-sm">
                  <div className="progress-bar progress-bar-indeterminate"></div>
                </div>
                <div className="text-center mt-3 text-muted">Fetching libraries...</div>
              </div>
            </div>
          ) : libraries.length === 0 ? (
            <div className="card card-md">
              <div className="card-body">
                <div className="empty">
                  <div className="empty-img">
                    <Folder size={128} strokeWidth={1} className="text-muted opacity-25" />
                  </div>
                  <p className="empty-title">No libraries found</p>
                  <p className="empty-subtitle text-muted">
                    Configure your first media library to start monitoring and processing video files.
                  </p>
                  <div className="empty-action">
                    <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
                      <Plus size={18} className="me-2" />
                      Add your first library
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="card">
              <div className="card-header border-0">
                <h3 className="card-title">Configured Roots</h3>
              </div>
              <div className="table-responsive">
                <table className="table table-vcenter card-table table-hover">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>System Path</th>
                      <th>Processing Pipeline</th>
                      <th className="text-center">Scanner</th>
                      <th className="text-center">Inotify</th>
                      <th className="w-1"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {libraries.map((lib) => (
                      <tr key={lib.id}>
                        <td className="p-0">
                          <div 
                            className="p-3 cursor-pointer" 
                            onClick={() => handleEdit(lib)}
                            role="button"
                          >
                            <div className="d-flex align-items-center">
                              <span className="avatar avatar-sm me-3 bg-blue-lt">
                                <Folder size={16} />
                              </span>
                              <div>
                                <div className="font-weight-medium text-reset">{lib.name}</div>
                                <div className="text-muted small">Priority: {lib.priority_score}</div>
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="p-0 text-muted">
                          <div 
                            className="p-3 cursor-pointer h-100" 
                            onClick={() => handleEdit(lib)}
                            role="button"
                          >
                            <code>{lib.path}</code>
                          </div>
                        </td>
                        <td className="p-0">
                          <div 
                            className="p-3 cursor-pointer h-100" 
                            onClick={() => handleEdit(lib)}
                            role="button"
                          >
                            {lib.pipeline ? (
                              <span className="badge bg-purple-lt d-flex align-items-center" style={{ width: 'fit-content' }}>
                                <Workflow size={12} className="me-1" />
                                {lib.pipeline.name}
                              </span>
                            ) : (
                              <span className="text-muted italic small">None (No processing)</span>
                            )}
                          </div>
                        </td>
                        <td className="p-0 text-center">
                          <div 
                            className="p-3 cursor-pointer h-100" 
                            onClick={() => handleEdit(lib)}
                            role="button"
                          >
                            {lib.enable_scanner ? (
                              <span className="badge badge-outline text-success">Active</span>
                            ) : (
                              <span className="badge badge-outline text-secondary">Paused</span>
                            )}
                          </div>
                        </td>
                        <td className="p-0 text-center">
                          <div 
                            className="p-3 cursor-pointer h-100" 
                            onClick={() => handleEdit(lib)}
                            role="button"
                          >
                            {lib.enable_inotify ? (
                              <span className="badge badge-outline text-success">Active</span>
                            ) : (
                              <span className="badge badge-outline text-secondary">Disabled</span>
                            )}
                          </div>
                        </td>
                        <td>
                          <div className="btn-list flex-nowrap">
                            <button
                              className="btn btn-icon btn-ghost-danger btn-sm"
                              onClick={() => handleDelete(lib.id)}
                              disabled={deleting === lib.id}
                              title="Delete Library"
                            >
                              <Trash size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add/Edit Library Modal */}
      {showAddModal && (
        <>
          <div className="modal modal-blur fade show d-block" tabIndex={-1} role="dialog">
            <div className="modal-dialog modal-lg modal-dialog-centered" role="document">
              <form className="modal-content" onSubmit={handleSubmit}>
                <div className="modal-header">
                  <h5 className="modal-title">{isEditing ? 'Configure Library' : 'New Media Library'}</h5>
                  <button type="button" className="btn-close" onClick={() => { setShowAddModal(false); resetForm(); }} />
                </div>
                <div className="modal-body">
                  {submitError && (
                    <div className="alert alert-danger mb-3" role="alert">
                      {submitError}
                    </div>
                  )}
                  <div className="row">
                    <div className="col-md-6">
                      <div className="mb-3">
                        <label className="form-label required">Display Name</label>
                        <input
                          className="form-control"
                          placeholder="e.g. Movies, TV Shows"
                          value={formState.name}
                          onChange={(e) => setFormState({ ...formState, name: e.target.value })}
                          required
                        />
                      </div>
                    </div>
                    <div className="col-md-6">
                      <div className="mb-3">
                        <label className="form-label">Priority Score</label>
                        <input
                          type="number"
                          className="form-control"
                          value={formState.priority_score}
                          onChange={(e) => setFormState({ ...formState, priority_score: parseInt(e.target.value) || 0 })}
                        />
                        <small className="form-hint">Used for task priority.</small>
                      </div>
                    </div>
                  </div>

                  <div className="mb-3">
                    <label className="form-label required">System Path</label>
                    <div className="input-group">
                      <span className="input-group-text">
                        <Folder size={18} />
                      </span>
                      <input
                        className="form-control"
                        placeholder="e.g. /mnt/media/movies"
                        value={formState.path}
                        onChange={(e) => setFormState({ ...formState, path: e.target.value })}
                        required
                      />
                      <button 
                        className="btn btn-outline-secondary" 
                        type="button"
                        onClick={() => setShowPicker(true)}
                      >
                        Browse
                      </button>
                    </div>
                  </div>

                  <div className="mb-3">
                    <label className="form-label">Processing Pipeline</label>
                    <select 
                      className="form-select"
                      value={formState.pipeline_id}
                      onChange={(e) => setFormState({ ...formState, pipeline_id: Number(e.target.value) })}
                    >
                      <option value="0">None (Do not process files in this library)</option>
                      {pipelines.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                    <small className="form-hint">
                      Select a pipeline template to apply to all files discovered in this library.
                    </small>
                  </div>

                  <hr className="my-3" />

                  <div className="row">
                    <div className="col-md-6">
                      <div className="mb-3">
                        <label className="form-check form-switch">
                          <input 
                            className="form-check-input" 
                            type="checkbox" 
                            checked={formState.enable_scanner}
                            onChange={(e) => setFormState({ ...formState, enable_scanner: e.target.checked })}
                          />
                          <span className="form-check-label">Enable Scanner</span>
                        </label>
                        <small className="form-hint">Regularly scan for new files.</small>
                      </div>
                    </div>
                    <div className="col-md-6">
                      <div className="mb-3">
                        <label className="form-check form-switch">
                          <input 
                            className="form-check-input" 
                            type="checkbox" 
                            checked={formState.enable_inotify}
                            onChange={(e) => setFormState({ ...formState, enable_inotify: e.target.checked })}
                          />
                          <span className="form-check-label">Enable Inotify</span>
                        </label>
                        <small className="form-hint">Instant detection of file changes.</small>
                      </div>
                    </div>
                  </div>

                  <div className="mb-3">
                    <label className="form-check form-switch">
                      <input 
                        className="form-check-input" 
                        type="checkbox" 
                        checked={formState.enable_remote_only}
                        onChange={(e) => setFormState({ ...formState, enable_remote_only: e.target.checked })}
                      />
                      <span className="form-check-label">Enable Remote Only</span>
                    </label>
                    <small className="form-hint">Files will only be processed by remote nodes.</small>
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-link link-secondary me-auto" onClick={() => { setShowAddModal(false); resetForm(); }} disabled={submitting}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={submitting}>
                    {submitting ? 'Saving...' : (isEditing ? 'Save Changes' : 'Create Library')}
                  </button>
                </div>
              </form>
            </div>
          </div>
          <div className="modal-backdrop fade show" />
        </>
      )}

      {showPicker && (
        <DirectoryPicker 
          initialPath={formState.path || '/'} 
          onSelect={(path) => { setFormState({ ...formState, path: path }); setShowPicker(false) }}
          onClose={() => setShowPicker(false)}
        />
      )}
    </div>
  )
}

export default Libraries
