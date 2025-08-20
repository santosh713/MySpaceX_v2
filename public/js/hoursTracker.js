/* HoursTracker – Sheet Best integration (Google Sheets as DB)
   - Set API_URL to your Sheet Best endpoint
   - Keep USE_REMOTE=true to read/write remotely
*/
(function () {
  const API_URL = "https://sheetdb.io/api/v1/g0lhbxi7ey5az";
  const USE_REMOTE = true;

  // ---- Elements ----
  const $ = (id) => document.getElementById(id);
  const nowEl = $("now"), statusEl = $("status"), sinceEl = $("since");
  const clockInBtn = $("clockInBtn"), clockOutBtn = $("clockOutBtn");
  const toggleManual = $("toggleManual"), manualForm = $("manualForm");
  const mDate = $("mDate"), mStart = $("mStart"), mEnd = $("mEnd");
  const exportCsvBtn = $("exportCsv"), clearAllBtn = $("clearAll");
  const sumShiftsEl = $("sumShifts"), sumHoursEl = $("sumHours");
  const weekBody = $("weekBody"), tableBody = $("tableBody");
  const paydayInput = $("paydayInput"), savePaydayBtn = $("savePayday"), clearPaydayBtn = $("clearPayday");
  const nextPaydayInfo = $("nextPaydayInfo"), payPeriodsWrap = $("payPeriods");

  // ---- Local persistence (user prefs) ----
  const PREF = { ACTIVE: "HT:activeStart", PAYDAY: "HT:paydayFriday" };
  const loadActive = () => { try { const v = localStorage.getItem(PREF.ACTIVE); return v ? new Date(v) : null; } catch { return null; } };
  const saveActive = (d) => d ? localStorage.setItem(PREF.ACTIVE, d.toISOString()) : localStorage.removeItem(PREF.ACTIVE);
  const loadPayday = () => localStorage.getItem(PREF.PAYDAY) || "";
  const savePayday = (s) => s ? localStorage.setItem(PREF.PAYDAY, s) : localStorage.removeItem(PREF.PAYDAY);

  // ---- Utils ----
  const pad2 = (n) => String(n).padStart(2, "0");
  const fmtDate = (d) => d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "2-digit" });
  const fmtTime = (d) => d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const fmtHM = (d) => d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  const toLocalISODate = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  const hoursBetween = (a, b) => Math.max(0, (b - a) / 36e5);
  const round2 = (x) => Math.round(x * 100) / 100;
  const uuid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
  const mondayOf = (d) => { const r = new Date(d); const diff = (r.getDay() + 6) % 7; r.setDate(r.getDate() - diff); r.setHours(0,0,0,0); return r; };
  const sundayOf = (d) => { const m = mondayOf(d); const s = new Date(m); s.setDate(m.getDate() + 6); s.setHours(23,59,59,999); return s; };
  const isFriday = (dateStr) => { const [y,m,d] = dateStr.split("-").map(Number); return new Date(y,m-1,d).getDay() === 5; };
  const nextPaydayFrom = (from, fStr) => { let [y,m,d] = fStr.split("-").map(Number); let ref = new Date(y,m-1,d); while (ref < from) ref.setDate(ref.getDate() + 14); return ref; };
  const biWeeklyPeriodsAround = (fStr, spanStart, spanEnd) => {
    if (!fStr) return [];
    const [y,m,d] = fStr.split("-").map(Number);
    let p = new Date(y,m-1,d); const min = new Date(spanStart); min.setDate(min.getDate()-14);
    const max = new Date(spanEnd); max.setDate(max.getDate()+14);
    const arr = [];
    while (true) { const end = new Date(p); end.setDate(p.getDate()-5); if (end < min) break; p.setDate(p.getDate()-14); }
    p = new Date(y,m-1,d);
    while (true) {
      const end = new Date(p); end.setDate(p.getDate()-5);
      const start = new Date(end); start.setDate(end.getDate()-13);
      if (end > max) break;
      if (start <= max && end >= min) arr.push({ payday: new Date(p), start, end });
      p.setDate(p.getDate()+14);
    }
    return arr;
  };

  // ---- Remote CRUD (Sheet Best) ----
  async function apiGetAll() {
    const r = await fetch(API_URL, { method: "GET" });
    if (!r.ok) throw new Error("GET failed");
    return await r.json(); // array of row objects
  }
  async function apiPostOne(row) {
    const r = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(row)
    });
    if (!r.ok) throw new Error("POST failed");
    return await r.json();
  }
  // Filtered DELETE by exact id: /id/<value>  (Sheet Best supports filtered deletion) 
  // Docs: DELETE /sheets/<id>/<Column>/*pattern* (exact match works without *).
  async function apiDeleteById(id) {
    const url = `${API_URL}/id/${encodeURIComponent(id)}`;
    const r = await fetch(url, { method: "DELETE" });
    if (!r.ok) throw new Error("DELETE failed");
    return await r.json();
  }

  // ---- App state ----
  let shifts = [];                // [{id,date,startISO,endISO,hours}]
  let activeStart = loadActive(); // Date | null

  // ---- Rendering ----
  function tickNow(){ nowEl.textContent = fmtTime(new Date()); }
  setInterval(tickNow, 1000); tickNow();

  function renderStatus(){
    if (activeStart){
      statusEl.textContent = "Clocked in";
      sinceEl.textContent = `since ${fmtDate(activeStart)} ${fmtHM(activeStart)}`;
      clockInBtn.disabled = true; clockOutBtn.disabled = false;
    } else {
      statusEl.textContent = "Not clocked in";
      sinceEl.textContent = "";
      clockInBtn.disabled = false; clockOutBtn.disabled = true;
    }
  }

  const totals = (arr) => ({
    count: arr.length,
    hours: round2(arr.reduce((s, r) => s + hoursBetween(new Date(r.startISO), new Date(r.endISO)), 0))
  });

  function renderTopSummary(){
    const t = totals(shifts);
    sumShiftsEl.textContent = t.count;
    sumHoursEl.textContent = t.hours.toFixed(2);
  }

  function renderTable(){
    tableBody.innerHTML = "";
    for (const s of shifts){
      const st = new Date(s.startISO), en = new Date(s.endISO);
      const hrs = round2(hoursBetween(st,en)).toFixed(2);
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td class="px-4 py-2 whitespace-nowrap text-sm">${fmtDate(st)}</td>
        <td class="px-4 py-2 whitespace-nowrap text-sm">${fmtHM(st)}</td>
        <td class="px-4 py-2 whitespace-nowrap text-sm">${fmtHM(en)}</td>
        <td class="px-4 py-2 whitespace-nowrap text-right font-semibold">${hrs}</td>
        <td class="px-4 py-2 whitespace-nowrap text-right">
          <button data-id="${s.id}" class="delShift px-2 py-1 rounded-lg border border-red-300 text-red-600 hover:bg-red-50">Delete</button>
        </td>
      `;
      tableBody.appendChild(tr);
    }
    tableBody.querySelectorAll(".delShift").forEach(btn=>{
      btn.addEventListener("click", async (e)=>{
        const id = e.currentTarget.getAttribute("data-id");
        if (!confirm("Delete this shift?")) return;
        if (USE_REMOTE){ await apiDeleteById(id); }
        // Update local state
        shifts = shifts.filter(x => x.id !== id);
        renderAll();
      });
    });
  }

  function renderWeekly(){
    weekBody.innerHTML = "";
    const map = new Map();
    for (const s of shifts){
      const mon = mondayOf(new Date(s.startISO));
      const key = mon.toISOString().slice(0,10);
      const sun = sundayOf(mon);
      const hrs = hoursBetween(new Date(s.startISO), new Date(s.endISO));
      if (!map.has(key)) map.set(key, { start: mon, end: sun, shifts: 0, hours: 0 });
      const obj = map.get(key); obj.shifts += 1; obj.hours += hrs;
    }
    [...map.values()].sort((a,b)=>a.start-b.start).forEach(r=>{
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td class="px-4 py-2 text-sm">${fmtDate(r.start)} → ${fmtDate(r.end)}</td>
        <td class="px-4 py-2 text-right font-semibold">${round2(r.hours).toFixed(2)}</td>
        <td class="px-4 py-2 text-right">${r.shifts}</td>
      `;
      weekBody.appendChild(tr);
    });
  }

  function renderPaydayUI(){
    const stored = loadPayday();
    paydayInput.value = stored || "";
    nextPaydayInfo.textContent = stored ? `Next payday: ${fmtDate(nextPaydayFrom(new Date(), stored))}` : "";
  }

  function renderPayPeriods(){
    payPeriodsWrap.innerHTML = "";
    const base = loadPayday();
    if (!base){ payPeriodsWrap.innerHTML = `<div class="px-4 py-3 text-sm text-gray-600 dark:text-neutral-300">Set a Friday payday to see bi-weekly periods.</div>`; return; }
    if (!shifts.length){ payPeriodsWrap.innerHTML = `<div class="px-4 py-3 text-sm text-gray-600 dark:text-neutral-300">No shifts yet.</div>`; return; }

    const startRange = new Date(shifts[0].startISO);
    const endRange = new Date(shifts[shifts.length-1].endISO);
    const periods = biWeeklyPeriodsAround(base, startRange, endRange);

    periods.forEach((p, idx)=>{
      const inPeriod = shifts.filter(s => new Date(s.startISO) <= p.end && new Date(s.endISO) >= p.start);
      const t = totals(inPeriod);
      const details = document.createElement("details");
      details.className = "border-t border-neutral-200 dark:border-neutral-800";
      if (idx === periods.length - 1) details.open = true;
      details.innerHTML = `
        <summary class="cursor-pointer select-none px-4 py-3 hover:bg-gray-50 dark:hover:bg-neutral-900">
          ${fmtDate(p.start)} → ${fmtDate(p.end)} • Hours: ${t.hours.toFixed(2)} • Shifts: ${t.count} • Payday: ${fmtDate(p.payday)}
        </summary>
        <div class="px-4 pb-4 overflow-x-auto">
          ${
            inPeriod.length
            ? `<table class="min-w-full text-sm">
                 <thead class="text-gray-600 dark:text-neutral-400">
                   <tr><th class="px-2 py-2 text-left">Date</th><th class="px-2 py-2 text-left">Start</th><th class="px-2 py-2 text-left">End</th><th class="px-2 py-2 text-right">Hours</th></tr>
                 </thead>
                 <tbody>
                   ${inPeriod.map(s => {
                      const st=new Date(s.startISO), en=new Date(s.endISO);
                      const h=round2(hoursBetween(st,en)).toFixed(2);
                      return `<tr>
                        <td class="px-2 py-1">${toLocalISODate(st)}</td>
                        <td class="px-2 py-1">${fmtHM(st)}</td>
                        <td class="px-2 py-1">${fmtHM(en)}</td>
                        <td class="px-2 py-1 text-right font-semibold">${h}</td>
                      </tr>`;
                   }).join("")}
                 </tbody>
               </table>`
            : `<div class="text-gray-600 dark:text-neutral-400 py-3">No shifts in this period.</div>`
          }
        </div>`;
      payPeriodsWrap.appendChild(details);
    });
  }

  function renderAll(){
    renderStatus();
    renderTopSummary();
    renderTable();
    renderWeekly();
    renderPaydayUI();
    renderPayPeriods();
  }

  // ---- Actions ----
  clockInBtn.addEventListener("click", async ()=>{
    if (activeStart) return;
    activeStart = new Date();
    saveActive(activeStart);
    renderStatus();
  });

  clockOutBtn.addEventListener("click", async ()=>{
    if (!activeStart) return;
    const end = new Date();
    const start = activeStart;
    const row = {
      id: uuid(),
      date: toLocalISODate(start),
      startISO: start.toISOString(),
      endISO: end.toISOString(),
      hours: round2(hoursBetween(start, end))
    };
    if (USE_REMOTE) await apiPostOne(row);
    // update local view from remote for canonical order
    await refreshFromSource();
    activeStart = null; saveActive(null); renderStatus();
  });

  toggleManual.addEventListener("click", ()=> manualForm.classList.toggle("hidden"));

  manualForm.addEventListener("submit", async (e)=>{
    e.preventDefault();
    if (!mDate.value || !mStart.value || !mEnd.value) return;
    const [Y,M,D] = mDate.value.split("-").map(Number);
    const [sh,sm] = mStart.value.split(":").map(Number);
    const [eh,em] = mEnd.value.split(":").map(Number);
    const start = new Date(Y, M-1, D, sh, sm, 0);
    const end   = new Date(Y, M-1, D, eh, em, 0);
    if (!(end > start)) return alert("End must be after start.");

    const row = {
      id: uuid(),
      date: toLocalISODate(start),
      startISO: start.toISOString(),
      endISO: end.toISOString(),
      hours: round2(hoursBetween(start, end))
    };
    if (USE_REMOTE) await apiPostOne(row);
    await refreshFromSource();
    manualForm.reset(); manualForm.classList.add("hidden");
  });

  exportCsvBtn.addEventListener("click", ()=>{
    const header = ["date","startISO","endISO","hours","id"];
    const csv = [header, ...shifts.map(r => [r.date, r.startISO, r.endISO, r.hours, r.id])]
      .map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `hours_${toLocalISODate(new Date())}.csv`;
    a.click(); URL.revokeObjectURL(a.href);
  });

  clearAllBtn.addEventListener("click", async ()=>{
    if (!confirm("Delete ALL shifts from the sheet?")) return;
    // delete all known ids one by one (safe & explicit)
    for (const s of shifts) { if (USE_REMOTE) await apiDeleteById(s.id); }
    await refreshFromSource();
    saveActive(null);
  });

  savePaydayBtn.addEventListener("click", ()=>{
    const v = paydayInput.value;
    if (!v) return alert("Choose a date.");
    if (!isFriday(v)) return alert("Payday must be a Friday.");
    savePayday(v); renderAll();
  });
  clearPaydayBtn.addEventListener("click", ()=>{ savePayday(""); renderAll(); });

  // ---- Load from source ----
  async function refreshFromSource(){
    if (USE_REMOTE){
      const rows = await apiGetAll(); // [{id,date,startISO,endISO,hours}, ...]
      // Defensive: filter to rows that have required fields
      shifts = rows
        .filter(r => r.id && r.startISO && r.endISO)
        .map(r => ({...r, hours: Number(r.hours || hoursBetween(new Date(r.startISO), new Date(r.endISO))) }))
        .sort((a,b)=> new Date(a.startISO) - new Date(b.startISO));
    }
    renderAll();
  }

  // ---- Boot ----
  (async ()=> {
    try { await refreshFromSource(); }
    catch (e) {
      console.error(e);
      alert("Could not load data from Sheet Best. Check API URL/CORS.");
      shifts = []; renderAll();
    }
  })();
})();
