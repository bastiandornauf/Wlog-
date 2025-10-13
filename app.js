(function() {
  'use strict';

  const STORAGE_KEY = 'zeit.entries.v1';
  /** @type {HTMLButtonElement} */
  const toggleBtn = document.getElementById('toggleBtn');
  /** @type {HTMLDivElement} */
  const statusRow = document.getElementById('statusRow');
  /** @type {HTMLUListElement} */
  const todayList = document.getElementById('todayList');
  /** @type {HTMLSpanElement} */
  const todaySum = document.getElementById('todaySum');
  /** @type {HTMLButtonElement} */
  const addManualBtn = document.getElementById('addManualBtn');
  /** @type {HTMLInputElement} */
  const monthInput = document.getElementById('monthInput');
  /** @type {HTMLButtonElement} */
  const exportBtn = document.getElementById('exportBtn');
  /** @type {HTMLButtonElement} */
  const importBtn = document.getElementById('importBtn');
  /** @type {HTMLInputElement} */
  const importFile = document.getElementById('importFile');
  /** @type {HTMLButtonElement} */
  const backupJsonBtn = document.getElementById('backupJsonBtn');
  /** @type {HTMLButtonElement} */
  const restoreJsonBtn = document.getElementById('restoreJsonBtn');
  /** @type {HTMLInputElement} */
  const restoreJsonFile = document.getElementById('restoreJsonFile');
  /** @type {HTMLDivElement} */
  const nowTime = document.getElementById('nowTime');
  /** @type {HTMLDivElement} */
  const nowDate = document.getElementById('nowDate');
  /** @type {HTMLButtonElement} */
  const installBtn = document.getElementById('installBtn');
  /** @type {HTMLUListElement} */
  const monthList = document.getElementById('monthList');
  /** @type {HTMLSpanElement} */
  const monthSum = document.getElementById('monthSum');
  /** @type {HTMLSpanElement} */
  const surchargeSum = document.getElementById('surchargeSum');
  /** @type {HTMLSpanElement} */
  const expectedSum = document.getElementById('expectedSum');
  /** @type {HTMLSpanElement} */
  const deltaSum = document.getElementById('deltaSum');

  /** @type {HTMLDialogElement} */
  const editDialog = document.getElementById('editDialog');
  /** @type {HTMLInputElement} */
  const fromInput = document.getElementById('fromInput');
  /** @type {HTMLInputElement} */
  const toInput = document.getElementById('toInput');
  /** @type {HTMLButtonElement} */
  const deleteEntryBtn = document.getElementById('deleteEntryBtn');
  /** @type {HTMLButtonElement} */
  const saveEntryBtn = document.getElementById('saveEntryBtn');

  /** @type {{id:string, start:string, end?:string}[]} */
  let entries = loadEntries();
  /** @type {string|null} */
  let editingId = null;

  // Clock
  setInterval(updateClock, 1000);
  updateClock();

  function updateClock() {
    const now = new Date();
    nowTime.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    nowDate.textContent = now.toLocaleDateString();
  }

  // Install prompt handling
  let deferredPrompt = null;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    installBtn.hidden = false;
    // Silently handle the install prompt
  });
  installBtn.addEventListener('click', async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    installBtn.hidden = true;
    deferredPrompt = null;
  });

  // Initial UI state
  refreshUI();

  toggleBtn.addEventListener('click', () => {
    const running = getRunningEntry();
    if (running) {
      running.end = new Date().toISOString();
      saveEntries(entries);
      announce('Stopp gespeichert');
    } else {
      entries.push({ id: crypto.randomUUID(), start: new Date().toISOString() });
      saveEntries(entries);
      announce('Start gespeichert');
    }
    refreshUI();
  });

  addManualBtn.addEventListener('click', () => {
    openEditor({ id: crypto.randomUUID(), start: new Date().toISOString(), end: new Date().toISOString() }, true);
  });

  monthInput.addEventListener('change', () => {
    refreshUI();
  });

  exportBtn.addEventListener('click', () => {
    const { year, month } = getSelectedMonth();
    const csv = buildMonthlyCsv(entries, year, month);
    // Add UTF-8 BOM for proper encoding
    const csvWithBom = '\uFEFF' + csv;
    const blob = new Blob([csvWithBom], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `arbeitszeiten_${year}-${String(month+1).padStart(2,'0')}.csv`;
    document.body.appendChild(a);
    a.click();
    URL.revokeObjectURL(url);
    a.remove();
  });

  importBtn.addEventListener('click', () => {
    importFile.value = '';
    importFile.click();
  });

  importFile.addEventListener('change', async () => {
    const file = importFile.files && importFile.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const imported = parseCsvToEntries(text);
      if (!imported.length) {
        announce('Keine gültigen Einträge gefunden');
        return;
      }
      const replace = confirm('Bestehende Einträge ersetzen?\nOK = Ersetzen, Abbrechen = Anhängen');
      if (replace) {
        entries = imported;
      } else {
        entries = entries.concat(imported);
      }
      saveEntries(entries);
      refreshUI();
      announce('Import abgeschlossen');
    } catch (e) {
      console.error(e);
      announce('Import fehlgeschlagen');
    }
  });

  backupJsonBtn.addEventListener('click', () => {
    try {
      const payload = { version: 1, exportedAt: new Date().toISOString(), entries };
      const json = JSON.stringify(payload, null, 2);
      const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `wlog-backup-${new Date().toISOString().slice(0,19).replace(/[:T]/g,'-')}.json`;
      document.body.appendChild(a);
      a.click();
      URL.revokeObjectURL(url);
      a.remove();
    } catch (e) {
      console.error(e);
      announce('Backup fehlgeschlagen');
    }
  });

  restoreJsonBtn.addEventListener('click', () => {
    restoreJsonFile.value = '';
    restoreJsonFile.click();
  });

  restoreJsonFile.addEventListener('change', async () => {
    const file = restoreJsonFile.files && restoreJsonFile.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const imported = normalizeBackupData(data);
      if (!imported.length) {
        announce('Keine gültigen Einträge in JSON');
        return;
      }
      const replace = confirm('Bestehende Einträge ersetzen?\nOK = Ersetzen, Abbrechen = Anhängen');
      if (replace) {
        entries = imported;
      } else {
        entries = entries.concat(imported);
      }
      saveEntries(entries);
      refreshUI();
      announce('Wiederherstellung abgeschlossen');
    } catch (e) {
      console.error(e);
      announce('Wiederherstellung fehlgeschlagen');
    }
  });

  deleteEntryBtn.addEventListener('click', () => {
    if (!editingId) return;
    entries = entries.filter(e => e.id !== editingId);
    saveEntries(entries);
    closeEditor();
    refreshUI();
  });

  saveEntryBtn.addEventListener('click', (ev) => {
    ev.preventDefault();
    if (!fromInput.value) return;
    const start = new Date(fromInput.value);
    const end = toInput.value ? new Date(toInput.value) : null;
    if (end && end < start) {
      toInput.setCustomValidity('Ende liegt vor Start');
      toInput.reportValidity();
      return;
    } else {
      toInput.setCustomValidity('');
    }
    if (editingId) {
      const idx = entries.findIndex(e => e.id === editingId);
      if (idx >= 0) {
        entries[idx] = { id: editingId, start: start.toISOString(), end: end ? end.toISOString() : undefined };
      }
    } else {
      entries.push({ id: crypto.randomUUID(), start: start.toISOString(), end: end ? end.toISOString() : undefined });
    }
    saveEntries(entries);
    closeEditor();
    refreshUI();
  });

  function refreshUI() {
    renderStatus();
    renderToday();
    ensureMonthDefault();
    renderMonth();
  }

  function renderStatus() {
    const running = getRunningEntry();
    if (running) {
      toggleBtn.textContent = 'Stop';
      const start = new Date(running.start);
      statusRow.textContent = `Läuft seit ${start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } else {
      toggleBtn.textContent = 'Start';
      statusRow.textContent = '';
    }
  }

  function renderToday() {
    const today = new Date();
    today.setHours(0,0,0,0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate()+1);

    const todays = entries
      .filter(e => new Date(e.start) >= today && new Date(e.start) < tomorrow)
      .sort((a,b) => new Date(a.start) - new Date(b.start));

    todayList.innerHTML = '';
    let totalMs = 0;
    for (const e of todays) {
      const li = document.createElement('li');
      const start = new Date(e.start);
      const end = e.end ? new Date(e.end) : null;
      const durationMs = end ? (end - start) : 0;
      totalMs += durationMs;

      const title = document.createElement('div');
      title.className = 'row-strong';
      title.textContent = `${fmtTime(start)}${end ? ' – ' + fmtTime(end) : ' – …'}`;

      const meta = document.createElement('div');
      meta.className = 'row-meta';
      meta.textContent = `${start.toLocaleDateString()} • ${fmtDuration(durationMs)}`;

      const edit = document.createElement('button');
      edit.className = 'btn';
      edit.textContent = 'Bearbeiten';
      edit.addEventListener('click', () => openEditor(e, false));

      li.appendChild(title);
      li.appendChild(meta);
      li.appendChild(edit);
      todayList.appendChild(li);
    }
    todaySum.textContent = fmtDuration(totalMs);
  }

  function renderMonth() {
    const { year, month } = getSelectedMonth();
    const start = new Date(year, month, 1);
    const end = new Date(year, month + 1, 1);

    const monthEntries = entries
      .filter(e => new Date(e.start) >= start && new Date(e.start) < end)
      .sort((a,b) => new Date(a.start) - new Date(b.start));

    monthList.innerHTML = '';
    let totalMs = 0;
    let surchargeMs = 0;

    for (const e of monthEntries) {
      const li = document.createElement('li');
      const startTime = new Date(e.start);
      const endTime = e.end ? new Date(e.end) : null;
      const durationMs = endTime ? (endTime - startTime) : 0;
      totalMs += durationMs;

      // Calculate surcharge time
      const surcharge = calculateSurcharge(startTime, endTime);
      surchargeMs += surcharge;
      
      
      // Add surcharge class if applicable
      if (surcharge > 0) {
        li.classList.add('surcharge');
      }

      const title = document.createElement('div');
      title.className = 'row-strong';
      title.textContent = `${fmtTime(startTime)}${endTime ? ' – ' + fmtTime(endTime) : ' – …'}`;

      const meta = document.createElement('div');
      meta.className = 'row-meta';
      const dayName = startTime.toLocaleDateString('de-DE', { weekday: 'long' });
      meta.textContent = `${startTime.toLocaleDateString()} (${dayName}) • ${fmtDuration(durationMs)}`;

      const edit = document.createElement('button');
      edit.className = 'btn';
      edit.textContent = 'Bearbeiten';
      edit.addEventListener('click', () => openEditor(e, false));

      li.appendChild(title);
      li.appendChild(meta);
      li.appendChild(edit);
      monthList.appendChild(li);
    }
    
    monthSum.textContent = fmtDuration(totalMs);
    surchargeSum.textContent = fmtDuration(surchargeMs);

    // Expected working time: 8.5h per weekday (Mon-Fri)
    const expectedMs = calculateExpectedMonthMs(year, month);
    expectedSum.textContent = fmtDuration(expectedMs);

    // Delta = worked - expected (signed)
    const deltaMs = totalMs - expectedMs;
    deltaSum.textContent = fmtSignedDuration(deltaMs);
  }

  function calculateExpectedMonthMs(year, month) {
    const msPerHour = 60 * 60 * 1000;
    const hoursPerDay = 8.5;
    const start = new Date(year, month, 1);
    const end = new Date(year, month + 1, 1);

    // Cap to today if selected month is current month
    const today = new Date();
    const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;
    const capEnd = isCurrentMonth ? new Date(Math.min(end.getTime(), new Date(today.getFullYear(), today.getMonth(), today.getDate()+1).getTime())) : end;

    let expectedDays = 0;
    for (let d = new Date(start); d < capEnd; d.setDate(d.getDate() + 1)) {
      const weekday = d.getDay(); // 0=Sun, 1=Mon, ... 6=Sat
      if (weekday >= 1 && weekday <= 5) {
        expectedDays += 1;
      }
    }
    return expectedDays * hoursPerDay * msPerHour;
  }

  function fmtSignedDuration(ms) {
    const sign = ms >= 0 ? '+' : '-';
    const abs = Math.abs(ms);
    const totalMinutes = Math.round(abs / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${sign}${String(hours).padStart(2,'0')}:${String(minutes).padStart(2,'0')}`;
  }

  function calculateSurcharge(startTime, endTime) {
    if (!endTime) return 0;
    
    let surchargeMs = 0;
    const start = new Date(startTime);
    const end = new Date(endTime);
    
    // Check if work spans multiple days
    const current = new Date(start);
    current.setHours(0, 0, 0, 0); // Start at beginning of day
    
    while (current < end) {
      const nextDay = new Date(current);
      nextDay.setDate(current.getDate() + 1);
      
      // Get the actual work period for this day
      const dayStart = new Date(Math.max(current.getTime(), start.getTime()));
      const dayEnd = new Date(Math.min(nextDay.getTime(), end.getTime()));
      
      // Check if it's Sunday (0 = Sunday)
      const isSunday = current.getDay() === 0;
      
      if (isSunday) {
        // Full day surcharge for Sunday
        surchargeMs += dayEnd - dayStart;
      } else {
        // Check for night work (22:00 - 05:00 next day)
        const nightStart = new Date(current);
        nightStart.setHours(22, 0, 0, 0);
        const nightEnd = new Date(nextDay);
        nightEnd.setHours(5, 0, 0, 0);
        
        // Calculate overlap between work time and night time
        const nightWorkStart = new Date(Math.max(dayStart.getTime(), nightStart.getTime()));
        const nightWorkEnd = new Date(Math.min(dayEnd.getTime(), nightEnd.getTime()));
        
        if (nightWorkStart < nightWorkEnd) {
          const nightSurcharge = nightWorkEnd - nightWorkStart;
          surchargeMs += nightSurcharge;
        }
      }
      
      current.setDate(current.getDate() + 1);
    }
    
    return surchargeMs;
  }

  function openEditor(entry, isNew) {
    editingId = isNew ? null : entry.id;
    fromInput.value = toLocalInputValue(new Date(entry.start));
    toInput.value = entry.end ? toLocalInputValue(new Date(entry.end)) : '';
    editDialog.showModal();
  }

  function closeEditor() {
    editingId = null;
    editDialog.close();
  }

  function getRunningEntry() {
    return entries.find(e => !e.end);
  }

  function ensureMonthDefault() {
    if (!monthInput.value) {
      const now = new Date();
      const v = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
      monthInput.value = v;
    }
  }

  function getSelectedMonth() {
    ensureMonthDefault();
    const [y,m] = monthInput.value.split('-').map(Number);
    return { year: y, month: m - 1 };
  }

  function buildMonthlyCsv(allEntries, year, month) {
    const start = new Date(year, month, 1);
    const end = new Date(year, month + 1, 1);
    const rows = [['Datum','Start','Ende','Dauer (hh:mm)','Zuschläge (hh:mm)','Wochentag']];
    let totalMs = 0;
    let totalSurchargeMs = 0;
    const monthEntries = allEntries
      .filter(e => new Date(e.start) >= start && new Date(e.start) < end)
      .sort((a,b) => new Date(a.start) - new Date(b.start));
    for (const e of monthEntries) {
      const s = new Date(e.start);
      const t = e.end ? new Date(e.end) : null;
      const durMs = t ? (t - s) : 0;
      const surchargeMs = calculateSurcharge(s, t);
      const dayName = s.toLocaleDateString('de-DE', { weekday: 'long' });
      totalMs += durMs;
      totalSurchargeMs += surchargeMs;
      rows.push([
        s.toLocaleDateString(),
        fmtTime(s),
        t ? fmtTime(t) : '',
        fmtDuration(durMs),
        fmtDuration(surchargeMs),
        dayName
      ]);
    }
    rows.push([]);
    rows.push(['Summe','','',fmtDuration(totalMs),fmtDuration(totalSurchargeMs),'']);
    return rows.map(r => r.map(escapeCsv).join(';')).join('\n');
  }

  function escapeCsv(value) {
    const s = String(value ?? '');
    if (/[";\n]/.test(s)) {
      return '"' + s.replace(/"/g,'""') + '"';
    }
    return s;
  }

  // --- CSV Import utilities ---

  function parseCsvToEntries(csvText) {
    const lines = csvText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(l => l.trim().length > 0);
    if (lines.length === 0) return [];
    const header = splitCsvLine(lines[0]);
    const idxDate = header.findIndex(h => /datum/i.test(h));
    const idxStart = header.findIndex(h => /^start$/i.test(h));
    const idxEnd = header.findIndex(h => /^ende$/i.test(h));
    if (idxDate < 0 || idxStart < 0) return [];

    const out = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = splitCsvLine(lines[i]);
      if (!cols.length) continue;
      const dateStr = (cols[idxDate] || '').trim();
      const startStr = (cols[idxStart] || '').trim();
      const endStr = (cols[idxEnd] || '').trim();
      if (!dateStr || !startStr) continue;

      const start = parseLocalDateTime(dateStr, startStr);
      const end = endStr ? parseLocalDateTime(dateStr, endStr) : null;
      if (!start) continue;

      out.push({
        id: crypto.randomUUID(),
        start: start.toISOString(),
        end: end ? end.toISOString() : undefined
      });
    }
    return out;
  }

  function splitCsvLine(line) {
    const res = [];
    let cur = '';
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQ) {
        if (ch === '"' && line[i+1] === '"') { cur += '"'; i++; }
        else if (ch === '"') { inQ = false; }
        else { cur += ch; }
      } else {
        if (ch === ';') { res.push(cur); cur = ''; }
        else if (ch === '"') { inQ = true; }
        else { cur += ch; }
      }
    }
    res.push(cur);
    return res;
  }

  function parseLocalDateTime(dateStr, timeStr) {
    const t = parseTimeHHMM(timeStr);
    if (!t) return null;

    let y,m,d;
    const m1 = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(dateStr);
    if (m1) {
      d = parseInt(m1[1],10);
      m = parseInt(m1[2],10) - 1;
      y = parseInt(m1[3],10);
    } else {
      const m2 = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
      if (!m2) return null;
      y = parseInt(m2[1],10);
      m = parseInt(m2[2],10) - 1;
      d = parseInt(m2[3],10);
    }
    return new Date(y, m, d, t.h, t.min, 0, 0);
  }

  function parseTimeHHMM(s) {
    const m = /^(\d{1,2}):(\d{2})$/.exec(s);
    if (!m) return null;
    const h = parseInt(m[1],10);
    const min = parseInt(m[2],10);
    if (isNaN(h) || isNaN(min)) return null;
    return { h, min };
  }

  function normalizeBackupData(data) {
    try {
      const list = Array.isArray(data) ? data : Array.isArray(data.entries) ? data.entries : [];
      const result = [];
      for (const item of list) {
        if (!item || typeof item !== 'object') continue;
        const start = safeDate(item.start);
        if (!start) continue;
        const end = item.end ? safeDate(item.end) : null;
        result.push({
          id: typeof item.id === 'string' && item.id ? item.id : crypto.randomUUID(),
          start: start.toISOString(),
          end: end ? end.toISOString() : undefined
        });
      }
      return result;
    } catch {
      return [];
    }
  }

  function safeDate(value) {
    try {
      const d = new Date(value);
      return isNaN(d.getTime()) ? null : d;
    } catch {
      return null;
    }
  }

  function fmtTime(d) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function fmtDuration(ms) {
    const totalMinutes = Math.round(ms / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${String(hours).padStart(2,'0')}:${String(minutes).padStart(2,'0')}`;
  }

  function toLocalInputValue(date) {
    const pad = (n) => String(n).padStart(2,'0');
    const yyyy = date.getFullYear();
    const MM = pad(date.getMonth()+1);
    const dd = pad(date.getDate());
    const hh = pad(date.getHours());
    const mm = pad(date.getMinutes());
    return `${yyyy}-${MM}-${dd}T${hh}:${mm}`;
  }

  function loadEntries() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  function saveEntries(list) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  }

  function announce(text) {
    statusRow.textContent = text;
    setTimeout(() => { if (statusRow.textContent === text) statusRow.textContent = ''; }, 1500);
  }
  
  // Enable iOS-only pull-to-refresh when installed to Home Screen (standalone)
  try {
    const isInWebAppiOS = (window.navigator.standalone === true);
    if (isInWebAppiOS && window.PullToRefresh && typeof window.PullToRefresh.init === 'function') {
      window.PullToRefresh.init({
        mainElement: 'body',
        onRefresh() {
          window.location.reload();
        }
      });
    }
  } catch {}

})();

