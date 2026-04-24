let editor;
let currentUser;

const starterHtml = `
<section class="hero-section locked-section">
  <div class="hero-inner">
    <p class="eyebrow editable-text">AFFORDABLE — YOUR WAY</p>
    <h1 class="editable-text">Look Professional.<br>Get More Customers.</h1>
    <p class="editable-text">Affordable websites designed to turn visitors into paying customers.</p>
    <a href="#contact" class="main-btn editable-text">Message Me</a>
  </div>
</section>

<section class="content-section locked-section">
  <h2 class="editable-text">Website Packages</h2>

  <div class="package-grid">
    <div class="package-card editable-card">
      <h3 class="editable-text">Starter</h3>
      <p class="price editable-text">$100</p>
      <p class="editable-text">Simple site to get online fast.</p>
    </div>

    <div class="package-card featured editable-card">
      <h3 class="editable-text">Business Growth</h3>
      <p class="price editable-text">$250</p>
      <p class="editable-text">Best option to attract customers.</p>
    </div>

    <div class="package-card editable-card">
      <h3 class="editable-text">Premium</h3>
      <p class="price editable-text">$500</p>
      <p class="editable-text">High-end business presence.</p>
    </div>
  </div>
</section>

<section class="content-section locked-section">
  <h2 class="editable-text">Why Choose Me</h2>
  <p class="about-text editable-text">I've been designing websites since 2015, helping small businesses look professional and convert visitors into customers.</p>
</section>

<section class="content-section locked-section" id="contact">
  <h2 class="editable-text">Let’s Build Your Website</h2>
  <p class="editable-text">Ready to get started?</p>
  <a href="mailto:you@example.com" class="main-btn editable-text">Contact Me</a>
</section>
`;

const starterCss = `
body{
margin:0;
background:#0B0B0F;
color:white;
font-family:Arial,sans-serif;
}

.hero-section{
min-height:90vh;
display:flex;
align-items:center;
justify-content:center;
text-align:center;
padding:80px 20px;
background:linear-gradient(120deg,#0B0B0F,#1a1a40,#2a1a55);
}

.hero-inner{
max-width:680px;
}

.eyebrow{
font-size:12px;
letter-spacing:3px;
color:#aaa;
}

h1{
font-size:48px;
line-height:1.1;
margin:15px 0;
}

h2{
font-size:34px;
text-align:center;
margin-bottom:30px;
}

p{
color:#bbb;
line-height:1.6;
}

.main-btn{
display:inline-block;
margin-top:22px;
padding:14px 30px;
border-radius:30px;
background:linear-gradient(45deg,#7B5CFF,#9F7BFF);
color:white;
text-decoration:none;
}

.content-section{
padding:70px 20px;
}

.package-grid{
display:flex;
flex-wrap:wrap;
justify-content:center;
gap:20px;
}

.package-card{
width:260px;
padding:28px;
border-radius:18px;
background:rgba(255,255,255,.06);
border:1px solid rgba(255,255,255,.1);
text-align:center;
}

.featured{
box-shadow:0 0 35px rgba(123,92,255,.45);
}

.price{
font-size:34px;
color:#9F7BFF;
}

.about-text{
max-width:700px;
margin:auto;
text-align:center;
}

@media(max-width:700px){
h1{font-size:36px;}
.package-card{width:100%;}
}
`;

initEditor();

async function initEditor(){
  currentUser = await checkUser();
  if(!currentUser) return;

  editor = grapesjs.init({
    container: "#gjs",
    height: "100%",
    fromElement: false,
    storageManager: false,

    blockManager: {
      appendTo: "#blocks"
    },

    layerManager: {
      appendTo: null
    },

    selectorManager: {
      appendTo: null
    },

    traitManager: {
      appendTo: null
    },

    styleManager: {
      appendTo: "#styles",
      sectors: [
        {
          name: "Text",
          open: true,
          buildProps: ["color", "font-size", "text-align"]
        },
        {
          name: "Spacing",
          open: false,
          buildProps: ["margin", "padding"]
        },
        {
          name: "Button/Card Style",
          open: false,
          buildProps: ["background-color", "border-radius"]
        }
      ]
    },

    panels: {
      defaults: []
    }
  });

  addEditorCommands();
  addClientBlocks();

  const saved = await loadSavedPage();

  if(saved && saved.html){
    editor.setComponents(saved.html);
    editor.setStyle(saved.css || starterCss);
  } else {
    editor.setComponents(starterHtml);
    editor.setStyle(starterCss);
  }

  lockClientEditing();
}

function addEditorCommands(){
  editor.Panels.addPanel({
    id: "client-options",
    el: ".editor-actions",
    buttons: []
  });
}

function addClientBlocks(){
  editor.BlockManager.add("client-text", {
    label: "Add Text",
    category: "Add Content",
    content: `<p class="editable-text">Add your text here</p>`
  });

  editor.BlockManager.add("client-heading", {
    label: "Add Heading",
    category: "Add Content",
    content: `<h2 class="editable-text">Add Heading</h2>`
  });

  editor.BlockManager.add("client-button", {
    label: "Add Button",
    category: "Add Content",
    content: `<a href="#" class="main-btn editable-text">Button Text</a>`
  });

  editor.BlockManager.add("client-section", {
    label: "Add Section",
    category: "Add Layout",
    content: `
      <section class="content-section client-added-section">
        <h2 class="editable-text">New Section</h2>
        <p class="editable-text">Add your message here.</p>
      </section>
    `
  });

  editor.BlockManager.add("client-card", {
    label: "Add Card",
    category: "Add Layout",
    content: `
      <div class="package-card editable-card">
        <h3 class="editable-text">Card Title</h3>
        <p class="editable-text">Card description goes here.</p>
      </div>
    `
  });
}

function lockClientEditing(){
  editor.DomComponents.getWrapper().find("*").forEach(component => {
    const classes = component.getClasses();

    const isEditableText = classes.includes("editable-text");
    const isEditableCard = classes.includes("editable-card");
    const isClientAdded = classes.includes("client-added-section");

    if(isEditableText){
      component.set({
        editable: true,
        draggable: false,
        droppable: false,
        removable: false,
        copyable: false,
        stylable: [
          "color",
          "font-size",
          "text-align",
          "margin",
          "padding",
          "background-color",
          "border-radius"
        ]
      });
    } else if(isEditableCard || isClientAdded){
      component.set({
        editable: false,
        draggable: true,
        droppable: true,
        removable: true,
        copyable: true,
        stylable: [
          "background-color",
          "border-radius",
          "margin",
          "padding"
        ]
      });
    } else {
      component.set({
        editable: false,
        draggable: false,
        droppable: true,
        removable: false,
        copyable: false,
        stylable: false
      });
    }
  });

  editor.on("component:add", component => {
    component.set({
      editable: true,
      draggable: true,
      droppable: true,
      removable: true,
      copyable: true
    });
  });
}

async function loadSavedPage(){
  const { data, error } = await db
    .from("visual_pages")
    .select("*")
    .eq("user_id", currentUser.id)
    .single();

  if(error || !data) return null;
  return data;
}

async function savePage(){
  const { error } = await db
    .from("visual_pages")
    .upsert({
      user_id: currentUser.id,
      html: editor.getHtml(),
      css: editor.getCss(),
      status: "draft",
      updated_at: new Date().toISOString()
    }, { onConflict: "user_id" });

  if(error){
    alert("Save failed.");
    console.error(error);
    return;
  }

  await addLog("Saved draft");
  alert("Draft saved.");
}

async function publishPage(){
  const { error } = await db
    .from("visual_pages")
    .upsert({
      user_id: currentUser.id,
      html: editor.getHtml(),
      css: editor.getCss(),
      status: "published",
      updated_at: new Date().toISOString()
    }, { onConflict: "user_id" });

  if(error){
    alert("Publish failed.");
    console.error(error);
    return;
  }

  await addLog("Published website changes");
  alert("Published.");
}

async function addLog(summary){
  await db
    .from("change_logs")
    .insert({
      user_id: currentUser.id,
      change_summary: summary
    });
}
