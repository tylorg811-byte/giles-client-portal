document.addEventListener("DOMContentLoaded", () => {
  setTimeout(() => {
    enableSectionDragDrop();
    enhanceDashboardVisuals();
  }, 900);
});

function enableSectionDragDrop(){
  const containers = [
    document.getElementById("clientsPage"),
    document.getElementById("importerPage"),
    document.getElementById("seoPage"),
    document.getElementById("analyticsPage"),
    document.getElementById("requestsPage"),
    document.getElementById("billingPage")
  ].filter(Boolean);

  containers.forEach(container => {
    const items = [...container.querySelectorAll(".draggable-section")];

    items.forEach((item, index) => {
      item.draggable = true;
      item.dataset.dragId = item.dataset.dragId || `${container.id}-${index}`;

      item.addEventListener("dragstart", () => {
        item.classList.add("dragging");
      });

      item.addEventListener("dragend", () => {
        item.classList.remove("dragging");
        saveSectionOrder(container);
      });
    });

    container.addEventListener("dragover", e => {
      e.preventDefault();

      const dragging = container.querySelector(".dragging");
      if(!dragging) return;

      const afterElement = getDragAfterElement(container, e.clientY);
      if(afterElement == null){
        container.appendChild(dragging);
      } else {
        container.insertBefore(dragging, afterElement);
      }
    });

    restoreSectionOrder(container);
  });
}

function getDragAfterElement(container, y){
  const draggableElements = [
    ...container.querySelectorAll(".draggable-section:not(.dragging)")
  ];

  return draggableElements.reduce((closest, child) => {
    const box = child.getBoundingClientRect();
    const offset = y - box.top - box.height / 2;

    if(offset < 0 && offset > closest.offset){
      return { offset, element: child };
    }

    return closest;
  }, { offset: Number.NEGATIVE_INFINITY }).element;
}

function saveSectionOrder(container){
  const order = [...container.querySelectorAll(".draggable-section")]
    .map(item => item.dataset.dragId);

  localStorage.setItem(`section-order-${container.id}`, JSON.stringify(order));
}

function restoreSectionOrder(container){
  const saved = localStorage.getItem(`section-order-${container.id}`);
  if(!saved) return;

  try{
    const order = JSON.parse(saved);

    order.forEach(id => {
      const item = container.querySelector(`[data-drag-id="${id}"]`);
      if(item) container.appendChild(item);
    });
  }catch(e){}
}

function enhanceDashboardVisuals(){
  patchAnalyticsRender();
  patchBillingRender();

  setTimeout(() => {
    renderAnalyticsMiniChart();
    renderBillingVisuals();
  }, 600);
}

function patchAnalyticsRender(){
  if(typeof window.renderAnalyticsOverviewFull !== "function") return;

  const original = window.renderAnalyticsOverviewFull;

  window.renderAnalyticsOverviewFull = function(){
    original();
    setTimeout(renderAnalyticsMiniChart, 100);
  };
}

function patchBillingRender(){
  if(typeof window.renderBillingOverview !== "function") return;

  const original = window.renderBillingOverview;

  window.renderBillingOverview = function(){
    original();
    setTimeout(renderBillingVisuals, 100);
  };
}

function renderAnalyticsMiniChart(){
  const mount = document.getElementById("analyticsChartMount");
  if(!mount) return;

  if(typeof analyticsEvents === "undefined") return;

  const last7 = getLastNDays(7);
  const counts = last7.map(day => {
    const count = analyticsEvents.filter(event => {
      const d = new Date(event.created_at);
      return d.toISOString().slice(0,10) === day.key;
    }).length;

    return { label: day.label, count };
  });

  const max = Math.max(...counts.map(d => d.count), 1);

  mount.innerHTML = `
    <div class="chart-card">
      <h3>Views Last 7 Days</h3>
      <div class="chart-bars">
        ${counts.map(day => `
          <div class="chart-bar" style="height:${Math.max((day.count / max) * 150, 8)}px">
            <strong>${day.count}</strong>
            <span>${day.label}</span>
          </div>
        `).join("")}
      </div>
    </div>
  `;
}

function renderBillingVisuals(){
  const mount = document.getElementById("billingVisualMount");
  if(!mount) return;

  if(typeof clientSites === "undefined") return;

  const groups = {
    active: [],
    manual: [],
    pastDue: [],
    paused: []
  };

  clientSites.forEach(site => {
    const status = String(site.billing_status || "").toLowerCase();
    const override = String(site.billing_override).toLowerCase() === "true";
    const overdue = isBillingOverdue(site);

    if(status === "paused"){
      groups.paused.push(site);
    } else if(status === "manual paid" || override || status === "free"){
      groups.manual.push(site);
    } else if(status === "past due" || overdue){
      groups.pastDue.push(site);
    } else {
      groups.active.push(site);
    }
  });

  mount.innerHTML = `
    <div class="billing-lanes">
      ${renderBillingLane("Active", groups.active, "✅")}
      ${renderBillingLane("Manual / Covered", groups.manual, "🧾")}
      ${renderBillingLane("Past Due", groups.pastDue, "⚠️")}
      ${renderBillingLane("Paused", groups.paused, "⏸️")}
    </div>
  `;
}

function renderBillingLane(title, sites, icon){
  return `
    <div class="billing-lane">
      <h3>${icon} ${title} <span class="badge">${sites.length}</span></h3>
      ${
        sites.length
          ? sites.slice(0,8).map(site => `
            <div class="billing-pill">
              <strong>${escapeDash(site.business_name || "Unnamed Business")}</strong>
              <span>${escapeDash(site.client_email || "")}</span>
              <span>Next: ${formatDashDate(site.next_payment_date)}</span>
            </div>
          `).join("")
          : `<div class="empty-state" style="padding:16px;">None</div>`
      }
    </div>
  `;
}

function isBillingOverdue(site){
  if(!site.next_payment_date) return false;

  const today = new Date();
  today.setHours(0,0,0,0);

  const next = new Date(site.next_payment_date + "T00:00:00");
  return next < today;
}

function getLastNDays(n){
  const days = [];

  for(let i = n - 1; i >= 0; i--){
    const d = new Date();
    d.setDate(d.getDate() - i);

    days.push({
      key: d.toISOString().slice(0,10),
      label: d.toLocaleDateString(undefined, { weekday:"short" })
    });
  }

  return days;
}

function escapeDash(value){
  return String(value || "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

function formatDashDate(dateString){
  if(!dateString) return "—";

  try{
    return new Date(dateString + "T00:00:00").toLocaleDateString();
  }catch(e){
    return "—";
  }
}
