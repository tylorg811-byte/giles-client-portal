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
`;

const starterCss = `
body{margin:0;background:#0B0B0F;color:white;font-family:Arial,sans-serif;}
.hero-section{min-height:90vh;display:flex;align-items:center;justify-content:center;text-align:center;padding:80px 20px;background:linear-gradient(120deg,#0B0B0F,#1a1a40,#2a1a55);}
.hero-inner{max-width:680px;}
.eyebrow{font-size:12px;letter-spacing:3px;color:#aaa;}
h1{font-size:48px;line-height:1.1;margin:15px 0;}
h2{font-size:34px;text-align:center;margin-bottom:30px;}
p{color:#bbb;line-height:1.6;}
.main-btn{display:inline-block;margin-top:22px;padding:14px 30px;border-radius:30px;background:linear-gradient(45deg,#7B5CFF,#9F7BFF);color:white;text-decoration:none;}
.content-section{padding:70px 20px;}
.package-card,.feature-card,.quote-card{padding:28px;border-radius:18px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);text-align:center;}
.image-block{max-width:100%;border-radius:18px;}
.divider{height:1px;background:linear-gradient(to right,transparent,#9F7BFF,transparent);margin:50px auto;width:80%;}
.spacer{height:60px;}
.gallery-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:18px;}
.gallery-grid img{width:100%;height:180px;object-fit:cover;border-radius:16px;}
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

  blockManager: { appendTo: "#blocks" },

  styleManager: {
    appendTo: "#styles",
    sectors: [
      {
        name: "Text",
        open: true,
        buildProps: ["color","font-size","text-align"]
      },
      {
        name: "Spacing",
        open: false,
        buildProps: ["margin","padding"]
      },
      {
        name: "Design",
        open: false,
        buildProps: ["background-color","border-radius"]
      }
    ]
  },

  // 🔥 THIS IS THE MAGIC
  dragMode: "absolute", // smoother positioning

  canvas: {
    styles: []
  },

  panels: { defaults: [] }
});
  addClientBlocks();
  addImageUploader();

  const saved = await loadSavedPage();

if(saved && saved.html){
  console.log("Loaded saved page");
  editor.setComponents(saved.html);
  editor.setStyle(saved.css || starterCss);
} else {
  console.log("Loading starter template");
  editor.setComponents(starterHtml);
  editor.setStyle(starterCss);
}

  // Force refresh so canvas actually renders
setTimeout(() => {
  editor.refresh();
}, 200);
  
  lockClientEditing();
}

function addClientBlocks(){
  editor.BlockManager.add("heading", {
    label: "Heading",
    category: "Text",
    content: `<h2 class="editable-text">Add Heading</h2>`
  });

  editor.BlockManager.add("paragraph", {
    label: "Paragraph",
    category: "Text",
    content: `<p class="editable-text">Add your text here.</p>`
  });

  editor.BlockManager.add("button", {
    label: "Button",
    category: "Text",
    content: `<a href="#" class="main-btn editable-text">Button Text</a>`
  });

  editor.BlockManager.add("image", {
    label: "Image",
    category: "Media",
    content: `<img class="image-block editable-image" src="https://via.placeholder.com/900x500?text=Upload+Image">`
  });

  editor.BlockManager.add("image-gallery", {
    label: "Image Gallery",
    category: "Media",
    content: `
      <section class="content-section client-added-section">
        <div class="gallery-grid">
          <img class="editable-image" src="https://via.placeholder.com/400x300?text=Image+1">
          <img class="editable-image" src="https://via.placeholder.com/400x300?text=Image+2">
          <img class="editable-image" src="https://via.placeholder.com/400x300?text=Image+3">
        </div>
      </section>
    `
  });

  editor.BlockManager.add("feature-card", {
    label: "Feature Card",
    category: "Cards",
    content: `
      <div class="feature-card editable-card">
        <h3 class="editable-text">Feature Title</h3>
        <p class="editable-text">Describe this feature or service.</p>
      </div>
    `
  });

  editor.BlockManager.add("quote", {
    label: "Quote/Testimonial",
    category: "Cards",
    content: `
      <div class="quote-card editable-card">
        <p class="editable-text">“Add a customer testimonial here.”</p>
        <strong class="editable-text">— Customer Name</strong>
      </div>
    `
  });

  editor.BlockManager.add("cta", {
    label: "Call To Action",
    category: "Sections",
    content: `
      <section class="content-section client-added-section" style="text-align:center;">
        <h2 class="editable-text">Ready to get started?</h2>
        <p class="editable-text">Let’s build something professional for your business.</p>
        <a href="#contact" class="main-btn editable-text">Contact Us</a>
      </section>
    `
  });

  editor.BlockManager.add("two-column", {
    label: "Two Columns",
    category: "Sections",
    content: `
      <section class="content-section client-added-section">
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:25px;align-items:center;">
          <div>
            <h2 class="editable-text">Section Title</h2>
            <p class="editable-text">Add your content here.</p>
          </div>
          <img class="image-block editable-image" src="https://via.placeholder.com/600x400?text=Image">
        </div>
      </section>
    `
  });

  editor.BlockManager.add("divider", {
    label: "Divider",
    category: "Design",
    content: `<div class="divider"></div>`
  });

  editor.BlockManager.add("spacer", {
    label: "Spacer",
    category: "Design",
    content: `<div class="spacer"></div>`
  });
}

function addImageUploader(){
  const uploadBox = document.createElement("div");
  uploadBox.innerHTML = `
    <div style="margin-top:20px;padding-top:18px;border-top:1px solid rgba(255,255,255,.12);">
      <h3 style="margin-bottom:12px;">Images</h3>
      <input id="customImageUpload" type="file" accept="image/*" style="font-size:13px;">
      <button id="uploadImageBtn" style="margin-top:10px;width:100%;padding:12px;border-radius:20px;border:none;background:#7B5CFF;color:white;font-weight:bold;cursor:pointer;">
        Upload Image
      </button>
      <p id="uploadStatus" style="font-size:12px;color:#bbb;margin-top:8px;"></p>
    </div>
  `;

  document.querySelector(".editor-sidebar").appendChild(uploadBox);

  document.getElementById("uploadImageBtn").addEventListener("click", uploadImageToSupabase);
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
    status.textContent = "Upload failed. Check your storage bucket.";
    return;
  }

  const { data } = db.storage
    .from("site-images")
    .getPublicUrl(filePath);

  const imageUrl = data.publicUrl;

  editor.AssetManager.add({
    src: imageUrl,
    name: file.name
  });

  editor.addComponents(`<img class="image-block editable-image" src="${imageUrl}">`);

  status.textContent = "Image uploaded and added to page.";
  input.value = "";
}

function lockClientEditing(){

  editor.DomComponents.getWrapper().find("*").forEach(component => {
    const classes = component.getClasses();

    const isText = classes.includes("editable-text");
    const isSection = classes.includes("locked-section");
    const isImage = classes.includes("editable-image");

    if(isSection){
      component.set({
        draggable: true,
        droppable: true,
        removable: false,
        copyable: false,
        selectable: true
      });
    }

    else if(isText){
      component.set({
        editable: true,
        draggable: false,
        droppable: false,
        removable: false,
        copyable: false
      });
    }

    else if(isImage){
      component.set({
        editable: true,
        draggable: true,
        removable: true,
        copyable: true
      });
    }

    else{
      component.set({
        draggable: false,
        droppable: false,
        removable: false,
        copyable: false
      });
    }
  });

  // 🔥 Smooth snapping feeling
  editor.on("component:drag:end", () => {
    editor.refresh();
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
