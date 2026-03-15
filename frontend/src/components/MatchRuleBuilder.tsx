import React from 'react';
import { Plus, Trash, Layers } from 'lucide-react';

export interface MatchRule {
  logical_op: string;
  rules: MatchRule[];
  property: string;
  operator: string;
  value: string;
}

interface MatchRuleBuilderProps {
  rule: MatchRule;
  onChange: (updatedRule: MatchRule) => void;
  depth?: number;
}

const MatchRuleBuilder: React.FC<MatchRuleBuilderProps> = ({ rule, onChange, depth = 0 }) => {
  const isGroup = rule.logical_op === 'AND' || rule.logical_op === 'OR';

  const handleUpdate = (field: keyof MatchRule, value: any) => {
    onChange({ ...rule, [field]: value });
  };

  const addSubRule = (isGroup: boolean) => {
    const newRule: MatchRule = isGroup
      ? { logical_op: 'AND', rules: [], property: '', operator: '', value: '' }
      : { logical_op: '', rules: [], property: 'bitrate', operator: '>', value: '0' };
    
    onChange({ ...rule, rules: [...(rule.rules || []), newRule] });
  };

  const removeSubRule = (index: number) => {
    const updatedRules = rule.rules.filter((_, i) => i !== index);
    onChange({ ...rule, rules: updatedRules });
  };

  const updateSubRule = (index: number, updatedSubRule: MatchRule) => {
    const updatedRules = [...rule.rules];
    updatedRules[index] = updatedSubRule;
    onChange({ ...rule, rules: updatedRules });
  };

  if (!isGroup) {
    return (
      <div className="row g-2 align-items-center">
        <div className="col-auto">
          <button 
            className="btn btn-icon btn-sm btn-ghost-primary" 
            title="Convert to Group"
            onClick={() => handleUpdate('logical_op', 'AND')}
          >
            <Layers size={14} />
          </button>
        </div>
        <div className="col">
          <div className="input-group input-group-sm">
            <select 
              className="form-select" 
              value={rule.property} 
              onChange={(e) => handleUpdate('property', e.target.value)}
            >
              <option value="bitrate">Bitrate (kbps)</option>
              <option value="width">Width (px)</option>
              <option value="height">Height (px)</option>
              <option value="codec">Codec</option>
            </select>
            <select 
              className="form-select" 
              style={{ maxWidth: '80px' }} 
              value={rule.operator} 
              onChange={(e) => handleUpdate('operator', e.target.value)}
            >
              <option value=">">&gt;</option>
              <option value="<">&lt;</option>
              <option value="==">==</option>
              <option value="!=">!=</option>
              <option value="contains">contains</option>
            </select>
            <input 
              className="form-control" 
              placeholder="Value" 
              value={rule.value} 
              onChange={(e) => handleUpdate('value', e.target.value)} 
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`p-3 rounded border ${depth % 2 === 0 ? 'bg-white' : 'bg-light'}`} style={{ borderLeftWidth: '4px' }}>
      <div className="d-flex justify-content-between align-items-center mb-2">
        <div className="d-flex align-items-center">
          <select 
            className={`form-select form-select-sm fw-bold ${rule.logical_op === 'AND' ? 'text-primary' : 'text-warning'}`}
            style={{ width: '80px' }}
            value={rule.logical_op}
            onChange={(e) => handleUpdate('logical_op', e.target.value)}
          >
            <option value="AND">AND</option>
            <option value="OR">OR</option>
          </select>
          <span className="ms-2 small text-muted">of the following:</span>
        </div>
        <div className="btn-list">
          <button className="btn btn-sm btn-ghost-primary" onClick={() => addSubRule(false)}>
            <Plus size={14} className="me-1" /> Rule
          </button>
          <button className="btn btn-sm btn-ghost-primary" onClick={() => addSubRule(true)}>
            <Plus size={14} className="me-1" /> Group
          </button>
          {depth > 0 && (
            <button className="btn btn-sm btn-ghost-secondary" onClick={() => handleUpdate('logical_op', '')}>
              <Trash size={14} />
            </button>
          )}
        </div>
      </div>

      <div className="rules-list d-grid gap-2">
        {rule.rules.length === 0 ? (
          <div className="text-center py-2 text-muted small border-dashed rounded">
            Empty group. Add a rule or group above.
          </div>
        ) : (
          rule.rules.map((subRule, idx) => (
            <div key={idx} className="d-flex align-items-start g-2">
              <div className="flex-fill">
                <MatchRuleBuilder 
                  rule={subRule} 
                  onChange={(updated) => updateSubRule(idx, updated)} 
                  depth={depth + 1} 
                />
              </div>
              <button 
                className="btn btn-icon btn-sm btn-ghost-danger mt-1 ms-1" 
                onClick={() => removeSubRule(idx)}
              >
                <Trash size={14} />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default MatchRuleBuilder;
