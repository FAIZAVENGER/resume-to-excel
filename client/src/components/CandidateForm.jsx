import { FileText, Loader2, Sparkles, TriangleAlert, Check } from 'lucide-react';
import { SECTIONS, isEmpty, missingFields } from '../fields.js';
import TagInput from './TagInput.jsx';
import RowStrip from './RowStrip.jsx';

const ORIGIN_LABEL = { ai: 'From resume', default: 'Default', manual: 'Fill in' };

function Control({ def, value, onChange, id, invalid }) {
  const common = { id, 'aria-invalid': invalid || undefined };
  switch (def.type) {
    case 'tags':
      return <TagInput id={id} value={value} onChange={onChange} placeholder={def.placeholder} invalid={invalid} />;
    case 'textarea':
      return (
        <textarea
          {...common}
          rows={def.rows || 3}
          value={value}
          placeholder={def.placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case 'select': {
      const options = !value || def.options.includes(value) ? def.options : [value, ...def.options];
      return (
        <select {...common} value={value} onChange={(e) => onChange(e.target.value)}>
          {options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      );
    }
    case 'readonly':
      return (
        <div id={id} className="readonly" tabIndex={-1}>
          <FileText size={16} />
          <span>{value || 'No file attached'}</span>
        </div>
      );
    default:
      return (
        <>
          <input
            {...common}
            type={def.type === 'date' ? 'date' : def.type === 'email' ? 'email' : 'text'}
            list={def.list ? `list-${def.key}` : undefined}
            value={value}
            placeholder={def.placeholder}
            autoComplete="off"
            onChange={(e) => onChange(e.target.value)}
          />
          {def.list && (
            <datalist id={`list-${def.key}`}>
              {def.list.map((o) => (
                <option key={o} value={o} />
              ))}
            </datalist>
          )}
        </>
      );
  }
}

function Field({ def, value, onChange, showErrors, extracted }) {
  const id = `field-${def.key}`;
  const empty = isEmpty(value);
  const invalid = showErrors && def.required && empty;
  const notFound = extracted && def.origin === 'ai' && empty;

  return (
    <div className={`field ${def.wide ? 'wide' : ''}`}>
      <div className="field-head">
        <label htmlFor={id}>
          {def.label}
          {def.required && (
            <span className="req" aria-hidden="true">
              {' '}
              *
            </span>
          )}
        </label>
        <span className={`origin origin-${def.origin}`}>
          {def.origin === 'ai' && <Sparkles size={11} />}
          {ORIGIN_LABEL[def.origin]}
        </span>
      </div>
      <Control def={def} value={value} onChange={onChange} id={id} invalid={invalid} />
      {def.chips && (
        <div className="chips" aria-label={`Quick values for ${def.label}`}>
          {def.chips.map((c) => (
            <button type="button" key={c} className={value === c ? 'on' : ''} onClick={() => onChange(c)}>
              {c}
            </button>
          ))}
        </div>
      )}
      {invalid && <p className="field-msg bad">Required. Fill this in before saving.</p>}
      {!invalid && notFound && (
        <p className="field-msg warn">{def.emptyHint || 'Not found in the resume. Fill it in.'}</p>
      )}
    </div>
  );
}

export default function CandidateForm({ item, onChange, onSave, onRetry, showErrors }) {
  const parsing = item.status === 'parsing';
  const missing = missingFields(item.data);
  const saved = Boolean(item.rowId);

  const jumpToFirst = () => {
    const el = document.getElementById(`field-${missing[0]}`);
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    el?.focus({ preventScroll: true });
  };

  return (
    <section className="sheet-panel" aria-busy={parsing}>
      <RowStrip data={item.data} showErrors={showErrors} />

      {parsing && (
        <div className="notice busy" role="status">
          <Loader2 size={16} className="spin" />
          Reading {item.fileName}. This usually takes a few seconds.
        </div>
      )}

      {item.status === 'error' && (
        <div className="notice bad" role="alert">
          <TriangleAlert size={16} />
          <span>{item.error}</span>
          {item.file && (
            <button type="button" className="link" onClick={onRetry}>
              Try again
            </button>
          )}
        </div>
      )}

      <fieldset className="sections" disabled={parsing}>
        {SECTIONS.map((section) => (
          <div className="section" key={section.id}>
            <div className="section-head">
              <h3>{section.title}</h3>
              <p>{section.hint}</p>
            </div>
            <div className="grid">
              {section.fields.map((def) => (
                <Field
                  key={def.key}
                  def={def}
                  value={item.data[def.key]}
                  showErrors={showErrors}
                  extracted={item.extracted}
                  onChange={(v) => onChange({ [def.key]: v })}
                />
              ))}
            </div>
          </div>
        ))}
      </fieldset>

      <div className="actionbar">
        <p className={missing.length ? 'status warn' : 'status ok'}>
          {missing.length ? (
            <>
              {missing.length} required {missing.length === 1 ? 'cell is' : 'cells are'} empty.{' '}
              <button type="button" className="link" onClick={jumpToFirst}>
                Go to the first one
              </button>
            </>
          ) : (
            <>
              <Check size={14} /> Every required cell is filled.
            </>
          )}
        </p>
        <button type="button" className="btn primary" onClick={onSave} disabled={parsing}>
          {saved ? 'Update row' : 'Save to sheet'}
        </button>
      </div>
    </section>
  );
}
