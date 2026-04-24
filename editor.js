let editor;
let currentUser;

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
          buildProps:["color","font-size","text-align"]
        },
        {
          name:"Spacing",
          open:false,
          buildProps:["margin","padding"]
        }
      ]
    },

    panels:{defaults:[]}
  });

  addBlocks();

  // ALWAYS LOAD SOMETHING FIRST
  editor.setComponents(starterHtml);
  editor.setStyle(starterCss);

  setTimeout(()=>editor.refresh(),300);

  // LOAD SAVED AFTER
  const saved = await loadSavedPage();

  if(saved && saved.html){
    editor.setComponents(saved.html);
    editor.setStyle(saved.css || starterCss);
    setTimeout(()=>editor.refresh(),300);
  }

  addWixControls();
}

/* =========================
   BLOCKS
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
    content:`<a class="main-btn">Button</a>`
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
    content:`<img src="https://via.placeholder.com/900x500" style="max-width:100%;">`
  });

}

/* =========================
   LOAD / SAVE
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
    return;
  }

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
    return;
  }

  alert("Published");
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

function addSectionAddButtons(){

  editor.on("load", () => {

    setTimeout(() => {
      renderAddButtons();
    }, 500);

  });

  editor.on("component:update", () => {
    renderAddButtons();
  });

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
