(() => {
  let data = [];
  let availableSoorten = new Set();

  function parseCSV(text) {
    const rows = [];
    let row = [];
    let field = '';
    let inQuotes = false;

    for (let i = 0; i < text.length; i += 1) {
      const ch = text[i];
      const next = text[i + 1];

      if (inQuotes) {
        if (ch === '"' && next === '"') {
          field += '"';
          i += 1;
        } else if (ch === '"') {
          inQuotes = false;
        } else {
          field += ch;
        }
        continue;
      }

      if (ch === '"') {
        inQuotes = true;
        continue;
      }

      if (ch === ',') {
        row.push(field);
        field = '';
        continue;
      }

      if (ch === '\n') {
        row.push(field);
        rows.push(row);
        row = [];
        field = '';
        continue;
      }

      if (ch === '\r') continue;

      field += ch;
    }

    if (field.length > 0 || row.length > 0) {
      row.push(field);
      rows.push(row);
    }

    return rows;
  }

  function normalizeKey(key) {
    return key
      .replace(/^\uFEFF/, '')
      .trim()
      .replace(/^"|"$/g, '')
      .toLowerCase();
  }

  function normalizeRows(rows) {
    const header = rows[0].map(normalizeKey);
    return rows.slice(1).map(values => {
      const obj = {};
      header.forEach((key, idx) => {
        const value = values[idx] ?? '';
        obj[key === 'sectie' ? 'sectie' : key] = value;
      });
      return obj;
    });
  }

  function toUpper(value) {
    return String(value || '').trim().toUpperCase();
  }

  function numValue(value) {
    const n = Number(String(value || '').trim());
    return Number.isFinite(n) ? n : null;
  }

  function orderFor(values) {
    if (values.soort === 'Voorna' && values.soort2) return ['gemeente', 'leggerart', 'begin'];
    if (values.legger) return ['gemeente', 'leggerart', 'begin'];
    if (values.naam) return ['gemeente', 'reeksdeel', 'naam1'];
    if (values.sectie || values.perceel) return ['gemeente', 'sectie', 'reeksdeel', 'begin'];
    if (values.deel || values.vak || values.arrondissement) return ['arrondissement', 'reeksdeel', 'begin'];
    if (values.volgnummer) return ['gemeente', 'sectie', 'begin'];
    return ['id'];
  }

  function compareValues(a, b, key) {
    const numericKeys = new Set(['begin', 'eind']);
    const av = a[key];
    const bv = b[key];

    if (numericKeys.has(key)) {
      const an = numValue(av) ?? 0;
      const bn = numValue(bv) ?? 0;
      return an - bn;
    }

    return String(av || '').localeCompare(String(bv || ''), 'nl', { sensitivity: 'base' });
  }

  async function readWithProgress(res, label) {
    const total = Number(res.headers.get('Content-Length')) || 0;
    const reader = res.body.getReader();
    const chunks = [];
    let loaded = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      loaded += value.byteLength;
      self.postMessage({ type: 'progress', loaded, total, label });
    }

    return { chunks, loaded, total };
  }

  async function fetchCsvText(gzPath, csvPath) {
    if (self.DecompressionStream) {
      self.postMessage({ type: 'source', source: 'gz' });
      const res = await fetch(gzPath, { cache: 'no-store' });
      if (!res.ok) throw new Error(`CSV laden mislukt (${res.status})`);
      const { chunks } = await readWithProgress(res, 'gz');
      const gzBlob = new Blob(chunks, { type: 'application/gzip' });
      const ds = new DecompressionStream('gzip');
      const stream = gzBlob.stream().pipeThrough(ds);
      return await new Response(stream).text();
    }

    self.postMessage({ type: 'source', source: 'csv' });
    const res = await fetch(csvPath, { cache: 'no-store' });
    if (!res.ok) throw new Error(`CSV laden mislukt (${res.status})`);
    const { chunks } = await readWithProgress(res, 'csv');
    const blob = new Blob(chunks, { type: 'text/csv' });
    return await blob.text();
  }

  async function init(payload) {
    const text = await fetchCsvText(payload.gzPath, payload.csvPath);
    const rows = parseCSV(text);
    data = normalizeRows(rows);
    availableSoorten = new Set(
      data.map(r => toUpper(r.soort)).filter(v => v)
    );
    self.postMessage({ type: 'ready', count: data.length });
  }

  function search(values) {
    let rows = data.slice();

    if (values.soortFilter) {
      const soortUpper = toUpper(values.soortFilter);
      if (availableSoorten.has(soortUpper)) {
        rows = rows.filter(r => toUpper(r.soort).startsWith(soortUpper));
      }
    }

    if (values.gemeente) {
      const gemUpper = toUpper(values.gemeente);
      rows = rows.filter(r => toUpper(r.gemeente).startsWith(gemUpper));
    }

    if (values.legger) {
      const leg = String(values.legger).trim();
      rows = rows.filter(r => String(r.leggerart || '').trim() === leg);
    }

    if (values.naam) {
      const q = toUpper(values.naam);
      const l = q.length;
      rows = rows.filter(r => {
        const n1 = toUpper(r.naam1).slice(0, l);
        const n2 = toUpper(r.naam2).slice(0, l);
        return n2 >= q && n1 <= q;
      });
    }

    if (values.sectie) {
      const sec = toUpper(values.sectie);
      rows = rows.filter(r => toUpper(r.sectie) === sec);
    }

    if (values.perceel) {
      const nr = numValue(values.perceel);
      if (nr !== null) {
        rows = rows.filter(r => {
          const b = numValue(r.begin);
          const e = numValue(r.eind);
          return b !== null && e !== null && b <= nr && e >= nr;
        });
      } else {
        rows = [];
      }
    }

    if (values.deel) {
      const needle = `DEEL${values.deel}`.toUpperCase();
      rows = rows.filter(r => toUpper(r.reeksdeel) === needle);
    }

    if (values.vak) {
      const nr = numValue(values.vak);
      if (nr !== null) {
        rows = rows.filter(r => {
          const b = numValue(r.begin);
          const e = numValue(r.eind);
          return b !== null && e !== null && b <= nr && e >= nr;
        });
      } else {
        rows = [];
      }
    }

    if (values.arrondissement) {
      const arr = toUpper(values.arrondissement);
      rows = rows.filter(r => toUpper(r.arrondissement) === arr);
    }

    if (values.volgnummer) {
      const nr = numValue(values.volgnummer);
      if (nr !== null) {
        rows = rows.filter(r => {
          const b = numValue(r.begin);
          const e = numValue(r.eind);
          return b !== null && e !== null && b <= nr && e >= nr;
        });
      } else {
        rows = [];
      }
    }

    const order = orderFor(values);
    rows.sort((a, b) => {
      for (const key of order) {
        const cmp = compareValues(a, b, key);
        if (cmp !== 0) return cmp;
      }
      return 0;
    });

    self.postMessage({ type: 'results', rows, total: rows.length });
  }

  self.addEventListener('message', (e) => {
    const { type, payload } = e.data || {};
    if (type === 'init') {
      init(payload).catch(err => {
        self.postMessage({ type: 'error', message: String(err.message || err) });
      });
      return;
    }
    if (type === 'search') {
      search(payload || {});
    }
  });
})();
