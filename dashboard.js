let dashboardUser = null;
let dashboardSite = null;
let clientSiteRecord = null;
let analyticsEvents = [];

const BASE_URL = "https://tylorg811-byte.github.io/giles-client-portal";

document.addEventListener("DOMContentLoaded", loadClientDashboard);

async function loadClientDashboard(){
  dashboardUser = await checkUser();
  if(!dashboardUser) return;

  document.getElementById("userEmail").textContent = dashboardUser.email;
  document.getElementById("welcomeName").textContent = dashboardUser.email;

  await loadClientSiteRecord();
  await loadClientSiteInfo();
  await loadAnalytics();
  await loadChangeRequests();
  await loadNotifications();

  updateLiveSiteLinks();
  renderBillingCard();
  renderAnalyticsCard();
}

async function loadClientSiteRecord(){
  const { data } = await db
    .from("client_sites")
    .select("*")
    .eq("client_user_id", dashboardUser.id)
    .single();

  clientSiteRecord = data || null;
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
    ? timeAgo(data.updated_at)
    : "—";
}

async function loadAnalytics(){
  const since = new Date();
  since.setDate(since.getDate() - 30);

  const { data, error } = await db
    .from("site_analytics_events")
    .select("*")
    .eq("client_user_id", dashboardUser.id)
    .gte("created_at", since.toISOString())
    .order("created_at", { ascending:false });

  if(error){
    console.error(error);
    analyticsEvents = [];
    return;
  }

  analyticsEvents = data || [];
}

function renderAnalyticsCard(){
  let panel = document.getElementById("analyticsCard");

  if(!panel){
    const main = document.querySelector(".main");
    const card = document.createElement("section");
    card.className = "card";
    card.id = "analyticsCard";
    main.insertBefore(card, main.children[2]);
    panel = card;
  }

  const todayCount = analyticsEvents.filter(event=>isToday(event.created_at)).length;
  const weekCount = analyticsEvents.filter(event=>isWithinDays(event.created_at,7)).length;
  const totalCount = analyticsEvents.length;
  const topPage = getTopValue(analyticsEvents,"page") || "—";
  const topDevice = getTopValue(analyticsEvents,"device") || "—";

  const recentRows = analyticsEvents.slice(0,6).map(event=>`
    <div class="request-item">
      <h3>${escapeHtml(event.page || "home")}</h3>
      <p>${escapeHtml(event.device || "unknown")} • ${escapeHtml(event.browser || "unknown")} • ${timeAgo(event.created_at)}</p>
      <p>Referrer: ${escapeHtml(cleanReferrer(event.referrer))}</p>
    </div>
  `).join("");

  panel.innerHTML = `
    <h2>Website Analytics</h2>
    <p>Performance from the last 30 days.</p>

    <div class="grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:18px;">
      <div class="stat">
        <span>Today</span>
        <strong>${todayCount}</strong>
      </div>

      <div class="stat">
        <span>7 Days</span>
        <strong>${weekCount}</strong>
      </div>

      <div class="stat">
        <span>30 Days</span>
        <strong>${totalCount}</strong>
      </div>

      <div class="stat">
        <span>Top Page</span>
        <strong style="font-size:20px;">${escapeHtml(topPage)}</strong>
      </div>
    </div>

    <div class="request-item">
      <h3>Top Device</h3>
      <p>${escapeHtml(topDevice)}</p>
    </div>

    <h3 style="margin:18px 0 10px;">Recent Visits</h3>
    <div class="request-list">
      ${recentRows || "<p>No analytics yet. Visits will appear after the live site is viewed.</p>"}
    </div>
  `;
}

function getClientBillingStatus(){
  const site = clientSiteRecord || {};

  if(site.billing_override){
    return {
      text:"Covered by Giles",
      class:"full",
      description:"Your website is manually covered by Giles Web Design."
    };
  }

  if(site.billing_status === "free"){
    return {
      text:"Covered by Giles",
      class:"full",
      description:"Your website is currently covered at no charge."
    };
  }

  if(site.billing_status === "manual paid"){
    return {
      text:"Paid",
      class:"full",
      description:"Your payment was received outside the automatic billing system."
    };
  }

  if(site.billing_status === "trial"){
    return {
      text:"Trial",
      class:"safe",
      description:"Your website is currently in a trial period."
    };
  }

  if(site.billing_status === "paused"){
    return {
      text:"Paused",
      class:"dark",
      description:"Your website service is currently paused."
    };
  }

  if(site.billing_status === "past due"){
    return {
      text:"Past Due",
      class:"danger",
      description:"Your website payment is past due. Please contact Giles Web Design."
    };
  }

  const today = new Date();
  today.setHours(0,0,0,0);

  const next = site.next_payment_date ? new Date(site.next_payment_date + "T00:00:00") : null;

  if(next && next < today){
    return {
      text:"Past Due",
      class:"danger",
      description:"Your website payment is past due. Please contact Giles Web Design."
    };
  }

  return {
    text:"Active",
    class:"full",
    description:"Your website plan is active."
  };
}

function renderBillingCard(){
  let panel = document.getElementById("billingCard");

  if(!panel){
    const main = document.querySelector(".main");
    const card = document.createElement("section");
    card.className = "card";
    card.id = "billingCard";
    main.insertBefore(card, main.children[3]);
    panel = card;
  }

  const billing = getClientBillingStatus();
  const site = clientSiteRecord || {};

  panel.innerHTML = `
    <h2>Billing & Package</h2>
    <p>${billing.description}</p>

    <div class="request-item">
      <h3>${escapeHtml(site.package_name || "Website Plan")}</h3>
      <p><strong>Status:</strong> <span class="badge">${billing.text}</span></p>
      <p><strong>Billing Cycle:</strong> ${escapeHtml(site.billing_cycle || "monthly")}</p>
      ${site.last_payment_date ? `<p><strong>Last Payment:</strong> ${formatDate(site.last_payment_date)}</p>` : ""}
      ${site.next_payment_date ? `<p><strong>Next Payment:</strong> ${formatDate(site.next_payment_date)}</p>` : ""}
      ${site.billing_notes ? `<p><strong>Notes:</strong> ${escapeHtml(site.billing_notes)}</p>` : ""}
    </div>
  `;
}

function getLiveUrl(){
  if(
    clientSiteRecord &&
    clientSiteRecord.domain &&
    clientSiteRecord.domain_status === "live" &&
    clientSiteRecord.domain_release_status !== "released"
  ){
    return `https://${clientSiteRecord.domain}`;
  }

  return `${BASE_URL}/index.html?client=${dashboardUser.id}`;
}

function updateLiveSiteLinks(){
  const liveUrl = getLiveUrl();

  document.querySelectorAll(".sidebar a").forEach(link=>{
    if(link.textContent.trim().toLowerCase().includes("view live")){
      link.href = liveUrl;
    }
  });
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

  const businessName =
    dashboardSite?.site_settings?.businessName ||
    clientSiteRecord?.business_name ||
    "";

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

  await db.from("notifications").insert({
    user_id: dashboardUser.id,
    title: "Change request submitted",
    message: "Your request was sent to Giles Web Design.",
    type: "request"
  });

  document.getElementById("requestText").value = "";
  statusBox.textContent = "Request submitted.";

  await loadChangeRequests();
  await loadNotifications();
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
      <p style="margin-top:8px;font-size:13px;color:#667085;">Submitted ${timeAgo(req.created_at)}</p>
      ${req.admin_notes ? `<p style="margin-top:10px;"><strong>Admin note:</strong> ${escapeHtml(req.admin_notes)}</p>` : ""}
    `;

    list.appendChild(item);
  });
}

async function loadNotifications(){
  let panel = document.getElementById("notificationList");

  if(!panel){
    const main = document.querySelector(".main");
    const notificationCard = document.createElement("section");
    notificationCard.className = "card";
    notificationCard.innerHTML = `
      <h2>Notifications</h2>
      <div id="notificationList" class="request-list">Loading notifications...</div>
    `;
    main.insertBefore(notificationCard, main.children[4]);
    panel = document.getElementById("notificationList");
  }

  const { data, error } = await db
    .from("notifications")
    .select("*")
    .eq("user_id", dashboardUser.id)
    .order("created_at", { ascending:false })
    .limit(8);

  if(error){
    panel.innerHTML = "<p>Could not load notifications.</p>";
    console.error(error);
    return;
  }

  const notifications = data || [];

  if(!notifications.length){
    panel.innerHTML = "<p>No notifications yet.</p>";
    return;
  }

  panel.innerHTML = "";

  notifications.forEach(note=>{
    const item = document.createElement("div");
    item.className = "request-item";

    item.innerHTML = `
      <h3>${escapeHtml(note.title || "Notification")}</h3>
      <p>${escapeHtml(note.message || "")}</p>
      <span class="badge">${note.is_read ? "read" : "new"}</span>
      <p style="margin-top:8px;font-size:13px;color:#667085;">${timeAgo(note.created_at)}</p>
      ${!note.is_read ? `<button class="primary" style="margin-top:8px;padding:9px 12px;font-size:12px;" onclick="markNotificationRead('${note.id}')">Mark Read</button>` : ""}
    `;

    panel.appendChild(item);
  });
}

async function markNotificationRead(id){
  await db
    .from("notifications")
    .update({ is_read:true })
    .eq("id", id);

  await loadNotifications();
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
  const diff = now - date;
  return diff <= days * 24 * 60 * 60 * 1000;
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
