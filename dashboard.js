function debugLog(msg){
  const box = document.getElementById("debugBox");
  if(box) box.innerHTML += `<div>${msg}</div>`;
  console.log(msg);
}

let currentUser = null;
let activeClientUserId = null;
let isAdminView = false;
let clientSite = null;
let analyticsEvents = [];
let leadEvents = [];
let changeRequests = [];
let supportTickets = [];

const LIVE_BASE_URL = "https://giles-sites.netlify.app";

document.addEventListener("DOMContentLoaded", initDashboard);

async function initDashboard(){
  debugLog("INIT START");

  try{
    currentUser = await checkUser();
    debugLog("USER: " + (currentUser ? currentUser.email : "null"));
  }catch(e){
    debugLog("USER ERROR: " + e.message);
    return;
  }

  if(!currentUser){
    debugLog("NO USER FOUND");
    return;
  }

  try{
    await setupActiveClientUser();
    debugLog("ACTIVE CLIENT: " + activeClientUserId);
  }catch(e){
    debugLog("ADMIN VIEW ERROR: " + e.message);
    return;
  }

  try{
    await loadDashboardData();
    debugLog("DATA LOADED: analytics " + analyticsEvents.length);
  }catch(e){
    debugLog("DATA ERROR: " + e.message);
    return;
  }

  try{
    renderDashboard();
    debugLog("RENDER DONE");
  }catch(e){
    debugLog("RENDER ERROR: " + e.message);
  }
}


async function setupActiveClientUser(){
  activeClientUserId = currentUser.id;
  isAdminView = false;

  const params = new URLSearchParams(window.location.search);
  const requestedClientId = params.get("client");

  if(!requestedClientId){
    return;
  }

  const { data: adminData, error: adminError } = await db
    .from("admin_users")
    .select("*")
    .eq("user_id", currentUser.id)
    .maybeSingle();

  if(adminError || !adminData){
    alert("Admin access only.");
    window.location.href = "dashboard.html";
    throw new Error("Admin access denied");
  }

  activeClientUserId = requestedClientId;
  isAdminView = true;
}

// LOAD ALL DATA
async function loadDashboardData(){
  await loadClientSite();
  await loadAnalytics();
  await loadLeads();
  await loadChangeRequests();
  await loadSupportTickets();
}

// CLIENT SITE
async function loadClientSite(){
  const { data, error } = await db
    .from("client_sites")
    .select("*")
    .eq("client_user_id", activeClientUserId)
    .maybeSingle();

  if(error) console.error(error);
  clientSite = data || null;
}

// ANALYTICS
async function loadAnalytics(){
  const allEvents = [];

  const legacy = await db
    .from("site_analytics_events")
    .select("*")
    .eq("client_user_id", activeClientUserId)
    .order("created_at", { ascending:false });

  if(!legacy.error && legacy.data){
    allEvents.push(...legacy.data.map(event=>normalizeDashboardAnalyticsEvent(event)));
  }else if(legacy.error){
    console.warn("Legacy analytics not loaded:", legacy.error.message || legacy.error);
  }

  const newAnalytics = await db
    .from("site_analytics")
    .select("*")
    .order("created_at", { ascending:false });

  if(!newAnalytics.error && newAnalytics.data){
    allEvents.push(
      ...newAnalytics.data
        .map(event=>normalizeDashboardAnalyticsEvent(event))
        .filter(event=>dashboardAnalyticsBelongsToActiveClient(event))
    );
  }else if(newAnalytics.error){
    console.warn("New site_analytics not loaded:", newAnalytics.error.message || newAnalytics.error);
  }

  analyticsEvents = allEvents
    .filter(Boolean)
    .sort((a,b)=>new Date(b.created_at || 0) - new Date(a.created_at || 0));
}

function normalizeDashboardAnalyticsEvent(event){
  if(!event) return null;

  return {
    ...event,
    client_user_id:event.client_user_id || activeClientUserId || "",
    page:event.page || event.path || "/",
    path:event.path || event.page || "/",
    referrer:event.referrer || "direct",
    device:event.device || detectDashboardDeviceFromUserAgent(event.user_agent),
    browser:event.browser || detectDashboardBrowserFromUserAgent(event.user_agent),
    created_at:event.created_at || new Date().toISOString()
  };
}

function dashboardAnalyticsBelongsToActiveClient(event){
  if(!event) return false;

  if(event.client_user_id && event.client_user_id === activeClientUserId){
    return true;
  }

  if(!clientSite) return false;

  const ids = getDashboardTrackingIds(clientSite);
  const siteId = String(event.site_id || "").toLowerCase().trim();
  const page = String(event.page || "").toLowerCase();
  const title = String(event.title || "").toLowerCase();

  if(siteId && ids.includes(siteId)){
    return true;
  }

  return ids.some(id=>{
    if(!id || id.length < 3) return false;
    return page.includes(id) || title.includes(id);
  });
}

function getDashboardTrackingIds(site){
  if(!site) return [];

  const ids = [
    site.client_user_id,
    site.tracking_site_id,
    site.site_id,
    site.slug,
    site.project_slug,
    site.domain,
    site.business_name
  ];

  if(site.business_name){
    ids.push(makeDashboardSlug(site.business_name));
  }

  if(site.domain){
    ids.push(makeDashboardSlug(site.domain));
  }

  return [...new Set(ids.filter(Boolean).map(value=>String(value).toLowerCase().trim()))];
}

function makeDashboardSlug(value){
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/^https?:\/\//,"")
    .replace(/^www\./,"")
    .replace(/\/$/,"")
    .replace(/[^a-z0-9]+/g,"-")
    .replace(/^-|-$/g,"");
}

function detectDashboardDeviceFromUserAgent(userAgent){
  const ua = String(userAgent || "").toLowerCase();

  if(/iphone|android.*mobile|windows phone/.test(ua)) return "mobile";
  if(/ipad|tablet|android/.test(ua)) return "tablet";

  return "desktop";
}

function detectDashboardBrowserFromUserAgent(userAgent){
  const ua = String(userAgent || "").toLowerCase();

  if(ua.includes("edg/")) return "Edge";
  if(ua.includes("chrome/") && !ua.includes("edg/")) return "Chrome";
  if(ua.includes("safari/") && !ua.includes("chrome/")) return "Safari";
  if(ua.includes("firefox/")) return "Firefox";

  return "Unknown";
}


// LEADS
async function loadLeads(){
  const { data, error } = await db
    .from("site_leads")
    .select("*")
    .eq("client_user_id", activeClientUserId)
    .order("created_at", { ascending:false });

  if(error) console.error(error);
  leadEvents = data || [];
}

// REQUESTS
async function loadChangeRequests(){
  const { data, error } = await db
    .from("change_requests")
    .select("*")
    .eq("client_user_id", activeClientUserId)
    .order("created_at", { ascending:false });

  if(error) console.error(error);
  changeRequests = data || [];
}

// SUPPORT
async function loadSupportTickets(){
  const { data, error } = await db
    .from("support_tickets")
    .select("*")
    .eq("client_user_id", activeClientUserId)
    .order("created_at", { ascending:false });

  if(error){
    console.error(error);
    supportTickets = [];
    return;
  }

  supportTickets = data || [];
}

function renderDashboard(){
  const name = clientSite?.business_name || "Your Website";
  const liveUrl = getLiveUrl();

  setText("welcomeTitle", `Welcome back, ${name}`);
  setText("welcomeSubtitle", isAdminView ? `Admin viewing client dashboard • ${buildSubtitle()}` : buildSubtitle());

  setHref("heroLiveBtn", liveUrl);
  setHref("sideLiveBtn", liveUrl);
  setHref("mobileLiveBtn", liveUrl);

  renderBadges();
  renderSummaryStats();
  renderOverview();
  renderAnalytics();
  renderLeads();
  renderRequests();
  renderSupport();
  renderBilling();
  renderSEO();
}

function buildSubtitle(){
  if(!clientSite) return "Your website account is being prepared.";

  if(clientSite.site_status === "published"){
    return "Your website is live and working. Here’s a clear summary of traffic, leads, billing, SEO, support, and requests.";
  }

  return "Your website is being prepared. You can still view updates and submit requests.";
}

function renderBadges(){
  const siteStatus = clientSite?.site_status || "setup";
  const billing = getBillingStatus(clientSite || {});
  const seoScore = Number(clientSite?.seo_score || 0);

  setBadge("siteStatusBadge", siteStatus === "published" ? "Website Live" : siteStatus, siteStatus === "published" ? "good" : "warn");
  setBadge("billingStatusBadge", billing.text, billing.class);
  setBadge("seoStatusBadge", `SEO ${seoScore}/100`, seoScore >= 80 ? "good" : seoScore >= 60 ? "warn" : "bad");
}

function renderSummaryStats(){
  const monthEvents = getLast30DayEvents();
  const viewsMonth = monthEvents.length;
  const viewsWeek = analyticsEvents.filter(e=>isWithinDays(e.created_at,7)).length;
  const leadsMonth = getLast30DayLeads().length;
  const openReqs = changeRequests.filter(r=>r.status !== "done").length;
  const openTickets = supportTickets.filter(t=>!["closed","resolved"].includes(String(t.status || "").toLowerCase())).length;

  animateNumber("sumViewsMonth", viewsMonth);
  animateNumber("sumLeadsMonth", leadsMonth);
  animateNumber("sumOpenRequests", openReqs);
  animateNumber("sumOpenTickets", openTickets);

  setText("viewsNote", `${viewsWeek} views in the last 7 days`);
  setText("leadsNote", leadsMonth === 1 ? "1 tracked website lead" : `${leadsMonth} tracked website leads`);
}

function renderOverview(){
  const monthEvents = getLast30DayEvents();
  const topPage = getTopValue(monthEvents,"page") || "your site";
  const topSource = getTopReferrer(monthEvents);
  const leads = getLast30DayLeads().length;

  setText(
    "summaryText",
    `In the last 30 days, your website received ${monthEvents.length} visit${monthEvents.length === 1 ? "" : "s"} and ${leads} lead${leads === 1 ? "" : "s"}. Your top page is ${topPage}, and your top traffic source is ${topSource}.`
  );

  renderChart("overviewChart", monthEvents);
  renderActivity();
}

function renderActivity(){
  const box = document.getElementById("activityFeed");
  if(!box) return;

  const combined = [
    ...analyticsEvents.map(e => ({ ...e, type:"visit" })),
    ...leadEvents.map(l => ({ ...l, type:"lead" })),
    ...changeRequests.map(r => ({ ...r, type:"request" })),
    ...supportTickets.map(t => ({ ...t, type:"support" }))
  ];

  const sorted = combined
    .filter(item => item.created_at)
    .sort((a,b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0,12);

  if(!sorted.length){
    box.innerHTML = `<div class="empty">No activity yet. Once your site gets visits, leads, requests, or tickets, they’ll show here.</div>`;
    return;
  }

  box.innerHTML = sorted.map(item => {
    let title = "Website Visit";
    let detail = `${escapeHtml(item.page || "Website")} • ${escapeHtml(cleanReferrer(item.referrer))}`;
    let pill = "Visitor Activity";

    if(item.type === "lead"){
      title = "New Website Lead";
      detail = `${escapeHtml(item.form_name || "Website form")} • ${escapeHtml(item.page || "Unknown page")}`;
      pill = "New Lead";
    }

    if(item.type === "request"){
      title = "Change Request Submitted";
      detail = `${escapeHtml(item.request_type || "Request")} • ${escapeHtml(item.page || "Website")}`;
      pill = escapeHtml(item.status || "new");
    }

    if(item.type === "support"){
      title = "Support Ticket Opened";
      detail = `${escapeHtml(item.subject || item.ticket_type || "Support ticket")}`;
      pill = escapeHtml(item.priority || item.status || "open");
    }

    return `
      <div class="item">
        <strong>${title}</strong>
       <div class="small">${detail}</div>
<div class="small">${timeAgo(item.created_at)}</div>
        <span class="badge">${pill}</span>
      </div>
    `;
  }).join("");
}

function renderAnalytics(){
  const monthEvents = getLast30DayEvents();
  const week = analyticsEvents.filter(e=>isWithinDays(e.created_at,7)).length;

  setText("analyticsTotal", monthEvents.length);
  setText("analyticsWeek", week);
  setText("analyticsSource", getTopReferrer(monthEvents));
  setText("analyticsDevice", getTopValue(monthEvents,"device") || "—");

  renderChart("analyticsChart", monthEvents);
  setupVisitFilters();
  renderVisitsList();
}

function setupVisitFilters(){
  fillFilter("visitMonthFilter", getMonthOptions(), "All Months");
  fillFilter("visitSourceFilter", getUniqueSources(), "All Sources");
  fillFilter("visitDeviceFilter", getUniqueFieldValues("device"), "All Devices");
  fillFilter("visitPageFilter", getUniqueFieldValues("page"), "All Pages");
}

function fillFilter(id, values, label){
  const el = document.getElementById(id);
  if(!el) return;

  const current = el.value || "all";
  el.innerHTML = `<option value="all">${label}</option>`;

  values.forEach(value=>{
    const safe = escapeAttribute(value);
    el.innerHTML += `<option value="${safe}">${escapeHtml(value)}</option>`;
  });

  if([...el.options].some(opt=>opt.value === current)){
    el.value = current;
  }
}

function getMonthOptions(){
  return [...new Set(analyticsEvents.map(event=>{
    const d = new Date(event.created_at);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
  }))].sort().reverse();
}

function getUniqueSources(){
  return [...new Set(analyticsEvents.map(event=>cleanReferrer(event.referrer)))].filter(Boolean).sort();
}

function getUniqueFieldValues(field){
  return [...new Set(analyticsEvents.map(event=>event[field] || "unknown"))].filter(Boolean).sort();
}

function renderVisitsList(){
  const box = document.getElementById("visitsList");
  if(!box) return;

  const month = getSelectValue("visitMonthFilter");
  const source = getSelectValue("visitSourceFilter");
  const device = getSelectValue("visitDeviceFilter");
  const page = getSelectValue("visitPageFilter");

  let data = [...analyticsEvents];

  data = data.filter(event=>{
    const eventMonth = new Date(event.created_at).toISOString().slice(0,7);
    const eventSource = cleanReferrer(event.referrer);
    const eventDevice = event.device || "unknown";
    const eventPage = event.page || "unknown";

    return (
      (month === "all" || eventMonth === month) &&
      (source === "all" || eventSource === source) &&
      (device === "all" || eventDevice === device) &&
      (page === "all" || eventPage === page)
    );
  });

  setText("visitCountBadge", `${data.length} Visit${data.length === 1 ? "" : "s"}`);

  if(!data.length){
    box.innerHTML = `<div class="empty">No visits match these filters.</div>`;
    return;
  }

  box.innerHTML = data.map(event=>`
    <div class="item">
      <strong>${escapeHtml(event.page || "Website Visit")}</strong>
      <div class="small">Source: ${escapeHtml(cleanReferrer(event.referrer))}</div>
<div class="small">Device: ${escapeHtml(event.device || "Unknown")} • Browser: ${escapeHtml(event.browser || "Unknown")}</div>
<div class="small">Path: ${escapeHtml(event.path || "—")}</div>
<div class="small">${timeAgo(event.created_at)}</div>
    </div>
  `).join("");
}

function renderLeads(){
  setText("leadCountBadge", `${leadEvents.length} Lead${leadEvents.length === 1 ? "" : "s"}`);

  const box = document.getElementById("leadsList");
  if(!box) return;

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

function renderRequests(){
  const summaryBox = document.getElementById("requestsSummary");
  const listBox = document.getElementById("requestsList");

  const open = changeRequests.filter(r=>r.status !== "done").length;
  const done = changeRequests.filter(r=>r.status === "done").length;

  if(summaryBox){
    summaryBox.innerHTML = `
      <div class="item"><strong>Open Requests</strong><p class="small">${open}</p></div>
      <div class="item"><strong>Completed Requests</strong><p class="small">${done}</p></div>
    `;
  }

  if(!listBox) return;

  if(!changeRequests.length){
    listBox.innerHTML = `<div class="empty">No requests submitted yet.</div>`;
    return;
  }

  listBox.innerHTML = changeRequests.map(req=>`
    <div class="item">
      <strong>${escapeHtml(req.request_type || "Request")}</strong>
      <p class="small">${escapeHtml(req.message || "")}</p>
      ${req.image_url ? `<img src="${escapeAttribute(req.image_url)}" alt="Request upload" style="width:100%;max-width:520px;border-radius:14px;margin:10px 0;border:1px solid rgba(255,255,255,.12);display:block;">` : ""}
      <span class="badge ${req.status === "done" ? "good" : "warn"}">${escapeHtml(req.status || "new")}</span>
      <p class="small">${timeAgo(req.created_at)}</p>
    </div>
  `).join("");
}

async function submitChangeRequest(){
  const type = getSelectValue("requestType");
  const page = cleanValue("requestPage");
  const message = cleanValue("requestMessage");
  const fileInput = document.getElementById("requestImage");
  const file = fileInput?.files?.[0] || null;

  if(!message){
    setText("requestMessageStatus","Please describe what you need changed.");
    return;
  }

  setText("requestMessageStatus","Submitting request...");

  let imageUrl = null;

  if(file){
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g,"-");
    const filePath = `${activeClientUserId}/${Date.now()}-${safeName}`;

    const { error: uploadError } = await db.storage
      .from("request-uploads")
      .upload(filePath, file, { upsert:false });

    if(uploadError){
      console.error("Image upload error:", uploadError);
      setText("requestMessageStatus","Image upload failed. Check the request-uploads bucket.");
      return;
    }

    const { data } = db.storage
      .from("request-uploads")
      .getPublicUrl(filePath);

    imageUrl = data?.publicUrl || null;
  }

  const payload = {
    client_user_id:activeClientUserId,
    client_email:currentUser.email,
    business_name:clientSite?.business_name || "",
    request_type:type,
    page,
    message,
    image_url:imageUrl,
    status:"new",
    created_at:new Date().toISOString()
  };

  const { error } = await db.from("change_requests").insert(payload);

  if(error){
    console.error("Change request error:", error);
    setText("requestMessageStatus","Request failed. Please try again.");
    return;
  }

  setText("requestMessageStatus","Request submitted successfully.");
  setValue("requestPage","");
  setValue("requestMessage","");
  if(fileInput) fileInput.value = "";

  await loadChangeRequests();
  renderRequests();
  renderOverview();
  renderSummaryStats();
}


function renderSupport(){
  const summaryBox = document.getElementById("supportSummary");
  const listBox = document.getElementById("supportList");

  const open = supportTickets.filter(t=>!["closed","resolved"].includes(String(t.status || "").toLowerCase())).length;
  const closed = supportTickets.filter(t=>["closed","resolved"].includes(String(t.status || "").toLowerCase())).length;
  const urgent = supportTickets.filter(t=>String(t.priority || "").toLowerCase() === "urgent").length;

  setText("ticketCountBadge", `${supportTickets.length} Ticket${supportTickets.length === 1 ? "" : "s"}`);

  if(summaryBox){
    summaryBox.innerHTML = `
      <div class="item"><strong>Open Tickets</strong><p class="small">${open}</p></div>
      <div class="item"><strong>Resolved Tickets</strong><p class="small">${closed}</p></div>
      <div class="item"><strong>Urgent Tickets</strong><p class="small">${urgent}</p></div>
    `;
  }

  if(!listBox) return;

  if(!supportTickets.length){
    listBox.innerHTML = `<div class="empty">No support tickets yet.</div>`;
    return;
  }

  listBox.innerHTML = supportTickets.map(ticket=>`
    <div class="item">
      <strong>${escapeHtml(ticket.subject || ticket.ticket_type || "Support Ticket")}</strong>
      <p class="small">${escapeHtml(ticket.message || "")}</p>
      <span class="badge ${getTicketBadgeClass(ticket.status)}">${escapeHtml(ticket.status || "open")}</span>
      <span class="badge ${getPriorityBadgeClass(ticket.priority)}">${escapeHtml(ticket.priority || "normal")}</span>
      ${ticket.admin_notes ? `<p class="small" style="margin-top:8px;"><strong>Admin Note:</strong> ${escapeHtml(ticket.admin_notes)}</p>` : ""}
      <p class="small">${timeAgo(ticket.created_at)}</p>
    </div>
  `).join("");
}

async function submitSupportTicket(){
  const ticketType = getSelectValue("ticketType");
  const priority = getSelectValue("ticketPriority");
  const subject = cleanValue("ticketSubject");
  const message = cleanValue("ticketMessage");

  if(!subject || !message){
    setText("ticketMessageStatus","Please enter a subject and describe the issue.");
    return;
  }

  const payload = {
    client_user_id:activeClientUserId,
    client_email:currentUser.email,
    business_name:clientSite?.business_name || "",
    ticket_type:ticketType,
    priority,
    subject,
    message,
    status:"open",
    created_at:new Date().toISOString()
  };

  const { error } = await db.from("support_tickets").insert(payload);

  if(error){
    console.error("Support ticket error:", error);
    setText("ticketMessageStatus","Support ticket failed. Please try again.");
    return;
  }

  setText("ticketMessageStatus","Support ticket submitted successfully.");
  setValue("ticketSubject","");
  setValue("ticketMessage","");

    await loadSupportTickets();
  renderSupport();
  renderOverview();
  renderSummaryStats();
}

function renderBilling(){
  const billing = getBillingStatus(clientSite || {});
  setBadge("billingMiniBadge", billing.text, billing.class);

  const detailsBox = document.getElementById("billingDetails");
  const planBox = document.getElementById("planDetails");

  if(detailsBox){
    detailsBox.innerHTML = `
      <div class="item"><strong>Status</strong><p class="small">${billing.text}</p></div>
      <div class="item"><strong>Next Payment</strong><p class="small">${formatDate(clientSite?.next_payment_date)}</p></div>
      <div class="item"><strong>Last Payment</strong><p class="small">${formatDate(clientSite?.last_payment_date)}</p></div>
      <div class="item"><strong>Billing Cycle</strong><p class="small">${escapeHtml(clientSite?.billing_cycle || "Monthly")}</p></div>
    `;
  }

  if(planBox){
    planBox.innerHTML = `
      <div class="item"><strong>Plan</strong><p class="small">${escapeHtml(clientSite?.package_name || "Website Plan")}</p></div>
      <div class="item"><strong>Website Status</strong><p class="small">${escapeHtml(clientSite?.site_status || "Setup")}</p></div>
      <div class="item"><strong>Editor Access</strong><p class="small">${escapeHtml(clientSite?.editor_access || "Safe Mode")}</p></div>
      <div class="item"><strong>Domain</strong><p class="small">${escapeHtml(clientSite?.domain || "No domain connected")}</p></div>
    `;
  }
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

  if(clientSite?.site_url) return clientSite.site_url;
  if(clientSite?.live_url) return clientSite.live_url;
  if(clientSite?.published_url) return clientSite.published_url;
  if(clientSite?.client_user_id) return `${LIVE_BASE_URL}/?client=${clientSite.client_user_id}`;

  return "#";
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

  const next = site.next_payment_date ? new Date(site.next_payment_date + "T00:00:00") : null;

  if(next && next < today){
    return { text:"Past Due", class:"bad" };
  }

  return { text:"Active", class:"good" };
}

function getSEOMessage(score){
  if(score >= 80) return "Your website has a strong SEO foundation. Keep sharing your website and building traffic.";
  if(score >= 60) return "Your SEO is off to a good start. A few improvements can make it stronger.";
  return "Your SEO needs more information. Add a strong title, description, location, and preview image.";
}

function getTicketBadgeClass(status){
  const s = String(status || "").toLowerCase();
  if(s === "closed" || s === "resolved") return "good";
  if(s === "in progress") return "warn";
  return "bad";
}

function getPriorityBadgeClass(priority){
  const p = String(priority || "").toLowerCase();
  if(p === "urgent") return "bad";
  if(p === "high") return "warn";
  return "";
}

function getLast30DayEvents(){
  return analyticsEvents.filter(event=>isWithinDays(event.created_at,30));
}

function getLast30DayLeads(){
  return leadEvents.filter(lead=>isWithinDays(lead.created_at,30));
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
  if(el) el.href = url || "#";
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

function getSelectValue(id){
  const el = document.getElementById(id);
  return el ? el.value : "all";
}

function escapeHtml(value){
  return String(value || "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

function escapeAttribute(value){
  return String(value || "")
    .replaceAll("&","&amp;")
    .replaceAll('"',"&quot;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;");
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
  if(!dateString) return false;
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

function getVisitorLocationLabel(event){
  const region = event.visitor_region || "";
  const country = event.visitor_country || "";
  const timezone = event.visitor_timezone || "";

  if(region && country) return `${region}, ${country}`;
  if(country) return country;
  if(timezone) return timezone;

  return "Unknown location";
}

function getTopLocation(events){
  const counts = {};

  events.forEach(event=>{
    const location = getVisitorLocationLabel(event);
    counts[location] = (counts[location] || 0) + 1;
  });

  return Object.entries(counts).sort((a,b)=>b[1]-a[1])[0]?.[0] || "Unknown location";
}

function getTopCountry(events){
  const counts = {};

  events.forEach(event=>{
    const country = event.visitor_country || "Unknown country";
    counts[country] = (counts[country] || 0) + 1;
  });

  return Object.entries(counts).sort((a,b)=>b[1]-a[1])[0]?.[0] || "Unknown country";
}

function getTopRegion(events){
  const counts = {};

  events.forEach(event=>{
    const region = event.visitor_region || "Unknown state/region";
    counts[region] = (counts[region] || 0) + 1;
  });

  return Object.entries(counts).sort((a,b)=>b[1]-a[1])[0]?.[0] || "Unknown state/region";
}

/* Replaces the existing renderOverview() so location appears in the dashboard summary */
function renderOverview(){
  const monthEvents = getLast30DayEvents();
  const topPage = getTopValue(monthEvents,"page") || "your site";
  const topSource = getTopReferrer(monthEvents);
  const topLocation = getTopLocation(monthEvents);
  const leads = getLast30DayLeads().length;

  setText(
    "summaryText",
    `In the last 30 days, your website received ${monthEvents.length} visit${monthEvents.length === 1 ? "" : "s"} and ${leads} lead${leads === 1 ? "" : "s"}. Your top page is ${topPage}, your top traffic source is ${topSource}, and your top visitor location is ${topLocation}.`
  );

  renderChart("overviewChart", monthEvents);
  renderActivity();
}

/* Replaces the existing renderAnalytics() so clients get a better location summary */
function renderAnalytics(){
  const monthEvents = getLast30DayEvents();
  const week = analyticsEvents.filter(e=>isWithinDays(e.created_at,7)).length;

  setText("analyticsTotal", monthEvents.length);
  setText("analyticsWeek", week);
  setText("analyticsSource", getTopReferrer(monthEvents));
  setText("analyticsDevice", getTopValue(monthEvents,"device") || "—");

  /* These only show if you later add matching IDs in dashboard.html */
  setText("analyticsLocation", getTopLocation(monthEvents));
  setText("analyticsRegion", getTopRegion(monthEvents));
  setText("analyticsCountry", getTopCountry(monthEvents));

  renderChart("analyticsChart", monthEvents);
  setupVisitFilters();
  renderVisitsList();
}

/* Replaces the existing renderVisitsList() so every visit card shows location */
function renderVisitsList(){
  const box = document.getElementById("visitsList");
  if(!box) return;

  const month = getSelectValue("visitMonthFilter");
  const source = getSelectValue("visitSourceFilter");
  const device = getSelectValue("visitDeviceFilter");
  const page = getSelectValue("visitPageFilter");

  let data = [...analyticsEvents];

  data = data.filter(event=>{
    const eventMonth = new Date(event.created_at).toISOString().slice(0,7);
    const eventSource = cleanReferrer(event.referrer);
    const eventDevice = event.device || "unknown";
    const eventPage = event.page || "unknown";

    return (
      (month === "all" || eventMonth === month) &&
      (source === "all" || eventSource === source) &&
      (device === "all" || eventDevice === device) &&
      (page === "all" || eventPage === page)
    );
  });

  setText("visitCountBadge", `${data.length} Visit${data.length === 1 ? "" : "s"}`);

  if(!data.length){
    box.innerHTML = `<div class="empty">No visits match these filters.</div>`;
    return;
  }

  box.innerHTML = data.map(event=>`
    <div class="item">
      <strong>${escapeHtml(event.page || "Website Visit")}</strong>
      <div class="small">Source: ${escapeHtml(cleanReferrer(event.referrer))}</div>
      <div class="small">Device: ${escapeHtml(event.device || "Unknown")} • Browser: ${escapeHtml(event.browser || "Unknown")}</div>
      <div class="small">Location: ${escapeHtml(getVisitorLocationLabel(event))}</div>
      <div class="small">Path: ${escapeHtml(event.path || "—")}</div>
      <div class="small">${timeAgo(event.created_at)}</div>
    </div>
  `).join("");
}

/* Optional: location will also appear in the activity feed for website visits */
function renderActivity(){
  const box = document.getElementById("activityFeed");
  if(!box) return;

  const combined = [
    ...analyticsEvents.map(e => ({ ...e, type:"visit" })),
    ...leadEvents.map(l => ({ ...l, type:"lead" })),
    ...changeRequests.map(r => ({ ...r, type:"request" })),
    ...supportTickets.map(t => ({ ...t, type:"support" }))
  ];

  const sorted = combined
    .filter(item => item.created_at)
    .sort((a,b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0,12);

  if(!sorted.length){
    box.innerHTML = `<div class="empty">No activity yet. Once your site gets visits, leads, requests, or tickets, they’ll show here.</div>`;
    return;
  }

  box.innerHTML = sorted.map(item => {
    let title = "Website Visit";
    let detail = `${escapeHtml(item.page || "Website")} • ${escapeHtml(cleanReferrer(item.referrer))} • ${escapeHtml(getVisitorLocationLabel(item))}`;
    let pill = "Visitor Activity";

    if(item.type === "lead"){
      title = "New Website Lead";
      detail = `${escapeHtml(item.form_name || "Website form")} • ${escapeHtml(item.page || "Unknown page")}`;
      pill = "New Lead";
    }

    if(item.type === "request"){
      title = "Change Request Submitted";
      detail = `${escapeHtml(item.request_type || "Request")} • ${escapeHtml(item.page || "Website")}`;
      pill = escapeHtml(item.status || "new");
    }

    if(item.type === "support"){
      title = "Support Ticket Opened";
      detail = `${escapeHtml(item.subject || item.ticket_type || "Support ticket")}`;
      pill = escapeHtml(item.priority || item.status || "open");
    }

    return `
      <div class="item">
        <strong>${title}</strong>
        <div class="small">${detail}</div>
        <div class="small">${timeAgo(item.created_at)}</div>
        <span class="badge">${pill}</span>
      </div>
    `;
  }).join("");
}
