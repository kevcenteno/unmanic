import React, { useEffect, useState } from 'react'
import { api } from '../context/AuthContext'
import { Cpu, Folder, Save, Info, CheckCircle, Plus, Trash } from 'lucide-react'
import DirectoryPicker from '../components/DirectoryPicker'

interface Setting {
  id: number
  key: string
  value: string
}

interface WorkerGroup {
  id: number
  name: string
  count: number
}

const Settings: React.FC = () => {
  const [settings, setSettings] = useState<Setting[]>([])
  const [groups, setGroups] = useState<WorkerGroup[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [savingSettings, setSavingSettings] = useState<boolean>(false)
  const [savingGroupId, setSavingGroupId] = useState<number | null>(null)
  const [deletingGroupId, setDeletingGroupId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [showPicker, setShowPicker] = useState<boolean>(false)
  const [activePathKey, setActivePathKey] = useState<string | null>(null)

  // Add Pool Modal State
  const [showAddPoolModal, setShowAddPoolModal] = useState<boolean>(false)
  const [newPoolName, setNewPoolName] = useState<string>('')
  const [newPoolCount, setNewPoolCount] = useState<number>(1)
  const [submittingPool, setSubmittingPool] = useState<boolean>(false)

  const fetchAll = async () => {
    setLoading(true)
    setError(null)
    try {
      const [sResp, gResp] = await Promise.all([
        api.get<Setting[]>('/settings'),
        api.get<WorkerGroup[]>('/workers/groups')
      ])

      const sortedSettings = (sResp?.data ?? []).sort((a, b) => a.key.localeCompare(b.key))
      setSettings(sortedSettings)
      setGroups(gResp?.data ?? [])
    } catch (err) {
      console.error('Failed to fetch settings/groups', err)
      setError('Failed to load settings from server')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSettingChange = (key: string, value: string) => {
    setSettings((prev) => prev.map((s) => (s.key === key ? { ...s, value: value } : s)))
  }

  const saveSettings = async (e?: React.FormEvent) => {
    e?.preventDefault()
    setSavingSettings(true)
    setError(null)
    setSuccess(null)
    try {
      await api.put('/settings', settings)
      setSuccess('All settings saved successfully')
      await fetchAll()
    } catch (err) {
      console.error('Failed to save settings', err)
      setError('Failed to save settings')
    } finally {
      setSavingSettings(false)
      setTimeout(() => setSuccess(null), 5000)
    }
  }

  const handleGroupCountChange = (id: number, count: number) => {
    setGroups((prev) => prev.map((g) => (g.id === id ? { ...g, count: count } : g)))
  }

  const handleGroupNameChange = (id: number, name: string) => {
    setGroups((prev) => prev.map((g) => (g.id === id ? { ...g, name: name } : g)))
  }

  const saveGroup = async (group: WorkerGroup) => {
    setSavingGroupId(group.id)
    setError(null)
    setSuccess(null)
    try {
      await api.put(`/workers/groups/${group.id}`, { name: group.name, count: group.count })
      setSuccess(`Worker pool "${group.name}" updated`)
      await fetchAll()
    } catch (err) {
      console.error('Failed to save group', err)
      setError('Failed to update worker group')
    } finally {
      setSavingGroupId(null)
      setTimeout(() => setSuccess(null), 5000)
    }
  }

  const deleteGroup = async (id: number) => {
    if (!window.confirm('Are you sure you want to remove this worker pool?')) return
    setDeletingGroupId(id)
    try {
      await api.delete(`/workers/groups/${id}`)
      setSuccess('Worker pool removed')
      await fetchAll()
    } catch (err) {
      setError('Failed to remove worker pool')
    } finally {
      setDeletingGroupId(null)
    }
  }

  const handleAddPool = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newPoolName.trim()) return
    setSubmittingPool(true)
    try {
      await api.post('/workers/groups', { name: newPoolName, count: newPoolCount })
      setShowAddPoolModal(false)
      setNewPoolName('')
      setNewPoolCount(1)
      setSuccess('New worker pool added')
      await fetchAll()
    } catch (err) {
      setError('Failed to add worker pool')
    } finally {
      setSubmittingPool(false)
    }
  }

  const openPicker = (key: string) => {
    setActivePathKey(key)
    setShowPicker(true)
  }

  const onDirectorySelected = (path: string) => {
    if (activePathKey) {
      handleSettingChange(activePathKey, path)
    }
    setShowPicker(false)
    setActivePathKey(null)
  }

  const groupedSettings = {
    'Network & UI': ['ui_port', 'ui_address', 'ssl_enabled', 'debugging', 'installation_name', 'installation_public_address'],
    'Library & Scanning': ['enable_library_scanner', 'schedule_full_scan_minutes', 'follow_symlinks', 'concurrent_file_testers', 'run_full_scan_on_start', 'clear_pending_tasks_on_restart'],
    'Cleanup & Logs': ['auto_manage_completed_tasks', 'compress_completed_tasks_logs', 'max_age_of_completed_tasks', 'always_keep_failed_tasks', 'log_buffer_retention'],
    'System Paths': ['cache_path', 'config_path', 'log_path', 'plugins_path', 'userdata_path'],
    'Other': [] as string[]
  }

  const renderSettingInput = (s: Setting) => {
    const isPath = s.key.toLowerCase().endsWith('_path')
    const isBool = ['true', 'false'].includes(s.value.toLowerCase()) || s.key.startsWith('enable_') || s.key.startsWith('ssl_') || s.key.startsWith('debugging') || s.key.startsWith('auto_') || s.key.startsWith('compress_') || s.key.startsWith('always_') || s.key.startsWith('run_') || s.key.startsWith('clear_')

    if (isBool) {
      const isChecked = s.value.toLowerCase() === 'true'
      return (
        <label className="form-check form-switch mt-2">
          <input 
            className="form-check-input" 
            type="checkbox" 
            checked={isChecked}
            onChange={(e) => handleSettingChange(s.key, e.target.checked ? 'true' : 'false')}
          />
          <span className="form-check-label text-capitalize">{s.key.replace(/_/g, ' ')}</span>
        </label>
      )
    }

    if (isPath) {
      return (
        <div className="mb-3">
          <label className="form-label text-capitalize">{s.key.replace(/_/g, ' ')}</label>
          <div className="input-group">
            <span className="input-group-text"><Folder size={16} /></span>
            <input
              className="form-control"
              value={s.value}
              onChange={(e) => handleSettingChange(s.key, e.target.value)}
            />
            <button className="btn btn-outline-secondary" type="button" onClick={() => openPicker(s.key)}>Browse</button>
          </div>
        </div>
      )
    }

    return (
      <div className="mb-3">
        <label className="form-label text-capitalize">{s.key.replace(/_/g, ' ')}</label>
        <input
          className="form-control"
          value={s.value}
          onChange={(e) => handleSettingChange(s.key, e.target.value)}
        />
      </div>
    )
  }

  return (
    <div className="container-xl">
      <div className="page-header d-print-none mb-4">
        <div className="row align-items-center">
          <div className="col">
            <div className="page-pretitle">Administration</div>
            <h2 className="page-title">System Settings</h2>
          </div>
          <div className="col-auto ms-auto">
            <button className="btn btn-primary" onClick={saveSettings} disabled={savingSettings || loading}>
              <Save size={18} className="me-2" /> Save All Settings
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="alert alert-danger" role="alert">
          <div className="d-flex">
            <Info className="me-2" />
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

      <div className="row row-cards">
        {/* Worker Groups Section */}
        <div className="col-12">
          <div className="card">
            <div className="card-header">
              <h3 className="card-title d-flex align-items-center">
                <Cpu size={18} className="me-2 text-info" />
                Worker Thread Pools
              </h3>
              <div className="card-actions">
                <button className="btn btn-sm btn-outline-primary" onClick={() => setShowAddPoolModal(true)}>
                  <Plus size={14} className="me-1" /> Add Pool
                </button>
              </div>
            </div>
            <div className="table-responsive">
              {loading ? (
                <div className="text-center py-4">
                  <div className="spinner-border text-primary" role="status"></div>
                </div>
              ) : groups.length === 0 ? (
                <div className="p-4 text-muted text-center">No worker groups configured.</div>
              ) : (
                <table className="table table-vcenter card-table">
                  <thead>
                    <tr>
                      <th>Pool Name</th>
                      <th className="w-1">Thread Count</th>
                      <th className="w-1"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {groups.map((g) => (
                      <tr key={g.id}>
                        <td>
                          <input
                            type="text"
                            className="form-control form-control-sm"
                            value={g.name}
                            onChange={(e) => handleGroupNameChange(g.id, e.target.value)}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            className="form-control form-control-sm"
                            style={{ width: '80px' }}
                            value={g.count}
                            min={0}
                            onChange={(e) => handleGroupCountChange(g.id, Number(e.target.value))}
                          />
                        </td>
                        <td className="text-end">
                          <div className="btn-list flex-nowrap">
                            <button
                              className="btn btn-sm btn-ghost-primary"
                              onClick={() => saveGroup(g)}
                              disabled={savingGroupId !== null}
                            >
                              {savingGroupId === g.id ? 'Saving...' : 'Update'}
                            </button>
                            <button
                              className="btn btn-sm btn-icon btn-ghost-danger"
                              onClick={() => deleteGroup(g.id)}
                              disabled={deletingGroupId !== null}
                              title="Remove Pool"
                            >
                              <Trash size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>

        {/* Dynamic Global Settings Sections */}
        {!loading && Object.entries(groupedSettings).map(([groupName, keys]) => {
          const groupSettings = settings.filter(s => keys.includes(s.key))
          if (groupSettings.length === 0 && groupName !== 'Other') return null
          const assignedKeys = Object.values(groupedSettings).flat()
          const otherSettings = groupName === 'Other' ? settings.filter(s => !assignedKeys.includes(s.key)) : []
          const currentSettings = groupName === 'Other' ? otherSettings : groupSettings
          if (currentSettings.length === 0) return null

          return (
            <div className="col-12" key={groupName}>
              <div className="card">
                <div className="card-header">
                  <h3 className="card-title">{groupName}</h3>
                </div>
                <div className="card-body">
                  <div className="row">
                    {currentSettings.map((s) => (
                      <div className="col-md-6" key={s.id}>
                        {renderSettingInput(s)}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Add Pool Modal */}
      {showAddPoolModal && (
        <>
          <div className="modal modal-blur fade show d-block" tabIndex={-1} role="dialog">
            <div className="modal-dialog modal-dialog-centered" role="document">
              <form className="modal-content" onSubmit={handleAddPool}>
                <div className="modal-header">
                  <h5 className="modal-title">Add Worker Pool</h5>
                  <button type="button" className="btn-close" onClick={() => setShowAddPoolModal(false)} />
                </div>
                <div className="modal-body">
                  <div className="mb-3">
                    <label className="form-label required">Pool Name</label>
                    <input className="form-control" value={newPoolName} onChange={(e) => setNewPoolName(e.target.value)} required placeholder="e.g. GPU Transcoding" />
                  </div>
                  <div className="mb-3">
                    <label className="form-label required">Initial Thread Count</label>
                    <input type="number" className="form-control" value={newPoolCount} min={1} onChange={(e) => setNewPoolCount(Number(e.target.value))} required />
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-link link-secondary me-auto" onClick={() => setShowAddPoolModal(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary" disabled={submittingPool}>
                    {submittingPool ? 'Adding...' : 'Add Pool'}
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
          initialPath={activePathKey ? settings.find(s => s.key === activePathKey)?.value : '/'} 
          onSelect={onDirectorySelected}
          onClose={() => { setShowPicker(false); setActivePathKey(null); }}
        />
      )}
    </div>
  )
}

export default Settings
