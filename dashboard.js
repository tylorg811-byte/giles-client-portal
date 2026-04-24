let dashboardUser = null;
let dashboardSite = null;

document.addEventListener("DOMContentLoaded", loadClientDashboard);

async function loadClientDashboard(){
  dashboardUser = await checkUser();
  if(!dashboardUser) return;

  document.getElementById("userEmail").textContent = dashboardUser.email;
  document.getElementById("welcomeName").textContent = dashboardUser.email;

  await loadClientSiteInfo();
  await loadChangeRequests();
}

async function loadClientSiteInfo(){
  const { data, error } = await db
    .from("visual_pages")
    .select("*")
    .eq("user_id", dashboardUser.id)
    .single();

  if(error || !data){
    document.getElementById("siteStatus").textContent = "Draft";
    document.getElementById("lastUpdated").textContent = "—";
    return;
  }

  dashboardSite = data;

  document.getElementById("siteStatus").textContent = data.status || "Draft";

  document.getElementById("lastUpdated").textContent = data.updated_at
    ? new Date(data.updated_at).toLocaleDateString()
    : "—";
}

async function submitChangeRequest(){
  const type = document.getElementById("requestType").value;
  const message = document.getElementById("requestText").value.trim();
  const statusBox = document.getElementById("requestMessage");

  if(!message){
    statusBox.textContent = "Please describe what you need changed.";
    return;
  }

  statusBox.textContent = "Submitting request...";

  const businessName = dashboardSite?.site_settings?.businessName || "";

  const { error } = await db
    .from("change_requests")
    .insert({
      client_user_id: dashboardUser.id,
      client_email: dashboardUser.email,
      business_name: businessName,
      request_type: type,
      message: message,
      status: "new"
    });

  if(error){
    console.error(error);
    statusBox.textContent = "Request failed. Try again.";
    return;
  }

  document.getElementById("requestText").value = "";
  statusBox.textContent = "Request submitted.";

  await loadChangeRequests();
}

async function loadChangeRequests(){
  const { data, error } = await db
    .from("change_requests")
    .select("*")
    .eq("client_user_id", dashboardUser.id)
    .order("created_at", { ascending:false });

  const list = document.getElementById("requestList");

  if(error){
    list.innerHTML = "<p>Could not load requests.</p>";
    console.error(error);
    return;
  }

  const requests = data || [];

  document.getElementById("openRequests").textContent =
    requests.filter(req => req.status !== "done").length;

  if(!requests.length){
    list.innerHTML = "<p>No requests yet.</p>";
    return;
  }

  list.innerHTML = "";

  requests.forEach(req=>{
    const item = document.createElement("div");
    item.className = "request-item";

    item.innerHTML = `
      <h3>${escapeHtml(req.request_type || "Request")}</h3>
      <p>${escapeHtml(req.message || "")}</p>
      <span class="badge">${escapeHtml(req.status || "new")}</span>
      ${req.admin_notes ? `<p style="margin-top:10px;"><strong>Admin note:</strong> ${escapeHtml(req.admin_notes)}</p>` : ""}
    `;

    list.appendChild(item);
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
