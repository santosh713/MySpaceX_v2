/* Pay Calculator – pulls Hours data from Sheet Best and computes pay */
(async function(){
  const API_URL = "https://sheetdb.io/api/v1/g0lhbxi7ey5az"; // same as HoursTracker
  const HOURLY = 17.50;

  // deduction factors from paystub
  const RATES = {
    FED: 0.0303,
    EI: 0.0164,
    CPP: 0.0500
  };

  const $ = id => document.getElementById(id);
  const periodSelect = $("periodSelect");
  const lbl = $("periodLabel");
  const totalHoursEl = $("totalHours"), grossPayEl = $("grossPay");
  const fedEl = $("fedAmount"), cppEl = $("cppAmount"), eiEl = $("eiAmount");
  const dedEl = $("deductions"), netEl = $("netPay");

  let chart;

  // Fetch shifts
  async function getShifts(){
    const r = await fetch(API_URL);
    if(!r.ok) throw new Error("Could not load shifts");
    return await r.json();
  }

  // Hours grouped by biweekly period
  function groupByPeriod(shifts, paydayFridayStr){
    if(!paydayFridayStr) return [];
    const [y,m,d] = paydayFridayStr.split("-").map(Number);
    let p = new Date(y,m-1,d); // Friday
    const mondayOf = d=>{
      const r=new Date(d); const diff=(r.getDay()+6)%7;
      r.setDate(r.getDate()-diff); r.setHours(0,0,0,0); return r;
    };
    const sundayOf = d=>{
      const m=mondayOf(d); const s=new Date(m);
      s.setDate(m.getDate()+6); s.setHours(23,59,59,999); return s;
    };

    // derive periods covering shift range
    const st=new Date(shifts[0].startISO), en=new Date(shifts[shifts.length-1].endISO);
    const periods=[];
    const min=new Date(st); min.setDate(min.getDate()-14);
    const max=new Date(en); max.setDate(max.getDate()+14);
    while(true){
      const end=new Date(p); end.setDate(p.getDate()-5);
      const start=new Date(end); start.setDate(end.getDate()-13);
      if(end>max) break;
      if(start<=max && end>=min) periods.push({label:`${start.toDateString()} → ${end.toDateString()}`, start,end});
      p.setDate(p.getDate()+14);
    }
    // group hours
    return periods.map(pr=>{
      const inPeriod=shifts.filter(s=>{
        const st=new Date(s.startISO), e=new Date(s.endISO);
        return st<=pr.end && e>=pr.start;
      });
      const hrs=inPeriod.reduce((t,s)=>{
        const st=new Date(s.startISO), e=new Date(s.endISO);
        return t+(e-st)/36e5;
      },0);
      return {...pr,hours:hrs};
    });
  }

  function calcAndRender(period){
    const hrs = period.hours;
    const gross = hrs*HOURLY;
    const fed = gross*RATES.FED, ei=gross*RATES.EI, cpp=gross*RATES.CPP;
    const deductions = fed+ei+cpp;
    const net=gross-deductions;

    lbl.textContent=period.label;
    totalHoursEl.textContent=hrs.toFixed(2);
    grossPayEl.textContent=gross.toFixed(2);
    fedEl.textContent=fed.toFixed(2);
    cppEl.textContent=cpp.toFixed(2);
    eiEl.textContent=ei.toFixed(2);
    dedEl.textContent=deductions.toFixed(2);
    netEl.textContent=net.toFixed(2);

    if(chart) chart.destroy();
    const ctx=document.getElementById("payChart").getContext("2d");
    chart=new Chart(ctx,{
      type:"doughnut",
      data:{
        labels:["Net Pay","Deductions"],
        datasets:[{
          data:[net,deductions],
          backgroundColor:["#4ade80","#f87171"]
        }]
      }
    });
  }

  try {
    const rows=await getShifts();
    if(rows.length===0) return;
    const paydayFriday=localStorage.getItem("HT:paydayFriday"); // same key as HoursTracker
    if(!paydayFriday) {
      lbl.textContent="Set a payday in HoursTracker first!";
      return;
    }
    const grouped=groupByPeriod(rows,paydayFriday);
    periodSelect.innerHTML=grouped.map((p,i)=>`<option value="${i}">${p.label}</option>`).join("");
    periodSelect.addEventListener("change",()=>calcAndRender(grouped[periodSelect.value]));
    calcAndRender(grouped[grouped.length-1]); // default latest
  } catch(e){
    console.error(e);
  }
})();
