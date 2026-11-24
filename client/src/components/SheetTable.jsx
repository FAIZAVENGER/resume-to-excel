import { useMemo, useRef, useState } from 'react';
import { Download, FilePlus2, Pencil, Search, Trash2, Loader2 } from 'lucide-react';
import { EXCEL_ORDER, FIELD_BY_KEY, columnLetter } from '../fields.js';

const show = (v) => (Array.isArray(v) ? v.join(', ') : v ?? '');

export default function SheetTable({ rows, selected, setSelected, onEdit, onDelete, onExport, onClear, exporting, onGoAdd }) {
  const [query, setQuery] = useState('');
  const appendRef = useRef(null);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => EXCEL_ORDER.some((k) => show(r[k]).toLowerCase().includes(q)));
  }, [rows, query]);

  const allVisibleSelected = visible.length > 0 && visible.every((r) => selected.has(r.id));
  const toggleAll = () => {
    const next = new Set(selected);
    if (allVisibleSelected) visible.forEach((r) => next.delete(r.id));
    else visible.forEach((r) => next.add(r.id));
    setSelected(next);
  };
  const toggleOne = (id) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  if (rows.length === 0) {
    return (
      <div className="empty-sheet">
        <h2>The sheet is empty</h2>
        <p>Candidates you save show up here as rows, ready to download as Excel.</p>
        <button type="button" className="btn primary" onClick={onGoAdd}>
          Add a candidate
        </button>
      </div>
    );
  }

  const scope = selected.size ? `${selected.size} selected` : `all ${rows.length}`;

  return (
    <section className="sheet-view">
      <div className="toolbar">
        <div className="search">
          <Search size={16} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, skill, company, location" aria-label="Search the sheet" />
        </div>
        <div className="toolbar-actions">
          <button type="button" className="btn primary" disabled={exporting} onClick={() => onExport(null)}>
            {exporting ? <Loader2 size={16} className="spin" /> : <Download size={16} />}
            Download Excel ({scope})
          </button>
          <button type="button" className="btn" disabled={exporting} onClick={() => appendRef.current?.click()}>
            <FilePlus2 size={16} />
            Add to my Excel file
          </button>
          <input
            ref={appendRef}
            type="file"
            accept=".xlsx"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onExport(file);
              e.target.value = '';
            }}
          />
          <button type="button" className="btn danger" onClick={onClear}>
            Clear sheet
          </button>
        </div>
      </div>
      <p className="toolbar-help">
        "Add to my Excel file" appends {scope} to the first sheet of an .xlsx you choose, matching columns by title.
      </p>

      <div className="table-scroll">
        <table className="grid-table">
          <thead>
            <tr>
              <th className="sticky c0">
                <input type="checkbox" checked={allVisibleSelected} onChange={toggleAll} aria-label="Select all rows" />
              </th>
              {EXCEL_ORDER.map((key, i) => (
                <th key={key} className={key === 'name' ? 'sticky c1' : ''}>
                  <span className="th-letter">{columnLetter(i)}</span>
                  {FIELD_BY_KEY[key].label}
                </th>
              ))}
              <th className="actions-col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => (
              <tr key={r.id} className={selected.has(r.id) ? 'picked' : ''}>
                <td className="sticky c0">
                  <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggleOne(r.id)} aria-label={`Select ${r.name}`} />
                </td>
                {EXCEL_ORDER.map((key) => (
                  <td key={key} className={key === 'name' ? 'sticky c1 strong' : ''}>
                    <div className="cell" title={show(r[key])}>
                      {show(r[key])}
                    </div>
                  </td>
                ))}
                <td className="actions-col">
                  <button type="button" className="icon-btn" aria-label={`Edit ${r.name}`} onClick={() => onEdit(r)}>
                    <Pencil size={15} />
                  </button>
                  <button type="button" className="icon-btn" aria-label={`Delete ${r.name}`} onClick={() => onDelete(r)}>
                    <Trash2 size={15} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {visible.length === 0 && <p className="no-match">No rows match "{query}".</p>}
      </div>
    </section>
  );
}
