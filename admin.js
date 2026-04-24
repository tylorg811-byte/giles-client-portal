let adminUser = null;
let clientSites = [];
let changeRequests = [];
let analyticsEvents = [];

const LIVE_BASE_URL = "https://giles-sites.netlify.app";

document.addEventListener("DOMContentLoaded", loadAdminDashboard);

/* =========================
   INIT
=========================*/
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
}

/* =========================
   NAVIGATION
=========================*/
function showAdminPage(page){
  document.querySelectorAll(".page-section").forEach(s=>s.classList.remove("active"));
  document.querySelectorAll(".sidebar button").forEach(b=>b.classList.remove("active-nav"));

  document.getElementById(`${page}Page`).classList.add("active");
  document.getElementById(`nav${capitalize(page)}`)?.classList.add("active-nav");

  const titles = {
    clients:"Client Websites",
    importer:"Website Importer",
    analytics:"Analytics",
    requests:"Change Requests",
    billing:"Billing"
  };

  document.getElementById("pageTitle").textContent = titles[page] || "Admin";

  if(window.innerWidth <= 1100){
    document.body.classList.remove("sidebar-open");
  }
}

/* =========================
   AUTH
=========================*/
async function checkAdminAccess(){
  const { data } = await db
    .from("admin_users")
    .select("*")
    .eq("user_id", adminUser.id)
    .single();

  return !!data;
}

/* =========================
   LOAD DATA
=========================*/
async function loadClientSites(){
  const { data } = await db
    .from("client_sites")
    .select("*")
    .order("created_at", { ascending:false });

  clientSites = data || [];

  renderStats();
  applyClientFilters();
}

async function loadChangeRequests(){
  const { data } = await db
    .from("change_requests")
    .select("*")
    .order("created_at", { ascending:false });

  changeRequests = data || [];
  renderChangeRequests();
}

async function loadAnalytics(){
  const { data } = await db
    .from("site_analytics_events")
    .select("*")
    .order("created_at", { ascending:false });

  analyticsEvents = data || [];
}

/* =========================
   STATS
=========================*/
function renderStats(){
  document.getElementById("totalClients").textContent = clientSites.length;

  document.getElementById("publishedClients").textContent =
    clientSites.filter(s=>s.site_status === "published").length;

  document.getElementById("pastDueClients").textContent =
    clientSites.filter(s=>getBillingStatus(s).text === "Past Due").length;

  document.getElementById("newRequests").textContent =
    changeRequests.filter(r=>r.status === "new").length;
}

/* =========================
   FILTERS
=========================*/
function applyClientFilters(){
  const search = document.getElementById("clientSearch").value.toLowerCase();
  const billing = document.getElementById("billingFilter").value;
  const siteStatus = document.getElementById("siteStatusFilter").value;
  const access = document.getElementById("editorAccessFilter").value;
  const domain = document.getElementById("domainFilter").value;

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

/* =========================
   CLIENT LIST
=========================*/
function renderClientSites(sites){
  const list = document.getElementById("clientList");
  list.innerHTML = "";

  if(!sites.length){
    list.innerHTML = `<div class="empty-state">No clients found.</div>`;
    return;
  }

  sites.forEach(site=>{
    const billing = getBillingStatus(site);
    const liveUrl = getClientLiveUrl(site);

    const card = document.createElement("div");
    card.className = "client-card";

    card.innerHTML = `
      <div>
        <h3>${escapeHtml(site.business_name)}</h3>
        <p>${escapeHtml(site.client_email)}</p>
        <p>${escapeHtml(site.domain || "No domain")}</p>

        <div style="margin-top:10px;">
          <span class="badge">${site.package_name}</span>
          <span class="badge ${billing.class}">${billing.text}</span>
        </div>
      </div>

      <div>
        <p><strong>Status:</strong> ${site.site_status}</p>
        <p><strong>Editor:</strong> ${site.editor_access}</p>
      </div>

      <div>
        <p><strong>Billing:</strong> ${site.billing_status}</p>
        <p><strong>Next:</strong> ${formatDate(site.next_payment_date)}</p>
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

/* =========================
   CLIENT DETAIL VIEW
=========================*/
function openClientDetail(id){
  const site = clientSites.find(s=>s.id === id);
  if(!site) return;

  showAdminPage("clientDetail");

  document.getElementById("detailBusinessName").textContent = site.business_name;
  document.getElementById("detailClientEmail").textContent = site.client_email;

  const container = document.getElementById("clientDetailContent");

  container.innerHTML = `
    <div class="detail-grid">
      
      <div class="detail-card">
        <h3>Website</h3>
        <div class="detail-row"><span>Status</span><span>${site.site_status}</span></div>
        <div class="detail-row"><span>Domain</span><span>${site.domain || "—"}</span></div>
        <div class="detail-row"><span>Editor Access</span><span>${site.editor_access}</span></div>
        <div style="margin-top:14px;">
          <a class="primary" href="${getClientLiveUrl(site)}" target="_blank">Open Site</a>
        </div>
      </div>

      <div class="detail-card">
        <h3>Billing</h3>
        <div class="detail-row"><span>Status</span><span>${site.billing_status}</span></div>
        <div class="detail-row"><span>Cycle</span><span>${site.billing_cycle}</span></div>
        <div class="detail-row"><span>Next Payment</span><span>${formatDate(site.next_payment_date)}</span></div>
      </div>

      <div class="detail-card">
        <h3>Notes</h3>
        <p>${escapeHtml(site.notes || "No notes.")}</p>
      </div>

    </div>
  `;
}

/* =========================
   HELPERS
=========================*/
function getClientLiveUrl(site){
  if(site.domain && site.domain_status === "live"){
    return `https://${site.domain}`;
  }
  return `${LIVE_BASE_URL}/?client=${site.client_user_id}`;
}

function getBillingStatus(site){
  if(site.billing_override) return { text:"Covered by Giles", class:"full" };
  if(site.billing_status === "past due") return { text:"Past Due", class:"danger" };
  if(site.billing_status === "free") return { text:"Free", class:"safe" };
  return { text:"Active", class:"full" };
}

function formatDate(d){
  if(!d) return "—";
  return new Date(d).toLocaleDateString();
}

function escapeHtml(str){
  return String(str || "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;");
}

function capitalize(str){
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/* =========================
   SIDEBAR
=========================*/
function toggleSidebar(){
  document.body.classList.toggle("sidebar-open");
}
