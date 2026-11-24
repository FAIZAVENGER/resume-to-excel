import { EXCEL_ORDER, FIELD_BY_KEY, columnLetter, isEmpty } from '../fields.js';

// A miniature of the Excel row: one cell per column (A to X), green once filled.
export default function RowStrip({ data, showErrors }) {
  const jump = (key) => {
    const el = document.getElementById(`field-${key}`);
    if (!el) return;
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    el.focus({ preventScroll: true });
  };

  const filledCount = EXCEL_ORDER.filter((k) => !isEmpty(data[k])).length;

  return (
    <div className="strip-wrap">
      <div className="strip" role="group" aria-label="Excel row, one cell per column">
        {EXCEL_ORDER.map((key, i) => {
          const f = FIELD_BY_KEY[key];
          const filled = !isEmpty(data[key]);
          const state = filled ? 'filled' : f.required ? (showErrors ? 'missing' : 'empty') : 'optional';
          return (
            <button
              type="button"
              key={key}
              className={`strip-cell ${state}`}
              onClick={() => jump(key)}
              title={`${columnLetter(i)}: ${f.label}${filled ? '' : ' (empty)'}`}
            >
              <span className="strip-col">{columnLetter(i)}</span>
              <span className="strip-fill" />
            </button>
          );
        })}
      </div>
      <p className="strip-note">
        {filledCount} of {EXCEL_ORDER.length} cells filled in this row
      </p>
    </div>
  );
}
