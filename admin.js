let adminUser = null;
let clientSites = [];
let changeRequests = [];

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
  renderClientSites();
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

  document.getElementById("liveDomains").textContent =
    clientSites.filter(site => site.domain_status === "live").length;

  const requestCounter = document.getElementById("newRequests");
  if(requestCounter){
    requestCounter.textContent =
      changeRequests.filter(req => req.status === "new").length;
  }
}

function getClientLiveUrl(site){
  if(site.domain && site.domain_status === "live"){
    return `https://${site.domain}`;
  }

  if(site.client_user_id){
    return `${BASE_URL}/index.html?client=${site.client_user_id}`;
  }

  return `${BASE_URL}/index.html`;
}

function renderClientSites(){
  const list = document.getElementById("clientList");
  list.innerHTML = "";

  if(!clientSites.length){
    list.innerHTML = "<p>No client sites yet.</p>";
    return;
  }

  clientSites.forEach(site=>{
    const card = document.createElement("div");
    card.className = "client-card";

    const domainText = site.domain || "No domain yet";
    const liveUrl = getClientLiveUrl(site);

    const editorUrl = site.client_user_id
      ? `editor.html?client=${site.client_user_id}`
      : "editor.html";

    const accessText = site.editor_access === "full" ? "Full Editor Access" : "Safe Mode";
    const accessClass = site.editor_access === "full" ? "full" : "safe";

    card.innerHTML = `
      <div>
        <h3>${escapeHtml(site.business_name || "Unnamed Business")}</h3>
        <p>${escapeHtml(site.client_email || "No email")}</p>
        <p><strong>User ID:</strong> ${escapeHtml(site.client_user_id || "Not assigned")}</p>
        <p><strong>Editor:</strong> <span class="badge ${accessClass}">${accessText}</span></p>
      </div>

      <div>
        <p><strong>Package</strong></p>
        <span class="badge">${escapeHtml(site.package_name || "None")}</span>
      </div>

      <div>
        <p><strong>Domain</strong></p>
        <p>${escapeHtml(domainText)}</p>
        <span class="badge">${escapeHtml(site.domain_status || "not connected")}</span>
      </div>

      <div class="actions">
        <button onclick="editClientSite('${site.id}')">Edit</button>
        <a href="${editorUrl}" target="_blank">Open Editor</a>
        <a href="${liveUrl}" target="_blank">View Site</a>
        <button onclick="copyText('${liveUrl}')">Copy Live</button>
        <button onclick="copyClientEditorLink('${editorUrl}')">Copy Editor</button>
        <button onclick="copyLoginLink()">Copy Login</button>
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
    site_status: cleanValue("siteStatus"),
    editor_access: cleanValue("editorAccess") || "safe",
    notes: cleanValue("notes"),
    updated_at: new Date().toISOString()
  };

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
    await db.from("notifications").insert({
      user_id: payload.client_user_id,
      title: "Website access updated",
      message: `Your editor access is now set to "${payload.editor_access === "full" ? "Full Editor Access" : "Safe Mode"}".`,
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
  document.getElementById("siteStatus").value = site.site_status || "draft";
  document.getElementById("editorAccess").value = site.editor_access || "safe";
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
  document.getElementById("siteStatus").value = "draft";
  document.getElementById("editorAccess").value = "safe";
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

function escapeHtml(value){
  return String(value || "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}
