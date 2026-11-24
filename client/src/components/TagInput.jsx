import { useState } from 'react';
import { X } from 'lucide-react';

export default function TagInput({ id, value, onChange, placeholder, invalid }) {
  const [draft, setDraft] = useState('');

  const add = (raw) => {
    const parts = raw.split(/[,;\n]/).map((s) => s.trim()).filter(Boolean);
    if (!parts.length) return;
    const next = [...value];
    for (const p of parts) {
      if (!next.some((x) => x.toLowerCase() === p.toLowerCase())) next.push(p);
    }
    onChange(next);
    setDraft('');
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      add(draft);
    } else if (e.key === 'Backspace' && !draft && value.length) {
      onChange(value.slice(0, -1));
    }
  };

  const onPaste = (e) => {
    const text = e.clipboardData.getData('text');
    if (/[,;\n]/.test(text)) {
      e.preventDefault();
      add(text);
    }
  };

  return (
    <div className={`tags ${invalid ? 'is-invalid' : ''}`}>
      {value.map((tag) => (
        <span className="tag" key={tag}>
          {tag}
          <button
            type="button"
            aria-label={`Remove ${tag}`}
            onClick={() => onChange(value.filter((t) => t !== tag))}
          >
            <X size={12} />
          </button>
        </span>
      ))}
      <input
        id={id}
        value={draft}
        placeholder={value.length ? '' : placeholder}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKeyDown}
        onPaste={onPaste}
        onBlur={() => add(draft)}
      />
    </div>
  );
}
