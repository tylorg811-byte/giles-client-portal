let currentUser = null;
let clientSite = null;
let analyticsEvents = [];
let leadEvents = [];
let changeRequests = [];
let notifications = [];

const LIVE_BASE_URL = "https://giles-sites.netlify.app";

document.addEventListener("DOMContentLoaded", initDashboard);

async function initDashboard(){
  currentUser = await checkUser();
  if(!currentUser) return;

  await loadDashboardData();
  renderDashboard();
}

async function loadDashboardData(){
  await loadClientSite();
  await loadAnalytics();
  await loadLeads();
  await loadChangeRequests();
  await loadNotifications();
}

async function loadClientSite(){
  const { data, error } = await db
    .from("client_sites")
    .select("*")
    .eq("client_user_id", currentUser.id)
    .maybeSingle();

  if(error) console.error(error);
  clientSite = data || null;
}

async function loadAnalytics(){
  const since = new Date();
  since.setDate(since.getDate() - 30);

  const { data, error } = await db
    .from("site_analytics_events")
    .select("*")
    .eq("client_user_id", currentUser.id)
    .gte("created_at", since.toISOString())
    .order("created_at", { ascending:false });

  if(error) console.error(error);
  analyticsEvents = data || [];
}

async function loadLeads(){
  const since = new Date();
  since.setDate(since.getDate() - 30);

  const { data, error } = await db
    .from("site_leads")
    .select("*")
    .eq("client_user_id", currentUser.id)
    .gte("created_at", since.toISOString())
    .order("created_at", { ascending:false });

  if(error) console.error(error);
  leadEvents = data || [];
}

async function loadChangeRequests(){
  const { data, error } = await db
    .from("change_requests")
    .select("*")
    .eq("client_user_id", currentUser.id)
    .order("created_at", { ascending:false });

  if(error) console.error(error);
  changeRequests = data || [];
}

async function loadNotifications(){
  const { data, error } = await db
    .from("notifications")
    .select("*")
    .eq("user_id", currentUser.id)
    .order("created_at", { ascending:false })
    .limit(8);

  notifications = error ? [] : data || [];
}

function renderDashboard(){
  const name = clientSite?.business_name || "Your Website";
  const liveUrl = getLiveUrl();

  setText("welcomeTitle", `Welcome back, ${name}`);
  setText("welcomeSubtitle", buildSubtitle());

  setHref("heroLiveBtn", liveUrl);
  setHref("sideLiveBtn", liveUrl);
  setHref("mobileLiveBtn", liveUrl);

  renderBadges();
  renderSummaryStats();
  renderOverview();
  renderAnalytics();
  renderLeads();
  renderRequests();
  renderBilling();
  renderSEO();
}

function buildSubtitle(){
  if(!clientSite) return "Your website account is being prepared.";

  if(clientSite.site_status === "published"){
    return "Your website is live and working. Here’s a clear summary of traffic, leads, billing, SEO, and requests.";
  }

  return "Your website is being prepared. You can still view updates and submit change requests.";
}

function renderBadges(){
  const siteStatus = clientSite?.site_status || "setup";
  const billing = getBillingStatus(clientSite || {});
  const seoScore = Number(clientSite?.seo_score || 0);

  setBadge("siteStatusBadge", siteStatus === "published" ? "🌐 Website Live" : `🛠 ${siteStatus}`, siteStatus === "published" ? "good" : "warn");
  setBadge("billingStatusBadge", `💳 ${billing.text}`, billing.class);
  setBadge("seoStatusBadge", `🔎 SEO ${seoScore}/100`, seoScore >= 80 ? "good" : seoScore >= 60 ? "warn" : "bad");
}

function renderSummaryStats(){
  const viewsMonth = analyticsEvents.length;
  const viewsWeek = analyticsEvents.filter(e=>isWithinDays(e.created_at,7)).length;
  const leadsMonth = leadEvents.length;
  const openReqs = changeRequests.filter(r=>r.status !== "done").length;
  const seo = Number(clientSite?.seo_score || 0);

  animateNumber("sumViewsMonth", viewsMonth);
  animateNumber("sumLeadsMonth", leadsMonth);
  animateNumber("sumOpenRequests", openReqs);
  animateNumber("sumSeoScore", seo);

  setText("viewsNote", `${viewsWeek} views in the last 7 days`);
  setText("leadsNote", leadsMonth === 1 ? "1 tracked website lead" : `${leadsMonth} tracked website leads`);
  setText("seoNote", seo >= 80 ? "Strong foundation" : seo >= 60 ? "Good start" : "Needs improvement");
}

function renderOverview(){
  const topPage = getTopValue(analyticsEvents,"page") || "your site";
  const topSource = getTopReferrer(analyticsEvents);
  const leads = leadEvents.length;

  setText(
    "summaryText",
    `In the last 30 days, your website received ${analyticsEvents.length} visit${analyticsEvents.length === 1 ? "" : "s"} and ${leads} lead${leads === 1 ? "" : "s"}. Your top page is ${topPage}, and your top traffic source is ${topSource}.`
  );

  renderChart("overviewChart", analyticsEvents);

  const billing = getBillingStatus(clientSite || {});
  const seo = Number(clientSite?.seo_score || 0);

  document.getElementById("healthList").innerHTML = `
    <div class="item"><strong>Website Status</strong><p class="small">${clientSite?.site_status === "published" ? "Your website is live." : "Your website is not marked published yet."}</p></div>
    <div class="item"><strong>Billing</strong><p class="small">${billing.text}. Next payment: ${formatDate(clientSite?.next_payment_date)}</p></div>
    <div class="item"><strong>SEO</strong><p class="small">SEO score is ${seo}/100.</p></div>
    <div class="item"><strong>Requests</strong><p class="small">${changeRequests.filter(r=>r.status !== "done").length} open request(s).</p></div>
  `;

  renderMiniLeads("overviewLeads", 3);
  renderMiniRequests("overviewRequests", 3);
}

function renderAnalytics(){
  const total = analyticsEvents.length;
  const week = analyticsEvents.filter(e=>isWithinDays(e.created_at,7)).length;

  setText("analyticsTotal", total);
  setText("analyticsWeek", week);
  setText("analyticsSource", getTopReferrer(analyticsEvents));
  setText("analyticsDevice", getTopValue(analyticsEvents,"device") || "—");

  renderChart("analyticsChart", analyticsEvents);

  const visitsBox = document.getElementById("visitsList");
  if(!analyticsEvents.length){
    visitsBox.innerHTML = `<div class="empty">No visits tracked yet.</div>`;
    return;
  }

  visitsBox.innerHTML = analyticsEvents.slice(0,15).map(event=>`
    <div class="item">
      <strong>${escapeHtml(event.page || "Website Visit")}</strong>
      <p class="small">Source: ${escapeHtml(cleanReferrer(event.referrer))}</p>
      <p class="small">Device: ${escapeHtml(event.device || "Unknown")} • Browser: ${escapeHtml(event.browser || "Unknown")}</p>
      <p class="small">${timeAgo(event.created_at)}</p>
    </div>
  `).join("");
}

function renderLeads(){
  setText("leadCountBadge", `${leadEvents.length} Lead${leadEvents.length === 1 ? "" : "s"}`);

  const box = document.getElementById("leadsList");
  if(!leadEvents.length){
    box.innerHTML = `<div class="empty">No leads yet. When someone submits a form, it will appear here.</div>`;
    return;
  }

  box.innerHTML = leadEvents.map(lead=>`
    <div class="item">
      <strong>${escapeHtml(lead.form_name || "Website Lead")}</strong>
      <p class="small">Page: ${escapeHtml(lead.page || "Unknown page")}</p>
      <p class="small">Source: ${escapeHtml(cleanReferrer(lead.source))}</p>
      <p class="small">${timeAgo(lead.created_at)}</p>
    </div>
  `).join("");
}

function renderMiniLeads(id,limit){
  const box = document.getElementById(id);
  if(!box) return;

  if(!leadEvents.length){
    box.innerHTML = `<div class="empty">No leads yet.</div>`;
    return;
  }

  box.innerHTML = leadEvents.slice(0,limit).map(lead=>`
    <div class="item">
      <strong>${escapeHtml(lead.form_name || "Website Lead")}</strong>
      <p class="small">${escapeHtml(lead.page || "Unknown page")} • ${timeAgo(lead.created_at)}</p>
    </div>
  `).join("");
}

function renderRequests(){
  const open = changeRequests.filter(r=>r.status !== "done").length;
  const done = changeRequests.filter(r=>r.status === "done").length;

  document.getElementById("requestsSummary").innerHTML = `
    <div class="item"><strong>Open Requests</strong><p class="small">${open}</p></div>
    <div class="item"><strong>Completed Requests</strong><p class="small">${done}</p></div>
    <div class="item"><strong>Average Response</strong><p class="small">Requests are reviewed by Giles Web Design.</p></div>
  `;

  const box = document.getElementById("requestsList");
  if(!changeRequests.length){
    box.innerHTML = `<div class="empty">No requests submitted yet.</div>`;
    return;
  }

  box.innerHTML = changeRequests.map(req=>`
    <div class="item">
      <strong>${escapeHtml(req.request_type || "Request")}</strong>
      <p class="small">${escapeHtml(req.message || "")}</p>
      <span class="badge ${req.status === "done" ? "good" : "warn"}">${escapeHtml(req.status || "new")}</span>
      <p class="small">${timeAgo(req.created_at)}</p>
    </div>
  `).join("");
}

function renderMiniRequests(id,limit){
  const box = document.getElementById(id);
  if(!box) return;

  if(!changeRequests.length){
    box.innerHTML = `<div class="empty">No requests yet.</div>`;
    return;
  }

  box.innerHTML = changeRequests.slice(0,limit).map(req=>`
    <div class="item">
      <strong>${escapeHtml(req.request_type || "Request")}</strong>
      <p class="small">${escapeHtml(req.status || "new")} • ${timeAgo(req.created_at)}</p>
    </div>
  `).join("");
}

function renderBilling(){
  const billing = getBillingStatus(clientSite || {});
  setBadge("billingMiniBadge", billing.text, billing.class);

  document.getElementById("billingDetails").innerHTML = `
    <div class="item"><strong>Status</strong><p class="small">${billing.text}</p></div>
    <div class="item"><strong>Next Payment</strong><p class="small">${formatDate(clientSite?.next_payment_date)}</p></div>
    <div class="item"><strong>Last Payment</strong><p class="small">${formatDate(clientSite?.last_payment_date)}</p></div>
    <div class="item"><strong>Billing Cycle</strong><p class="small">${escapeHtml(clientSite?.billing_cycle || "Monthly")}</p></div>
  `;

  document.getElementById("planDetails").innerHTML = `
    <div class="item"><strong>Plan</strong><p class="small">${escapeHtml(clientSite?.package_name || "Website Plan")}</p></div>
    <div class="item"><strong>Website Status</strong><p class="small">${escapeHtml(clientSite?.site_status || "Setup")}</p></div>
    <div class="item"><strong>Editor Access</strong><p class="small">${escapeHtml(clientSite?.editor_access || "Safe Mode")}</p></div>
    <div class="item"><strong>Domain</strong><p class="small">${escapeHtml(clientSite?.domain || "No domain connected")}</p></div>
  `;
}

function renderSEO(){
  const score = Number(clientSite?.seo_score || 0);
  const scoreClass = score >= 80 ? "good" : score >= 60 ? "warn" : "bad";

  setBadge("seoMainBadge", `${score}/100`, scoreClass);
  setText("seoMainText", getSEOMessage(score));

  const progress = document.getElementById("seoProgress");
  if(progress) progress.style.width = `${score}%`;

  setText("seoPreviewUrl", getLiveUrl());
  setText("seoPreviewTitle", clientSite?.seo_title || clientSite?.business_name || "Website Title");
  setText("seoPreviewDescription", clientSite?.seo_description || "SEO description has not been added yet.");
}

function getSEOMessage(score){
  if(score >= 80) return "Your website has a strong SEO foundation. Keep sharing your website and building traffic.";
  if(score >= 60) return "Your SEO is off to a good start. A few improvements can make it stronger.";
  return "Your SEO needs more information. Add a strong title, description, location, and preview image.";
}

async function submitChangeRequest(){
  const type = cleanValue("requestType");
  const page = cleanValue("requestPage");
  const message = cleanValue("requestMessage");

  if(!message){
    setText("requestMessageStatus","Please describe what you need changed.");
    return;
  }

  const payload = {
    client_user_id:currentUser.id,
    client_email:currentUser.email,
    business_name:clientSite?.business_name || "",
    request_type:type,
    page,
    message,
    status:"new",
    created_at:new Date().toISOString()
  };

  const { error } = await db.from("change_requests").insert(payload);

  if(error){
    console.error(error);
    setText("requestMessageStatus","Request failed. Please try again.");
    return;
  }

  setText("requestMessageStatus","Request submitted successfully.");
  setValue("requestPage","");
  setValue("requestMessage","");

  await loadChangeRequests();
  renderRequests();
  renderOverview();
  renderSummaryStats();
}

function renderChart(id,events){
  const box = document.getElementById(id);
  if(!box) return;

  const days = last7Days(events);
  const max = Math.max(...days.map(d=>d.count),1);

  box.innerHTML = days.map(day=>`
    <div class="bar-wrap">
      <div class="bar-value">${day.count}</div>
      <div class="bar" style="height:${Math.max((day.count / max) * 175,8)}px"></div>
      <div class="bar-label">${day.label}</div>
    </div>
  `).join("");
}

function last7Days(events){
  const days = [];

  for(let i=6;i>=0;i--){
    const d = new Date();
    d.setDate(d.getDate() - i);
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
  const pageEl = document.getElementById(`${page}Page`);
  if(pageEl) pageEl.classList.add("active");

  document.querySelectorAll(".tabs button, .nav button").forEach(b=>b.classList.remove("active"));

  document.querySelectorAll(`button[onclick*="${page}"]`).forEach(b=>b.classList.add("active"));

  if(btn) btn.classList.add("active");

  window.scrollTo({top:0,behavior:"smooth"});
}

function toggleMobileMenu(){
  document.getElementById("mobileDrawer")?.classList.toggle("open");
}

function getLiveUrl(){
  if(clientSite?.domain && clientSite?.domain_status === "live" && clientSite?.domain_release_status !== "released"){
    return `https://${clientSite.domain}`;
  }

  return `${LIVE_BASE_URL}/?client=${currentUser.id}`;
}

function getBillingStatus(site){
  if(site.billing_override) return { text:"Covered", class:"good" };
  if(site.billing_status === "past due") return { text:"Past Due", class:"bad" };
  if(site.billing_status === "paused") return { text:"Paused", class:"dark" };
  if(site.billing_status === "free") return { text:"Free", class:"good" };
  if(site.billing_status === "manual paid") return { text:"Manual Paid", class:"good" };
  if(site.billing_status === "trial") return { text:"Trial", class:"warn" };

  const today = new Date();
  today.setHours(0,0,0,0);

  const next = site.next_payment_date
    ? new Date(site.next_payment_date + "T00:00:00")
    : null;

  if(next && next < today){
    return { text:"Past Due", class:"bad" };
  }

  return { text:"Active", class:"good" };
}

function animateNumber(id,end){
  const el = document.getElementById(id);
  if(!el) return;

  const final = Number(end || 0);
  const duration = 650;
  const startTime = performance.now();

  function update(now){
    const progress = Math.min((now - startTime) / duration,1);
    el.textContent = Math.floor(final * progress);
    if(progress < 1) requestAnimationFrame(update);
  }

  requestAnimationFrame(update);
}

function setText(id,value){
  const el = document.getElementById(id);
  if(el) el.textContent = value ?? "";
}

function setValue(id,value){
  const el = document.getElementById(id);
  if(el) el.value = value || "";
}

function setHref(id,url){
  const el = document.getElementById(id);
  if(el) el.href = url;
}

function setBadge(id,text,type){
  const el = document.getElementById(id);
  if(!el) return;
  el.textContent = text;
  el.className = `badge ${type || ""}`;
}

function cleanValue(id){
  const el = document.getElementById(id);
  return el ? el.value.trim() : "";
}

function escapeHtml(value){
  return String(value || "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

function cleanReferrer(ref){
  if(!ref || ref === "direct") return "direct";
  try{return new URL(ref).hostname;}catch(e){return ref;}
}

function getTopReferrer(events){
  const counts = {};
  events.forEach(event=>{
    const source = cleanReferrer(event.referrer);
    counts[source] = (counts[source] || 0) + 1;
  });
  return Object.entries(counts).sort((a,b)=>b[1]-a[1])[0]?.[0] || "direct";
}

function getTopValue(items,key){
  const counts = {};
  items.forEach(item=>{
    const value = item[key] || "unknown";
    counts[value] = (counts[value] || 0) + 1;
  });
  return Object.entries(counts).sort((a,b)=>b[1]-a[1])[0]?.[0] || null;
}

function isWithinDays(dateString,days){
  return new Date() - new Date(dateString) <= days * 24 * 60 * 60 * 1000;
}

function timeAgo(dateString){
  if(!dateString) return "—";
  const seconds = Math.floor((new Date() - new Date(dateString)) / 1000);
  if(seconds < 60) return "just now";
  const mins = Math.floor(seconds / 60);
  if(mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if(hrs < 24) return `${hrs} hr ago`;
  const days = Math.floor(hrs / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

function formatDate(dateString){
  if(!dateString) return "—";
  return new Date(dateString + "T00:00:00").toLocaleDateString();
}
