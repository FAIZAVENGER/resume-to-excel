async function request(path, options) {
  let res;
  try {
    res = await fetch(path, options);
  } catch {
    throw new Error('Cannot reach the server. Make sure it is running.');
  }
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      message = (await res.json()).error || message;
    } catch {
      /* keep default */
    }
    throw new Error(message);
  }
  return res;
}

export async function getHealth() {
  return (await request('/api/health')).json();
}

export async function parseResume(file, jobContext) {
  const body = new FormData();
  body.append('resume', file);
  body.append('jobContext', jobContext || '');
  return (await request('/api/parse', { method: 'POST', body })).json();
}

export async function exportExcel(rows, workbookFile) {
  const body = new FormData();
  body.append('rows', JSON.stringify(rows));
  if (workbookFile) body.append('workbook', workbookFile);
  return (await request('/api/export', { method: 'POST', body })).blob();
}

export function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
