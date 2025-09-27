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

    // Debug output
    console.log('Month filter:', { year, month, start, end });
    console.log('All entries:', entries);

    const monthEntries = entries
      .filter(e => {
        const entryDate = new Date(e.start);
        const isInMonth = entryDate >= start && entryDate < end;
        console.log('Entry:', e.start, 'Date:', entryDate, 'In month:', isInMonth);
        return isInMonth;
      })
      .sort((a,b) => new Date(a.start) - new Date(b.start));

    console.log('Filtered entries:', monthEntries);

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
      
      console.log('Entry surcharge:', { startTime, endTime, surcharge, duration: fmtDuration(surcharge) });
      
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
    
    console.log('Total MS:', totalMs, 'Surcharge MS:', surchargeMs);
    monthSum.textContent = fmtDuration(totalMs);
    surchargeSum.textContent = fmtDuration(surchargeMs);
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
          surchargeMs += nightWorkEnd - nightWorkStart;
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
})();

