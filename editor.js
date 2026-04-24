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

<section class="content-section">
  <h2>Website Packages</h2>
  <div class="package-grid">
    <div class="package-card">
      <h3>Starter</h3>
      <p class="price">$100</p>
      <p>Simple site to get online fast.</p>
    </div>

    <div class="package-card featured">
      <h3>Business Growth</h3>
      <p class="price">$250</p>
      <p>Best option to attract customers.</p>
    </div>

    <div class="package-card">
      <h3>Premium</h3>
      <p class="price">$500</p>
      <p>High-end business presence.</p>
    </div>
  </div>
</section>

<section class="content-section" id="contact">
  <h2>Let’s Build Your Website</h2>
  <p>Ready to get started?</p>
  <a href="mailto:you@example.com" class="main-btn">Contact Me</a>
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

    styleManager: {
      appendTo: "#styles",
      sectors: [{
        name: "Allowed Styling",
        open: true,
        buildProps: [
          "color",
          "background-color",
          "font-size",
          "text-align",
          "margin",
          "padding",
          "border-radius"
        ]
      }]
    }
  });

  editor.BlockManager.add("text", {
    label: "Text",
    content: `<p>Edit this text</p>`
  });

  editor.BlockManager.add("heading", {
    label: "Heading",
    content: `<h2>Edit Heading</h2>`
  });

  editor.BlockManager.add("button", {
    label: "Button",
    content: `<a class="main-btn" href="#">Click Here</a>`
  });

  editor.BlockManager.add("section", {
    label: "Section",
    content: `<section class="content-section"><h2>New Section</h2><p>Edit this section.</p></section>`
  });

  editor.setComponents(starterHtml);
  editor.setStyle(starterCss);

  const saved = await loadSavedPage();

  if(saved && saved.html){
    editor.setComponents(saved.html);
    editor.setStyle(saved.css || starterCss);
  }
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
