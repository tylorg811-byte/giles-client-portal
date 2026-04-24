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

  await loadClientSites();
  await loadChangeRequests();
  await loadAnalytics();
  await loadLeads();

  renderStats();
  renderSmartAlerts();
  renderChangeRequests();
  renderAnalyticsOverviewFull();
  populateAnalyticsClientDropdown();
  loadClientAnalyticsView();
  renderBillingOverview();
}

/* =========================
   NAV
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
    analytics:"Analytics",
    requests:"Change Requests",
    billing:"Billing"
  };

  setText("pageTitle", titles[page] || "Admin");

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
  applyClientFilters();
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
    console.warn("Leads not loaded. Make sure site_leads SQL was run.", error);
    leadEvents = [];
    return;
  }

  leadEvents = data || [];
}

/* =========================
   STATS / ALERTS
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

  const alerts = [];

  if(pastDue) alerts.push(`<span class="badge danger">⚠️ ${pastDue} Past Due</span>`);
  if(pendingDomains) alerts.push(`<span class="badge safe">🌐 ${pendingDomains} Domains Pending</span>`);
  if(newRequests) alerts.push(`<span class="badge safe">💬 ${newRequests} New Requests</span>`);
  if(lockedEditors) alerts.push(`<span class="badge danger">🔒 ${lockedEditors} Editor Locks</span>`);
  if(leadsToday) alerts.push(`<span class="badge full">🔥 ${leadsToday} Leads Today</span>`);

  if(!alerts.length){
    box.innerHTML = `
      <strong>✅ Command Center</strong>
      <p style="margin-top:8px;color:#64748b;">Everything looks good right now.</p>
    `;
    return;
  }

  box.innerHTML = `
    <strong>Command Center</strong>
    <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:12px;">
      ${alerts.join("")}
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
      site.package_name
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
   CLIENT CARDS
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

    const card = document.createElement("div");
    card.className = "client-card";

    card.innerHTML = `
      <div>
        <div class="card-group-title">Client</div>
        <h3>${escapeHtml(site.business_name || "Unnamed Business")}</h3>
        <p>${escapeHtml(site.client_email || "No email")}</p>
        <p>${escapeHtml(site.domain || "No domain")}</p>

        <div style="margin-top:10px;">
          <span class="badge">${escapeHtml(site.package_name || "Package")}</span>
          <span class="badge ${billing.class}">${billing.text}</span>
          ${site.editor_locked ? `<span class="badge danger">Editor Locked</span>` : ""}
        </div>

        ${site.client_tags ? `<p style="margin-top:8px;"><strong>Tags:</strong> ${escapeHtml(site.client_tags)}</p>` : ""}
      </div>

      <div>
        <div class="card-group-title">Website</div>
        <p><strong>Status:</strong> ${escapeHtml(site.site_status || "draft")}</p>
        <p><strong>Editor:</strong> ${escapeHtml(site.editor_access || "safe")}</p>
        <p><strong>Domain:</strong> ${escapeHtml(site.domain_status || "not connected")}</p>
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

    list.appendChild(card);
  });
}

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
  }, `Editor access changed to ${nextAccess === "full" ? "Full Editor Access" : "Safe Mode"}.`);
}

async function toggleEditorLock(id){
  const site = clientSites.find(item=>item.id === id);
  if(!site) return;

  let reason = "";

  if(!site.editor_locked){
    reason = prompt("Why are you locking this client out of the editor?", "Safety, non-payment, or preference") || "";
  }

  await updateClientQuick(id, {
    editor_locked:!site.editor_locked,
    editor_locked_reason:!site.editor_locked ? reason : ""
  }, site.editor_locked ? "Editor unlocked." : "Editor locked.");
}

async function updateClientQuick(id, updates, successMessage){
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

  const site = clientSites.find(item=>item.id === id);

  if(site?.client_user_id){
    await db.from("notifications").insert({
      user_id:site.client_user_id,
      title:"Website account updated",
      message:successMessage,
      type:"site"
    });
  }

  await loadClientSites();
  renderStats();
  renderSmartAlerts();
  renderBillingOverview();
}

/* =========================
   CLIENT FORM ACTIONS
========================= */
async function saveClientSite(){
  const id = cleanValue("clientRecordId");

  const payload = {
    admin_user_id: adminUser.id,
    client_user_id: cleanValue("clientUserId") || null,
    client_email: cleanValue("clientEmail"),
    business_name: cleanValue("businessName"),
    package_name: cleanValue("packageName"),
    domain: cleanValue("domain").replace(/^https?:\/\//,"").replace(/\/$/,""),
    domain_status: cleanValue("domainStatus"),
    domain_release_status: cleanValue("domainReleaseStatus") || "connected",
    domain_release_notes: cleanValue("domainReleaseNotes"),
    site_status: cleanValue("siteStatus"),
    editor_access: cleanValue("editorAccess") || "safe",
    editor_locked: cleanValue("editorLocked") === "true",
    editor_locked_reason: cleanValue("editorLockedReason"),
    client_tags: cleanValue("clientTags"),
    billing_status: cleanValue("billingStatus") || "active",
    billing_override: cleanValue("billingOverride") === "true",
    billing_override_reason: cleanValue("billingOverrideReason"),
    billing_notes: cleanValue("billingNotes"),
    billing_cycle: cleanValue("billingCycle") || "monthly",
    next_payment_date: cleanValue("nextPaymentDate") || null,
    last_payment_date: cleanValue("lastPaymentDate") || null,
    notes: cleanValue("notes"),
    updated_at:new Date().toISOString()
  };

  if(payload.domain_release_status === "released"){
    payload.domain_status = "released";
    payload.domain_released_at = new Date().toISOString();
  }

  let response;

  if(id){
    response = await db
      .from("client_sites")
      .update(payload)
      .eq("id", id);
  } else {
    response = await db
      .from("client_sites")
      .insert(payload);
  }

  if(response.error){
    console.error(response.error);
    setText("message", "Save failed.");
    return;
  }

  if(payload.client_user_id){
    const billing = getBillingStatus(payload);

    await db.from("notifications").insert({
      user_id:payload.client_user_id,
      title:"Website account updated",
      message:`Your website status is "${payload.site_status}". Billing: "${billing.text}".`,
      type:"site"
    });
  }

  setText("message", "Client site saved.");

  clearClientForm();

  await loadClientSites();
  renderStats();
  renderSmartAlerts();
  renderBillingOverview();
  populateAnalyticsClientDropdown();
}

function editClientSite(id){
  const site = clientSites.find(item=>item.id === id);
  if(!site) return;

  showAdminPage("clients");

  setValue("clientRecordId", site.id);
  setValue("businessName", site.business_name);
  setValue("clientEmail", site.client_email);
  setValue("clientUserId", site.client_user_id);
  setValue("packageName", site.package_name || "Starter");
  setValue("domain", site.domain);
  setValue("domainStatus", site.domain_status || "not connected");
  setValue("domainReleaseStatus", site.domain_release_status || "connected");
  setValue("domainReleaseNotes", site.domain_release_notes);
  setValue("siteStatus", site.site_status || "draft");
  setValue("editorAccess", site.editor_access || "safe");
  setValue("editorLocked", site.editor_locked ? "true" : "false");
  setValue("editorLockedReason", site.editor_locked_reason);
  setValue("clientTags", site.client_tags);
  setValue("billingStatus", site.billing_status || "active");
  setValue("billingOverride", site.billing_override ? "true" : "false");
  setValue("billingOverrideReason", site.billing_override_reason);
  setValue("billingNotes", site.billing_notes);
  setValue("billingCycle", site.billing_cycle || "monthly");
  setValue("nextPaymentDate", site.next_payment_date);
  setValue("lastPaymentDate", site.last_payment_date);
  setValue("notes", site.notes);

  scrollToForm();
}

function clearClientForm(){
  const defaults = {
    clientRecordId:"",
    businessName:"",
    clientEmail:"",
    clientUserId:"",
    packageName:"Starter",
    domain:"",
    domainStatus:"not connected",
    domainReleaseStatus:"connected",
    domainReleaseNotes:"",
    siteStatus:"draft",
    editorAccess:"safe",
    editorLocked:"false",
    editorLockedReason:"",
    clientTags:"",
    billingStatus:"active",
    billingOverride:"false",
    billingOverrideReason:"",
    billingNotes:"",
    billingCycle:"monthly",
    nextPaymentDate:"",
    lastPaymentDate:"",
    notes:""
  };

  Object.entries(defaults).forEach(([id,value])=>{
    setValue(id,value);
  });

  setText("message", "");
}

function closeClientForm(){
  const wrap = document.getElementById("clientFormWrap");
  if(wrap) wrap.style.display = "none";
}

function toggleClientForm(){
  const wrap = document.getElementById("clientFormWrap");
  if(!wrap) return;

  wrap.style.display = wrap.style.display === "block" ? "none" : "block";
}

function scrollToForm(){
  showAdminPage("clients");

  const wrap = document.getElementById("clientFormWrap");
  if(wrap) wrap.style.display = "block";

  const card = document.getElementById("clientFormCard");
  if(card){
    card.scrollIntoView({
      behavior:"smooth",
      block:"start"
    });
  }
}

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

  await loadClientSites();
  renderStats();
  renderSmartAlerts();
  renderBillingOverview();
}

async function releaseDomain(id){
  const site = clientSites.find(item=>item.id === id);
  if(!site) return;

  const reason = prompt(
    `Release domain for ${site.business_name || site.client_email}?\n\nThis marks the domain as released in your portal.\n\nReason:`,
    "Client requested domain release"
  );

  if(reason === null) return;
  if(!confirm(`Confirm release for ${site.domain}?`)) return;

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

  if(site.client_user_id){
    await db.from("notifications").insert({
      user_id:site.client_user_id,
      title:"Domain released",
      message:`Your domain ${site.domain} has been marked as released from Giles Web Design management.`,
      type:"domain"
    });
  }

  await loadClientSites();
  renderStats();
  renderSmartAlerts();
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

    const editorUrl = req.client_user_id
      ? `editor.html?client=${req.client_user_id}`
      : "editor.html";

    const liveUrl = req.client_user_id
      ? `${LIVE_BASE_URL}/?client=${req.client_user_id}`
      : LIVE_BASE_URL;

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
        <textarea id="notes-${req.id}" placeholder="Optional note...">${escapeHtml(req.admin_notes || "")}</textarea>
      </div>

      <div class="actions">
        <button onclick="updateChangeRequest('${req.id}', '${req.client_user_id || ""}')">Update</button>
        <a href="${editorUrl}" target="_blank">Editor</a>
        <a href="${liveUrl}" target="_blank">View Site</a>
        <button onclick="completeRequest('${req.id}', '${req.client_user_id || ""}')">Complete</button>
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
    alert("Request update failed.");
    console.error(error);
    return;
  }

  if(clientUserId){
    await db.from("notifications").insert({
      user_id:clientUserId,
      title:"Request status updated",
      message:`Your request is now marked as "${status}".${notes ? " Note: " + notes : ""}`,
      type:"request"
    });
  }

  await loadChangeRequests();
  renderChangeRequests();
  renderStats();
  renderSmartAlerts();
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
    alert("Could not complete request.");
    console.error(error);
    return;
  }

  if(clientUserId){
    await db.from("notifications").insert({
      user_id:clientUserId,
      title:"Request completed",
      message:`Your requested change has been completed.${notes ? " Note: " + notes : ""}`,
      type:"request"
    });
  }

  await loadChangeRequests();
  renderChangeRequests();
  renderStats();
  renderSmartAlerts();
}

async function deleteChangeRequest(id){
  if(!confirm("Delete this change request?")) return;

  const { error } = await db
    .from("change_requests")
    .delete()
    .eq("id", id);

  if(error){
    alert("Delete failed.");
    console.error(error);
    return;
  }

  await loadChangeRequests();
  renderChangeRequests();
  renderStats();
  renderSmartAlerts();
}

/* =========================
   ANALYTICS + LEADS
========================= */
function renderAnalyticsOverviewFull(){
  const container = document.getElementById("analyticsOverview");
  if(!container) return;

  const total = analyticsEvents.length;
  const today = analyticsEvents.filter(event=>isToday(event.created_at)).length;
  const week = analyticsEvents.filter(event=>isWithinDays(event.created_at,7)).length;
  const leads = leadEvents.length;
  const topDevice = getTopValue(analyticsEvents,"device") || "—";

  container.innerHTML = `
    <div class="analytics-header-grid">
      <div class="stat"><span>Total Views</span><strong>${total}</strong></div>
      <div class="stat"><span>Today</span><strong>${today}</strong></div>
      <div class="stat"><span>7 Days</span><strong>${week}</strong></div>
      <div class="stat"><span>Leads</span><strong>${leads}</strong></div>
    </div>

    <div class="source-grid">
      <div class="source-card">
        <span>Top Device</span>
        <strong>${escapeHtml(topDevice)}</strong>
      </div>

      <div class="source-card">
        <span>Top Source</span>
        <strong>${escapeHtml(getTopReferrer(analyticsEvents))}</strong>
      </div>

      <div class="source-card">
        <span>Top Page</span>
        <strong>${escapeHtml(getTopValue(analyticsEvents,"page") || "—")}</strong>
      </div>
    </div>
  `;
}

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

function loadClientAnalyticsView(){
  const select = document.getElementById("analyticsClientSelect");
  const container = document.getElementById("analyticsClientView");

  if(!select || !container) return;

  const id = select.value;

  if(!id){
    container.innerHTML = `<div class="empty-state">No client selected.</div>`;
    return;
  }

  const site = clientSites.find(item=>item.client_user_id === id);
  const events = analyticsEvents.filter(event=>event.client_user_id === id);
  const leads = leadEvents.filter(lead=>lead.client_user_id === id);

  const today = events.filter(event=>isToday(event.created_at)).length;
  const week = events.filter(event=>isWithinDays(event.created_at,7)).length;
  const month = events.length;
  const leadMonth = leads.length;

  const topPage = getTopValue(events,"page") || "—";
  const topDevice = getTopValue(events,"device") || "—";
  const topBrowser = getTopValue(events,"browser") || "—";
  const topSource = getTopReferrer(events);

  const recentVisits = events.slice(0,8).map(event=>`
    <div class="analytics-client-card">
      <p><strong>${escapeHtml(event.page || "home")}</strong></p>
      <p>${escapeHtml(event.device || "unknown")} • ${escapeHtml(event.browser || "unknown")}</p>
      <p><strong>Source:</strong> ${escapeHtml(cleanReferrer(event.referrer))}</p>
      <p style="color:#64748b;font-size:13px;">${timeAgo(event.created_at)}</p>
    </div>
  `).join("");

  const recentLeads = leads.slice(0,6).map(lead=>`
    <div class="analytics-client-card">
      <p><strong>${escapeHtml(lead.form_name || "Website Lead")}</strong></p>
      <p>${escapeHtml(lead.page || "unknown page")}</p>
      <p><strong>Source:</strong> ${escapeHtml(cleanReferrer(lead.source))}</p>
      <p style="color:#64748b;font-size:13px;">${timeAgo(lead.created_at)}</p>
    </div>
  `).join("");

  container.innerHTML = `
    <h2>${escapeHtml(site?.business_name || "Client Analytics")}</h2>

    <div class="analytics-header-grid">
      <div class="stat"><span>Today</span><strong>${today}</strong></div>
      <div class="stat"><span>7 Days</span><strong>${week}</strong></div>
      <div class="stat"><span>30 Days</span><strong>${month}</strong></div>
      <div class="stat"><span>Leads</span><strong>${leadMonth}</strong></div>
    </div>

    <div class="source-grid">
      <div class="source-card">
        <span>Top Source</span>
        <strong>${escapeHtml(topSource)}</strong>
      </div>

      <div class="source-card">
        <span>Top Page</span>
        <strong>${escapeHtml(topPage)}</strong>
      </div>

      <div class="source-card">
        <span>Top Device</span>
        <strong>${escapeHtml(topDevice)}</strong>
      </div>

      <div class="source-card">
        <span>Top Browser</span>
        <strong>${escapeHtml(topBrowser)}</strong>
      </div>

      <div class="source-card">
        <span>Live URL</span>
        <strong style="font-size:16px;">${escapeHtml(site ? getClientLiveUrl(site) : "—")}</strong>
      </div>

      <div class="source-card">
        <span>Domain</span>
        <strong>${escapeHtml(site?.domain || "No domain")}</strong>
      </div>
    </div>

    <h3 style="margin:24px 0 12px;">Recent Leads</h3>
    <div class="visit-list">
      ${recentLeads || `<div class="empty-state">No leads yet.</div>`}
    </div>

    <h3 style="margin:24px 0 12px;">Recent Visits</h3>
    <div class="visit-list">
      ${recentVisits || `<div class="empty-state">No visits yet.</div>`}
    </div>
  `;
}

/* =========================
   DETAIL / BILLING
========================= */
function openClientDetail(id){
  const site = clientSites.find(item=>item.id === id);
  if(!site) return;

  showAdminPage("clientDetail");

  setText("detailBusinessName", site.business_name || "Client Details");
  setText("detailClientEmail", site.client_email || "");

  const analytics = site.client_user_id ? getClientAnalytics(site.client_user_id) : null;
  const leads = site.client_user_id ? getClientLeads(site.client_user_id) : null;
  const billing = getBillingStatus(site);

  const container = document.getElementById("clientDetailContent");

  container.innerHTML = `
    <div class="detail-grid">
      <div class="detail-card">
        <h3>Website</h3>
        <div class="detail-row"><span>Status</span><span>${escapeHtml(site.site_status || "draft")}</span></div>
        <div class="detail-row"><span>Domain</span><span>${escapeHtml(site.domain || "—")}</span></div>
        <div class="detail-row"><span>Domain Status</span><span>${escapeHtml(site.domain_status || "—")}</span></div>
        <div class="detail-row"><span>Editor Access</span><span>${escapeHtml(site.editor_access || "safe")}</span></div>
        <div class="detail-row"><span>Editor Lock</span><span>${site.editor_locked ? "Locked" : "Unlocked"}</span></div>

        <div style="margin-top:16px;display:flex;gap:10px;flex-wrap:wrap;">
          <a class="primary" href="${getClientLiveUrl(site)}" target="_blank">Open Site</a>
          <a class="secondary" href="editor.html?client=${site.client_user_id || ""}" target="_blank">Open Editor</a>
        </div>
      </div>

      <div class="detail-card">
        <h3>Billing</h3>
        <div class="detail-row"><span>Status</span><span>${billing.text}</span></div>
        <div class="detail-row"><span>Cycle</span><span>${escapeHtml(site.billing_cycle || "monthly")}</span></div>
        <div class="detail-row"><span>Last Payment</span><span>${formatDate(site.last_payment_date)}</span></div>
        <div class="detail-row"><span>Next Payment</span><span>${formatDate(site.next_payment_date)}</span></div>
      </div>

      <div class="detail-card">
        <h3>Performance</h3>
        <div class="detail-row"><span>Views Today</span><span>${analytics ? analytics.today : 0}</span></div>
        <div class="detail-row"><span>Views 7 Days</span><span>${analytics ? analytics.week : 0}</span></div>
        <div class="detail-row"><span>Views 30 Days</span><span>${analytics ? analytics.month : 0}</span></div>
        <div class="detail-row"><span>Leads 30 Days</span><span>${leads ? leads.month : 0}</span></div>
        <div class="detail-row"><span>Top Page</span><span>${analytics ? escapeHtml(analytics.topPage) : "—"}</span></div>
      </div>

      <div class="detail-card">
        <h3>Notes</h3>
        <p>${escapeHtml(site.notes || "No notes.")}</p>
        ${site.client_tags ? `<p style="margin-top:12px;"><strong>Tags:</strong> ${escapeHtml(site.client_tags)}</p>` : ""}
      </div>
    </div>
  `;
}

function renderBillingOverview(){
  const box = document.getElementById("billingOverview");
  if(!box) return;

  const active = clientSites.filter(site=>getBillingStatus(site).text === "Active").length;
  const covered = clientSites.filter(site=>getBillingStatus(site).text === "Covered by Giles").length;
  const past = clientSites.filter(site=>getBillingStatus(site).text === "Past Due").length;
  const manual = clientSites.filter(site=>site.billing_status === "manual paid").length;

  const pastDueList = clientSites
    .filter(site=>getBillingStatus(site).text === "Past Due")
    .map(site=>`
      <div class="analytics-client-card">
        <p><strong>${escapeHtml(site.business_name || "Unnamed Business")}</strong></p>
        <p>${escapeHtml(site.client_email || "")}</p>
        <p>Next due: ${formatDate(site.next_payment_date)}</p>
      </div>
    `).join("");

  box.innerHTML = `
    <div class="grid">
      <div class="stat"><span>Active</span><strong>${active}</strong></div>
      <div class="stat"><span>Covered</span><strong>${covered}</strong></div>
      <div class="stat"><span>Manual Paid</span><strong>${manual}</strong></div>
      <div class="stat"><span>Past Due</span><strong>${past}</strong></div>
    </div>

    <h3 style="margin:20px 0 12px;">Past Due Clients</h3>
    <div class="visit-list">
      ${pastDueList || `<div class="empty-state">No past due clients.</div>`}
    </div>
  `;
}

/* =========================
   HELPERS
========================= */
function getClientAnalytics(clientUserId){
  const events = analyticsEvents.filter(event=>event.client_user_id === clientUserId);

  return {
    today:events.filter(event=>isToday(event.created_at)).length,
    week:events.filter(event=>isWithinDays(event.created_at,7)).length,
    month:events.length,
    topPage:getTopValue(events,"page") || "—",
    topSource:getTopReferrer(events)
  };
}

function getClientLeads(clientUserId){
  const leads = leadEvents.filter(lead=>lead.client_user_id === clientUserId);

  return {
    today:leads.filter(lead=>isToday(lead.created_at)).length,
    week:leads.filter(lead=>isWithinDays(lead.created_at,7)).length,
    month:leads.length,
    topSource:getTopLeadSource(leads)
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

  return Object.entries(counts)
    .sort((a,b)=>b[1]-a[1])[0]?.[0] || null;
}

function getTopReferrer(events){
  const counts = {};

  events.forEach(event=>{
    const source = cleanReferrer(event.referrer);
    counts[source] = (counts[source] || 0) + 1;
  });

  return Object.entries(counts)
    .sort((a,b)=>b[1]-a[1])[0]?.[0] || "direct";
}

function getTopLeadSource(leads){
  const counts = {};

  leads.forEach(lead=>{
    const source = cleanReferrer(lead.source);
    counts[source] = (counts[source] || 0) + 1;
  });

  return Object.entries(counts)
    .sort((a,b)=>b[1]-a[1])[0]?.[0] || "direct";
}

function cleanReferrer(ref){
  if(!ref || ref === "direct") return "direct";

  try{
    return new URL(ref).hostname;
  }catch(e){
    return ref;
  }
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
      headers:{
        "Content-Type":"application/json"
      },
      body:JSON.stringify({
        email,
        password,
        businessName
      })
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
User ID: ${data.userId}

Copy this info before closing.`
    );

    await loadClientSites();
    renderStats();
    renderSmartAlerts();
    populateAnalyticsClientDropdown();

  }catch(error){
    console.error(error);
    alert("Client creation failed. Check console.");
  }
}

function generateClientPassword(){
  return "Site" + Math.random().toString(36).slice(2,10) + "!";
}

async function createCheckoutForClient(clientSiteId){
  const site = clientSites.find(item => item.id === clientSiteId);

  if(!site){
    alert("Client not found.");
    return;
  }

  if(!site.client_user_id){
    alert("This client needs a Supabase User ID first.");
    return;
  }

  const priceId = prompt(
    "Paste the Stripe recurring Price ID for this client:",
    site.stripe_price_id || ""
  );

  if(!priceId) return;

  try{
    const response = await fetch("https://giles-sites.netlify.app/.netlify/functions/create-checkout-session", {
      method:"POST",
      headers:{
        "Content-Type":"application/json"
      },
      body:JSON.stringify({
        client_user_id:site.client_user_id,
        price_id:priceId
      })
    });

    const result = await response.json();

    if(!response.ok){
      alert(result.error || "Could not create checkout session.");
      console.error(result);
      return;
    }

    const message =
`Stripe Checkout created.

Client: ${site.business_name || site.client_email}
Checkout Link:
${result.url}`;

    navigator.clipboard.writeText(result.url);
    alert(message + "\n\nLink copied to clipboard.");

  }catch(error){
    console.error(error);
    alert("Checkout creation failed.");
  }
}
