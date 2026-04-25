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

  if(error){
    console.error(error);
    return;
  }

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

  analyticsEvents = error ? [] : data || [];
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

  leadEvents = error ? [] : data || [];
}

async function loadChangeRequests(){
  const { data, error } = await db
    .from("change_requests")
    .select("*")
    .eq("client_user_id", currentUser.id)
    .order("created_at", { ascending:false });

  changeRequests = error ? [] : data || [];
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
  const businessName = clientSite?.business_name || "Your Website";
  const liveUrl = getLiveUrl();

  setText("welcomeTitle", `Welcome back, ${businessName}`);
  setText("welcomeSubtitle", buildSubtitle());

  setLink("openLiveBtn", liveUrl);
  setLink("heroLiveBtn", liveUrl);

  setLink("openEditorBtn", "editor.html");
  setLink("heroEditorBtn", "editor.html");

  renderStatusBadges();
  renderStats();
  renderActivity();
  renderSEO();
  renderBilling();
  renderRequests();
  renderNotifications();
}

function buildSubtitle(){
  if(!clientSite){
    return "Your website account is being prepared.";
  }

  if(clientSite.site_status === "published"){
    return "Your website is live and working. Track visitors, leads, requests, billing, and SEO from here.";
  }

  return "Your website is currently being prepared. You can still submit requests and review your account.";
}

function renderStatusBadges(){
  const siteBadge = document.getElementById("siteStatusBadge");
  const billingBadge = document.getElementById("billingStatusBadge");

  const siteStatus = clientSite?.site_status || "setup";
  const billing = getBillingStatus(clientSite || {});

  siteBadge.textContent = siteStatus === "published" ? "🌐 Website Live" : `🛠 ${siteStatus}`;
  siteBadge.className = siteStatus === "published" ? "badge good" : "badge warn";

  billingBadge.textContent = `💳 ${billing.text}`;
  billingBadge.className = `badge ${billing.class}`;
}

function renderStats(){
  const month = analyticsEvents.length;
  const week = analyticsEvents.filter(e=>isWithinDays(e.created_at,7)).length;
  const leadsMonth = leadEvents.length;
  const openReqs = changeRequests.filter(r=>r.status !== "done").length;

  setText("viewsMonth", month);
  setText("viewsWeek", week);
  setText("leadsMonth", leadsMonth);
  setText("openRequests", openReqs);
}

function renderActivity(){
  const topPage = getTopValue(analyticsEvents,"page") || "your site";
  const topSource = getTopReferrer(analyticsEvents);
  const leadsMonth = leadEvents.length;

  setText(
    "activitySummary",
    `Your website has received ${analyticsEvents.length} visits in the last 30 days. Top page: ${topPage}. Top source: ${topSource}. You received ${leadsMonth} lead${leadsMonth === 1 ? "" : "s"}.`
  );

  const box = document.getElementById("recentLeads");

  if(!leadEvents.length){
    box.innerHTML = `<div class="empty">No leads yet. Once someone submits a form, it will appear here.</div>`;
    return;
  }

  box.innerHTML = leadEvents.slice(0,6).map(lead=>`
    <div class="lead-card">
      <strong>${escapeHtml(lead.form_name || "Website Lead")}</strong>
      <p class="small">Page: ${escapeHtml(lead.page || "Unknown")}</p>
      <p class="small">Source: ${escapeHtml(cleanReferrer(lead.source))}</p>
      <p class="small">${timeAgo(lead.created_at)}</p>
    </div>
  `).join("");
}

function renderSEO(){
  const score = Number(clientSite?.seo_score || 0);
  const badge = document.getElementById("seoBadge");
  const progress = document.getElementById("seoProgress");

  badge.textContent = `${score}/100`;
  progress.style.width = `${score}%`;

  if(score >= 80){
    badge.className = "badge good";
    setText("seoText", "Your website has a strong SEO foundation. Keep posting links and adding content to help ranking.");
  } else if(score >= 60){
    badge.className = "badge warn";
    setText("seoText", "Your SEO is off to a good start. A few improvements can make your site stronger.");
  } else {
    badge.className = "badge bad";
    setText("seoText", "Your SEO needs more information. We can improve your title, description, location, and preview image.");
  }
}

function renderBilling(){
  const billing = getBillingStatus(clientSite || {});
  const mini = document.getElementById("billingMiniBadge");
  mini.textContent = billing.text;
  mini.className = `badge ${billing.class}`;

  document.getElementById("billingDetails").innerHTML = `
    <div class="lead-card">
      <strong>Status</strong>
      <p class="small">${billing.text}</p>
    </div>

    <div class="lead-card">
      <strong>Next Payment</strong>
      <p class="small">${formatDate(clientSite?.next_payment_date)}</p>
    </div>

    <div class="lead-card">
      <strong>Last Payment</strong>
      <p class="small">${formatDate(clientSite?.last_payment_date)}</p>
    </div>

    <div class="lead-card">
      <strong>Plan</strong>
      <p class="small">${escapeHtml(clientSite?.package_name || "Website Plan")}</p>
    </div>
  `;
}

function renderRequests(){
  const box = document.getElementById("recentRequests");

  if(!changeRequests.length){
    box.innerHTML = `<div class="empty">No requests yet.</div>`;
    return;
  }

  box.innerHTML = changeRequests.slice(0,5).map(req=>`
    <div class="request-card">
      <strong>${escapeHtml(req.request_type || "Request")}</strong>
      <p class="small">${escapeHtml(req.message || "")}</p>
      <span class="badge ${req.status === "done" ? "good" : "warn"}">${escapeHtml(req.status || "new")}</span>
    </div>
  `).join("");
}

function renderNotifications(){
  const box = document.getElementById("notificationsList");

  if(!notifications.length){
    box.innerHTML = `<div class="empty">No notifications yet.</div>`;
    return;
  }

  box.innerHTML = notifications.map(note=>`
    <div class="notification-card">
      <strong>${escapeHtml(note.title || "Update")}</strong>
      <p class="small">${escapeHtml(note.message || "")}</p>
      <p class="small">${timeAgo(note.created_at)}</p>
    </div>
  `).join("");
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
  renderStats();
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

function setText(id,value){
  const el = document.getElementById(id);
  if(el) el.textContent = value ?? "";
}

function setValue(id,value){
  const el = document.getElementById(id);
  if(el) el.value = value || "";
}

function setLink(id,url){
  const el = document.getElementById(id);
  if(el) el.href = url;
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

  try{
    return new URL(ref).hostname;
  }catch(e){
    return ref;
  }
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
  const date = new Date(dateString);
  const now = new Date();
  return now - date <= days * 24 * 60 * 60 * 1000;
}

function timeAgo(dateString){
  if(!dateString) return "—";

  const date = new Date(dateString);
  const seconds = Math.floor((new Date() - date) / 1000);

  if(seconds < 60) return "just now";

  const minutes = Math.floor(seconds / 60);
  if(minutes < 60) return `${minutes} min ago`;

  const hours = Math.floor(minutes / 60);
  if(hours < 24) return `${hours} hr ago`;

  const days = Math.floor(hours / 24);
  if(days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;

  return date.toLocaleDateString();
}

function formatDate(dateString){
  if(!dateString) return "—";
  return new Date(dateString + "T00:00:00").toLocaleDateString();
}
