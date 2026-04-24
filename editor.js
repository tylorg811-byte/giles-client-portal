let editor;
let currentUser;

const starterHtml = `
<section class="hero-section">
  <div class="hero-inner">
    <p class="eyebrow">AFFORDABLE — YOUR WAY</p>
    <h1>Look Professional.<br>Get More Customers.</h1>
    <p>Affordable websites designed to turn visitors into paying customers.</p>
    <a href="#contact" class="main-btn">Message Me</a>
  </div>
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
  max-width:700px;
}

.eyebrow{
  font-size:12px;
  letter-spacing:3px;
  color:#aaa;
}

h1{
  font-size:52px;
  line-height:1.1;
  margin:18px 0;
}

p{
  color:#ddd;
  font-size:18px;
}

.main-btn{
  display:inline-block;
  margin-top:25px;
  padding:14px 32px;
  border-radius:30px;
  background:#7B5CFF;
  color:white;
  text-decoration:none;
  font-weight:bold;
}
`;

document.addEventListener("DOMContentLoaded", initEditor);

async function initEditor(){
  currentUser = await checkUser();
  if(!currentUser) return;

  editor = grapesjs.init({
    container: "#gjs",
    height: "100%",
    width: "auto",
    fromElement: false,
    storageManager: false,
    blockManager: {
      appendTo: "#blocks"
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
          name: "Design",
          open: false,
          buildProps: ["background-color", "border-radius"]
        }
      ]
    },
    panels: {
      defaults: []
    }
  });

  editor.setComponents(starterHtml);
  editor.setStyle(starterCss);

  addBlocks();

  setTimeout(() => {
    editor.refresh();
  }, 500);

  const saved = await loadSavedPage();

  if(saved && saved.html){
    editor.setComponents(saved.html);
    editor.setStyle(saved.css || starterCss);

    setTimeout(() => {
      editor.refresh();
    }, 500);
  }
}

function addBlocks(){
  editor.BlockManager.add("heading", {
    label: "Heading",
    category: "Text",
    content: `<h2>Add Heading</h2>`
  });

  editor.BlockManager.add("paragraph", {
    label: "Paragraph",
    category: "Text",
    content: `<p>Add your text here.</p>`
  });

  editor.BlockManager.add("button", {
    label: "Button",
    category: "Text",
    content: `<a href="#" class="main-btn">Button Text</a>`
  });

  editor.BlockManager.add("section", {
    label: "Section",
    category: "Layout",
    content: `
      <section style="padding:70px 20px;text-align:center;background:#0B0B0F;color:white;">
        <h2>New Section</h2>
        <p>Add your content here.</p>
      </section>
    `
  });

  editor.BlockManager.add("image", {
    label: "Image",
    category: "Media",
    content: `<img src="https://via.placeholder.com/900x500" style="max-width:100%;border-radius:18px;">`
  });
}

async function loadSavedPage(){
  const { data, error } = await db
    .from("visual_pages")
    .select("*")
    .eq("user_id", currentUser.id)
    .single();

  if(error){
    console.log("No saved page yet:", error.message);
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
      status: "draft",
      updated_at: new Date().toISOString()
    }, { onConflict: "user_id" });

  if(error){
    alert("Save failed.");
    console.error(error);
    return;
  }

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

  alert("Published.");
}
