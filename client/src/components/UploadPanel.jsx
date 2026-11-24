import { useRef, useState } from 'react';
import { CheckCircle2, CircleAlert, FileUp, Loader2, X, FileText } from 'lucide-react';

const ACCEPT = '.pdf,.docx,.doc,.txt,.md,.rtf,.html,.htm,.png,.jpg,.jpeg,.webp';

function subtitle(item) {
  if (item.status === 'parsing') return 'Reading resume';
  if (item.status === 'error') return 'Needs attention';
  if (item.status === 'saved') return 'Saved to sheet';
  return item.data.name || 'Ready to review';
}

function StatusIcon({ status }) {
  if (status === 'parsing') return <Loader2 size={16} className="spin" />;
  if (status === 'error') return <CircleAlert size={16} />;
  if (status === 'saved') return <CheckCircle2 size={16} />;
  return <FileText size={16} />;
}

export default function UploadPanel({ onFiles, jobContext, setJobContext, queue, activeId, setActiveId, onRemove }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  const take = (fileList) => {
    const files = Array.from(fileList || []);
    if (files.length) onFiles(files);
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <aside className="intake">
      <div className="intake-block">
        <div
          className={`dropzone ${dragging ? 'drag' : ''}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            take(e.dataTransfer.files);
          }}
        >
          <FileUp size={26} strokeWidth={1.6} />
          <p className="dz-title">Drop resumes here</p>
          <p className="dz-sub">PDF, Word, TXT, RTF, HTML or an image. Up to 10 MB each. You can add several at once.</p>
          <button type="button" className="btn" onClick={() => inputRef.current?.click()}>
            Choose files
          </button>
          <input ref={inputRef} type="file" accept={ACCEPT} multiple hidden onChange={(e) => take(e.target.files)} />
        </div>
      </div>

      <div className="intake-block">
        <label htmlFor="jd" className="intake-label">
          Job requirement <span className="optional">(optional)</span>
        </label>
        <textarea
          id="jd"
          rows={3}
          value={jobContext}
          onChange={(e) => setJobContext(e.target.value)}
          placeholder="e.g. Java Spring Boot developer, microservices, 5+ years"
        />
        <p className="intake-help">Used to work out relevant experience. Applies to resumes you upload next.</p>
      </div>

      <div className="intake-block">
        <div className="intake-label">Resumes ({queue.length})</div>
        {queue.length === 0 ? (
          <p className="intake-help">Nothing uploaded yet.</p>
        ) : (
          <ul className="queue">
            {queue.map((item) => (
              <li key={item.id} className={`${item.id === activeId ? 'active' : ''} s-${item.status}`}>
                <button type="button" className="queue-main" onClick={() => setActiveId(item.id)}>
                  <StatusIcon status={item.status} />
                  <span className="queue-text">
                    <span className="queue-file">{item.fileName}</span>
                    <span className="queue-sub">{subtitle(item)}</span>
                  </span>
                </button>
                <button type="button" className="icon-btn" aria-label={`Remove ${item.fileName}`} onClick={() => onRemove(item.id)}>
                  <X size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}
