let editor;
let currentUser;
let editingUserId = null;
let isAdminEditing = false;
let clientSafeMode = false;
let clientSiteRecord = null;

let pages = {};
let activePage = "home";
let siteSettings = {};

document.addEventListener("DOMContentLoaded", initEditor);

async function initEditor(){

  currentUser = await checkUser();
  if(!currentUser) return;

  const params = new URLSearchParams(window.location.search);
  const clientId = params.get("client");

  editingUserId = currentUser.id;

  /* ================= ADMIN CHECK ================= */

  if(clientId){
    const { data: adminRow } = await db
      .from("admin_users")
      .select("*")
      .eq("user_id", currentUser.id)
      .single();

    if(adminRow){
      editingUserId = clientId;
      isAdminEditing = true;
    } else {
      alert("Admin access required.");
      window.location.href = "dashboard.html";
      return;
    }
  }

  /* ================= CLIENT SETTINGS ================= */

  const { data: clientRecord } = await db
    .from("client_sites")
    .select("*")
    .eq("client_user_id", editingUserId)
    .single();

  clientSiteRecord = clientRecord || null;

  if(isAdminEditing){
    clientSafeMode = false;
  } else {
    clientSafeMode = clientSiteRecord?.editor_access !== "full";
  }

  /* ================= INIT EDITOR ================= */

  editor = grapesjs.init({
    container:"#gjs",
    height:"100%",
    fromElement:false,
    storageManager:false,
    blockManager:{appendTo:"#blocks"},
    styleManager:{appendTo:"#styles"},
    panels:{defaults:[]}
  });

  addBlocks();

  const saved = await loadSavedPage();

  if(saved && saved.pages){
    pages = saved.pages;
    activePage = saved.active_page || "home";
  } else {
    pages.home = {
      html:`<h1>Start building</h1>`,
      css:``
    };
  }

  loadPage();

  /* ================= SAFETY MODE ================= */

  setupClientSafetyMode();
}

/* ================= LOAD PAGE ================= */

function loadPage(){
  const page = pages[activePage];

  editor.setComponents(page.html);
  editor.setStyle(page.css || "");

  setTimeout(()=>editor.refresh(),300);
}

/* ================= BLOCKS ================= */

function addBlocks(){
  editor.BlockManager.add("text",{
    label:"Text",
    content:`<p>Editable text</p>`
  });

  editor.BlockManager.add("image",{
    label:"Image",
    content:`<img src="https://via.placeholder.com/400">`
  });

  editor.BlockManager.add("section",{
    label:"Section",
    content:`<section style="padding:40px;"><h2>New Section</h2></section>`
  });
}

/* ================= SAVE ================= */

async function loadSavedPage(){
  const { data } = await db
    .from("visual_pages")
    .select("*")
    .eq("user_id", editingUserId)
    .single();

  return data || null;
}

async function publishPage(){

  const html = editor.getHtml();
  const css = editor.getCss();

  await db.from("visual_pages").upsert({
    user_id:editingUserId,
    html,
    css,
    pages,
    active_page:activePage,
    status:"published",
    updated_at:new Date().toISOString()
  });

  await db
    .from("client_sites")
    .update({
      site_status:"published",
      updated_at:new Date().toISOString()
    })
    .eq("client_user_id", editingUserId);

  await db.from("notifications").insert({
    user_id: editingUserId,
    title: "Website published",
    message: "Your website has been published.",
    type: "site"
  });

  alert("Published");
}

/* ================= SAFETY MODE ================= */

function setupClientSafetyMode(){

  if(!clientSafeMode) return;

  document.body.classList.add("client-safe-mode");

  /* Banner */
  const banner = document.createElement("div");
  banner.className = "safe-mode-banner";
  banner.innerHTML = `
    Safe Editing Mode is ON.<br>
    You can edit text and images only.
  `;
  document.body.prepend(banner);

  /* Lock everything */
  lockComponents();

  /* Block adding */
  editor.on("component:add", component=>{
    setTimeout(()=>{
      component.remove();
      alert("Adding sections is disabled. Submit a request.");
    },50);
  });

  /* Selection rules */
  editor.on("component:selected", component=>{
    if(!component) return;

    const tag = component.get("tagName");

    if(["p","h1","h2","h3","span","a"].includes(tag)){
      component.set({
        editable:true,
        draggable:false,
        removable:false
      });
      return;
    }

    if(tag === "img"){
      component.set({
        editable:false,
        draggable:false,
        removable:false
      });
      return;
    }

    component.set({
      selectable:false
    });
  });
}

function lockComponents(){

  const wrapper = editor.DomComponents.getWrapper();
  const all = wrapper.find("*");

  all.forEach(comp=>{
    comp.set({
      draggable:false,
      droppable:false,
      removable:false,
      copyable:false
    });
  });
}

/* ================= HELPERS ================= */

function checkUser(){
  return db.auth.getUser().then(res=>res.data.user);
}
