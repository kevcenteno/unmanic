import React, { useState } from 'react';
import { X, Plus, ChevronDown } from 'lucide-react';
import { MatchRule } from './MatchRuleBuilder';

interface RuleDeckProps {
  rule: MatchRule;
  onChange: (updatedRule: MatchRule) => void;
}

const RuleDeck: React.FC<RuleDeckProps> = ({ rule, onChange }) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [newRule, setNewRule] = useState({
    property: 'bitrate',
    operator: 'is',
    value: '',
    minValue: '',
    maxValue: ''
  });

  const activeRules = rule.logical_op === 'AND' ? rule.rules : [];

  const removeRule = (index: number) => {
    const updatedRules = activeRules.filter((_, i) => i !== index);
    onChange({ ...rule, logical_op: 'AND', rules: updatedRules });
  };

  const addRule = () => {
    let finalValue = newRule.value;
    if (newRule.operator === 'between') {
      finalValue = `${newRule.minValue}-${newRule.maxValue}`;
    }

    const ruleToAdd: MatchRule = {
      logical_op: '',
      rules: [],
      property: newRule.property,
      operator: newRule.operator,
      value: finalValue
    };

    onChange({
      ...rule,
      logical_op: 'AND',
      rules: [...activeRules, ruleToAdd]
    });
    setShowAddForm(false);
    setNewRule({ property: 'bitrate', operator: 'is', value: '', minValue: '', maxValue: '' });
  };

  const renderChip = (r: MatchRule, index: number) => {
    let displayValue = r.value;
    if (r.operator === 'between') {
      displayValue = r.value.replace('-', ' to ');
    }
    
    const isBitrate = r.property.toLowerCase() === 'bitrate';

    return (
      <div key={index} className="badge bg-blue-lt me-2 mb-2 p-2 d-inline-flex align-items-center" style={{ fontSize: '0.85rem' }}>
        <span className="text-capitalize fw-bold me-1">{r.property}:</span>
        <span className="me-1">{r.operator}</span>
        <span className="fw-bold">{displayValue}{isBitrate ? ' kbps' : ''}</span>
        <button 
          type="button" 
          className="btn-close ms-2" 
          style={{ fontSize: '0.5rem' }} 
          onClick={() => removeRule(index)}
        />
      </div>
    );
  };

  return (
    <div className="rule-deck">
      <div className="d-flex flex-wrap align-items-center mb-2">
        {activeRules.map((r, idx) => renderChip(r, idx))}
        
        <div className="dropdown">
          <button 
            className="btn btn-sm btn-outline-primary mb-2" 
            type="button"
            onClick={() => setShowAddForm(!showAddForm)}
          >
            <Plus size={14} className="me-1" /> Add Rule
          </button>

          {showAddForm && (
            <div className="card shadow-lg position-absolute z-index-1000 mt-1" style={{ width: '300px', zIndex: 1050 }}>
              <div className="card-body p-3">
                <div className="mb-3">
                  <label className="form-label small">Property</label>
                  <select 
                    className="form-select form-select-sm" 
                    value={newRule.property}
                    onChange={(e) => setNewRule({ ...newRule, property: e.target.value })}
                  >
                    <option value="width">Width (px)</option>
                    <option value="height">Height (px)</option>
                    <option value="bitrate">Bitrate (kbps)</option>
                    <option value="codec">Codec</option>
                  </select>
                </div>

                <div className="mb-3">
                  <label className="form-label small">Operator</label>
                  <select 
                    className="form-select form-select-sm"
                    value={newRule.operator}
                    onChange={(e) => setNewRule({ ...newRule, operator: e.target.value })}
                  >
                    <option value="is">is</option>
                    <option value="is not">is not</option>
                    {newRule.property !== 'codec' && (
                      <>
                        <option value=">">greater than</option>
                        <option value="<">less than</option>
                        <option value="between">between (inclusive)</option>
                      </>
                    )}
                  </select>
                </div>

                <div className="mb-3">
                  <label className="form-label small">Value</label>
                  {newRule.property === 'codec' ? (
                    <select 
                      className="form-select form-select-sm"
                      value={newRule.value}
                      onChange={(e) => setNewRule({ ...newRule, value: e.target.value })}
                    >
                      <option value="">Select codec...</option>
                      <option value="h264">h264</option>
                      <option value="hevc">hevc</option>
                      <option value="av1">av1</option>
                      <option value="vp9">vp9</option>
                    </select>
                  ) : newRule.operator === 'between' ? (
                    <div className="row g-2">
                      <div className="col">
                        <input 
                          type="number" 
                          className="form-control form-control-sm" 
                          placeholder="Min"
                          value={newRule.minValue}
                          onChange={(e) => setNewRule({ ...newRule, minValue: e.target.value })}
                        />
                      </div>
                      <div className="col">
                        <input 
                          type="number" 
                          className="form-control form-control-sm" 
                          placeholder="Max"
                          value={newRule.maxValue}
                          onChange={(e) => setNewRule({ ...newRule, maxValue: e.target.value })}
                        />
                      </div>
                    </div>
                  ) : (
                    <input 
                      type="number" 
                      className="form-control form-control-sm" 
                      placeholder="Value"
                      value={newRule.value}
                      onChange={(e) => setNewRule({ ...newRule, value: e.target.value })}
                    />
                  )}
                </div>

                <div className="d-flex justify-content-end gap-2 mt-3">
                  <button className="btn btn-sm btn-link text-muted" onClick={() => setShowAddForm(false)}>Cancel</button>
                  <button className="btn btn-sm btn-primary" onClick={addRule}>Add</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      {activeRules.length === 0 && !showAddForm && (
        <div className="text-muted small italic">No rules defined. Matches all files.</div>
      )}
    </div>
  );
};

export default RuleDeck;
