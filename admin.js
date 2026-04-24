let adminUser = null;
let clientSites = [];

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
        <p>Make sure your Supabase user ID is added to the admin_users table.</p>
      </div>
    `;
    return;
  }

  await loadClientSites();
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

function renderStats(){
  document.getElementById("totalClients").textContent = clientSites.length;

  document.getElementById("publishedClients").textContent =
    clientSites.filter(site => site.site_status === "published").length;

  document.getElementById("liveDomains").textContent =
    clientSites.filter(site => site.domain_status === "live").length;

  document.getElementById("pendingDomains").textContent =
    clientSites.filter(site => site.domain_status === "pending").length;
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
    const liveUrl = site.domain
      ? `https://${site.domain}`
      : "https://tylorg811-byte.github.io/giles-client-portal/";

    const editorUrl = site.client_user_id
      ? `editor.html?client=${site.client_user_id}`
      : "editor.html";

    card.innerHTML = `
      <div>
        <h3>${escapeHtml(site.business_name || "Unnamed Business")}</h3>
        <p>${escapeHtml(site.client_email || "No email")}</p>
        <p><strong>User ID:</strong> ${escapeHtml(site.client_user_id || "Not assigned")}</p>
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
        <button onclick="copyClientEditorLink('${editorUrl}')">Copy Editor</button>
        <button onclick="copyLoginLink()">Copy Login</button>
        <button class="danger" onclick="deleteClientSite('${site.id}')">Delete</button>
      </div>
    `;

    list.appendChild(card);
  });
}

async function saveClientSite(){
  const id = document.getElementById("clientRecordId").value;

  const payload = {
    admin_user_id: adminUser.id,
    client_user_id: cleanValue("clientUserId") || null,
    client_email: cleanValue("clientEmail"),
    business_name: cleanValue("businessName"),
    package_name: cleanValue("packageName"),
    domain: cleanValue("domain"),
    domain_status: cleanValue("domainStatus"),
    site_status: cleanValue("siteStatus"),
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
  document.getElementById("notes").value = "";
}

function scrollToForm(){
  document.getElementById("clientFormCard").scrollIntoView({
    behavior:"smooth",
    block:"start"
  });
}

function copyLoginLink(){
  const link = "https://tylorg811-byte.github.io/giles-client-portal/login.html";
  navigator.clipboard.writeText(link);
  alert("Login link copied.");
}

function copyClientEditorLink(editorUrl){
  const fullLink = `https://tylorg811-byte.github.io/giles-client-portal/${editorUrl}`;
  navigator.clipboard.writeText(fullLink);
  alert("Client editor link copied.");
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
