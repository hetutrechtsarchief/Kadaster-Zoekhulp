(() => {
  const CSV_PATH_GZ = 'KADASTER.csv.gz';
  const CSV_PATH_FALLBACK = 'KADASTER.csv';
  const WORKER_PATH = 'worker.js';

  const els = {
    form: document.getElementById('searchForm'),
    soort: document.getElementById('soort'),
    gemeente: document.getElementById('gemeente'),
    legger: document.getElementById('legger'),
    soort2: document.getElementById('soort2'),
    naam: document.getElementById('naam'),
    sectie: document.getElementById('sectie'),
    perceel: document.getElementById('perceel'),
    arrondissement: document.getElementById('arrondissement'),
    deel: document.getElementById('deel'),
    vak: document.getElementById('vak'),
    volgnummer: document.getElementById('volgnummer'),
    status: document.getElementById('status'),
    results: document.getElementById('results'),
    tipsBefore: document.getElementById('tipsBefore'),
    btnZoeken: document.getElementById('btnZoeken'),
  };

  const fieldBlocks = {
    gemeente: document.getElementById('field-gemeente'),
    legger: document.getElementById('field-legger'),
    soort2: document.getElementById('field-soort2'),
    naam: document.getElementById('field-naam'),
    sectie: document.getElementById('field-sectie'),
    perceel: document.getElementById('field-perceel'),
    arrondissement: document.getElementById('field-arrondissement'),
    deel: document.getElementById('field-deel'),
    vak: document.getElementById('field-vak'),
    volgnummer: document.getElementById('field-volgnummer'),
  };

  let worker = null;
  let workerReady = false;

  function buildScanLink(row) {
    const dvd = String(row.dvd_nr || '').trim();
    const pad = String(row.pad || '').trim();
    const filenaam = String(row.filenaam || '').trim();
    if (!dvd || !pad || !filenaam) return '';
    return `https://studiezaal/kadaster/DVD's/${dvd}${pad}${filenaam}`;
  }

  function inventarisLink(value) {
    const inv = String(value || '').trim();
    if (!inv) return '';
    return `https://hualab.nl/1294.${inv}`;
  }

  function setStatus(message) {
    els.status.textContent = message;
  }

  function showTipsBefore(soort) {
    if (!els.tipsBefore) return;
    const blocks = Array.from(els.tipsBefore.querySelectorAll('[data-soort]'));
    const match = blocks.find(b => b.getAttribute('data-soort') === soort) ||
      blocks.find(b => b.getAttribute('data-soort') === '');
    blocks.forEach(b => b.classList.toggle('hidden', b !== match));
  }

  function showTipsEmpty() {
    showTipsBefore(els.soort.value);
    els.results.innerHTML = '';
  }

  function renderTable(rows, columns, title) {
    if (!rows.length) {
      els.results.innerHTML = '<div class="tips">Geen resultaten gevonden.</div>';
      return;
    }

    els.results.innerHTML = '';

    const titleEl = document.createElement('p');
    const strong = document.createElement('strong');
    strong.textContent = title || 'Zoekresultaten';
    titleEl.appendChild(strong);
    els.results.appendChild(titleEl);

    const table = document.createElement('table');
    const thead = document.createElement('thead');
    const trh = document.createElement('tr');
    columns.forEach(col => {
      const th = document.createElement('th');
      th.innerHTML = col.header || col.label;
      trh.appendChild(th);
    });
    thead.appendChild(trh);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    table.appendChild(tbody);
    els.results.appendChild(table);

    const chunkSize = 200;
    let index = 0;

    function renderChunk() {
      const frag = document.createDocumentFragment();
      const end = Math.min(index + chunkSize, rows.length);
      for (let i = index; i < end; i += 1) {
        const row = rows[i];
        const tr = document.createElement('tr');
        columns.forEach(col => {
          const td = document.createElement('td');
          if (col.numeric) td.className = 'num';
          const value = col.value(row);
          td.innerHTML = value || '';
          tr.appendChild(td);
        });
        frag.appendChild(tr);
      }
      tbody.appendChild(frag);
      index = end;
      if (index < rows.length) requestAnimationFrame(renderChunk);
    }

    requestAnimationFrame(renderChunk);
  }

  function getFormValues() {
    const values = {
      soort: els.soort.value.trim(),
      gemeente: els.gemeente ? els.gemeente.value.trim() : '',
      legger: els.legger ? els.legger.value.trim() : '',
      soort2: els.soort2 ? els.soort2.value.trim() : '',
      naam: els.naam ? els.naam.value.trim() : '',
      sectie: els.sectie ? els.sectie.value.trim() : '',
      perceel: els.perceel ? els.perceel.value.trim() : '',
      arrondissement: els.arrondissement ? els.arrondissement.value.trim() : '',
      deel: els.deel ? els.deel.value.trim() : '',
      vak: els.vak ? els.vak.value.trim() : '',
      volgnummer: els.volgnummer ? els.volgnummer.value.trim() : '',
    };

    if (values.soort === 'Leggers') {
      values.soortFilter = '';
    } else if (values.soort === 'Voorna') {
      values.soortFilter = values.soort2;
    } else {
      values.soortFilter = values.soort;
    }

    return values;
  }

  function applyVisibility() {
    const soort = els.soort.value;
    const showGemeente = soort !== 'Alg';

    fieldBlocks.gemeente.classList.toggle('hidden', !showGemeente);
    fieldBlocks.legger.classList.toggle('hidden', soort !== 'Leggers');
    fieldBlocks.soort2.classList.toggle('hidden', soort !== 'Voorna');
    fieldBlocks.naam.classList.toggle('hidden', soort !== 'Naamlijst');
    fieldBlocks.sectie.classList.toggle('hidden', !(soort === 'Register 69' || soort === 'Register 71' || soort === 'SAT'));
    fieldBlocks.perceel.classList.toggle('hidden', !(soort === 'Register 69' || soort === 'Register 71'));
    fieldBlocks.arrondissement.classList.toggle('hidden', soort !== 'Alg');
    fieldBlocks.deel.classList.toggle('hidden', soort !== 'Alg');
    fieldBlocks.vak.classList.toggle('hidden', soort !== 'Alg');
    fieldBlocks.volgnummer.classList.toggle('hidden', soort !== 'SAT');
    if (els.btnZoeken) els.btnZoeken.disabled = !soort;
  }

  function search() {
    const values = getFormValues();
    const allowEmptyNaamlijst = values.soort === 'Naamlijst' && !values.naam;
    const allowEmptySat = values.soort === 'SAT' && !values.sectie && !values.volgnummer;
    const hasCriteria = Boolean(
      allowEmptyNaamlijst ||
      allowEmptySat ||
      values.legger || values.soort2 || values.naam || values.sectie || values.perceel ||
      values.arrondissement || values.deel || values.vak || values.volgnummer
    );

    if (!hasCriteria) {
      setStatus('Vul minimaal een specifiek zoekveld in.');
      showTipsEmpty();
      return;
    }

    if (!workerReady || !worker) {
      setStatus('Gegevens zijn nog niet geladen.');
      return;
    }

    setStatus('Bezig met zoeken...');
    worker.postMessage({ type: 'search', payload: values });
  }

  function buildColumns(values) {
    if (values.soort === 'Voorna' && values.soort2) {
      return [
        col('Gemeente', r => r.gemeente),
        col('Reeks', r => r.reeksdeel),
        col('Inventarisnummer', r => link(r.invnr, inventarisLink(r.invnr))),
        col('Scan', r => link('scan', buildScanLink(r)), false, scanHeader()),
      ];
    }

    if (values.legger) {
      return [
        col('Gemeente', r => r.gemeente),
        col('Leggerartikelnummer', r => r.leggerart, true),
        col('Volgnummer', r => r.begin, true),
        col('t/m', r => r.eind, true),
        col('Reeks', r => r.reeksdeel),
        col('Inventarisnummer', r => link(r.invnr, inventarisLink(r.invnr))),
        col('Scan', r => link('scan', buildScanLink(r)), false, scanHeader()),
      ];
    }

    if (values.soort === 'Naamlijst') {
      return [
        col('Gemeente', r => r.gemeente),
        col('Reeks', r => r.reeksdeel),
        col('Naam bereik', r => `${r.naam1 || ''} t/m ${r.naam2 || ''}`.trim()),
        col('Inventarisnummer', r => link(r.invnr, inventarisLink(r.invnr))),
        col('Scan', r => link('scan', buildScanLink(r)), false, scanHeader()),
      ];
    }

    if (values.soort === 'Register 71') {
      return [
        col('Gemeente', r => r.gemeente),
        col('Sectie', r => r.sectie),
        col('Reeks', r => r.reeksdeel),
        col('Perceel bereik', r => `${r.begino || r.begin || ''}-${r.eindo || r.eind || ''}`.replace(/^-|-$/g, '')),
        col('Inventarisnummer', r => link(r.invnr, inventarisLink(r.invnr))),
        col('Scan', r => link('scan', buildScanLink(r)), false, scanHeader()),
      ];
    }

    if (values.sectie || values.perceel) {
      return [
        col('Gemeente', r => r.gemeente),
        col('Sectie', r => r.sectie),
        col('Reeks', r => r.reeksdeel),
        col('Perceelnummer', r => r.begin, true),
        col('t/m', r => r.eind, true),
        col('Inventarisnummer', r => link(r.invnr, inventarisLink(r.invnr))),
        col('Scan', r => link('scan', buildScanLink(r)), false, scanHeader()),
      ];
    }

    if (values.deel || values.vak || values.arrondissement) {
      return [
        col('Arrondissement', r => r.arrondissement),
        col('Vaknummer', r => r.begin, true),
        col('t/m', r => r.eind, true),
        col('Inventarisnummer', r => link(r.invnr, inventarisLink(r.invnr))),
        col('Scan', r => link('scan', buildScanLink(r)), false, scanHeader()),
      ];
    }

    if (values.volgnummer) {
      return [
        col('Gemeente', r => r.gemeente),
        col('Sectie', r => r.sectie),
        col('Volgnummer', r => r.begin, true),
        col('t/m', r => r.eind, true),
        col('Inventarisnummer', r => link(r.invnr, inventarisLink(r.invnr))),
        col('Scan', r => link('scan', buildScanLink(r)), false, scanHeader()),
      ];
    }

    return [
      col('Gemeente', r => r.gemeente),
      col('ID', r => r.id, true),
      col('Inventarisnummer', r => link(r.invnr, inventarisLink(r.invnr))),
      col('Scan', r => link('scan', buildScanLink(r)), false, scanHeader()),
    ];
  }

  function col(label, value, numeric = false, header = null) {
    return { label, value, numeric, header };
  }

  function scanHeader() {
    const text = 'de scan kan alleen opgevraagd worden in de studiezaal van Het Utrechts Archief.';
    return `Scan <button type="button" class="help-tip" data-tip="${text}">?</button>`;
  }

  function link(text, href) {
    const safeText = String(text || '').trim();
    if (!href) return safeText;
    return `<a target="_blank" rel="noopener" href="${href}">${safeText || 'link'}</a>`;
  }

  function applyQueryToForm() {
    const params = new URLSearchParams(window.location.search);
    const mapping = [
      ['soort', els.soort],
      ['gemeente', els.gemeente],
      ['legger', els.legger],
      ['soort2', els.soort2],
      ['naam', els.naam],
      ['sectie', els.sectie],
      ['perceel', els.perceel],
      ['arrondissement', els.arrondissement],
      ['deel', els.deel],
      ['vak', els.vak],
      ['volgnummer', els.volgnummer],
    ];

    mapping.forEach(([key, el]) => {
      if (!el) return;
      const value = params.get(key);
      if (value !== null) el.value = value;
    });

    applyVisibility();
  }

  async function init() {
    applyVisibility();
    applyQueryToForm();

    setStatus('Gegevens laden...');
    worker = new Worker(WORKER_PATH);
    worker.addEventListener('message', (e) => {
      const { type, count, rows, total, message, loaded, label, source } = e.data || {};
      if (type === 'ready') {
        workerReady = true;
        setStatus(`Gegevens geladen (${count} regels).`);
        if (window.location.search.length > 1) search();
        else showTipsBefore(els.soort.value);
        return;
      }
      if (type === 'source') {
        if (source === 'gz') console.log('CSV bron: KADASTER.csv.gz');
        if (source === 'csv') console.log('CSV bron: KADASTER.csv');
        return;
      }
      if (type === 'progress') {
        const mb = (loaded / (1024 * 1024)).toFixed(1);
        if (total) {
          const pct = Math.round((loaded / total) * 100);
          setStatus(`Gegevens laden... ${pct}% (${mb} MB)`);
        } else {
          setStatus(`Gegevens laden... ${mb} MB`);
        }
        return;
      }
      if (type === 'results') {
        const columns = buildColumns(getFormValues());
        const soortLabel = els.soort.value
          ? (els.soort.selectedOptions && els.soort.selectedOptions[0]
              ? els.soort.selectedOptions[0].textContent.trim()
              : els.soort.value)
          : 'Onbekend';
        const title = `${total} zoekresultaten in ${soortLabel}`;
        setStatus('');
        renderTable(rows || [], columns, title);
        return;
      }
      if (type === 'error') {
        setStatus('Gegevens laden mislukt. Gebruik een lokale webserver om index.html te openen.');
        els.results.innerHTML = `<div class="tips">Fout: ${String(message || 'Onbekende fout')}</div>`;
      }
    });
    worker.postMessage({ type: 'init', payload: { gzPath: CSV_PATH_GZ, csvPath: CSV_PATH_FALLBACK } });
  }

  els.soort.addEventListener('change', () => {
    applyVisibility();
    els.results.innerHTML = '';
    setStatus('');
    showTipsBefore(els.soort.value);
  });

  els.form.addEventListener('submit', (e) => {
    e.preventDefault();
    search();
  });

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-toggle]');
    if (!btn) return;
    const id = btn.getAttribute('data-toggle');
    const target = document.getElementById(id);
    if (target) target.classList.toggle('hidden');
  });

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.help-tip');
    if (!btn) return;
    e.preventDefault();
    const open = btn.classList.toggle('is-open');
    if (open) {
      document.querySelectorAll('.help-tip.is-open').forEach(el => {
        if (el !== btn) el.classList.remove('is-open');
      });
    }
  });

  init();
})();
