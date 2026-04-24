let adminUser = null;
let clientSites = [];
let changeRequests = [];
let activeBillingFilter = "all";

const BASE_URL = "https://tylorg811-byte.github.io/giles-client-portal";

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
        <p>This page is only available to approved admin users.</p>
      </div>
    `;
    return;
  }

  await loadClientSites();
  await loadChangeRequests();
}

async function checkAdminAccess(){
  const { data, error } = await db
    .from("admin_users")
    .select("*")
    .eq("user_id", adminUser.id)
    .single();

  return !!data && !error;
}

async function loadClientSites(){
  const { data, error } = await db
    .from("client_sites")
    .select("*")
    .order("created_at", { ascending:false });

  if(error){
    document.getElementById("clientList").innerHTML = "Could not load client sites.";
    console.error(error);
    return;
  }

  clientSites = data || [];
  renderStats();
  applyBillingFilter();
}

async function loadChangeRequests(){
  const { data, error } = await db
    .from("change_requests")
    .select("*")
    .order("created_at", { ascending:false });

  if(error){
    document.getElementById("changeRequestList").innerHTML = "Could not load requests.";
    console.error(error);
    return;
  }

  changeRequests = data || [];
  renderStats();
  renderChangeRequests();
}

function renderStats(){
  document.getElementById("totalClients").textContent = clientSites.length;

  document.getElementById("publishedClients").textContent =
    clientSites.filter(site => site.site_status === "published").length;

  document.getElementById("pastDueClients").textContent =
    clientSites.filter(site => getBillingStatus(site).text === "Past Due").length;

  const requestCounter = document.getElementById("newRequests");
  if(requestCounter){
    requestCounter.textContent =
      changeRequests.filter(req => req.status === "new").length;
  }
}

function getClientLiveUrl(site){
  if(site.domain && site.domain_status === "live" && site.domain_release_status !== "released"){
    return `https://${site.domain}`;
  }

  if(site.client_user_id){
    return `${BASE_URL}/index.html?client=${site.client_user_id}`;
  }

  return `${BASE_URL}/index.html`;
}

function getBillingStatus(site){
  if(site.billing_override){
    return { text:"Covered by Giles", class:"full" };
  }

  if(site.billing_status === "free"){
    return { text:"Free / Comped", class:"full" };
  }

  if(site.billing_status === "manual paid"){
    return { text:"Manual Paid", class:"full" };
  }

  if(site.billing_status === "trial"){
    return { text:"Trial", class:"safe" };
  }

  if(site.billing_status === "paused"){
    return { text:"Paused", class:"dark" };
  }

  if(site.billing_status === "past due"){
    return { text:"Past Due", class:"danger" };
  }

  const today = new Date();
  today.setHours(0,0,0,0);

  const next = site.next_payment_date ? new Date(site.next_payment_date + "T00:00:00") : null;

  if(!next){
    return { text:"Active", class:"full" };
  }

  if(next < today){
    return { text:"Past Due", class:"danger" };
  }

  return { text:"Active", class:"full" };
}

function applyBillingFilter(){
  const filter = document.getElementById("billingFilter")?.value || "all";
  activeBillingFilter = filter;

  let filtered = [...clientSites];

  if(filter !== "all"){
    filtered = clientSites.filter(site=>{
      const status = getBillingStatus(site).text.toLowerCase();
      const raw = (site.billing_status || "").toLowerCase();

      if(filter === "active") return status === "active";
      if(filter === "past") return status === "past due";
      if(filter === "covered") return status === "covered by giles";
      if(filter === "free") return raw === "free";
      if(filter === "trial") return raw === "trial";
      if(filter === "paused") return raw === "paused";
      if(filter === "manual paid") return raw === "manual paid";

      return true;
    });
  }

  renderClientSites(filtered);
}

function renderClientSites(sites = clientSites){
  const list = document.getElementById("clientList");
  list.innerHTML = "";

  if(!sites.length){
    list.innerHTML = "<p>No client sites match this filter.</p>";
    return;
  }

  sites.forEach(site=>{
    const card = document.createElement("div");
    card.className = "client-card";

    const domainText = site.domain || "No domain yet";
    const liveUrl = getClientLiveUrl(site);

    const editorUrl = site.client_user_id
      ? `editor.html?client=${site.client_user_id}`
      : "editor.html";

    const accessText = site.editor_access === "full" ? "Full Editor Access" : "Safe Mode";
    const accessClass = site.editor_access === "full" ? "full" : "safe";

    const billing = getBillingStatus(site);

    const releaseStatus = site.domain_release_status || "connected";
    const releaseClass = releaseStatus === "released" ? "danger" : releaseStatus === "release requested" ? "safe" : "";

    card.innerHTML = `
      <div>
        <h3>${escapeHtml(site.business_name || "Unnamed Business")}</h3>
        <p>${escapeHtml(site.client_email || "No email")}</p>
        <p><strong>User ID:</strong> ${escapeHtml(site.client_user_id || "Not assigned")}</p>
        <p><strong>Editor:</strong> <span class="badge ${accessClass}">${accessText}</span></p>
        <p><strong>Billing:</strong> <span class="badge ${billing.class}">${billing.text}</span></p>
        <p><strong>Cycle:</strong> ${escapeHtml(site.billing_cycle || "monthly")}</p>
        ${site.last_payment_date ? `<p><strong>Last Paid:</strong> ${formatDate(site.last_payment_date)}</p>` : ""}
        ${site.next_payment_date ? `<p><strong>Next Due:</strong> ${formatDate(site.next_payment_date)}</p>` : ""}
        ${site.billing_override ? `<p><strong>Override:</strong> <span class="badge full">Enabled</span></p>` : ""}
      </div>

      <div>
        <p><strong>Package</strong></p>
        <span class="badge">${escapeHtml(site.package_name || "None")}</span>
      </div>

      <div>
        <p><strong>Domain</strong></p>
        <p>${escapeHtml(domainText)}</p>
        <span class="badge">${escapeHtml(site.domain_status || "not connected")}</span>
        <p style="margin-top:8px;"><strong>Release:</strong></p>
        <span class="badge ${releaseClass}">${escapeHtml(releaseStatus)}</span>
        ${site.domain_released_at ? `<p>Released ${timeAgo(site.domain_released_at)}</p>` : ""}
      </div>

      <div class="actions">
        <button onclick="editClientSite('${site.id}')">Edit</button>
        <a href="${editorUrl}" target="_blank">Open Editor</a>
        <a href="${liveUrl}" target="_blank">View Site</a>
        <button onclick="copyText('${liveUrl}')">Copy Live</button>
        <button onclick="copyClientEditorLink('${editorUrl}')">Copy Editor</button>
        <button onclick="copyLoginLink()">Copy Login</button>
        ${site.domain ? `<button class="release-btn" onclick="releaseDomain('${site.id}')">Release Domain</button>` : ""}
        <button class="danger" onclick="deleteClientSite('${site.id}')">Delete</button>
      </div>
    `;

    list.appendChild(card);
  });
}

function renderChangeRequests(){
  const list = document.getElementById("changeRequestList");
  list.innerHTML = "";

  if(!changeRequests.length){
    list.innerHTML = "<p>No change requests yet.</p>";
    return;
  }

  changeRequests.forEach(req=>{
    const card = document.createElement("div");
    card.className = "request-card";

    const editorUrl = req.client_user_id
      ? `editor.html?client=${req.client_user_id}`
      : "editor.html";

    const liveUrl = req.client_user_id
      ? `${BASE_URL}/index.html?client=${req.client_user_id}`
      : `${BASE_URL}/index.html`;

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
        <a href="${editorUrl}" target="_blank">Open Editor</a>
        <a href="${liveUrl}" target="_blank">View Site</a>
        <button class="danger" onclick="deleteChangeRequest('${req.id}')">Delete</button>
      </div>
    `;

    list.appendChild(card);
  });
}

async function releaseDomain(id){
  const site = clientSites.find(item => item.id === id);
  if(!site) return;

  const reason = prompt(
    `Release domain for ${site.business_name || site.client_email}?\n\nThis will mark the domain as released in your portal and stop using it as the live managed URL.\n\nReason:`,
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
    alert("Domain release failed.");
    console.error(error);
    return;
  }

  if(site.client_user_id){
    await db.from("notifications").insert({
      user_id: site.client_user_id,
      title: "Domain released",
      message: `Your domain ${site.domain} has been marked as released from Giles Web Design management. ${reason ? "Reason: " + reason : ""}`,
      type: "domain"
    });
  }

  alert("Domain marked as released.");
  await loadClientSites();
}

async function updateChangeRequest(id, clientUserId){
  const status = document.getElementById(`status-${id}`).value;
  const notes = document.getElementById(`notes-${id}`).value.trim();

  const { error } = await db
    .from("change_requests")
    .update({
      status: status,
      admin_notes: notes,
      updated_at: new Date().toISOString()
    })
    .eq("id", id);

  if(error){
    alert("Request update failed.");
    console.error(error);
    return;
  }

  if(clientUserId){
    await db.from("notifications").insert({
      user_id: clientUserId,
      title: "Request status updated",
      message: `Your request is now marked as "${status}".${notes ? " Note: " + notes : ""}`,
      type: "request"
    });
  }

  await loadChangeRequests();
  alert("Request updated.");
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
}

async function saveClientSite(){
  const id = document.getElementById("clientRecordId").value;

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
    billing_status: cleanValue("billingStatus") || "active",
    billing_override: cleanValue("billingOverride") === "true",
    billing_override_reason: cleanValue("billingOverrideReason"),
    billing_notes: cleanValue("billingNotes"),
    billing_cycle: cleanValue("billingCycle") || "monthly",
    next_payment_date: cleanValue("nextPaymentDate") || null,
    last_payment_date: cleanValue("lastPaymentDate") || null,
    notes: cleanValue("notes"),
    updated_at: new Date().toISOString()
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
    document.getElementById("message").textContent = "Save failed.";
    console.error(response.error);
    return;
  }

  if(payload.client_user_id){
    const billing = getBillingStatus(payload);

    await db.from("notifications").insert({
      user_id: payload.client_user_id,
      title: "Website account updated",
      message: `Your website status is "${payload.site_status}". Billing: "${billing.text}".${payload.next_payment_date ? " Next payment: " + payload.next_payment_date + "." : ""}`,
      type: "site"
    });
  }

  document.getElementById("message").textContent = "Client site saved.";
  clearClientForm();
  await loadClientSites();
}

function editClientSite(id){
  const site = clientSites.find(item => item.id === id);
  if(!site) return;

  document.getElementById("clientRecordId").value = site.id;
  document.getElementById("businessName").value = site.business_name || "";
  document.getElementById("clientEmail").value = site.client_email || "";
  document.getElementById("clientUserId").value = site.client_user_id || "";
  document.getElementById("packageName").value = site.package_name || "Starter";
  document.getElementById("domain").value = site.domain || "";
  document.getElementById("domainStatus").value = site.domain_status || "not connected";
  document.getElementById("domainReleaseStatus").value = site.domain_release_status || "connected";
  document.getElementById("domainReleaseNotes").value = site.domain_release_notes || "";
  document.getElementById("siteStatus").value = site.site_status || "draft";
  document.getElementById("editorAccess").value = site.editor_access || "safe";
  document.getElementById("billingStatus").value = site.billing_status || "active";
  document.getElementById("billingOverride").value = site.billing_override ? "true" : "false";
  document.getElementById("billingOverrideReason").value = site.billing_override_reason || "";
  document.getElementById("billingNotes").value = site.billing_notes || "";
  document.getElementById("billingCycle").value = site.billing_cycle || "monthly";
  document.getElementById("nextPaymentDate").value = site.next_payment_date || "";
  document.getElementById("lastPaymentDate").value = site.last_payment_date || "";
  document.getElementById("notes").value = site.notes || "";

  scrollToForm();
}

async function deleteClientSite(id){
  if(!confirm("Delete this client site record?")) return;

  const { error } = await db
    .from("client_sites")
    .delete()
    .eq("id", id);

  if(error){
    alert("Delete failed.");
    console.error(error);
    return;
  }

  await loadClientSites();
}

function clearClientForm(){
  document.getElementById("clientRecordId").value = "";
  document.getElementById("businessName").value = "";
  document.getElementById("clientEmail").value = "";
  document.getElementById("clientUserId").value = "";
  document.getElementById("packageName").value = "Starter";
  document.getElementById("domain").value = "";
  document.getElementById("domainStatus").value = "not connected";
  document.getElementById("domainReleaseStatus").value = "connected";
  document.getElementById("domainReleaseNotes").value = "";
  document.getElementById("siteStatus").value = "draft";
  document.getElementById("editorAccess").value = "safe";
  document.getElementById("billingStatus").value = "active";
  document.getElementById("billingOverride").value = "false";
  document.getElementById("billingOverrideReason").value = "";
  document.getElementById("billingNotes").value = "";
  document.getElementById("billingCycle").value = "monthly";
  document.getElementById("nextPaymentDate").value = "";
  document.getElementById("lastPaymentDate").value = "";
  document.getElementById("notes").value = "";
}

function scrollToForm(){
  document.getElementById("clientFormCard").scrollIntoView({
    behavior:"smooth",
    block:"start"
  });
}

function copyLoginLink(){
  copyText(`${BASE_URL}/login.html`);
}

function copyClientEditorLink(editorUrl){
  copyText(`${BASE_URL}/${editorUrl}`);
}

function copyText(text){
  navigator.clipboard.writeText(text);
  alert("Copied.");
}

function cleanValue(id){
  const el = document.getElementById(id);
  return el ? el.value.trim() : "";
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
