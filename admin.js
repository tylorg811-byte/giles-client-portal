let adminUser = null;
let clientSites = [];
let changeRequests = [];
let supportTickets = [];
let analyticsEvents = [];
let leadEvents = [];
let clientPayments = [];

const LIVE_BASE_URL = "https://giles-sites.netlify.app";

document.addEventListener("DOMContentLoaded", loadAdminDashboard);

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
}

async function checkAdminAccess(){
  const { data, error } = await db
    .from("admin_users")
    .select("*")
    .eq("user_id", adminUser.id)
    .single();

  return !!data && !error;
}

async function refreshAdminData(){
  await loadClientSites();
  await loadChangeRequests();
  await loadSupportTickets();
  await loadAnalytics();
  await loadLeads();
  await loadPayments();

  renderStats();
  renderSmartAlerts();
  applyClientFilters();
  renderChangeRequests();
  renderSupportOverview();
  renderSupportTickets();
  renderAnalyticsOverviewFull();
  populateAnalyticsClientDropdown();
  populateSEOClientDropdown();
  renderBillingOverview();
  renderRevenueDashboard();
  renderPaymentHistory();
}

async function loadClientSites(){
  const { data, error } = await db
    .from("client_sites")
    .select("*")
    .order("created_at", { ascending:false });

  if(error){
    console.error(error);
    clientSites = [];
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
    changeRequests = [];
    return;
  }

  changeRequests = data || [];
}

async function loadSupportTickets(){
  const { data, error } = await db
    .from("support_tickets")
    .select("*")
    .order("created_at", { ascending:false });

  if(error){
    console.error("Support tickets not loaded:", error);
    supportTickets = [];
    return;
  }

  supportTickets = data || [];
}

async function loadAnalytics(){
  const { data, error } = await db
    .from("site_analytics_events")
    .select("*")
    .order("created_at", { ascending:false });

  if(error){
    console.error(error);
    analyticsEvents = [];
    return;
  }

  analyticsEvents = data || [];
}

async function loadLeads(){
  const { data, error } = await db
    .from("site_leads")
    .select("*")
    .order("created_at", { ascending:false });

  if(error){
    console.warn("Leads not loaded.", error);
    leadEvents = [];
    return;
  }

  leadEvents = data || [];
}

async function loadPayments(){
  const { data, error } = await db
    .from("client_payments")
    .select("*")
    .order("paid_at", { ascending:false });

  if(error){
    console.error("Payments not loaded:", error);
    clientPayments = [];
    return;
  }

  clientPayments = data || [];
}

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
    support:"Support Tickets",
    billing:"Billing & Revenue"
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

  if(page === "support"){
    renderSupportOverview();
    renderSupportTickets();
  }

  if(page === "billing"){
    renderBillingOverview();
    renderRevenueDashboard();
    renderPaymentHistory();
  }

  if(window.innerWidth <= 1150){
    document.body.classList.remove("sidebar-open");
  }
}

function renderStats(){
  const openSupport = supportTickets.filter(ticket=>!["closed","resolved"].includes(String(ticket.status || "").toLowerCase())).length;

  setText("totalClients", clientSites.length);
  setText("publishedClients", clientSites.filter(site=>site.site_status === "published").length);
  setText("pastDueClients", clientSites.filter(site=>getBillingStatus(site).text === "Past Due").length);
  setText("newRequests", openSupport);
}

function renderSmartAlerts(){
  const box = document.getElementById("smartAlerts");
  if(!box) return;

  const pastDue = clientSites.filter(site=>getBillingStatus(site).text === "Past Due").length;
  const pendingDomains = clientSites.filter(site=>site.domain_status === "pending").length;
  const newRequests = changeRequests.filter(req=>req.status === "new").length;
  const openSupport = supportTickets.filter(ticket=>!["closed","resolved"].includes(String(ticket.status || "").toLowerCase())).length;
  const urgentSupport = supportTickets.filter(ticket=>String(ticket.priority || "").toLowerCase() === "urgent" && !["closed","resolved"].includes(String(ticket.status || "").toLowerCase())).length;
  const lockedEditors = clientSites.filter(site=>site.editor_locked).length;
  const leadsToday = leadEvents.filter(lead=>isToday(lead.created_at)).length;
  const lowSeo = clientSites.filter(site=>Number(site.seo_score || 0) < 60).length;

  const alerts = [];

  if(urgentSupport) alerts.push(`<span class="badge danger">🚨 ${urgentSupport} Urgent Support</span>`);
  if(openSupport) alerts.push(`<span class="badge danger">🎧 ${openSupport} Open Support</span>`);
  if(pastDue) alerts.push(`<span class="badge danger">⚠️ ${pastDue} Past Due</span>`);
  if(pendingDomains) alerts.push(`<span class="badge safe">🌐 ${pendingDomains} Domains Pending</span>`);
  if(newRequests) alerts.push(`<span class="badge safe">💬 ${newRequests} Change Requests</span>`);
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
    const payments = getClientPaymentTotal(site.client_user_id);
    const openSupport = site.client_user_id ? supportTickets.filter(t=>t.client_user_id === site.client_user_id && !["closed","resolved"].includes(String(t.status || "").toLowerCase())).length : 0;

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
          ${openSupport ? `<span class="badge danger">${openSupport} Support</span>` : ""}
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
        <p><strong>Revenue:</strong> ${money(payments)}</p>
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

    list.appendChild(card);
  });
}

async function quickPublish(id){
  await updateClientQuick(id, { site_status:"published" });
}

async function quickPause(id){
  await updateClientQuick(id, { site_status:"paused" });
}

async function quickMarkPaid(id){
  const site = clientSites.find(item=>item.id === id);
  if(!site) return;

  const amountRaw = prompt("Payment amount received? Example: 25 or 250", "");
  const amount = Number(amountRaw || 0);

  const today = new Date();
  const next = new Date();
  next.setMonth(next.getMonth() + 1);

  if(amount > 0){
    await db.from("client_payments").insert({
      client_user_id: site.client_user_id || null,
      client_email: site.client_email || null,
      business_name: site.business_name || null,
      amount,
      source: "manual",
      payment_type: "manual payment",
      notes: "Marked paid from admin console",
      paid_at: new Date().toISOString()
    });
  }

  await updateClientQuick(id, {
    billing_status:"active",
    billing_override:false,
    last_payment_date:toDateInput(today),
    next_payment_date:toDateInput(next)
  });
}

async function toggleSafeMode(id){
  const site = clientSites.find(item=>item.id === id);
  if(!site) return;

  const nextAccess = site.editor_access === "full" ? "safe" : "full";

  await updateClientQuick(id, {
    editor_access:nextAccess
  });
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
  });
}

async function updateClientQuick(id, updates){
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

async function saveClientSite(){
  const id = cleanValue("clientRecordId");

  const payload = {
    admin_user_id: adminUser.id,
    business_name: cleanValue("businessName"),
    client_email: cleanValue("clientEmail"),
    client_user_id: cleanValue("clientUserId") || null,
    package_name: cleanValue("packageName"),
    business_type: cleanValue("businessType"),
    business_location: cleanValue("businessLocation"),
    domain: cleanValue("domain").replace(/^https?:\/\//,"").replace(/\/$/,""),
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
  const defaults = {
    clientRecordId:"",
    businessName:"",
    clientEmail:"",
    clientUserId:"",
    packageName:"Starter",
    businessType:"",
    businessLocation:"",
    domain:"",
    domainStatus:"not connected",
    domainReleaseStatus:"connected",
    siteStatus:"draft",
    editorAccess:"safe",
    editorLocked:"false",
    editorLockedReason:"",
    billingStatus:"active",
    billingOverride:"false",
    billingCycle:"monthly",
    nextPaymentDate:"",
    lastPaymentDate:"",
    clientTags:"",
    billingOverrideReason:"",
    billingNotes:"",
    domainReleaseNotes:"",
    notes:""
  };

  Object.entries(defaults).forEach(([id,value])=>setValue(id,value));
  setText("message","");
}

function toggleClientForm(){
  const wrap = document.getElementById("clientFormWrap");
  if(!wrap) return;
  wrap.style.display = wrap.style.display === "block" ? "none" : "block";
}

function closeClientForm(){
  const wrap = document.getElementById("clientFormWrap");
  if(wrap) wrap.style.display = "none";
}

function scrollToForm(){
  showAdminPage("clients");

  const wrap = document.getElementById("clientFormWrap");
  if(wrap) wrap.style.display = "block";

  const card = document.getElementById("clientFormCard");
  if(card) card.scrollIntoView({behavior:"smooth",block:"start"});
}

function renderSupportOverview(){
  const box = document.getElementById("supportOverview");
  if(!box) return;

  const open = supportTickets.filter(t=>String(t.status || "").toLowerCase() === "open").length;
  const progress = supportTickets.filter(t=>String(t.status || "").toLowerCase() === "in progress").length;
  const urgent = supportTickets.filter(t=>String(t.priority || "").toLowerCase() === "urgent" && !["closed","resolved"].includes(String(t.status || "").toLowerCase())).length;
  const resolved = supportTickets.filter(t=>["closed","resolved"].includes(String(t.status || "").toLowerCase())).length;

  box.innerHTML = `
    <div class="grid">
      <div class="stat"><span>Open</span><strong>${open}</strong></div>
      <div class="stat"><span>In Progress</span><strong>${progress}</strong></div>
      <div class="stat"><span>Urgent</span><strong>${urgent}</strong></div>
      <div class="stat"><span>Resolved</span><strong>${resolved}</strong></div>
    </div>
  `;
}

function renderSupportTickets(){
  const list = document.getElementById("supportTicketList");
  if(!list) return;

  const search = cleanValue("supportSearch").toLowerCase();
  const statusFilter = cleanValue("supportStatusFilter") || "all";
  const priorityFilter = cleanValue("supportPriorityFilter") || "all";
  const typeFilter = cleanValue("supportTypeFilter") || "all";

  let filtered = [...supportTickets];

  filtered = filtered.filter(ticket=>{
    const searchable = [
      ticket.business_name,
      ticket.client_email,
      ticket.ticket_type,
      ticket.priority,
      ticket.subject,
      ticket.message,
      ticket.status,
      ticket.admin_notes
    ].join(" ").toLowerCase();

    const status = String(ticket.status || "").toLowerCase();
    const priority = String(ticket.priority || "").toLowerCase();
    const type = String(ticket.ticket_type || "");

    return (
      searchable.includes(search) &&
      (statusFilter === "all" || status === statusFilter) &&
      (priorityFilter === "all" || priority === priorityFilter) &&
      (typeFilter === "all" || type === typeFilter)
    );
  });

  list.innerHTML = "";

  if(!filtered.length){
    list.innerHTML = `<div class="empty-state">No support tickets found.</div>`;
    return;
  }

  filtered.forEach(ticket=>{
    const card = document.createElement("div");
    card.className = "ticket-card";

    const editorUrl = ticket.client_user_id ? `editor.html?client=${ticket.client_user_id}` : "editor.html";
    const site = clientSites.find(s=>s.client_user_id === ticket.client_user_id);
    const liveUrl = site ? getClientLiveUrl(site) : LIVE_BASE_URL;

    card.innerHTML = `
      <div>
        <h3>${escapeHtml(ticket.subject || ticket.ticket_type || "Support Ticket")}</h3>
        <p>${escapeHtml(ticket.business_name || ticket.client_email || "")}</p>
        <p>${escapeHtml(ticket.client_email || "")}</p>
        <span class="badge ${getTicketBadgeClass(ticket.status)}">${escapeHtml(ticket.status || "open")}</span>
        <span class="badge ${getPriorityBadgeClass(ticket.priority)}">${escapeHtml(ticket.priority || "normal")}</span>
        <p>${timeAgo(ticket.created_at)}</p>
      </div>

      <div>
        <p><strong>${escapeHtml(ticket.ticket_type || "Support Issue")}</strong></p>
        <p>${escapeHtml(ticket.message || "")}</p>
        ${ticket.admin_notes ? `<p><strong>Admin Note:</strong> ${escapeHtml(ticket.admin_notes)}</p>` : ""}
      </div>

      <div>
        <label>Status</label>
        <select id="ticket-status-${ticket.id}">
          <option value="open" ${ticket.status === "open" ? "selected" : ""}>Open</option>
          <option value="in progress" ${ticket.status === "in progress" ? "selected" : ""}>In Progress</option>
          <option value="resolved" ${ticket.status === "resolved" ? "selected" : ""}>Resolved</option>
          <option value="closed" ${ticket.status === "closed" ? "selected" : ""}>Closed</option>
        </select>

        <label style="margin-top:8px;">Priority</label>
        <select id="ticket-priority-${ticket.id}">
          <option value="normal" ${ticket.priority === "normal" ? "selected" : ""}>Normal</option>
          <option value="high" ${ticket.priority === "high" ? "selected" : ""}>High</option>
          <option value="urgent" ${ticket.priority === "urgent" ? "selected" : ""}>Urgent</option>
        </select>

        <label style="margin-top:8px;">Admin Notes</label>
        <textarea id="ticket-notes-${ticket.id}">${escapeHtml(ticket.admin_notes || "")}</textarea>
      </div>

      <div class="actions">
        <button onclick="updateSupportTicket('${ticket.id}')">Update</button>
        <button onclick="resolveSupportTicket('${ticket.id}')">Resolve</button>
        <a href="${editorUrl}" target="_blank">Editor</a>
        <a href="${liveUrl}" target="_blank">Live</a>
        <button class="danger wide" onclick="deleteSupportTicket('${ticket.id}')">Delete</button>
      </div>
    `;

    list.appendChild(card);
  });
}

function clearSupportFilters(){
  setValue("supportSearch","");
  setValue("supportStatusFilter","all");
  setValue("supportPriorityFilter","all");
  setValue("supportTypeFilter","all");
  renderSupportTickets();
}

async function updateSupportTicket(id){
  const status = cleanValue(`ticket-status-${id}`);
  const priority = cleanValue(`ticket-priority-${id}`);
  const notes = cleanValue(`ticket-notes-${id}`);

  const { error } = await db
    .from("support_tickets")
    .update({
      status,
      priority,
      admin_notes:notes,
      updated_at:new Date().toISOString()
    })
    .eq("id", id);

  if(error){
    console.error(error);
    alert("Support ticket update failed.");
    return;
  }

  await refreshAdminData();
}

async function resolveSupportTicket(id){
  const notes = cleanValue(`ticket-notes-${id}`) || "Resolved by Giles Web Design.";

  const { error } = await db
    .from("support_tickets")
    .update({
      status:"resolved",
      admin_notes:notes,
      updated_at:new Date().toISOString()
    })
    .eq("id", id);

  if(error){
    console.error(error);
    alert("Could not resolve support ticket.");
    return;
  }

  await refreshAdminData();
}

async function deleteSupportTicket(id){
  if(!confirm("Delete this support ticket?")) return;

  const { error } = await db
    .from("support_tickets")
    .delete()
    .eq("id", id);

  if(error){
    console.error(error);
    alert("Delete failed.");
    return;
  }

  await refreshAdminData();
}

function renderRevenueDashboard(){
  const box = document.getElementById("revenueOverview");
  if(!box) return;

  const total = clientPayments.reduce((sum,p)=>sum + Number(p.amount || 0),0);

  const last30 = clientPayments
    .filter(p=>isWithinDays(p.paid_at,30))
    .reduce((sum,p)=>sum + Number(p.amount || 0),0);

  const thisMonth = clientPayments
    .filter(p=>isCurrentMonth(p.paid_at))
    .reduce((sum,p)=>sum + Number(p.amount || 0),0);

  const monthly = getMonthlyRevenue();

  box.innerHTML = `
    <div class="grid">
      <div class="stat"><span>Total Revenue</span><strong>${money(total)}</strong></div>
      <div class="stat"><span>Last 30 Days</span><strong>${money(last30)}</strong></div>
      <div class="stat"><span>This Month</span><strong>${money(thisMonth)}</strong></div>
      <div class="stat"><span>Payments</span><strong>${clientPayments.length}</strong></div>
    </div>

    <h3 style="margin:24px 0 12px;">Monthly Revenue</h3>
    <div class="source-grid">
      ${
        monthly.length
          ? monthly.map(row=>`
            <div class="source-card">
              <span>${row.month}</span>
              <strong>${money(row.total)}</strong>
            </div>
          `).join("")
          : `<div class="empty-state">No payments logged yet.</div>`
      }
    </div>
  `;
}

function renderPaymentHistory(){
  const box = document.getElementById("paymentHistory");
  if(!box) return;

  if(!clientPayments.length){
    box.innerHTML = `<div class="empty-state">No payments logged yet.</div>`;
    return;
  }

  box.innerHTML = `
    <div class="visit-list">
      ${clientPayments.slice(0,50).map(payment=>`
        <div class="analytics-client-card">
          <p><strong>${escapeHtml(payment.business_name || payment.client_email || "Payment")}</strong></p>
          <p>${money(payment.amount || 0)} • ${escapeHtml(payment.source || "manual")}</p>
          <p>${escapeHtml(payment.payment_type || "payment")}</p>
          <p style="color:#64748b;font-size:13px;">${formatDateTime(payment.paid_at)}</p>
        </div>
      `).join("")}
    </div>
  `;
}

function getMonthlyRevenue(){
  const groups = {};

  clientPayments.forEach(payment=>{
    if(!payment.paid_at) return;

    const date = new Date(payment.paid_at);
    const key = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}`;

    groups[key] = (groups[key] || 0) + Number(payment.amount || 0);
  });

  return Object.entries(groups)
    .sort((a,b)=>b[0].localeCompare(a[0]))
    .map(([month,total])=>({
      month:formatMonth(month),
      total
    }));
}

function getClientPaymentTotal(clientUserId){
  if(!clientUserId) return 0;

  return clientPayments
    .filter(payment=>payment.client_user_id === clientUserId)
    .reduce((sum,payment)=>sum + Number(payment.amount || 0),0);
}

function renderBillingOverview(){
  const box = document.getElementById("billingOverview");
  if(!box) return;

  const activeSites = clientSites.filter(s=>getBillingStatus(s).text === "Active");
  const pastSites = clientSites.filter(s=>getBillingStatus(s).text === "Past Due");
  const manualSites = clientSites.filter(s=>s.billing_status === "manual paid");
  const coveredSites = clientSites.filter(s=>s.billing_override || s.billing_status === "free");

  const lane = (title,sites,icon)=>`
    <div class="source-card">
      <span>${icon} ${title}</span>
      <strong>${sites.length}</strong>
      <div style="margin-top:14px;display:grid;gap:10px;">
        ${
          sites.slice(0,8).map(site=>`
            <div style="background:white;border:1px solid #e2e8f0;border-radius:14px;padding:12px;">
              <p><strong>${escapeHtml(site.business_name || "Unnamed")}</strong></p>
              <p style="color:#64748b;font-size:13px;">Next: ${formatDate(site.next_payment_date)}</p>
            </div>
          `).join("") || `<p style="color:#64748b;font-size:13px;">None</p>`
        }
      </div>
    </div>
  `;

  box.innerHTML = `
    <div class="grid">
      <div class="stat"><span>Active</span><strong>${activeSites.length}</strong></div>
      <div class="stat"><span>Manual Paid</span><strong>${manualSites.length}</strong></div>
      <div class="stat"><span>Covered</span><strong>${coveredSites.length}</strong></div>
      <div class="stat"><span>Past Due</span><strong>${pastSites.length}</strong></div>
    </div>

    <div class="source-grid">
      ${lane("Active",activeSites,"✅")}
      ${lane("Manual / Covered",[...manualSites,...coveredSites],"🧾")}
      ${lane("Past Due",pastSites,"⚠️")}
    </div>
  `;
}


function renderAnalyticsOverviewFull(){
  const el = document.getElementById("analyticsOverview");
  if(!el) return;

  const total = analyticsEvents.length;
  const today = analyticsEvents.filter(e=>isToday(e.created_at)).length;
  const week = analyticsEvents.filter(e=>isWithinDays(e.created_at,7)).length;
  const leads = leadEvents.length;

  const topClientId = getTopValue(analyticsEvents,"client_user_id");
  const topClient = getClientNameById(topClientId);
  const topSource = getTopReferrer(analyticsEvents);
  const topPage = getTopValue(analyticsEvents,"page") || "—";
  const topDevice = getTopValue(analyticsEvents,"device") || "—";

  el.innerHTML = `
    <div class="analytics-header-grid">
      <div class="stat"><span>Total Views</span><strong>${total}</strong></div>
      <div class="stat"><span>Today</span><strong>${today}</strong></div>
      <div class="stat"><span>7 Days</span><strong>${week}</strong></div>
      <div class="stat"><span>Total Leads</span><strong>${leads}</strong></div>
    </div>

    <div class="source-grid">
      <div class="source-card"><span>Top Client</span><strong>${escapeHtml(topClient)}</strong></div>
      <div class="source-card"><span>Top Source</span><strong>${escapeHtml(topSource)}</strong></div>
      <div class="source-card"><span>Top Page</span><strong>${escapeHtml(topPage)}</strong></div>
      <div class="source-card"><span>Top Device</span><strong>${escapeHtml(topDevice)}</strong></div>
    </div>
  `;

  setupAdminAnalyticsFilters();
  renderAdminVisitsList();
}

function setupAdminAnalyticsFilters(){
  fillAdminFilter(
    "adminAnalyticsClientFilter",
    clientSites
      .filter(site=>site.client_user_id)
      .map(site=>({
        value:site.client_user_id,
        label:site.business_name || site.client_email || site.client_user_id
      })),
    "All Clients"
  );

  fillAdminFilter(
    "adminAnalyticsMonthFilter",
    getAdminAnalyticsMonths().map(month=>({value:month,label:formatAnalyticsMonth(month)})),
    "All Months"
  );

  fillAdminFilter(
    "adminAnalyticsSourceFilter",
    getAdminUniqueSources().map(source=>({value:source,label:source})),
    "All Sources"
  );

  fillAdminFilter(
    "adminAnalyticsDeviceFilter",
    getAdminUniqueFieldValues("device").map(device=>({value:device,label:device})),
    "All Devices"
  );

  fillAdminFilter(
    "adminAnalyticsPageFilter",
    getAdminUniqueFieldValues("page").map(page=>({value:page,label:page})),
    "All Pages"
  );
}

function fillAdminFilter(id, options, allLabel){
  const select = document.getElementById(id);
  if(!select) return;

  const current = select.value || "all";
  select.innerHTML = `<option value="all">${allLabel}</option>`;

  options.forEach(option=>{
    select.innerHTML += `
      <option value="${escapeAttribute(option.value)}">${escapeHtml(option.label)}</option>
    `;
  });

  if([...select.options].some(opt=>opt.value === current)){
    select.value = current;
  }
}

function renderAdminVisitsList(){
  const list = document.getElementById("adminVisitsList");
  if(!list) return;

  const client = getAdminFilterValue("adminAnalyticsClientFilter");
  const month = getAdminFilterValue("adminAnalyticsMonthFilter");
  const source = getAdminFilterValue("adminAnalyticsSourceFilter");
  const device = getAdminFilterValue("adminAnalyticsDeviceFilter");
  const page = getAdminFilterValue("adminAnalyticsPageFilter");

  let filtered = [...analyticsEvents];

  filtered = filtered.filter(event=>{
    const eventMonth = event.created_at
      ? new Date(event.created_at).toISOString().slice(0,7)
      : "";

    const eventSource = cleanReferrer(event.referrer);
    const eventDevice = event.device || "unknown";
    const eventPage = event.page || "unknown";

    return (
      (client === "all" || event.client_user_id === client) &&
      (month === "all" || eventMonth === month) &&
      (source === "all" || eventSource === source) &&
      (device === "all" || eventDevice === device) &&
      (page === "all" || eventPage === page)
    );
  });

  setText("adminVisitCountBadge", `${filtered.length} Visit${filtered.length === 1 ? "" : "s"}`);
  renderFilteredAnalyticsStats(filtered);

  if(!filtered.length){
    list.innerHTML = `<div class="empty-state">No visits match these filters.</div>`;
    return;
  }

  list.innerHTML = filtered.slice(0,100).map(event=>`
    <div class="analytics-client-card">
      <p><strong>${escapeHtml(getClientNameById(event.client_user_id))}</strong></p>
      <p><strong>Page:</strong> ${escapeHtml(event.page || "Website Visit")}</p>
      <p><strong>Source:</strong> ${escapeHtml(cleanReferrer(event.referrer))}</p>
      <p><strong>Device:</strong> ${escapeHtml(event.device || "Unknown")} • ${escapeHtml(event.browser || "Unknown")}</p>
      <p><strong>Path:</strong> ${escapeHtml(event.path || "—")}</p>
      <p style="color:#64748b;font-size:13px;">${timeAgo(event.created_at)}</p>
    </div>
  `).join("");
}

function renderFilteredAnalyticsStats(events){
  const box = document.getElementById("adminAnalyticsFilteredStats");
  if(!box) return;

  const topClient = getClientNameById(getTopValue(events,"client_user_id"));
  const topSource = getTopReferrer(events);
  const topDevice = getTopValue(events,"device") || "—";
  const topPage = getTopValue(events,"page") || "—";

  box.innerHTML = `
    <div class="grid">
      <div class="stat"><span>Filtered Views</span><strong>${events.length}</strong></div>
      <div class="stat"><span>Top Client</span><strong style="font-size:22px;">${escapeHtml(topClient)}</strong></div>
      <div class="stat"><span>Top Source</span><strong style="font-size:22px;">${escapeHtml(topSource)}</strong></div>
      <div class="stat"><span>Top Page</span><strong style="font-size:22px;">${escapeHtml(topPage)}</strong></div>
    </div>

    <div class="source-grid">
      <div class="source-card"><span>Top Device</span><strong>${escapeHtml(topDevice)}</strong></div>
      <div class="source-card"><span>Mobile Views</span><strong>${events.filter(e=>e.device === "mobile").length}</strong></div>
      <div class="source-card"><span>Desktop Views</span><strong>${events.filter(e=>e.device === "desktop").length}</strong></div>
    </div>
  `;
}

function clearAdminAnalyticsFilters(){
  setValue("adminAnalyticsClientFilter","all");
  setValue("adminAnalyticsMonthFilter","all");
  setValue("adminAnalyticsSourceFilter","all");
  setValue("adminAnalyticsDeviceFilter","all");
  setValue("adminAnalyticsPageFilter","all");
  renderAdminVisitsList();
}

function getAdminAnalyticsMonths(){
  return [...new Set(analyticsEvents.map(event=>{
    if(!event.created_at) return null;
    return new Date(event.created_at).toISOString().slice(0,7);
  }).filter(Boolean))].sort().reverse();
}

function formatAnalyticsMonth(key){
  const [year,month] = key.split("-");
  const date = new Date(Number(year), Number(month)-1, 1);

  return date.toLocaleDateString(undefined,{
    month:"long",
    year:"numeric"
  });
}

function getAdminUniqueSources(){
  return [...new Set(analyticsEvents.map(event=>cleanReferrer(event.referrer)))].filter(Boolean).sort();
}

function getAdminUniqueFieldValues(field){
  return [...new Set(analyticsEvents.map(event=>event[field] || "unknown"))].filter(Boolean).sort();
}

function getClientNameById(clientUserId){
  if(!clientUserId) return "Unknown Client";

  const site = clientSites.find(site=>site.client_user_id === clientUserId);
  return site?.business_name || site?.client_email || clientUserId || "Unknown Client";
}

function getAdminFilterValue(id){
  const el = document.getElementById(id);
  return el ? el.value : "all";
}

function escapeAttribute(value){
  return String(value || "")
    .replaceAll("&","&amp;")
    .replaceAll('"',"&quot;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;");
}


function populateAnalyticsClientDropdown(){
  const select = document.getElementById("analyticsClientSelect");
  if(!select) return;

  const current = select.value;
  select.innerHTML = "";

  clientSites.forEach(site=>{
    if(!site.client_user_id) return;

    const option = document.createElement("option");
    option.value = site.client_user_id;
    option.textContent = site.business_name || site.client_email || site.client_user_id;
    select.appendChild(option);
  });

  if(current) select.value = current;

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

  const site = clientSites.find(s=>s.client_user_id === id);
  const events = analyticsEvents.filter(e=>e.client_user_id === id);
  const leads = leadEvents.filter(l=>l.client_user_id === id);

  container.innerHTML = `
    <h2>${escapeHtml(site?.business_name || "Client Analytics")}</h2>

    <div class="analytics-header-grid">
      <div class="stat"><span>Views</span><strong>${events.length}</strong></div>
      <div class="stat"><span>Leads</span><strong>${leads.length}</strong></div>
      <div class="stat"><span>Top Page</span><strong style="font-size:22px;">${escapeHtml(getTopValue(events,"page") || "—")}</strong></div>
      <div class="stat"><span>Device</span><strong style="font-size:22px;">${escapeHtml(getTopValue(events,"device") || "—")}</strong></div>
    </div>

    <h3 style="margin:24px 0 12px;">All Recent Visits</h3>
    <div class="visit-list">
      ${
        events.length
          ? events.slice(0,50).map(event=>`
            <div class="analytics-client-card">
              <p><strong>${escapeHtml(event.page || "Website Visit")}</strong></p>
              <p>Source: ${escapeHtml(cleanReferrer(event.referrer))}</p>
              <p>${escapeHtml(event.device || "Unknown")} • ${escapeHtml(event.browser || "Unknown")}</p>
              <p style="color:#64748b;font-size:13px;">${timeAgo(event.created_at)}</p>
            </div>
          `).join("")
          : `<div class="empty-state">No visits for this client yet.</div>`
      }
    </div>
  `;
}

function openClientDetail(id){
  const site = clientSites.find(s=>s.id === id);
  if(!site) return;

  showAdminPage("clientDetail");

  setText("detailBusinessName", site.business_name || "Client Details");
  setText("detailClientEmail", site.client_email || "");

  const billing = getBillingStatus(site);
  const analytics = site.client_user_id ? getClientAnalytics(site.client_user_id) : null;
  const leads = site.client_user_id ? getClientLeads(site.client_user_id) : null;
  const revenue = getClientPaymentTotal(site.client_user_id);
  const openSupport = site.client_user_id ? supportTickets.filter(t=>t.client_user_id === site.client_user_id && !["closed","resolved"].includes(String(t.status || "").toLowerCase())).length : 0;

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
        <div class="detail-row"><span>Revenue</span><span>${money(revenue)}</span></div>
        <div class="detail-row"><span>Cycle</span><span>${escapeHtml(site.billing_cycle || "monthly")}</span></div>
        <div class="detail-row"><span>Last</span><span>${formatDate(site.last_payment_date)}</span></div>
        <div class="detail-row"><span>Next</span><span>${formatDate(site.next_payment_date)}</span></div>
      </div>

      <div class="detail-card">
        <h3>Performance</h3>
        <div class="detail-row"><span>Views 30d</span><span>${analytics ? analytics.month : 0}</span></div>
        <div class="detail-row"><span>Leads 30d</span><span>${leads ? leads.month : 0}</span></div>
        <div class="detail-row"><span>Support Open</span><span>${openSupport}</span></div>
        <div class="detail-row"><span>Top Page</span><span>${analytics ? escapeHtml(analytics.topPage) : "—"}</span></div>
      </div>

      <div class="detail-card">
        <h3>Notes</h3>
        <p>${escapeHtml(site.notes || "No notes.")}</p>
      </div>
    </div>
  `;
}

function populateSEOClientDropdown(){
  const select = document.getElementById("seoClientSelect");
  if(!select) return;

  const current = select.value;
  select.innerHTML = "";

  clientSites.forEach(site=>{
    if(!site.client_user_id) return;

    const option = document.createElement("option");
    option.value = site.client_user_id;
    option.textContent = site.business_name || site.client_email || site.client_user_id;
    select.appendChild(option);
  });

  if(current) select.value = current;

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

  const keywords = [name,type,location,`${type} near me`,`affordable ${type}`,`${name} website`].filter(Boolean).join(", ");

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
    const site = clientSites.find(s=>s.client_user_id === req.client_user_id);
    const liveUrl = site ? getClientLiveUrl(site) : LIVE_BASE_URL;

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
        ${req.image_url ? `
  <a href="${req.image_url}" target="_blank">
    <img src="${req.image_url}" style="
      width:100%;
      max-height:260px;
      object-fit:cover;
      border-radius:12px;
      margin-top:10px;
      border:1px solid rgba(255,255,255,.12);
    ">
  </a>
` : ""}
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

function getClientAnalytics(clientUserId){
  const events = analyticsEvents.filter(e=>e.client_user_id === clientUserId);

  return {
    today:events.filter(e=>isToday(e.created_at)).length,
    week:events.filter(e=>isWithinDays(e.created_at,7)).length,
    month:events.filter(e=>isWithinDays(e.created_at,30)).length,
    topPage:getTopValue(events,"page") || "—"
  };
}

function getClientLeads(clientUserId){
  const leads = leadEvents.filter(l=>l.client_user_id === clientUserId);

  return {
    today:leads.filter(l=>isToday(l.created_at)).length,
    week:leads.filter(l=>isWithinDays(l.created_at,7)).length,
    month:leads.filter(l=>isWithinDays(l.created_at,30)).length
  };
}

function getClientLiveUrl(site){
  if(site.domain && site.domain_status === "live" && site.domain_release_status !== "released"){
    return `https://${site.domain}`;
  }

  if(site.site_url) return site.site_url;
  if(site.live_url) return site.live_url;
  if(site.published_url) return site.published_url;

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

function getTicketBadgeClass(status){
  const s = String(status || "").toLowerCase();
  if(s === "closed" || s === "resolved") return "full";
  if(s === "in progress") return "safe";
  return "danger";
}

function getPriorityBadgeClass(priority){
  const p = String(priority || "").toLowerCase();
  if(p === "urgent") return "danger";
  if(p === "high") return "safe";
  return "";
}

function setText(id,value){
  const el = document.getElementById(id);
  if(el) el.textContent = value ?? "";
}

function setValue(id,value){
  const el = document.getElementById(id);
  if(el) el.value = value || "";
}

function cleanValue(id){
  const el = document.getElementById(id);
  return el ? el.value.trim() : "";
}

function copyText(text){
  navigator.clipboard.writeText(text);
  alert("Copied.");
}

function toggleSidebar(){
  document.body.classList.toggle("sidebar-open");
}

function toDateInput(date){
  return date.toISOString().split("T")[0];
}

function formatDate(dateString){
  if(!dateString) return "—";
  return new Date(dateString + "T00:00:00").toLocaleDateString();
}

function formatDateTime(dateString){
  if(!dateString) return "—";
  return new Date(dateString).toLocaleString();
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

function isCurrentMonth(dateString){
  if(!dateString) return false;

  const date = new Date(dateString);
  const now = new Date();

  return date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth();
}

function getTopValue(items,key){
  const counts = {};

  items.forEach(item=>{
    const value = item[key] || "unknown";
    counts[value] = (counts[value] || 0) + 1;
  });

  return Object.entries(counts).sort((a,b)=>b[1]-a[1])[0]?.[0] || null;
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

function getInitials(text){
  return String(text || "C")
    .split(" ")
    .filter(Boolean)
    .slice(0,2)
    .map(word=>word[0])
    .join("")
    .toUpperCase();
}

function formatMonth(key){
  const [year,month] = key.split("-");
  const date = new Date(Number(year), Number(month)-1, 1);

  return date.toLocaleDateString(undefined,{
    month:"long",
    year:"numeric"
  });
}

function money(amount){
  return "$" + Number(amount || 0).toLocaleString(undefined,{
    minimumFractionDigits:2,
    maximumFractionDigits:2
  });
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
