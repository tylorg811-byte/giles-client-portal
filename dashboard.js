let currentUser = null;
let clientSite = null;
let analyticsEvents = [];
let leadEvents = [];
let changeRequests = [];

const LIVE_BASE_URL = "https://giles-sites.netlify.app";

document.addEventListener("DOMContentLoaded", initDashboard);

async function initDashboard(){
  currentUser = await checkUser();
  if(!currentUser) return;

  await loadData();
  renderDashboard();
}

async function loadData(){
  await loadClientSite();
  await loadAnalytics();
  await loadLeads();
  await loadRequests();
}

async function loadClientSite(){
  const { data } = await db
    .from("client_sites")
    .select("*")
    .eq("client_user_id", currentUser.id)
    .maybeSingle();

  clientSite = data || null;
}

async function loadAnalytics(){
  const since = new Date();
  since.setDate(since.getDate() - 30);

  const { data } = await db
    .from("site_analytics_events")
    .select("*")
    .eq("client_user_id", currentUser.id)
    .gte("created_at", since.toISOString())
    .order("created_at", { ascending:false });

  analyticsEvents = data || [];
}

async function loadLeads(){
  const { data } = await db
    .from("site_leads")
    .select("*")
    .eq("client_user_id", currentUser.id)
    .order("created_at", { ascending:false });

  leadEvents = data || [];
}

async function loadRequests(){
  const { data } = await db
    .from("change_requests")
    .select("*")
    .eq("client_user_id", currentUser.id)
    .order("created_at", { ascending:false });

  changeRequests = data || [];
}

function renderDashboard(){
  const name = clientSite?.business_name || "Your Website";

  setText("welcomeTitle", `Welcome back, ${name}`);
  setText("welcomeSubtitle", "Here’s how your website is performing.");

  const viewsMonth = analyticsEvents.length;
  const viewsWeek = analyticsEvents.filter(e=>isWithinDays(e.created_at,7)).length;
  const leadsMonth = leadEvents.length;
  const openReqs = changeRequests.filter(r=>r.status !== "done").length;

  animateNumber("sumViewsMonth", viewsMonth);
  animateNumber("sumLeadsMonth", leadsMonth);
  animateNumber("sumOpenRequests", openReqs);
  animateNumber("sumSeoScore", clientSite?.seo_score || 0);

  renderOverview();
  renderAnalytics();
  renderLeads();
  renderRequests();
  renderBilling();
  renderSEO();
}

function renderOverview(){
  const topPage = getTopValue(analyticsEvents,"page") || "your site";
  const topSource = getTopReferrer(analyticsEvents);

  setText(
    "summaryText",
    `Your website received ${analyticsEvents.length} visits in the last 30 days. Top page: ${topPage}. Top source: ${topSource}.`
  );

  renderChart("overviewChart", analyticsEvents);

  renderMiniLeads("overviewLeads", 3);
  renderMiniRequests("overviewRequests", 3);
}

function renderAnalytics(){
  const total = analyticsEvents.length;
  const week = analyticsEvents.filter(e=>isWithinDays(e.created_at,7)).length;

  setText("analyticsTotal", total);
  setText("analyticsWeek", week);
  setText("analyticsSource", getTopReferrer(analyticsEvents));

  renderChart("analyticsChart", analyticsEvents);

  const visitsBox = document.getElementById("visitsList");

  if(!analyticsEvents.length){
    visitsBox.innerHTML = `<div class="empty">No visits yet.</div>`;
    return;
  }

  visitsBox.innerHTML = analyticsEvents.slice(0,15).map(event=>`
    <div class="item">
      <strong>${escapeHtml(event.page || "Visit")}</strong>
      <p class="small">Source: ${escapeHtml(cleanReferrer(event.referrer))}</p>
      <p class="small">${timeAgo(event.created_at)}</p>
    </div>
  `).join("");
}

function renderLeads(){
  const box = document.getElementById("leadsList");

  if(!leadEvents.length){
    box.innerHTML = `<div class="empty">No leads yet.</div>`;
    return;
  }

  box.innerHTML = leadEvents.map(lead=>`
    <div class="item">
      <strong>${escapeHtml(lead.form_name || "Lead")}</strong>
      <p class="small">${escapeHtml(lead.page || "Unknown page")}</p>
      <p class="small">${timeAgo(lead.created_at)}</p>
    </div>
  `).join("");
}

function renderRequests(){
  const box = document.getElementById("requestsList");

  if(!changeRequests.length){
    box.innerHTML = `<div class="empty">No requests yet.</div>`;
    return;
  }

  box.innerHTML = changeRequests.map(req=>`
    <div class="item">
      <strong>${escapeHtml(req.request_type)}</strong>
      <p class="small">${escapeHtml(req.message)}</p>
      <span class="badge ${req.status === "done" ? "good" : "warn"}">${req.status}</span>
    </div>
  `).join("");
}

function renderMiniLeads(id,limit){
  const box = document.getElementById(id);

  if(!leadEvents.length){
    box.innerHTML = `<div class="empty">No leads</div>`;
    return;
  }

  box.innerHTML = leadEvents.slice(0,limit).map(l=>`
    <div class="item">
      <strong>${escapeHtml(l.form_name)}</strong>
      <p class="small">${timeAgo(l.created_at)}</p>
    </div>
  `).join("");
}

function renderMiniRequests(id,limit){
  const box = document.getElementById(id);

  if(!changeRequests.length){
    box.innerHTML = `<div class="empty">No requests</div>`;
    return;
  }

  box.innerHTML = changeRequests.slice(0,limit).map(r=>`
    <div class="item">
      <strong>${escapeHtml(r.request_type)}</strong>
      <p class="small">${r.status}</p>
    </div>
  `).join("");
}

function renderBilling(){
  setText("billingStatus", clientSite?.billing_status || "Active");
  setText("nextPayment", formatDate(clientSite?.next_payment_date));
}

function renderSEO(){
  setText("seoScore", `${clientSite?.seo_score || 0}/100`);
}

function renderChart(id,events){
  const box = document.getElementById(id);
  if(!box) return;

  const days = last7Days(events);
  const max = Math.max(...days.map(d=>d.count),1);

  box.innerHTML = days.map(day=>`
    <div class="bar-wrap">
      <div class="bar-value">${day.count}</div>
      <div class="bar" style="height:${Math.max((day.count/max)*160,8)}px"></div>
      <div class="bar-label">${day.label}</div>
    </div>
  `).join("");
}

function last7Days(events){
  const days = [];

  for(let i=6;i>=0;i--){
    const d = new Date();
    d.setDate(d.getDate()-i);
    const key = d.toISOString().slice(0,10);

    const count = events.filter(e=>{
      return new Date(e.created_at).toISOString().slice(0,10) === key;
    }).length;

    days.push({
      label:d.toLocaleDateString(undefined,{weekday:"short"}),
      count
    });
  }

  return days;
}

function showDashPage(page,btn){
  document.querySelectorAll(".page").forEach(p=>p.classList.remove("active"));
  document.getElementById(page+"Page")?.classList.add("active");

  document.querySelectorAll(".tabs button, .nav button").forEach(b=>b.classList.remove("active"));
  if(btn) btn.classList.add("active");

  window.scrollTo({top:0,behavior:"smooth"});
}

function animateNumber(id,end){
  const el = document.getElementById(id);
  if(!el) return;

  let start = 0;
  const duration = 600;
  const startTime = performance.now();

  function update(now){
    const progress = Math.min((now-startTime)/duration,1);
    el.textContent = Math.floor(end*progress);
    if(progress<1) requestAnimationFrame(update);
  }

  requestAnimationFrame(update);
}

function setText(id,value){
  const el = document.getElementById(id);
  if(el) el.textContent = value || "";
}

function formatDate(date){
  if(!date) return "—";
  return new Date(date+"T00:00:00").toLocaleDateString();
}

function timeAgo(date){
  const seconds = Math.floor((new Date()-new Date(date))/1000);
  if(seconds<60) return "just now";
  const m = Math.floor(seconds/60);
  if(m<60) return m+" min ago";
  const h = Math.floor(m/60);
  if(h<24) return h+" hr ago";
  const d = Math.floor(h/24);
  return d+" day"+(d===1?"":"s")+" ago";
}

function cleanReferrer(ref){
  if(!ref || ref==="direct") return "direct";
  try{return new URL(ref).hostname;}catch{ return ref;}
}

function getTopReferrer(events){
  const counts = {};
  events.forEach(e=>{
    const s = cleanReferrer(e.referrer);
    counts[s]=(counts[s]||0)+1;
  });
  return Object.entries(counts).sort((a,b)=>b[1]-a[1])[0]?.[0] || "direct";
}

function getTopValue(items,key){
  const counts = {};
  items.forEach(i=>{
    const v = i[key] || "unknown";
    counts[v]=(counts[v]||0)+1;
  });
  return Object.entries(counts).sort((a,b)=>b[1]-a[1])[0]?.[0] || null;
}

function isWithinDays(date,days){
  return new Date()-new Date(date) <= days*86400000;
}

function escapeHtml(str){
  return String(str||"")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;");
}
