let editor;
let currentUser;
let currentDesignCategory = "all";
let designStyles = [];

/* =========================
   STARTER PAGE
=========================*/
const starterHtml = `
<section class="hero-section content-section">
  <div style="max-width:700px;margin:auto;text-align:center;">
    <p style="letter-spacing:3px;color:#888;">AFFORDABLE — YOUR WAY</p>
    <h1>Look Professional.<br>Get More Customers.</h1>
    <p>Affordable websites designed to turn visitors into paying customers.</p>
    <a href="#" class="main-btn">Message Me</a>
  </div>
</section>
`;

const starterCss = `
body{
margin:0;
font-family:Arial,sans-serif;
background:#fff;
}

h1{
font-size:48px;
margin:20px 0;
}

.content-section{
padding:80px 20px;
}

.main-btn{
display:inline-block;
padding:14px 30px;
border-radius:999px;
background:linear-gradient(135deg,#7B5CFF,#9F7BFF);
color:white;
text-decoration:none;
font-weight:800;
}

.preset-divider{
height:2px;
width:80%;
margin:40px auto;
background:linear-gradient(90deg,transparent,#7B5CFF,transparent);
}

.preset-shape{
width:120px;
height:120px;
border-radius:30px;
background:linear-gradient(135deg,#7B5CFF,#9F7BFF);
margin:30px auto;
}
`;

/* =========================
   INIT
=========================*/
document.addEventListener("DOMContentLoaded", initEditor);

async function initEditor(){
  currentUser = await checkUser();
  if(!currentUser) return;

  editor = grapesjs.init({
    container: "#gjs",
    height: "100%",
    fromElement: false,
    storageManager: false,

    blockManager:{
      appendTo:"#blocks"
    },

    styleManager:{
      appendTo:"#styles",
      sectors:[
        {
          name:"Text",
          open:true,
          buildProps:["color","font-size","text-align","font-weight","letter-spacing","line-height"]
        },
        {
          name:"Spacing",
          open:false,
          buildProps:["margin","padding"]
        },
        {
          name:"Design",
          open:false,
          buildProps:["background-color","border-radius","box-shadow","border","opacity"]
        }
      ]
    },

    panels:{defaults:[]}
  });

  addBlocks();

  editor.setComponents(starterHtml);
  editor.setStyle(starterCss);

  setTimeout(()=>editor.refresh(),300);

  const saved = await loadSavedPage();

  if(saved && saved.html){
    editor.setComponents(saved.html);
    editor.setStyle(saved.css || starterCss);
    setTimeout(()=>editor.refresh(),300);
  }

  buildDesignLibrary();
  renderDesignLibrary();
  setupDesignSearch();
  setupImageUploader();
  addWixControls();
  addSectionAddButtons();
}

/* =========================
   BASIC BLOCKS
=========================*/
function addBlocks(){

  editor.BlockManager.add("heading",{
    label:"Heading",
    category:"Text",
    content:`<h2>Heading</h2>`
  });

  editor.BlockManager.add("text",{
    label:"Text",
    category:"Text",
    content:`<p>Add text here</p>`
  });

  editor.BlockManager.add("button",{
    label:"Button",
    category:"Text",
    content:`<a href="#" class="main-btn">Button</a>`
  });

  editor.BlockManager.add("section",{
    label:"Section",
    category:"Layout",
    content:`
      <section class="content-section">
        <h2>New Section</h2>
        <p>Content here</p>
      </section>
    `
  });

  editor.BlockManager.add("image",{
    label:"Image",
    category:"Media",
    content:`<img src="https://via.placeholder.com/900x500" style="max-width:100%;border-radius:18px;">`
  });

  editor.BlockManager.add("card",{
    label:"Card",
    category:"Layout",
    content:`
      <div style="padding:30px;border-radius:22px;background:white;box-shadow:0 15px 45px rgba(0,0,0,.12);">
        <h3>Card Title</h3>
        <p>Card text goes here.</p>
      </div>
    `
  });
}

/* =========================
   HUGE DESIGN LIBRARY ENGINE
=========================*/
function buildDesignLibrary(){
  designStyles = [];

  const palettes = [
    ["#7B5CFF","#9F7BFF"],["#0EA5E9","#22D3EE"],["#10B981","#A7F3D0"],["#F97316","#FDBA74"],
    ["#EC4899","#F9A8D4"],["#EF4444","#FCA5A5"],["#111827","#374151"],["#F59E0B","#FDE68A"],
    ["#8B5CF6","#C4B5FD"],["#06B6D4","#67E8F9"],["#14B8A6","#99F6E4"],["#84CC16","#D9F99D"],
    ["#6366F1","#A5B4FC"],["#D946EF","#F5D0FE"],["#FB7185","#FDA4AF"],["#2DD4BF","#0F766E"],
    ["#334155","#94A3B8"],["#020617","#1E293B"],["#4F46E5","#7C3AED"],["#CA8A04","#FACC15"]
  ];

  const fontFamilies = [
    "Arial, sans-serif","Georgia, serif","'Times New Roman', serif","Verdana, sans-serif",
    "'Trebuchet MS', sans-serif","Impact, sans-serif","Tahoma, sans-serif","Courier New, monospace",
    "Inter, Arial, sans-serif","Playfair Display, serif"
  ];

  const shadows = [
    "0 8px 20px rgba(0,0,0,.12)",
    "0 14px 34px rgba(0,0,0,.18)",
    "0 20px 55px rgba(0,0,0,.24)",
    "0 0 30px rgba(123,92,255,.45)",
    "inset 0 1px 0 rgba(255,255,255,.35), 0 14px 34px rgba(0,0,0,.18)"
  ];

  const radii = ["0px","8px","14px","22px","999px"];
  const borders = ["none","1px solid rgba(0,0,0,.12)","2px solid currentColor","1px solid rgba(255,255,255,.25)"];
  const textAligns = ["left","center","right"];
  const fontSizes = ["16px","18px","22px","28px","36px","48px","64px"];
  const weights = ["400","500","600","700","800","900"];

  /* 220 BUTTON STYLES */
  for(let i=0;i<220;i++){
    const p = palettes[i % palettes.length];
    const radius = radii[i % radii.length];
    const shadow = shadows[i % shadows.length];
    const border = borders[i % borders.length];
    const solid = i % 4 === 0;

    designStyles.push({
      category:"buttons",
      name:`Button Style ${i+1}`,
      preview:"Button",
      css:{
        display:"inline-block",
        padding:`${12 + (i % 5)}px ${22 + (i % 7) * 3}px`,
        borderRadius:radius,
        background: solid ? p[0] : `linear-gradient(135deg,${p[0]},${p[1]})`,
        color:"#ffffff",
        textDecoration:"none",
        fontWeight:weights[i % weights.length],
        boxShadow:shadow,
        border:border,
        letterSpacing: i % 3 === 0 ? ".5px" : "0px"
      }
    });
  }

  /* 160 TEXT STYLES */
  for(let i=0;i<160;i++){
    const p = palettes[i % palettes.length];

    designStyles.push({
      category:"text",
      name:`Text Style ${i+1}`,
      preview:"Sample Text",
      css:{
        color:p[0],
        fontSize:fontSizes[i % fontSizes.length],
        fontWeight:weights[i % weights.length],
        textAlign:textAligns[i % textAligns.length],
        letterSpacing:i % 4 === 0 ? "2px" : "0px",
        lineHeight:i % 3 === 0 ? "1.1" : "1.45",
        textTransform:i % 6 === 0 ? "uppercase" : "none"
      }
    });
  }

  /* 150 CARD STYLES */
  for(let i=0;i<150;i++){
    const p = palettes[i % palettes.length];

    designStyles.push({
      category:"cards",
      name:`Card Style ${i+1}`,
      preview:"Card",
      css:{
        padding:`${22 + (i % 6) * 3}px`,
        borderRadius:radii[(i+2) % radii.length],
        background:i % 3 === 0 ? `linear-gradient(135deg,${p[0]},${p[1]})` : "#ffffff",
        color:i % 3 === 0 ? "#ffffff" : "#111827",
        boxShadow:shadows[i % shadows.length],
        border:borders[i % borders.length]
      }
    });
  }

  /* 170 BACKGROUND STYLES */
  for(let i=0;i<170;i++){
    const p = palettes[i % palettes.length];

    designStyles.push({
      category:"backgrounds",
      name:`Background ${i+1}`,
      preview:"Background",
      css:{
        background:i % 2 === 0
          ? `linear-gradient(${90 + (i % 180)}deg,${p[0]},${p[1]})`
          : `radial-gradient(circle at ${20 + (i % 60)}% ${20 + (i % 60)}%,${p[1]},${p[0]})`,
        color:"#ffffff"
      }
    });
  }

  /* 150 GRADIENTS */
  for(let i=0;i<150;i++){
    const p = palettes[i % palettes.length];
    const q = palettes[(i+5) % palettes.length];

    designStyles.push({
      category:"gradients",
      name:`Gradient ${i+1}`,
      preview:"Gradient",
      css:{
        background:`linear-gradient(${i * 7 % 360}deg,${p[0]},${p[1]},${q[0]})`,
        color:"#ffffff"
      }
    });
  }

  /* 100 DIVIDERS / GRAPHICS */
  for(let i=0;i<100;i++){
    const p = palettes[i % palettes.length];

    designStyles.push({
      category:"dividers",
      name:`Divider / Graphic ${i+1}`,
      preview:"Divider",
      html:`<div class="preset-divider" style="height:${1 + (i % 6)}px;width:${50 + (i % 45)}%;background:linear-gradient(90deg,transparent,${p[0]},${p[1]},transparent);border-radius:999px;margin:40px auto;"></div>`
    });
  }

  /* 100 IMAGE TREATMENTS */
  for(let i=0;i<100;i++){
    designStyles.push({
      category:"images",
      name:`Image Treatment ${i+1}`,
      preview:"Image",
      css:{
        borderRadius:radii[(i+1) % radii.length],
        boxShadow:shadows[i % shadows.length],
        filter:i % 5 === 0 ? "grayscale(1)" : i % 5 === 1 ? "contrast(1.18)" : i % 5 === 2 ? "saturate(1.3)" : "none",
        border:borders[i % borders.length]
      }
    });
  }

  /* 60 FONT COMBINATIONS */
  for(let i=0;i<60;i++){
    designStyles.push({
      category:"fonts",
      name:`Font Combo ${i+1}`,
      preview:"Font Style",
      css:{
        fontFamily:fontFamilies[i % fontFamilies.length],
        fontWeight:weights[i % weights.length],
        letterSpacing:i % 4 === 0 ? "1px" : "0px",
        lineHeight:i % 3 === 0 ? "1.2" : "1.5"
      }
    });
  }

  /* 100 SECTION LAYOUT PRESETS */
  for(let i=0;i<100;i++){
    const p = palettes[i % palettes.length];

    designStyles.push({
      category:"sections",
      name:`Section Layout ${i+1}`,
      preview:"Section",
      html:`
        <section class="content-section" style="padding:${60 + (i % 5) * 12}px 20px;text-align:${textAligns[i % textAligns.length]};background:${i % 2 === 0 ? "#ffffff" : `linear-gradient(135deg,${p[0]},${p[1]})`};color:${i % 2 === 0 ? "#111827" : "#ffffff"};">
          <div style="max-width:${760 + (i % 5) * 80}px;margin:auto;">
            <h2>Premium Section</h2>
            <p>Add your content here and customize it visually.</p>
            <a href="#" class="main-btn">Call To Action</a>
          </div>
        </section>
      `
    });
  }
}

/* =========================
   RENDER DESIGN LIBRARY
=========================*/
function renderDesignLibrary(){
  const box = document.getElementById("designLibrary");
  const count = document.getElementById("designCount");
  if(!box) return;

  const search = document.getElementById("designSearch")?.value.toLowerCase() || "";

  const filtered = designStyles.filter(item => {
    const categoryMatch = currentDesignCategory === "all" || item.category === currentDesignCategory;
    const searchMatch = item.name.toLowerCase().includes(search) || item.category.toLowerCase().includes(search);
    return categoryMatch && searchMatch;
  });

  count.textContent = `${filtered.length} styles showing • ${designStyles.length}+ total styles`;

  box.innerHTML = "";

  filtered.forEach((item, index)=>{
    const card = document.createElement("button");
    card.className = "design-style-card";
    card.innerHTML = `
      <span>${item.category}</span>
      <strong>${item.preview}</strong>
      <small>${item.name}</small>
    `;

    if(item.css){
      Object.entries(item.css).forEach(([key,value])=>{
        card.style[key] = value;
      });
    }

    card.onclick = () => applyDesignStyle(item);
    box.appendChild(card);
  });
}

function setupDesignSearch(){
  const search = document.getElementById("designSearch");
  if(search){
    search.addEventListener("input", renderDesignLibrary);
  }
}

function setDesignCategory(category, btn){
  currentDesignCategory = category;

  document.querySelectorAll(".design-tabs button").forEach(b=>b.classList.remove("active"));
  btn.classList.add("active");

  renderDesignLibrary();
}

function applyDesignStyle(item){
  if(item.html){
    editor.addComponents(item.html);
    editor.refresh();
    return;
  }

  const selected = editor.getSelected();

  if(!selected){
    alert("Select something on the page first.");
    return;
  }

  selected.addStyle(item.css);
  editor.refresh();
}

/* =========================
   IMAGE UPLOADER
=========================*/
function setupImageUploader(){
  const btn = document.getElementById("uploadImageBtn");
  if(btn){
    btn.addEventListener("click", uploadImageToSupabase);
  }
}

async function uploadImageToSupabase(){
  const input = document.getElementById("customImageUpload");
  const status = document.getElementById("uploadStatus");

  if(!input.files.length){
    status.textContent = "Choose an image first.";
    return;
  }

  const file = input.files[0];
  const filePath = `${currentUser.id}/${Date.now()}-${file.name}`;

  status.textContent = "Uploading...";

  const { error } = await db.storage
    .from("site-images")
    .upload(filePath, file);

  if(error){
    console.error(error);
    status.textContent = "Upload failed. Check your site-images bucket.";
    return;
  }

  const { data } = db.storage
    .from("site-images")
    .getPublicUrl(filePath);

  editor.addComponents(`<img src="${data.publicUrl}" style="max-width:100%;border-radius:18px;">`);
  status.textContent = "Image uploaded and added.";
  input.value = "";
}

/* =========================
   LOAD / SAVE / PUBLISH
=========================*/
async function loadSavedPage(){
  const { data, error } = await db
    .from("visual_pages")
    .select("*")
    .eq("user_id", currentUser.id)
    .single();

  if(error){
    console.log("No saved page yet");
    return null;
  }

  return data;
}

async function savePage(){
  const { error } = await db
    .from("visual_pages")
    .upsert({
      user_id: currentUser.id,
      html: editor.getHtml(),
      css: editor.getCss(),
      status:"draft",
      updated_at:new Date().toISOString()
    },{onConflict:"user_id"});

  if(error){
    alert("Save failed");
    console.error(error);
    return;
  }

  await addLog("Saved draft");
  alert("Saved");
}

async function publishPage(){
  const { error } = await db
    .from("visual_pages")
    .upsert({
      user_id: currentUser.id,
      html: editor.getHtml(),
      css: editor.getCss(),
      status:"published",
      updated_at:new Date().toISOString()
    },{onConflict:"user_id"});

  if(error){
    alert("Publish failed");
    console.error(error);
    return;
  }

  await addLog("Published website changes");
  alert("Published");
}

async function addLog(summary){
  await db
    .from("change_logs")
    .insert({
      user_id: currentUser.id,
      change_summary: summary
    });
}

/* =========================
   WIX CONTROLS
=========================*/
function addWixControls(){
  editor.on("component:selected", component => {
    document.querySelectorAll(".wix-control-bar").forEach(e=>e.remove());

    const el = component.view?.el;
    if(!el) return;

    const tag = component.get("tagName");

    if(tag !== "section") return;

    const rect = el.getBoundingClientRect();

    const bar = document.createElement("div");
    bar.className = "wix-control-bar";

    bar.innerHTML = `
      <button data-up>↑</button>
      <button data-down>↓</button>
      <button data-dup>Duplicate</button>
      <button data-del>Delete</button>
    `;

    document.body.appendChild(bar);

    bar.style.left = rect.left + 10 + "px";
    bar.style.top = rect.top - 40 + "px";

    bar.querySelector("[data-up]").onclick = ()=>{
      const prev = component.prev();
      if(prev){
        component.move(prev,{at:0});
        editor.refresh();
      }
    };

    bar.querySelector("[data-down]").onclick = ()=>{
      const next = component.next();
      if(next){
        component.move(next,{at:1});
        editor.refresh();
      }
    };

    bar.querySelector("[data-dup]").onclick = ()=>{
      const clone = component.clone();
      component.parent().append(clone,{at:component.index()+1});
      editor.select(clone);
      editor.refresh();
    };

    bar.querySelector("[data-del]").onclick = ()=>{
      if(confirm("Delete section?")){
        component.remove();
        bar.remove();
      }
    };
  });

  editor.on("component:deselected", ()=>{
    document.querySelectorAll(".wix-control-bar").forEach(e=>e.remove());
  });
}

/* =========================
   ADD SECTION BUTTONS
=========================*/
function addSectionAddButtons(){
  editor.on("component:selected", () => renderAddButtons());
  editor.on("component:update", () => renderAddButtons());
  editor.on("component:add", () => renderAddButtons());

  setTimeout(renderAddButtons, 800);
}

function renderAddButtons(){
  document.querySelectorAll(".add-section-btn").forEach(e => e.remove());

  const sections = editor.DomComponents.getWrapper().find("section");

  sections.forEach((section, index) => {
    const el = section.view?.el;
    if(!el) return;

    const rect = el.getBoundingClientRect();

    const btn = document.createElement("div");
    btn.className = "add-section-btn";
    btn.innerText = "+ Add Section";

    btn.style.left = rect.left + rect.width/2 - 70 + "px";
    btn.style.top = rect.bottom - 20 + "px";

    btn.onclick = () => {
      const newSection = editor.addComponents(`
        <section class="content-section">
          <h2>New Section</h2>
          <p>Add your content here.</p>
        </section>
      `)[0];

      section.parent().append(newSection, { at: index + 1 });
      editor.select(newSection);
      editor.refresh();
    };

    document.body.appendChild(btn);
  });
}
