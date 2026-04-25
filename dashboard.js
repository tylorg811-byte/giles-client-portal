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

  setText("welcome", `Welcome, ${name}`);
  setText("subtitle", "Here’s how your website is performing.");

  const views30 = analyticsEvents.length;
  const views7 = analyticsEvents.filter(e=>isWithinDays(e.created_at,7)).length;

  animateNumber("views30", views30);
  animateNumber("views7", views7);
  animateNumber("leadsCount", leadEvents.length);
  animateNumber("requestsCount", changeRequests.filter(r=>r.status !== "done").length);

  renderChart();
  renderLeads();
  renderRequests();
  renderBilling();
  renderSEO();
}

function renderChart(){
  const chart = document.getElementById("chart");
  if(!chart) return;

  const days = last7Days();
  const max = Math.max(...days.map(d=>d.count), 1);

  chart.innerHTML = days.map(day=>`
    <div style="flex:1;text-align:center;">
      <div class="bar" style="height:${Math.max((day.count / max) * 170, 8)}px;"></div>
      <small style="font-size:11px;color:#64748b;">${day.label}</small>
      <div style="font-size:12px;font-weight:800;">${day.count}</div>
    </div>
  `).join("");
}

function renderLeads(){
  const box = document.getElementById("leadsList");
  if(!box) return;

  if(!leadEvents.length){
    box.innerHTML = `<div class="card">No leads yet.</div>`;
    return;
  }

  box.innerHTML = leadEvents.slice(0,20).map(lead=>`
    <div class="row">
      <div>
        <strong>${escapeHtml(lead.form_name || "Website Lead")}</strong>
        <div style="color:#64748b;font-size:13px;">${escapeHtml(lead.page || "Unknown page")}</div>
      </div>
      <div>${timeAgo(lead.created_at)}</div>
    </div>
  `).join("");
}

function renderRequests(){
  const box = document.getElementById("requestsList");
  if(!box) return;

  if(!changeRequests.length){
    box.innerHTML = `<div class="card">No requests yet.</div>`;
    return;
  }

  box.innerHTML = changeRequests.map(req=>`
    <div class="row">
      <div>
        <strong>${escapeHtml(req.request_type || "Request")}</strong>
        <div style="color:#64748b;font-size:13px;">${escapeHtml(req.message || "")}</div>
      </div>
      <span class="badge ${req.status === "done" ? "good" : "warn"}">${escapeHtml(req.status || "new")}</span>
    </div>
  `).join("");
}

function renderBilling(){
  const status = getBillingStatus(clientSite || {});
  setText("billingStatus", status.text);
  setText("nextPayment", formatDate(clientSite?.next_payment_date));
}

function renderSEO(){
  setText("seoScore", `${clientSite?.seo_score || 0}/100`);
}

function last7Days(){
  const days = [];

  for(let i=6;i>=0;i--){
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0,10);

    const count = analyticsEvents.filter(e=>{
      return new Date(e.created_at).toISOString().slice(0,10) === key;
    }).length;

    days.push({
      label:d.toLocaleDateString(undefined,{weekday:"short"}),
      count
    });
  }

  return days;
}

function animateNumber(id,end){
  const el = document.getElementById(id);
  if(!el) return;

  let start = 0;
  const duration = 700;
  const startTime = performance.now();

  function update(now){
    const progress = Math.min((now - startTime) / duration, 1);
    el.textContent = Math.floor(start + (end - start) * progress);

    if(progress < 1) requestAnimationFrame(update);
  }

  requestAnimationFrame(update);
}

function getBillingStatus(site){
  if(site.billing_override) return { text:"Covered" };
  if(site.billing_status === "past due") return { text:"Past Due" };
  if(site.billing_status === "paused") return { text:"Paused" };
  if(site.billing_status === "manual paid") return { text:"Manual Paid" };
  if(site.billing_status === "free") return { text:"Free" };

  return { text:"Active" };
}

function isWithinDays(dateString,days){
  return new Date() - new Date(dateString) <= days * 24 * 60 * 60 * 1000;
}

function setText(id,value){
  const el = document.getElementById(id);
  if(el) el.textContent = value ?? "";
}

function formatDate(dateString){
  if(!dateString) return "—";
  return new Date(dateString + "T00:00:00").toLocaleDateString();
}

function timeAgo(dateString){
  const seconds = Math.floor((new Date() - new Date(dateString)) / 1000);
  if(seconds < 60) return "just now";
  const mins = Math.floor(seconds / 60);
  if(mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if(hrs < 24) return `${hrs} hr ago`;
  const days = Math.floor(hrs / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

function escapeHtml(value){
  return String(value || "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}
