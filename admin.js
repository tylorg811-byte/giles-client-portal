let adminUser = null;
let clientSites = [];
let changeRequests = [];
let analyticsEvents = [];

const LIVE_BASE_URL = "https://giles-sites.netlify.app";

document.addEventListener("DOMContentLoaded", loadAdminDashboard);

async function loadAdminDashboard(){
  adminUser = await checkUser();
  if(!adminUser) return;

  document.getElementById("adminEmail").textContent = adminUser.email;

  const isAdmin = await checkAdminAccess();

  if(!isAdmin){
    document.querySelector(".main").innerHTML = `
      <div class="card">
        <h1>Admin access required</h1>
      </div>
    `;
    return;
  }

  await loadClientSites();
  await loadChangeRequests();
  await loadAnalytics();

  renderStats();
  renderChangeRequests();
  renderAnalyticsOverviewFull();
  populateAnalyticsClientDropdown();
  loadClientAnalyticsView();
}

function showAdminPage(page){
  document.querySelectorAll(".page-section").forEach(s=>s.classList.remove("active"));
  document.querySelectorAll(".sidebar button").forEach(b=>b.classList.remove("active-nav"));

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

  document.getElementById("pageTitle").textContent = titles[page] || "Admin";

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

  if(window.innerWidth <= 1100){
    document.body.classList.remove("sidebar-open");
  }
}

async function checkAdminAccess(){
  const { data } = await db
    .from("admin_users")
    .select("*")
    .eq("user_id", adminUser.id)
    .single();

  return !!data;
}

async function loadClientSites(){
  const { data, error } = await db
    .from("client_sites")
    .select("*")
    .order("created_at", { ascending:false });

  if(error){
    console.error(error);
    document.getElementById("clientList").innerHTML = `<div class="empty-state">Could not load clients.</div>`;
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

function renderStats(){
  document.getElementById("totalClients").textContent = clientSites.length;

  document.getElementById("publishedClients").textContent =
    clientSites.filter(s=>s.site_status === "published").length;

  document.getElementById("pastDueClients").textContent =
    clientSites.filter(s=>getBillingStatus(s).text === "Past Due").length;

  document.getElementById("newRequests").textContent =
    changeRequests.filter(r=>r.status === "new").length;
}

function applyClientFilters(){
  const search = document.getElementById("clientSearch")?.value.toLowerCase() || "";
  const billing = document.getElementById("billingFilter")?.value || "all";
  const siteStatus = document.getElementById("siteStatusFilter")?.value || "all";
  const access = document.getElementById("editorAccessFilter")?.value || "all";
  const domain = document.getElementById("domainFilter")?.value || "all";

  let filtered = [...clientSites];

  filtered = filtered.filter(site=>{
    const matchSearch =
      (site.business_name || "").toLowerCase().includes(search) ||
      (site.client_email || "").toLowerCase().includes(search) ||
      (site.domain || "").toLowerCase().includes(search);

    const billingText = getBillingStatus(site).text.toLowerCase();

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

    const card = document.createElement("div");
    card.className = "client-card";

    card.innerHTML = `
      <div>
        <h3>${escapeHtml(site.business_name || "Unnamed Business")}</h3>
        <p>${escapeHtml(site.client_email || "")}</p>
        <p>${escapeHtml(site.domain || "No domain")}</p>

        <div style="margin-top:10px;">
          <span class="badge">${escapeHtml(site.package_name || "Package")}</span>
          <span class="badge ${billing.class}">${billing.text}</span>
        </div>
      </div>

      <div>
        <p><strong>Status:</strong> ${escapeHtml(site.site_status || "draft")}</p>
        <p><strong>Editor:</strong> ${escapeHtml(site.editor_access || "safe")}</p>
        <p><strong>Views:</strong> ${analytics ? analytics.month : 0} / 30d</p>
      </div>

      <div>
        <p><strong>Billing:</strong> ${escapeHtml(site.billing_status || "active")}</p>
        <p><strong>Next:</strong> ${formatDate(site.next_payment_date)}</p>
        <p><strong>Top Page:</strong> ${analytics ? escapeHtml(analytics.topPage) : "—"}</p>
      </div>

      <div class="actions">
        <button onclick="openClientDetail('${site.id}')">View</button>
        <a href="${liveUrl}" target="_blank">View Site</a>
        <a href="editor.html?client=${site.client_user_id}" target="_blank">Editor</a>
        <button onclick="editClientSite('${site.id}')">Edit</button>
      </div>
    `;

    list.appendChild(card);
  });
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
        <p style="margin-top:8px;">${timeAgo(req.created_at)}</p>
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
        <button class="danger" onclick="deleteChangeRequest('${req.id}')">Delete</button>
      </div>
    `;

    list.appendChild(card);
  });
}

function renderAnalyticsOverviewFull(){
  const container = document.getElementById("analyticsOverview");
  if(!container) return;

  const total = analyticsEvents.length;
  const today = analyticsEvents.filter(e=>isToday(e.created_at)).length;
  const week = analyticsEvents.filter(e=>isWithinDays(e.created_at,7)).length;
  const topPage = getTopValue(analyticsEvents,"page") || "—";
  const topDevice = getTopValue(analyticsEvents,"device") || "—";

  container.innerHTML = `
    <div class="grid">
      <div class="stat"><span>Total Views</span><strong>${total}</strong></div>
      <div class="stat"><span>Today</span><strong>${today}</strong></div>
      <div class="stat"><span>7 Days</span><strong>${week}</strong></div>
      <div class="stat"><span>Top Device</span><strong style="font-size:20px;">${escapeHtml(topDevice)}</strong></div>
    </div>

    <div class="analytics-client-card">
      <p><strong>Top Page Overall:</strong> ${escapeHtml(topPage)}</p>
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

  const site = clientSites.find(s=>s.client_user_id === id);
  const events = analyticsEvents.filter(e=>e.client_user_id === id);

  const today = events.filter(e=>isToday(e.created_at)).length;
  const week = events.filter(e=>isWithinDays(e.created_at,7)).length;
  const month = events.length;
  const topPage = getTopValue(events,"page") || "—";
  const topDevice = getTopValue(events,"device") || "—";
  const topBrowser = getTopValue(events,"browser") || "—";

  const recent = events.slice(0,10).map(e=>`
    <div class="analytics-client-card">
      <p><strong>${escapeHtml(e.page || "home")}</strong></p>
      <p>${escapeHtml(e.device || "unknown")} • ${escapeHtml(e.browser || "unknown")} • ${timeAgo(e.created_at)}</p>
      <p>Referrer: ${escapeHtml(cleanReferrer(e.referrer))}</p>
    </div>
  `).join("");

  container.innerHTML = `
    <h2>${escapeHtml(site?.business_name || "Client Analytics")}</h2>

    <div class="grid">
      <div class="stat"><span>Today</span><strong>${today}</strong></div>
      <div class="stat"><span>7 Days</span><strong>${week}</strong></div>
      <div class="stat"><span>30 Days</span><strong>${month}</strong></div>
      <div class="stat"><span>Top Page</span><strong style="font-size:18px;">${escapeHtml(topPage)}</strong></div>
    </div>

    <div class="analytics-table">
      <div class="analytics-client-card"><p><strong>Top Device</strong></p><p>${escapeHtml(topDevice)}</p></div>
      <div class="analytics-client-card"><p><strong>Top Browser</strong></p><p>${escapeHtml(topBrowser)}</p></div>
      <div class="analytics-client-card"><p><strong>Domain</strong></p><p>${escapeHtml(site?.domain || "No domain")}</p></div>
      <div class="analytics-client-card"><p><strong>Live URL</strong></p><p style="word-break:break-word;">${escapeHtml(site ? getClientLiveUrl(site) : "—")}</p></div>
    </div>

    <h3 style="margin:22px 0 12px;">Recent Visits</h3>
    <div class="request-list">
      ${recent || "<p>No analytics yet.</p>"}
    </div>
  `;
}

function renderBillingOverview(){
  const box = document.getElementById("billingOverview");
  if(!box) return;

  const active = clientSites.filter(s=>getBillingStatus(s).text === "Active").length;
  const covered = clientSites.filter(s=>getBillingStatus(s).text === "Covered by Giles").length;
  const past = clientSites.filter(s=>getBillingStatus(s).text === "Past Due").length;
  const manual = clientSites.filter(s=>s.billing_status === "manual paid").length;

  box.innerHTML = `
    <div class="grid">
      <div class="stat"><span>Active</span><strong>${active}</strong></div>
      <div class="stat"><span>Covered</span><strong>${covered}</strong></div>
      <div class="stat"><span>Manual Paid</span><strong>${manual}</strong></div>
      <div class="stat"><span>Past Due</span><strong>${past}</strong></div>
    </div>
  `;
}

function openClientDetail(id){
  const site = clientSites.find(s=>s.id === id);
  if(!site) return;

  showAdminPage("clientDetail");

  document.getElementById("detailBusinessName").textContent = site.business_name || "Client Details";
  document.getElementById("detailClientEmail").textContent = site.client_email || "";

  const analytics = site.client_user_id ? getClientAnalytics(site.client_user_id) : null;
  const billing = getBillingStatus(site);

  document.getElementById("clientDetailContent").innerHTML = `
    <div class="detail-grid">
      <div class="detail-card">
        <h3>Website</h3>
        <div class="detail-row"><span>Status</span><span>${escapeHtml(site.site_status || "draft")}</span></div>
        <div class="detail-row"><span>Domain</span><span>${escapeHtml(site.domain || "—")}</span></div>
        <div class="detail-row"><span>Editor Access</span><span>${escapeHtml(site.editor_access || "safe")}</span></div>
        <div style="margin-top:14px;">
          <a class="primary" href="${getClientLiveUrl(site)}" target="_blank">Open Site</a>
        </div>
      </div>

      <div class="detail-card">
        <h3>Billing</h3>
        <div class="detail-row"><span>Status</span><span>${billing.text}</span></div>
        <div class="detail-row"><span>Cycle</span><span>${escapeHtml(site.billing_cycle || "monthly")}</span></div>
        <div class="detail-row"><span>Next Payment</span><span>${formatDate(site.next_payment_date)}</span></div>
      </div>

      <div class="detail-card">
        <h3>Analytics</h3>
        <div class="detail-row"><span>Today</span><span>${analytics ? analytics.today : 0}</span></div>
        <div class="detail-row"><span>7 Days</span><span>${analytics ? analytics.week : 0}</span></div>
        <div class="detail-row"><span>30 Days</span><span>${analytics ? analytics.month : 0}</span></div>
        <div class="detail-row"><span>Top Page</span><span>${analytics ? escapeHtml(analytics.topPage) : "—"}</span></div>
      </div>

      <div class="detail-card">
        <h3>Notes</h3>
        <p>${escapeHtml(site.notes || "No notes.")}</p>
      </div>
    </div>
  `;
}

async function updateChangeRequest(id, clientUserId){
  const status = document.getElementById(`status-${id}`).value;
  const notes = document.getElementById(`notes-${id}`).value.trim();

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
}

/* keep existing form functions from your previous admin.js if they are below this line */
function getClientAnalytics(clientUserId){
  const events = analyticsEvents.filter(e=>e.client_user_id === clientUserId);

  return {
    today:events.filter(e=>isToday(e.created_at)).length,
    week:events.filter(e=>isWithinDays(e.created_at,7)).length,
    month:events.length,
    topPage:getTopValue(events,"page") || "—"
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

  const next = site.next_payment_date ? new Date(site.next_payment_date + "T00:00:00") : null;

  if(next && next < today){
    return { text:"Past Due", class:"danger" };
  }

  return { text:"Active", class:"full" };
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

  document.getElementById("clientFormCard").scrollIntoView({
    behavior:"smooth",
    block:"start"
  });
}

function toggleSidebar(){
  document.body.classList.toggle("sidebar-open");
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

function cleanReferrer(ref){
  if(!ref || ref === "direct") return "direct";

  try{
    return new URL(ref).hostname;
  }catch(e){
    return ref;
  }
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

function formatDate(d){
  if(!d) return "—";
  return new Date(d + "T00:00:00").toLocaleDateString();
}

function escapeHtml(str){
  return String(str || "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

function capitalize(str){
  return str.charAt(0).toUpperCase() + str.slice(1);
}
