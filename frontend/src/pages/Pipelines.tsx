import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../context/AuthContext';
import { Plus, Trash, ArrowUp, ArrowDown, Save, ChevronLeft, AlertCircle, CheckCircle, Copy, Folder } from 'lucide-react';
import RuleDeck from '../components/RuleDeck';
import { MatchRule } from '../components/MatchRuleBuilder';
import DirectoryPicker from '../components/DirectoryPicker';

interface FFmpegSettings {
  custom_main_options?: string;
  custom_advanced_options?: string;
  video_flags: string;
  container: string;
}

interface Profile {
  id?: number;
  priority: number;
  name: string;
  match_rule: MatchRule;
  ffmpeg_settings: FFmpegSettings;
}

const Pipelines: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEditing = Boolean(id);

  const [name, setName] = useState('');
  const [rejectLargerFiles, setRejectLargerFiles] = useState(true);
  const [cachePath, setCachePath] = useState('');
  const [relocatePath, setRelocatePath] = useState('');
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [pickerTarget, setPickerConfig] = useState<{ field: 'cache' | 'relocate'; initial: string }>({ field: 'cache', initial: '/' });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const settingsResp = await api.get('/settings');
        const globalCache = settingsResp.data.find((s: any) => s.key === 'cache_path')?.value || '/tmp/muxmill/cache';

        if (isEditing) {
          const pipeResp = await api.get(`/pipelines/${id}`);
          setName(pipeResp.data.name);
          setRejectLargerFiles(pipeResp.data.reject_larger_files !== undefined ? pipeResp.data.reject_larger_files : true);
          setCachePath(pipeResp.data.cache_path || globalCache);
          setRelocatePath(pipeResp.data.relocate_path || '');
          // Sort profiles by priority when loading
          const sortedProfiles = (pipeResp.data.profiles || []).sort((a: Profile, b: Profile) => a.priority - b.priority);
          setProfiles(sortedProfiles);
        } else {
          setCachePath(globalCache);
        }
      } catch (err) {
        console.error('Failed to fetch data', err);
        setError('Failed to load pipeline data');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id, isEditing]);

  const addProfile = () => {
    const newProfile: Profile = {
      priority: profiles.length,
      name: `New Profile ${profiles.length + 1}`,
      match_rule: { logical_op: 'AND', rules: [], property: '', operator: '', value: '' },
      ffmpeg_settings: {
          custom_main_options: '-hwaccel cuda -hwaccel_output_format cuda',
          custom_advanced_options: '-max_muxing_queue_size 2048 -vf scale_cuda=format=p010le',
        video_flags: '-c:v hevc_nvenc -profile:v main10 -pix_fmt p010le -preset p6 -rc vbr -cq 24 -spatial-aq 1 -aq-strength 8 -rc-lookahead 32',
        container: 'original'
      }
    };
    setProfiles([...profiles, newProfile]);
  };

  const updateProfile = (index: number, field: keyof Profile, value: any) => {
    const updated = [...profiles];
    updated[index] = { ...updated[index], [field]: value };
    setProfiles(updated);
  };

  const updateMatchRule = (index: number, updatedRule: MatchRule) => {
    const updated = [...profiles];
    updated[index].match_rule = updatedRule;
    setProfiles(updated);
  };

  const updateFFmpeg = (index: number, field: keyof FFmpegSettings, value: any) => {
    const updated = [...profiles];
    updated[index].ffmpeg_settings = { ...updated[index].ffmpeg_settings, [field]: value };
    setProfiles(updated);
  };

  const removeProfile = (index: number) => {
    const updated = profiles.filter((_, i) => i !== index).map((p, i) => ({ ...p, priority: i }));
    setProfiles(updated);
  };

  const duplicateProfile = (index: number) => {
    const profileToCopy = profiles[index];
    const newProfile: Profile = JSON.parse(JSON.stringify(profileToCopy));
    delete newProfile.id;
    newProfile.name = `${newProfile.name} (Copy)`;
    
    const newProfiles = [...profiles];
    newProfiles.splice(index + 1, 0, newProfile);
    
    // Update priorities to match index
    const reordered = newProfiles.map((p, i) => ({ ...p, priority: i }));
    setProfiles(reordered);
  };

  const moveProfile = (index: number, direction: 'up' | 'down') => {
    const newProfiles = [...profiles];
    const target = direction === 'up' ? index - 1 : index + 1;
    if (target < 0 || target >= newProfiles.length) return;
    
    [newProfiles[index], newProfiles[target]] = [newProfiles[target], newProfiles[index]];
    
    // Update priorities to match index
    const reordered = newProfiles.map((p, i) => ({ ...p, priority: i }));
    setProfiles(reordered);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Pipeline name is required');
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    const payload = {
      name,
      reject_larger_files: rejectLargerFiles,
      cache_path: cachePath,
      relocate_path: relocatePath,
      profiles
    };

    try {
      if (isEditing) {
        await api.put(`/pipelines/${id}`, payload);
        setSuccess('Pipeline updated successfully');
      } else {
        await api.post('/pipelines', payload);
        setSuccess('Pipeline created successfully');
        setTimeout(() => navigate('/pipelines'), 2000);
      }
    } catch (err) {
      console.error('Failed to save pipeline', err);
      setError('Failed to save pipeline. Check if name is unique.');
    } finally {
      setSaving(false);
    }
  };

  if (loading && isEditing) {
    return <div className="container-xl py-4"><div className="spinner-border text-primary" role="status"></div></div>;
  }

  return (
    <div className="container-xl">
      <div className="page-header mb-4">
        <div className="row align-items-center">
          <div className="col-auto">
            <button className="btn btn-icon btn-ghost-secondary" onClick={() => navigate(-1)}>
              <ChevronLeft size={24} />
            </button>
          </div>
          <div className="col">
            <div className="page-pretitle">Administration</div>
            <h2 className="page-title">{isEditing ? 'Edit Pipeline Template' : 'Create Pipeline Template'}</h2>
          </div>
          <div className="col-auto">
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              <Save size={18} className="me-2" /> {saving ? 'Saving...' : 'Save Template'}
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="alert alert-danger" role="alert">
          <div className="d-flex"><AlertCircle className="me-2" /><div>{error}</div></div>
        </div>
      )}

      {success && (
        <div className="alert alert-success" role="alert">
          <div className="d-flex"><CheckCircle className="me-2" /><div>{success}</div></div>
        </div>
      )}

      <div className="row row-cards">
        <div className="col-12">
          <div className="card">
            <div className="card-header border-0 pb-0">
              <h3 className="card-title">Pipeline Settings</h3>
            </div>
            <div className="card-body">
              <div className="row g-3">
                <div className="col-md-8">
                  <label className="form-label required">Template Name</label>
                  <input className="form-control" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. 4K to 1080p Standard" />
                </div>
                <div className="col-md-4 d-flex align-items-end">
                  <label className="form-check form-switch mb-2">
                    <input 
                      className="form-check-input" 
                      type="checkbox" 
                      checked={rejectLargerFiles}
                      onChange={(e) => setRejectLargerFiles(e.target.checked)}
                    />
                    <span className="form-check-label">Reject if output is larger than input</span>
                  </label>
                </div>

                <div className="col-md-6">
                  <label className="form-label">Cache Path</label>
                  <div className="input-group">
                    <span className="input-group-text"><Folder size={16} /></span>
                    <input className="form-control" value={cachePath} onChange={e => setCachePath(e.target.value)} placeholder="e.g. /tmp/cache" />
                    <button className="btn btn-outline-secondary" type="button" onClick={() => { setPickerConfig({ field: 'cache', initial: cachePath }); setShowPicker(true); }}>Browse</button>
                  </div>
                  <small className="form-hint">Directory where intermediate files are stored during processing.</small>
                </div>

                <div className="col-md-6">
                  <label className="form-label">Relocate completed files to (Optional)</label>
                  <div className="input-group">
                    <span className="input-group-text"><Folder size={16} /></span>
                    <input className="form-control" value={relocatePath} onChange={e => setRelocatePath(e.target.value)} placeholder="e.g. /mnt/media/optimized" />
                    <button className="btn btn-outline-secondary" type="button" onClick={() => { setPickerConfig({ field: 'relocate', initial: relocatePath }); setShowPicker(true); }}>Browse</button>
                  </div>
                  <small className="form-hint">Leave empty to replace the original file in its library location.</small>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="col-12">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <h3 className="mb-0">Processing Profiles (Priority Order)</h3>
            <button className="btn btn-outline-primary btn-sm" onClick={addProfile}>
              <Plus size={16} className="me-1" /> Add Profile
            </button>
          </div>

          {profiles.length === 0 ? (
            <div className="card border-dashed">
              <div className="card-body text-center py-5 text-muted">
                No profiles added yet. A template needs at least one profile to process files.
              </div>
            </div>
          ) : (
            profiles.map((profile, idx) => (
              <div className="card mb-3 border-start border-primary border-3 shadow-sm position-relative" key={idx}>
                {/* Delete Button - Top Right */}
                <div className="position-absolute top-0 end-0 m-2" style={{ zIndex: 10 }}>
                  <button 
                    className="btn btn-icon btn-sm btn-ghost-danger rounded-circle" 
                    onClick={() => removeProfile(idx)} 
                    title="Remove Profile"
                  >
                    <Trash size={14} />
                  </button>
                </div>

                <div className="card-body">
                  <div className="row align-items-start g-3">
                    <div className="col-auto pt-4">
                      {/* Priority Arrows with Display */}
                      <div className="text-center">
                        <div className="small fw-bold text-muted mb-1">#{idx}</div>
                        <div className="btn-group-vertical">
                          <button className="btn btn-icon btn-sm btn-ghost-secondary" onClick={() => moveProfile(idx, 'up')} disabled={idx === 0}><ArrowUp size={14}/></button>
                          <button className="btn btn-icon btn-sm btn-ghost-secondary" onClick={() => moveProfile(idx, 'down')} disabled={idx === profiles.length - 1}><ArrowDown size={14}/></button>
                        </div>
                      </div>
                    </div>
                    
                    <div className="col">
                      <div className="mb-3">
                        <label className="form-label small font-weight-bold">Profile Name</label>
                        <input className="form-control form-control-sm" value={profile.name} onChange={e => updateProfile(idx, 'name', e.target.value)} placeholder="e.g. 4K HEVC" />
                      </div>
                      
                      <div className="mb-3">
                        <label className="form-label small font-weight-bold">Match Rules (When to use this profile)</label>
                        <RuleDeck 
                          rule={profile.match_rule} 
                          onChange={(updated) => updateMatchRule(idx, updated)} 
                        />
                      </div>

                      <div className="mb-3">
                        <label className="form-label small font-weight-bold">Output File Container</label>
                        <select 
                          className="form-select form-select-sm"
                          style={{ maxWidth: '250px' }}
                          value={profile.ffmpeg_settings.container}
                          onChange={e => updateFFmpeg(idx, 'container', e.target.value)}
                        >
                          <option value="original">Keep the same container (original)</option>
                          <option value="mp4">MP4</option>
                          <option value="mkv">MKV</option>
                          <option value="mov">MOV</option>
                          <option value="webm">WebM</option>
                        </select>
                      </div>

                      <div className="bg-light p-3 rounded border">
                        <div className="row g-3">
                          <div className="col-12">
                            <label className="form-label small font-weight-bold text-muted">Custom Main Options</label>
                            <textarea 
                              className="form-control form-control-sm font-monospace bg-white" 
                              rows={2}
                              value={profile.ffmpeg_settings.custom_main_options || ''} 
                              onChange={e => updateFFmpeg(idx, 'custom_main_options', e.target.value)}
                              placeholder="e.g. -hwaccel cuda -hwaccel_output_format cuda ..."
                            />
                            <small className="form-hint mt-1">
                              These flags are placed directly after `ffmpeg` and before the input file (`-i`).
                            </small>
                          </div>
                          
                          <div className="col-12">
                            <label className="form-label small font-weight-bold text-muted">Custom Advanced Options</label>
                            <textarea 
                              className="form-control form-control-sm font-monospace bg-white" 
                              rows={2}
                              value={profile.ffmpeg_settings.custom_advanced_options || ''} 
                              onChange={e => updateFFmpeg(idx, 'custom_advanced_options', e.target.value)}
                              placeholder="e.g. -vf scale_cuda=format=p010le -max_muxing_queue_size 2048 ..."
                            />
                            <small className="form-hint mt-1">
                              These flags are placed immediately after the input file.
                            </small>
                          </div>

                          <div className="col-12">
                            <label className="form-label small font-weight-bold text-muted">FFmpeg Video Output Flags</label>
                            <textarea 
                              className="form-control form-control-sm font-monospace bg-white" 
                              rows={2}
                              value={profile.ffmpeg_settings.video_flags} 
                              onChange={e => updateFFmpeg(idx, 'video_flags', e.target.value)}
                              placeholder="e.g. -c:v hevc_nvenc -profile:v main10 ..."
                            />
                            <small className="form-hint mt-1">
                              These flags are placed near the end of the command before the output file.
                            </small>
                          </div>
                        </div>
                      </div>

                      {/* Copy Button - Bottom Right */}
                      <div className="d-flex justify-content-end mt-3">
                        <button 
                          className="btn btn-sm btn-outline-primary" 
                          onClick={() => duplicateProfile(idx)}
                          title="Duplicate Profile"
                        >
                          <Copy size={14} className="me-1" /> Duplicate Profile
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {showPicker && (
        <DirectoryPicker 
          initialPath={pickerTarget.initial || '/'} 
          onSelect={(path) => { 
            if (pickerTarget.field === 'cache') setCachePath(path);
            else setRelocatePath(path);
            setShowPicker(false);
          }}
          onClose={() => setShowPicker(false)}
        />
      )}
    </div>
  );
};

export default Pipelines;