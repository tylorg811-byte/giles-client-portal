function setText(id,value){
  const el = document.getElementById(id);
  if(el) el.textContent = value;
}

function setValue(id,value){
  const el = document.getElementById(id);
  if(el) el.value = value || "";
}

function cleanValue(id){
  const el = document.getElementById(id);
  return el ? el.value.trim() : "";
}

function getBillingStatus(site){
  if(site.billing_override) return { text:"Covered by Giles", class:"full" };
  if(site.billing_status === "past due") return { text:"Past Due", class:"danger" };
  if(site.billing_status === "free") return { text:"Free", class:"safe" };
  if(site.billing_status === "manual paid") return { text:"Manual Paid", class:"full" };
  if(site.billing_status === "trial") return { text:"Trial", class:"safe" };
  if(site.billing_status === "paused") return { text:"Paused", class:"dark" };

  const today = new Date();
  today.setHours(0,0,0,0);

  const next = site.next_payment_date
    ? new Date(site.next_payment_date + "T00:00:00")
    : null;

  if(next && next < today){
    return { text:"Past Due", class:"danger" };
  }

  return { text:"Active", class:"full" };
}

let adminUser = null;
let clientSites = [];
let changeRequests = [];
let analyticsEvents = [];
let leadEvents = [];

const LIVE_BASE_URL = "https://giles-sites.netlify.app";

document.addEventListener("DOMContentLoaded", loadAdminDashboard);

/* =========================
   INIT
========================= */
async function loadAdminDashboard(){
  adminUser = await checkUser();
  if(!adminUser) return;

  setText("adminEmail", adminUser.email);

  const isAdmin = await checkAdminAccess();

  if(!isAdmin){
    document.querySelector(".main").innerHTML = `
      <section class="card">
        <h1>Admin access required</h1>
        <p>You must be an approved admin to view this page.</p>
      </section>
    `;
    return;
  }

  await refreshAdminData();

  populateAnalyticsClientDropdown();
  populateSEOClientDropdown();
  loadClientAnalyticsView();
}

/* =========================
   NAVIGATION
========================= */
function showAdminPage(page){
  document.querySelectorAll(".page-section").forEach(section=>{
    section.classList.remove("active");
  });

  document.querySelectorAll(".sidebar button").forEach(button=>{
    button.classList.remove("active-nav");
  });

  const pageEl = document.getElementById(`${page}Page`);
  if(pageEl) pageEl.classList.add("active");

  const navEl = document.getElementById(`nav${capitalize(page)}`);
  if(navEl) navEl.classList.add("active-nav");

  const titles = {
    clients:"Client Websites",
    clientDetail:"Client Details",
    importer:"Website Importer",
    seo:"SEO Panel",
    analytics:"Analytics",
    requests:"Change Requests",
    billing:"Billing"
  };

  setText("pageTitle", titles[page] || "Admin Console");

  if(page === "seo"){
    populateSEOClientDropdown();
    loadSEOClient();
  }

  if(page === "analytics"){
    renderAnalyticsOverviewFull();
    populateAnalyticsClientDropdown();
    loadClientAnalyticsView();
  }

  if(page === "requests"){
    renderChangeRequests();
  }

  if(page === "billing"){
    renderBillingOverview();
  }

  if(window.innerWidth <= 1150){
    document.body.classList.remove("sidebar-open");
  }
}

/* =========================
   AUTH
========================= */
async function checkAdminAccess(){
  const { data, error } = await db
    .from("admin_users")
    .select("*")
    .eq("user_id", adminUser.id)
    .single();

  return !!data && !error;
}

/* =========================
   LOAD DATA
========================= */
async function refreshAdminData(){
  await loadClientSites();
  await loadChangeRequests();
  await loadAnalytics();
  await loadLeads();

  renderStats();
  renderSmartAlerts();
  applyClientFilters();
  renderChangeRequests();
  renderAnalyticsOverviewFull();
  populateAnalyticsClientDropdown();
  populateSEOClientDropdown();
  renderBillingOverview();
}

async function loadClientSites(){
  const { data, error } = await db
    .from("client_sites")
    .select("*")
    .order("created_at", { ascending:false });

  if(error){
    console.error(error);
    const list = document.getElementById("clientList");
    if(list) list.innerHTML = `<div class="empty-state">Could not load clients.</div>`;
    return;
  }

  clientSites = data || [];
}

async function loadChangeRequests(){
  const { data, error } = await db
    .from("change_requests")
    .select("*")
    .order("created_at", { ascending:false });

  if(error){
    console.error(error);
    const list = document.getElementById("changeRequestList");
    if(list) list.innerHTML = `<div class="empty-state">Could not load change requests.</div>`;
    return;
  }

  changeRequests = data || [];
}

async function loadAnalytics(){
  const since = new Date();
  since.setDate(since.getDate() - 30);

  const { data, error } = await db
    .from("site_analytics_events")
    .select("*")
    .gte("created_at", since.toISOString())
    .order("created_at", { ascending:false });

  if(error){
    console.error(error);
    analyticsEvents = [];
    return;
  }

  analyticsEvents = data || [];
}

async function loadLeads(){
  const since = new Date();
  since.setDate(since.getDate() - 30);

  const { data, error } = await db
    .from("site_leads")
    .select("*")
    .gte("created_at", since.toISOString())
    .order("created_at", { ascending:false });

  if(error){
    console.warn("Leads not loaded. Make sure site_leads exists.", error);
    leadEvents = [];
    return;
  }

  leadEvents = data || [];
}

/* =========================
   STATS + ALERTS
========================= */
function renderStats(){
  setText("totalClients", clientSites.length);

  setText(
    "publishedClients",
    clientSites.filter(site=>site.site_status === "published").length
  );

  setText(
    "pastDueClients",
    clientSites.filter(site=>getBillingStatus(site).text === "Past Due").length
  );

  setText(
    "newRequests",
    changeRequests.filter(req=>req.status === "new").length
  );
}

function renderSmartAlerts(){
  const box = document.getElementById("smartAlerts");
  if(!box) return;

  const pastDue = clientSites.filter(site=>getBillingStatus(site).text === "Past Due").length;
  const pendingDomains = clientSites.filter(site=>site.domain_status === "pending").length;
  const newRequests = changeRequests.filter(req=>req.status === "new").length;
  const lockedEditors = clientSites.filter(site=>site.editor_locked).length;
  const leadsToday = leadEvents.filter(lead=>isToday(lead.created_at)).length;
  const lowSeo = clientSites.filter(site=>Number(site.seo_score || 0) < 60).length;

  const alerts = [];

  if(pastDue) alerts.push(`<span class="badge danger">⚠️ ${pastDue} Past Due</span>`);
  if(pendingDomains) alerts.push(`<span class="badge safe">🌐 ${pendingDomains} Domains Pending</span>`);
  if(newRequests) alerts.push(`<span class="badge safe">💬 ${newRequests} New Requests</span>`);
  if(lockedEditors) alerts.push(`<span class="badge danger">🔒 ${lockedEditors} Editor Locks</span>`);
  if(leadsToday) alerts.push(`<span class="badge full">🔥 ${leadsToday} Leads Today</span>`);
  if(lowSeo) alerts.push(`<span class="badge safe">🔎 ${lowSeo} SEO Needs Review</span>`);

  if(!alerts.length){
    box.innerHTML = `
      <div style="display:flex;justify-content:space-between;gap:16px;align-items:center;">
        <div>
          <h2 style="margin-bottom:6px;">Command Center</h2>
          <p style="color:#64748b;">Everything looks good right now.</p>
        </div>
        <span class="badge full">✅ Healthy</span>
      </div>
    `;
    return;
  }

  box.innerHTML = `
    <div style="display:flex;justify-content:space-between;gap:16px;align-items:flex-start;flex-wrap:wrap;">
      <div>
        <h2 style="margin-bottom:6px;">Command Center</h2>
        <p style="color:#64748b;">Items that need your attention.</p>
      </div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;">
        ${alerts.join("")}
      </div>
    </div>
  `;
}

/* =========================
   FILTERS
========================= */
function applyClientFilters(){
  const search = cleanValue("clientSearch").toLowerCase();
  const billing = cleanValue("billingFilter") || "all";
  const siteStatus = cleanValue("siteStatusFilter") || "all";
  const access = cleanValue("editorAccessFilter") || "all";
  const domain = cleanValue("domainFilter") || "all";

  let filtered = [...clientSites];

  filtered = filtered.filter(site=>{
    const searchable = [
      site.business_name,
      site.client_email,
      site.domain,
      site.client_tags,
      site.package_name,
      site.business_type,
      site.business_location,
      site.seo_title
    ].join(" ").toLowerCase();

    const billingText = getBillingStatus(site).text.toLowerCase();

    const matchSearch = searchable.includes(search);

    const matchBilling =
      billing === "all" ||
      (billing === "past" && billingText === "past due") ||
      (billing === "covered" && billingText === "covered by giles") ||
      (billing === "active" && billingText === "active") ||
      site.billing_status === billing;

    const matchSite = siteStatus === "all" || site.site_status === siteStatus;
    const matchAccess = access === "all" || site.editor_access === access;
    const matchDomain = domain === "all" || site.domain_status === domain;

    return matchSearch && matchBilling && matchSite && matchAccess && matchDomain;
  });

  renderClientSites(filtered);
}

/* =========================
   CLIENT CARDS — REDESIGNED
========================= */
function renderClientSites(sites){
  const list = document.getElementById("clientList");
  if(!list) return;

  list.innerHTML = "";

  if(!sites.length){
    list.innerHTML = `<div class="empty-state">No clients found.</div>`;
    return;
  }

  sites.forEach(site=>{
    const billing = getBillingStatus(site);
    const liveUrl = getClientLiveUrl(site);
    const analytics = site.client_user_id ? getClientAnalytics(site.client_user_id) : null;
    const leads = site.client_user_id ? getClientLeads(site.client_user_id) : null;

    const seoScore = Number(site.seo_score || 0);
    const seoClass = seoScore >= 80 ? "full" : seoScore >= 60 ? "safe" : "danger";

    const initials = getInitials(site.business_name || site.client_email || "Client");

    const card = document.createElement("div");
    card.className = "client-card";

    card.innerHTML = `
      <div>
        <div style="display:flex;gap:14px;align-items:center;margin-bottom:14px;">
          <div style="
            width:54px;
            height:54px;
            border-radius:18px;
            background:linear-gradient(135deg,#7B5CFF,#A78BFA);
            color:white;
            display:flex;
            align-items:center;
            justify-content:center;
            font-weight:900;
            font-size:18px;
            box-shadow:0 14px 28px rgba(123,92,255,.25);
          ">${escapeHtml(initials)}</div>

          <div>
            <div class="card-group-title">Client</div>
            <h3>${escapeHtml(site.business_name || "Unnamed Business")}</h3>
          </div>
        </div>

        <p>${escapeHtml(site.client_email || "No email")}</p>
        <p>${escapeHtml(site.domain || "No domain")}</p>

        <div style="margin-top:12px;">
          <span class="badge">${escapeHtml(site.package_name || "Package")}</span>
          <span class="badge ${billing.class}">${billing.text}</span>
          <span class="badge ${seoClass}">SEO ${seoScore}/100</span>
          ${site.editor_locked ? `<span class="badge danger">Editor Locked</span>` : ""}
        </div>

        ${site.client_tags ? `<p style="margin-top:10px;"><strong>Tags:</strong> ${escapeHtml(site.client_tags)}</p>` : ""}
      </div>

      <div>
        <div class="card-group-title">Website</div>
        <p><strong>Status:</strong> ${escapeHtml(site.site_status || "draft")}</p>
        <p><strong>Editor:</strong> ${escapeHtml(site.editor_access || "safe")}</p>
        <p><strong>Domain:</strong> ${escapeHtml(site.domain_status || "not connected")}</p>
        <p><strong>Type:</strong> ${escapeHtml(site.business_type || "—")}</p>
      </div>

      <div>
        <div class="card-group-title">Performance</div>
        <p><strong>Views:</strong> ${analytics ? analytics.month : 0} / 30d</p>
        <p><strong>Leads:</strong> ${leads ? leads.month : 0} / 30d</p>
        <p><strong>Top Page:</strong> ${analytics ? escapeHtml(analytics.topPage) : "—"}</p>
        <p><strong>Next:</strong> ${formatDate(site.next_payment_date)}</p>
      </div>

      <div class="actions">
        <button onclick="openClientDetail('${site.id}')">View</button>
        <button onclick="editClientSite('${site.id}')">Edit</button>

        <a href="${liveUrl}" target="_blank">Live</a>
        <a href="editor.html?client=${site.client_user_id || ""}" target="_blank">Editor</a>

        <button onclick="openSEOForClient('${site.client_user_id || ""}')">SEO</button>
        <button onclick="createCheckoutForClient('${site.id}')">Stripe</button>

        <button onclick="quickPublish('${site.id}')">Publish</button>
        <button onclick="quickPause('${site.id}')">Pause</button>

        <button onclick="quickMarkPaid('${site.id}')">Mark Paid</button>
        <button onclick="toggleSafeMode('${site.id}')">Safe/Full</button>

        <button onclick="toggleEditorLock('${site.id}')">${site.editor_locked ? "Unlock" : "Lock"}</button>
        <button onclick="copyText('${liveUrl}')">Copy Link</button>

        ${site.domain ? `<button class="release-btn wide" onclick="releaseDomain('${site.id}')">Release Domain</button>` : ""}
        <button class="danger wide" onclick="deleteClientSite('${site.id}')">Delete Client</button>
      </div>
    `;
/* =========================
   QUICK ACTIONS
========================= */
async function quickPublish(id){
  await updateClientQuick(id, { site_status:"published" }, "Client marked as published.");
}

async function quickPause(id){
  await updateClientQuick(id, { site_status:"paused" }, "Client site paused.");
}

async function quickMarkPaid(id){
  const today = new Date();
  const next = new Date();
  next.setMonth(next.getMonth() + 1);

  await updateClientQuick(id, {
    billing_status:"active",
    billing_override:false,
    last_payment_date:toDateInput(today),
    next_payment_date:toDateInput(next)
  }, "Payment marked as received.");
}

async function toggleSafeMode(id){
  const site = clientSites.find(item=>item.id === id);
  if(!site) return;

  const nextAccess = site.editor_access === "full" ? "safe" : "full";

  await updateClientQuick(id, {
    editor_access:nextAccess
  }, `Editor access changed to ${nextAccess}.`);
}

async function toggleEditorLock(id){
  const site = clientSites.find(item=>item.id === id);
  if(!site) return;

  let reason = "";

  if(!site.editor_locked){
    reason = prompt("Reason for locking editor?", "Non-payment / safety / request") || "";
  }

  await updateClientQuick(id, {
    editor_locked:!site.editor_locked,
    editor_locked_reason:!site.editor_locked ? reason : ""
  }, site.editor_locked ? "Editor unlocked." : "Editor locked.");
}

async function updateClientQuick(id, updates, message){
  const { error } = await db
    .from("client_sites")
    .update({
      ...updates,
      updated_at:new Date().toISOString()
    })
    .eq("id", id);

  if(error){
    console.error(error);
    alert("Update failed.");
    return;
  }

  await refreshAdminData();
}

/* =========================
   CLIENT FORM
========================= */
async function saveClientSite(){
  const id = cleanValue("clientRecordId");

  const payload = {
    business_name: cleanValue("businessName"),
    client_email: cleanValue("clientEmail"),
    client_user_id: cleanValue("clientUserId") || null,
    package_name: cleanValue("packageName"),
    business_type: cleanValue("businessType"),
    business_location: cleanValue("businessLocation"),
    domain: cleanValue("domain"),
    domain_status: cleanValue("domainStatus"),
    domain_release_status: cleanValue("domainReleaseStatus"),
    site_status: cleanValue("siteStatus"),
    editor_access: cleanValue("editorAccess"),
    editor_locked: cleanValue("editorLocked") === "true",
    editor_locked_reason: cleanValue("editorLockedReason"),
    billing_status: cleanValue("billingStatus"),
    billing_override: cleanValue("billingOverride") === "true",
    billing_cycle: cleanValue("billingCycle"),
    next_payment_date: cleanValue("nextPaymentDate") || null,
    last_payment_date: cleanValue("lastPaymentDate") || null,
    client_tags: cleanValue("clientTags"),
    billing_override_reason: cleanValue("billingOverrideReason"),
    billing_notes: cleanValue("billingNotes"),
    domain_release_notes: cleanValue("domainReleaseNotes"),
    notes: cleanValue("notes"),
    updated_at:new Date().toISOString()
  };

  let response;

  if(id){
    response = await db.from("client_sites").update(payload).eq("id", id);
  } else {
    response = await db.from("client_sites").insert(payload);
  }

  if(response.error){
    console.error(response.error);
    setText("message", "Save failed.");
    return;
  }

  setText("message", "Client saved.");
  clearClientForm();
  await refreshAdminData();
}

function editClientSite(id){
  const site = clientSites.find(s=>s.id === id);
  if(!site) return;

  setValue("clientRecordId", site.id);
  setValue("businessName", site.business_name);
  setValue("clientEmail", site.client_email);
  setValue("clientUserId", site.client_user_id);
  setValue("packageName", site.package_name);
  setValue("businessType", site.business_type);
  setValue("businessLocation", site.business_location);
  setValue("domain", site.domain);
  setValue("domainStatus", site.domain_status);
  setValue("domainReleaseStatus", site.domain_release_status);
  setValue("siteStatus", site.site_status);
  setValue("editorAccess", site.editor_access);
  setValue("editorLocked", site.editor_locked ? "true" : "false");
  setValue("editorLockedReason", site.editor_locked_reason);
  setValue("billingStatus", site.billing_status);
  setValue("billingOverride", site.billing_override ? "true" : "false");
  setValue("billingCycle", site.billing_cycle);
  setValue("nextPaymentDate", site.next_payment_date);
  setValue("lastPaymentDate", site.last_payment_date);
  setValue("clientTags", site.client_tags);
  setValue("billingOverrideReason", site.billing_override_reason);
  setValue("billingNotes", site.billing_notes);
  setValue("domainReleaseNotes", site.domain_release_notes);
  setValue("notes", site.notes);

  scrollToForm();
}

function clearClientForm(){
  document.querySelectorAll("#clientFormWrap input, #clientFormWrap textarea").forEach(i=>i.value="");
  setText("message","");
}

function toggleClientForm(){
  const wrap = document.getElementById("clientFormWrap");
  wrap.style.display = wrap.style.display === "none" ? "block" : "none";
}

function closeClientForm(){
  document.getElementById("clientFormWrap").style.display = "none";
}

function scrollToForm(){
  document.getElementById("clientFormCard").scrollIntoView({behavior:"smooth"});
}

/* =========================
   ANALYTICS
========================= */
function renderAnalyticsOverviewFull(){
  const el = document.getElementById("analyticsOverview");
  if(!el) return;

  const total = analyticsEvents.length;
  const today = analyticsEvents.filter(e=>isToday(e.created_at)).length;
  const week = analyticsEvents.filter(e=>isWithinDays(e.created_at,7)).length;
  const leads = leadEvents.length;

  el.innerHTML = `
    <div class="analytics-header-grid">
      <div class="stat"><span>Total</span><strong>${total}</strong></div>
      <div class="stat"><span>Today</span><strong>${today}</strong></div>
      <div class="stat"><span>7 Days</span><strong>${week}</strong></div>
      <div class="stat"><span>Leads</span><strong>${leads}</strong></div>
    </div>
  `;
}

function loadClientAnalyticsView(){
  const select = document.getElementById("analyticsClientSelect");
  const container = document.getElementById("analyticsClientView");

  if(!select || !container) return;

  const id = select.value;

  const events = analyticsEvents.filter(e=>e.client_user_id === id);
  const leads = leadEvents.filter(l=>l.client_user_id === id);

  container.innerHTML = `
    <div class="analytics-header-grid">
      <div class="stat"><span>Views</span><strong>${events.length}</strong></div>
      <div class="stat"><span>Leads</span><strong>${leads.length}</strong></div>
      <div class="stat"><span>Top Page</span><strong>${getTopValue(events,"page") || "—"}</strong></div>
      <div class="stat"><span>Device</span><strong>${getTopValue(events,"device") || "—"}</strong></div>
    </div>
  `;
}

/* =========================
   BILLING
========================= */
function renderBillingOverview(){
  const el = document.getElementById("billingOverview");
  if(!el) return;

  const active = clientSites.filter(s=>getBillingStatus(s).text==="Active").length;
  const past = clientSites.filter(s=>getBillingStatus(s).text==="Past Due").length;

  el.innerHTML = `
    <div class="grid">
      <div class="stat"><span>Active</span><strong>${active}</strong></div>
      <div class="stat"><span>Past Due</span><strong>${past}</strong></div>
    </div>
  `;
}

     /* =========================
   CLIENT DETAIL
========================= */
function openClientDetail(id){
  const site = clientSites.find(s=>s.id === id);
  if(!site) return;

  showAdminPage("clientDetail");

  setText("detailBusinessName", site.business_name || "Client Details");
  setText("detailClientEmail", site.client_email || "");

  const billing = getBillingStatus(site);
  const analytics = site.client_user_id ? getClientAnalytics(site.client_user_id) : null;
  const leads = site.client_user_id ? getClientLeads(site.client_user_id) : null;

  document.getElementById("clientDetailContent").innerHTML = `
    <div class="detail-grid">
      <div class="detail-card">
        <h3>Website</h3>
        <div class="detail-row"><span>Status</span><span>${escapeHtml(site.site_status || "draft")}</span></div>
        <div class="detail-row"><span>Domain</span><span>${escapeHtml(site.domain || "—")}</span></div>
        <div class="detail-row"><span>Editor</span><span>${escapeHtml(site.editor_access || "safe")}</span></div>
        <div class="detail-row"><span>Lock</span><span>${site.editor_locked ? "Locked" : "Unlocked"}</span></div>
        <div class="detail-row"><span>SEO</span><span>${site.seo_score || 0}/100</span></div>

        <div style="margin-top:16px;display:flex;gap:10px;flex-wrap:wrap;">
          <a class="primary" href="${getClientLiveUrl(site)}" target="_blank">Open Site</a>
          <a class="secondary" href="editor.html?client=${site.client_user_id || ""}" target="_blank">Editor</a>
          <button class="secondary" onclick="openSEOForClient('${site.client_user_id || ""}')">SEO</button>
        </div>
      </div>

      <div class="detail-card">
        <h3>Billing</h3>
        <div class="detail-row"><span>Status</span><span>${billing.text}</span></div>
        <div class="detail-row"><span>Cycle</span><span>${escapeHtml(site.billing_cycle || "monthly")}</span></div>
        <div class="detail-row"><span>Last</span><span>${formatDate(site.last_payment_date)}</span></div>
        <div class="detail-row"><span>Next</span><span>${formatDate(site.next_payment_date)}</span></div>
      </div>

      <div class="detail-card">
        <h3>Performance</h3>
        <div class="detail-row"><span>Views 30d</span><span>${analytics ? analytics.month : 0}</span></div>
        <div class="detail-row"><span>Leads 30d</span><span>${leads ? leads.month : 0}</span></div>
        <div class="detail-row"><span>Top Page</span><span>${analytics ? escapeHtml(analytics.topPage) : "—"}</span></div>
      </div>

      <div class="detail-card">
        <h3>Notes</h3>
        <p>${escapeHtml(site.notes || "No notes.")}</p>
      </div>
    </div>
  `;
}

/* =========================
   SEO PANEL
========================= */
function populateSEOClientDropdown(){
  const select = document.getElementById("seoClientSelect");
  if(!select) return;

  select.innerHTML = "";

  clientSites.forEach(site=>{
    if(!site.client_user_id) return;
    const option = document.createElement("option");
    option.value = site.client_user_id;
    option.textContent = site.business_name || site.client_email || site.client_user_id;
    select.appendChild(option);
  });

  if(!select.innerHTML){
    select.innerHTML = `<option value="">No clients available</option>`;
  }
}

function loadSEOClient(){
  const select = document.getElementById("seoClientSelect");
  if(!select) return;

  const site = clientSites.find(s=>s.client_user_id === select.value);
  if(!site) return;

  setValue("seoImage", site.seo_image);
  setValue("seoBusinessType", site.business_type);
  setValue("seoBusinessLocation", site.business_location);
  setValue("seoTitle", site.seo_title);
  setValue("seoDescription", site.seo_description);
  setValue("seoKeywords", site.seo_keywords);

  updateSEOPreview();
  updateSEOScoreDisplay(site.seo_score || 0);
}

function openSEOForClient(clientUserId){
  showAdminPage("seo");
  populateSEOClientDropdown();

  const select = document.getElementById("seoClientSelect");
  if(select && clientUserId) select.value = clientUserId;

  loadSEOClient();
}

function autoGenerateSEO(){
  const select = document.getElementById("seoClientSelect");
  if(!select) return;

  const site = clientSites.find(s=>s.client_user_id === select.value);
  if(!site){
    setText("seoMessage","Choose a client first.");
    return;
  }

  const type = cleanValue("seoBusinessType") || site.business_type || "Business";
  const location = cleanValue("seoBusinessLocation") || site.business_location || "";
  const name = site.business_name || "Business";

  const title = location
    ? `${name} | ${type} in ${location}`
    : `${name} | ${type} Website`;

  const description = location
    ? `${name} provides professional ${type.toLowerCase()} services in ${location}. Contact today to learn more.`
    : `${name} provides professional ${type.toLowerCase()} services. Contact today to learn more.`;

  const keywords = [
    name,
    type,
    location,
    `${type} near me`,
    `affordable ${type}`,
    `${name} website`
  ].filter(Boolean).join(", ");

  setValue("seoTitle", title);
  setValue("seoDescription", description);
  setValue("seoKeywords", keywords);

  scoreSEO();
  updateSEOPreview();
  setText("seoMessage","SEO generated. Review and save.");
}

function scoreSEO(){
  const score = calculateSEOScore(
    cleanValue("seoTitle"),
    cleanValue("seoDescription"),
    cleanValue("seoKeywords"),
    cleanValue("seoImage"),
    cleanValue("seoBusinessType"),
    cleanValue("seoBusinessLocation")
  );

  updateSEOScoreDisplay(score);
  updateSEOPreview();
  setText("seoMessage", `SEO score updated: ${score}/100`);
  return score;
}

function calculateSEOScore(title,description,keywords,image,type,location){
  let score = 0;

  if(title) score += 20;
  if(title.length >= 35 && title.length <= 70) score += 10;

  if(description) score += 20;
  if(description.length >= 90 && description.length <= 180) score += 10;

  if(keywords) score += 10;
  if(keywords.split(",").filter(k=>k.trim()).length >= 4) score += 10;

  if(type) score += 10;
  if(location) score += 10;
  if(image) score += 10;

  return Math.min(score,100);
}

function updateSEOScoreDisplay(score){
  const scoreNum = Number(score || 0);
  const ring = document.getElementById("seoScoreRing");
  const text = document.getElementById("seoScoreText");
  const notes = document.getElementById("seoScoreNotes");

  if(text) text.textContent = scoreNum;

  const degrees = Math.round((scoreNum / 100) * 360);
  let color = "#ef4444";
  let message = "Needs work. Add title, description, keywords, type, location, and image.";

  if(scoreNum >= 80){
    color = "#16a34a";
    message = "Great SEO foundation. This client is ready to publish.";
  } else if(scoreNum >= 60){
    color = "#f97316";
    message = "Good start. Add a few missing details.";
  }

  if(ring){
    ring.style.background = `conic-gradient(${color} 0deg, ${color} ${degrees}deg, #e5e7eb ${degrees}deg)`;
  }

  if(notes) notes.textContent = message;
}

function updateSEOPreview(){
  const select = document.getElementById("seoClientSelect");
  const site = clientSites.find(s=>s.client_user_id === select?.value);

  setText("seoPreviewUrl", site ? getClientLiveUrl(site) : "https://clientsite.com");
  setText("seoPreviewTitle", cleanValue("seoTitle") || "SEO title preview");
  setText("seoPreviewDesc", cleanValue("seoDescription") || "SEO description preview will show here.");
}

async function saveSEO(){
  const select = document.getElementById("seoClientSelect");
  if(!select || !select.value){
    setText("seoMessage","Choose a client first.");
    return;
  }

  const score = scoreSEO();

  const payload = {
    business_type: cleanValue("seoBusinessType"),
    business_location: cleanValue("seoBusinessLocation"),
    seo_title: cleanValue("seoTitle"),
    seo_description: cleanValue("seoDescription"),
    seo_keywords: cleanValue("seoKeywords"),
    seo_image: cleanValue("seoImage"),
    seo_score: score,
    updated_at:new Date().toISOString()
  };

  const { error } = await db
    .from("client_sites")
    .update(payload)
    .eq("client_user_id", select.value);

  if(error){
    console.error(error);
    setText("seoMessage","SEO save failed.");
    return;
  }

  setText("seoMessage","SEO saved.");
  await refreshAdminData();
}

/* =========================
   ANALYTICS DROPDOWN
========================= */
function populateAnalyticsClientDropdown(){
  const select = document.getElementById("analyticsClientSelect");
  if(!select) return;

  select.innerHTML = "";

  clientSites.forEach(site=>{
    if(!site.client_user_id) return;
    const option = document.createElement("option");
    option.value = site.client_user_id;
    option.textContent = site.business_name || site.client_email || site.client_user_id;
    select.appendChild(option);
  });

  if(!select.innerHTML){
    select.innerHTML = `<option value="">No clients available</option>`;
  }
}

/* =========================
   CHANGE REQUESTS
========================= */
function renderChangeRequests(){
  const list = document.getElementById("changeRequestList");
  if(!list) return;

  list.innerHTML = "";

  if(!changeRequests.length){
    list.innerHTML = `<div class="empty-state">No change requests yet.</div>`;
    return;
  }

  changeRequests.forEach(req=>{
    const card = document.createElement("div");
    card.className = "request-card";

    const editorUrl = req.client_user_id ? `editor.html?client=${req.client_user_id}` : "editor.html";
    const liveUrl = req.client_user_id ? `${LIVE_BASE_URL}/?client=${req.client_user_id}` : LIVE_BASE_URL;

    card.innerHTML = `
      <div>
        <h3>${escapeHtml(req.business_name || req.client_email || "Client Request")}</h3>
        <p>${escapeHtml(req.client_email || "")}</p>
        <span class="badge">${escapeHtml(req.status || "new")}</span>
        <p>${timeAgo(req.created_at)}</p>
      </div>

      <div>
        <p><strong>${escapeHtml(req.request_type || "Request")}</strong></p>
        <p>${escapeHtml(req.message || "")}</p>
        ${req.admin_notes ? `<p><strong>Note:</strong> ${escapeHtml(req.admin_notes)}</p>` : ""}
      </div>

      <div>
        <label>Status</label>
        <select id="status-${req.id}">
          <option value="new" ${req.status === "new" ? "selected" : ""}>New</option>
          <option value="in progress" ${req.status === "in progress" ? "selected" : ""}>In Progress</option>
          <option value="done" ${req.status === "done" ? "selected" : ""}>Done</option>
        </select>

        <label style="margin-top:8px;">Admin Notes</label>
        <textarea id="notes-${req.id}">${escapeHtml(req.admin_notes || "")}</textarea>
      </div>

      <div class="actions">
        <button onclick="updateChangeRequest('${req.id}', '${req.client_user_id || ""}')">Update</button>
        <button onclick="completeRequest('${req.id}', '${req.client_user_id || ""}')">Complete</button>
        <a href="${editorUrl}" target="_blank">Editor</a>
        <a href="${liveUrl}" target="_blank">Live</a>
        <button class="danger wide" onclick="deleteChangeRequest('${req.id}')">Delete</button>
      </div>
    `;

    list.appendChild(card);
  });
}

async function updateChangeRequest(id, clientUserId){
  const status = cleanValue(`status-${id}`);
  const notes = cleanValue(`notes-${id}`);

  const { error } = await db
    .from("change_requests")
    .update({
      status,
      admin_notes:notes,
      updated_at:new Date().toISOString()
    })
    .eq("id", id);

  if(error){
    console.error(error);
    alert("Request update failed.");
    return;
  }

  await refreshAdminData();
}

async function completeRequest(id, clientUserId){
  const notes = cleanValue(`notes-${id}`) || "Completed by Giles Web Design.";

  const { error } = await db
    .from("change_requests")
    .update({
      status:"done",
      admin_notes:notes,
      updated_at:new Date().toISOString()
    })
    .eq("id", id);

  if(error){
    console.error(error);
    alert("Could not complete request.");
    return;
  }

  await refreshAdminData();
}

async function deleteChangeRequest(id){
  if(!confirm("Delete this change request?")) return;

  const { error } = await db
    .from("change_requests")
    .delete()
    .eq("id", id);

  if(error){
    console.error(error);
    alert("Delete failed.");
    return;
  }

  await refreshAdminData();
}

/* =========================
   STRIPE / CLIENT CREATION
========================= */
async function createClientAccount(){
  const email = prompt("Client Email:");
  if(!email) return;

  const businessName = prompt("Business Name:");
  if(!businessName) return;

  const passwordInput = prompt("Set a password, or leave blank to auto-generate:");
  const password = passwordInput || generateClientPassword();

  try{
    const res = await fetch("https://giles-sites.netlify.app/.netlify/functions/create-client", {
      method:"POST",
      headers:{ "Content-Type":"application/json" },
      body:JSON.stringify({ email, password, businessName })
    });

    const data = await res.json();

    if(data.error){
      alert("Error: " + data.error);
      return;
    }

    alert(
`CLIENT CREATED ✅

Email: ${data.email}
Password: ${data.password}
User ID: ${data.userId}`
    );

    await refreshAdminData();

  }catch(error){
    console.error(error);
    alert("Client creation failed.");
  }
}

function generateClientPassword(){
  return "Site" + Math.random().toString(36).slice(2,10) + "!";
}

async function createCheckoutForClient(clientSiteId){
  const site = clientSites.find(s=>s.id === clientSiteId);

  if(!site){
    alert("Client not found.");
    return;
  }

  if(!site.client_user_id){
    alert("This client needs a Supabase User ID first.");
    return;
  }

  if(site.stripe_checkout_url){
    const useOld = confirm("This client already has a saved Stripe checkout link. Copy existing link?");
    if(useOld){
      copyText(site.stripe_checkout_url);
      return;
    }
  }

  const priceId = prompt("Paste Stripe recurring Price ID:", site.stripe_price_id || "");
  if(!priceId) return;

  try{
    const res = await fetch("https://giles-sites.netlify.app/.netlify/functions/create-checkout-session", {
      method:"POST",
      headers:{ "Content-Type":"application/json" },
      body:JSON.stringify({
        client_user_id:site.client_user_id,
        price_id:priceId
      })
    });

    const data = await res.json();

    if(!res.ok){
      alert(data.error || "Could not create checkout session.");
      return;
    }

    copyText(data.url);
    alert("Stripe checkout link copied.");

    await refreshAdminData();

  }catch(error){
    console.error(error);
    alert("Checkout creation failed.");
  }
}

/* =========================
   DELETE / DOMAIN
========================= */
async function deleteClientSite(id){
  if(!confirm("Delete this client site record?")) return;

  const { error } = await db
    .from("client_sites")
    .delete()
    .eq("id", id);

  if(error){
    console.error(error);
    alert("Delete failed.");
    return;
  }

  await refreshAdminData();
}

async function releaseDomain(id){
  const site = clientSites.find(s=>s.id === id);
  if(!site) return;

  const reason = prompt("Reason for domain release:", "Client requested domain release");
  if(reason === null) return;

  const { error } = await db
    .from("client_sites")
    .update({
      domain_status:"released",
      domain_release_status:"released",
      domain_release_notes:reason,
      domain_released_at:new Date().toISOString(),
      updated_at:new Date().toISOString()
    })
    .eq("id", id);

  if(error){
    console.error(error);
    alert("Domain release failed.");
    return;
  }

  await refreshAdminData();
}

/* =========================
   HELPERS
========================= */
function getClientAnalytics(clientUserId){
  const events = analyticsEvents.filter(e=>e.client_user_id === clientUserId);

  return {
    today:events.filter(e=>isToday(e.created_at)).length,
    week:events.filter(e=>isWithinDays(e.created_at,7)).length,
    month:events.length,
    topPage:getTopValue(events,"page") || "—"
  };
}

function getClientLeads(clientUserId){
  const leads = leadEvents.filter(l=>l.client_user_id === clientUserId);

  return {
    today:leads.filter(l=>isToday(l.created_at)).length,
    week:leads.filter(l=>isWithinDays(l.created_at,7)).length,
    month:leads.length
  };
}

function getClientLiveUrl(site){
  if(site.domain && site.domain_status === "live" && site.domain_release_status !== "released"){
    return `https://${site.domain}`;
  }

  return `${LIVE_BASE_URL}/?client=${site.client_user_id}`;
}

function getBillingStatus(site){
  if(site.billing_override) return { text:"Covered by Giles", class:"full" };
  if(site.billing_status === "past due") return { text:"Past Due", class:"danger" };
  if(site.billing_status === "free") return { text:"Free", class:"safe" };
  if(site.billing_status === "manual paid") return { text:"Manual Paid", class:"full" };
  if(site.billing_status === "trial") return { text:"Trial", class:"safe" };
  if(site.billing_status === "paused") return { text:"Paused", class:"dark" };

  const today = new Date();
  today.setHours(0,0,0,0);

  const next = site.next_payment_date
    ? new Date(site.next_payment_date + "T00:00:00")
    : null;

  if(next && next < today){
    return { text:"Past Due", class:"danger" };
  }

  return { text:"Active", class:"full" };
}

function getInitials(text){
  return String(text || "C")
    .split(" ")
    .filter(Boolean)
    .slice(0,2)
    .map(w=>w[0])
    .join("")
    .toUpperCase();
}

function toggleSidebar(){
  document.body.classList.toggle("sidebar-open");
}

function copyText(text){
  navigator.clipboard.writeText(text);
  alert("Copied.");
}

function cleanValue(id){
  const el = document.getElementById(id);
  return el ? el.value.trim() : "";
}

function setValue(id,value){
  const el = document.getElementById(id);
  if(el) el.value = value || "";
}

function setText(id,value){
  const el = document.getElementById(id);
  if(el) el.textContent = value;
}

function toDateInput(date){
  return date.toISOString().split("T")[0];
}

function getTopValue(items,key){
  const counts = {};

  items.forEach(item=>{
    const value = item[key] || "unknown";
    counts[value] = (counts[value] || 0) + 1;
  });

  return Object.entries(counts).sort((a,b)=>b[1]-a[1])[0]?.[0] || null;
}

function isToday(dateString){
  const date = new Date(dateString);
  const today = new Date();

  return date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate();
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

function escapeHtml(value){
  return String(value || "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

function capitalize(text){
  return String(text || "").charAt(0).toUpperCase() + String(text || "").slice(1);
}
    list.appendChild(card);
  });
}
