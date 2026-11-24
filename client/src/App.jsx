import { useEffect, useRef, useState } from 'react';
import { FileSpreadsheet, Sparkles } from 'lucide-react';
import { getHealth, parseResume, exportExcel, saveBlob } from './api.js';
import { useLocalStorage } from './hooks.js';
import { applyExtraction, missingFields, newRecord, todayISO, uid } from './fields.js';
import UploadPanel from './components/UploadPanel.jsx';
import CandidateForm from './components/CandidateForm.jsx';
import SheetTable from './components/SheetTable.jsx';
import RowStrip from './components/RowStrip.jsx';

const digits = (s) => String(s || '').replace(/\D/g, '').slice(-10);

export default function App() {
  const [tab, setTab] = useState('add');
  const [health, setHealth] = useState(null);
  const [queue, setQueue] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [rows, setRows] = useLocalStorage('rs.rows', []);
  const [jobContext, setJobContext] = useLocalStorage('rs.jobContext', '');
  const [recruiter, setRecruiter] = useLocalStorage('rs.recruiter', '');
  const [selected, setSelected] = useState(new Set());
  const [exporting, setExporting] = useState(false);
  const [toast, setToast] = useState(null);

  const jobRef = useRef(jobContext);
  jobRef.current = jobContext;
  const recruiterRef = useRef(recruiter);
  recruiterRef.current = recruiter;
  const chain = useRef(Promise.resolve());

  useEffect(() => {
    getHealth().then(setHealth).catch(() => setHealth({ offline: true }));
  }, []);

  const notify = (message, tone = 'ok') => {
    setToast({ message, tone, id: Date.now() });
  };
  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(null), 3600);
    return () => clearTimeout(t);
  }, [toast]);

  const patchItem = (id, patch) => setQueue((q) => q.map((x) => (x.id === id ? { ...x, ...patch } : x)));

  // ---- parsing (one resume at a time, to stay inside Groq's free-tier rate limits) ----
  const runParse = async (item) => {
    patchItem(item.id, { status: 'parsing', error: '' });
    try {
      const { data } = await parseResume(item.file, jobRef.current);
      setQueue((q) =>
        q.map((x) =>
          x.id === item.id
            ? { ...x, status: x.rowId ? 'saved' : 'ready', extracted: true, data: applyExtraction(x.data, data) }
            : x
        )
      );
    } catch (err) {
      patchItem(item.id, { status: 'error', error: err.message });
    }
  };

  const enqueueParse = (items) => {
    items.forEach((item) => {
      chain.current = chain.current.then(() => runParse(item));
    });
  };

  const handleFiles = (files) => {
    const items = files.map((file) => ({
      id: uid(),
      file,
      fileName: file.name,
      status: 'parsing',
      error: '',
      extracted: false,
      showErrors: false,
      rowId: null,
      data: newRecord({ resumeFile: file.name, recruiterName: recruiterRef.current }),
    }));
    setQueue((q) => [...q, ...items]);
    setActiveId((cur) => cur || items[0].id);
    enqueueParse(items);
  };

  const active = queue.find((x) => x.id === activeId) || null;

  const updateData = (patch) => {
    if (!active) return;
    if ('recruiterName' in patch) setRecruiter(patch.recruiterName);
    setQueue((q) => q.map((x) => (x.id === active.id ? { ...x, data: { ...x.data, ...patch } } : x)));
  };

  const removeItem = (id) => {
    setQueue((q) => q.filter((x) => x.id !== id));
    if (id === activeId) {
      const rest = queue.filter((x) => x.id !== id);
      setActiveId(rest[0]?.id || null);
    }
  };

  // ---- saving to the sheet ----
  const save = () => {
    if (!active) return;
    const data = active.data;
    if (missingFields(data).length) {
      patchItem(active.id, { showErrors: true });
      notify('Some required cells are empty.', 'warn');
      const first = missingFields(data)[0];
      document.getElementById(`field-${first}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      return;
    }
    const dup = rows.find(
      (r) =>
        r.id !== active.rowId &&
        ((data.email && r.email?.toLowerCase() === data.email.toLowerCase()) ||
          (digits(data.contactNumber) && digits(r.contactNumber) === digits(data.contactNumber)))
    );
    if (dup && !window.confirm(`${dup.name} is already in the sheet with the same email or phone. Save anyway?`)) return;

    const rowId = active.rowId || uid();
    const row = { ...data, id: rowId, savedAt: Date.now() };
    const updating = Boolean(active.rowId);
    setRows((prev) => (updating ? prev.map((r) => (r.id === rowId ? row : r)) : [...prev, row]));
    patchItem(active.id, { rowId, status: 'saved', showErrors: false });
    notify(updating ? 'Row updated.' : 'Saved to sheet.');

    const next = queue.find((x) => x.id !== active.id && x.status !== 'saved' && x.status !== 'parsing');
    if (next && !updating) setActiveId(next.id);
  };

  const editRow = (row) => {
    const existing = queue.find((x) => x.rowId === row.id);
    if (existing) {
      setActiveId(existing.id);
    } else {
      const item = {
        id: uid(), file: null, fileName: row.resumeFile || row.name, status: 'saved', error: '',
        extracted: false, showErrors: false, rowId: row.id, data: newRecord(row),
      };
      setQueue((q) => [...q, item]);
      setActiveId(item.id);
    }
    setTab('add');
  };

  const deleteRow = (row) => {
    if (!window.confirm(`Delete ${row.name} from the sheet?`)) return;
    setRows((prev) => prev.filter((r) => r.id !== row.id));
    setSelected((s) => {
      const n = new Set(s);
      n.delete(row.id);
      return n;
    });
    setQueue((q) => q.map((x) => (x.rowId === row.id ? { ...x, rowId: null, status: 'ready' } : x)));
  };

  const clearSheet = () => {
    if (!window.confirm(`Remove all ${rows.length} candidates from the sheet? This cannot be undone.`)) return;
    setRows([]);
    setSelected(new Set());
    setQueue((q) => q.map((x) => (x.rowId ? { ...x, rowId: null, status: 'ready' } : x)));
  };

  // ---- Excel export ----
  const doExport = async (workbookFile) => {
    const target = selected.size ? rows.filter((r) => selected.has(r.id)) : rows;
    setExporting(true);
    try {
      const blob = await exportExcel(target, workbookFile);
      const name = workbookFile
        ? workbookFile.name.replace(/\.xlsx$/i, '') + '_updated.xlsx'
        : `Candidates_${todayISO()}.xlsx`;
      saveBlob(blob, name);
      notify(workbookFile ? `Added ${target.length} rows to ${workbookFile.name}.` : `Downloaded ${target.length} rows.`);
    } catch (err) {
      notify(err.message, 'bad');
    } finally {
      setExporting(false);
    }
  };

  const serverOffline = health?.offline;
  const noKey = health && !health.offline && !health.groqConfigured;

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="logo" aria-hidden="true">
            <FileSpreadsheet size={20} />
          </span>
          <h1>ResumeSheet</h1>
        </div>
        <nav className="tabs" aria-label="Sections">
          <button type="button" className={tab === 'add' ? 'on' : ''} onClick={() => setTab('add')}>
            Add candidate
          </button>
          <button type="button" className={tab === 'sheet' ? 'on' : ''} onClick={() => setTab('sheet')}>
            Excel sheet <span className="count">{rows.length}</span>
          </button>
        </nav>
        <div className={`pill ${serverOffline ? 'bad' : noKey ? 'warn' : health ? 'ok' : ''}`}>
          <span className="dot" />
          {serverOffline ? 'Server offline' : noKey ? 'Groq key missing' : health ? 'Groq ready' : 'Connecting'}
        </div>
      </header>

      <main className="wrap">
        {serverOffline && (
          <div className="banner bad" role="alert">
            The server is not reachable. Start it with <code>npm run dev</code> from the project folder.
          </div>
        )}
        {noKey && (
          <div className="banner warn" role="alert">
            Add your Groq key to read resumes: copy <code>.env.example</code> to <code>.env</code>, set{' '}
            <code>GROQ_API_KEY</code>, then restart the server. You can still fill rows in by hand.
          </div>
        )}

        {tab === 'add' ? (
          <div className="workspace">
            <UploadPanel
              onFiles={handleFiles}
              jobContext={jobContext}
              setJobContext={setJobContext}
              queue={queue}
              activeId={activeId}
              setActiveId={setActiveId}
              onRemove={removeItem}
            />
            <div className="stage">
              {active ? (
                <CandidateForm
                  key={active.id}
                  item={active}
                  showErrors={active.showErrors}
                  onChange={updateData}
                  onSave={save}
                  onRetry={() => enqueueParse([active])}
                />
              ) : (
                <div className="empty-stage">
                  <h2>Upload a resume to start a new row</h2>
                  <p>
                    Each resume becomes one row of your Excel sheet. The cells fill in three ways, and each field is
                    tagged so you can see which is which.
                  </p>
                  <RowStrip data={newRecord()} />
                  <dl className="legend">
                    <div>
                      <dt>
                        <span className="origin origin-ai">
                          <Sparkles size={11} />
                          From resume
                        </span>
                      </dt>
                      <dd>Name, contact, email, experience, skills, education, company and clients.</dd>
                    </div>
                    <div>
                      <dt>
                        <span className="origin origin-default">Default</span>
                      </dt>
                      <dd>Source is Naukri. Communication, competency and comments start as Good. Tracking is YES.</dd>
                    </div>
                    <div>
                      <dt>
                        <span className="origin origin-manual">Fill in</span>
                      </dt>
                      <dd>Notice period, locations, CTC, offers and your name.</dd>
                    </div>
                  </dl>
                </div>
              )}
            </div>
          </div>
        ) : (
          <SheetTable
            rows={rows}
            selected={selected}
            setSelected={setSelected}
            onEdit={editRow}
            onDelete={deleteRow}
            onExport={doExport}
            onClear={clearSheet}
            exporting={exporting}
            onGoAdd={() => setTab('add')}
          />
        )}
      </main>

      {toast && (
        <div className={`toast ${toast.tone}`} role="status" key={toast.id}>
          {toast.message}
        </div>
      )}
    </div>
  );
}
