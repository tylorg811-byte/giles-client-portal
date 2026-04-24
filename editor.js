let editor;
let currentUser;
let activePage = "home";
let pages = {};
let siteSettings = {};

let currentPresetCategory = "all";
let currentImageCategory = "all";
let currentBackgroundCategory = "all";

let stylePresets = [];
let stockImages = [];
let backgroundPresets = [];
let fontPresets = [];

const starterCss = `
body{margin:0;font-family:Arial,sans-serif;background:#fff;color:#111827;}
h1{font-size:52px;line-height:1.05;margin:20px 0;}
h2{font-size:38px;margin:0 0 18px;}
p{font-size:18px;line-height:1.6;color:#555;}
.content-section{padding:80px 20px;}
.main-btn{display:inline-block;padding:14px 30px;border-radius:999px;background:linear-gradient(135deg,#7B5CFF,#9F7BFF);color:white;text-decoration:none;font-weight:800;}
.card{padding:30px;border-radius:24px;background:white;box-shadow:0 15px 45px rgba(0,0,0,.12);}
.grid-3{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:24px;max-width:1100px;margin:auto;}
.site-image{max-width:100%;border-radius:20px;display:block;}
@media(max-width:700px){h1{font-size:38px;}h2{font-size:30px;}}
`;

const pageTemplates = {
home: `<section class="content-section" style="min-height:85vh;display:flex;align-items:center;background:linear-gradient(135deg,#07111f,#141b5f);color:white;text-align:center;">
<div style="max-width:760px;margin:auto;">
<p style="letter-spacing:3px;color:#cbd5e1;">AFFORDABLE — YOUR WAY</p>
<h1>Look Professional.<br>Get More Customers.</h1>
<p style="color:#dbeafe;">Affordable websites designed to turn visitors into paying customers.</p>
<a href="#" class="main-btn">Message Me</a>
</div>
</section>`,

about: `<section class="content-section" style="text-align:center;background:#f8fafc;"><h1>About Us</h1><p>Tell customers who you are and why they should trust you.</p></section>`,

services: `<section class="content-section"><div style="max-width:1000px;margin:auto;text-align:center;"><h1>Services</h1><p>Highlight your main services.</p><div class="grid-3" style="margin-top:35px;"><div class="card"><h3>Service One</h3><p>Describe this service.</p></div><div class="card"><h3>Service Two</h3><p>Describe this service.</p></div><div class="card"><h3>Service Three</h3><p>Describe this service.</p></div></div></div></section>`,

contact: `<section class="content-section" style="text-align:center;background:#07111f;color:white;"><h1>Contact Us</h1><p style="color:#dbeafe;">Ready to get started?</p><a href="mailto:you@example.com" class="main-btn">Send Message</a></section>`,

gallery: `<section class="content-section" style="text-align:center;"><h1>Gallery</h1><p>Showcase your work.</p></section>`
};

document.addEventListener("DOMContentLoaded", initEditor);

async function initEditor(){
currentUser = await checkUser();
if(!currentUser) return;

editor = grapesjs.init({
container:"#gjs",
height:"100%",
fromElement:false,
storageManager:false,
blockManager:{appendTo:"#blocks"},
styleManager:{
appendTo:"#styles",
sectors:[
{name:"Text",open:true,buildProps:["color","font-size","text-align","font-weight","letter-spacing","line-height"]},
{name:"Spacing",open:false,buildProps:["margin","padding"]},
{name:"Design",open:false,buildProps:["background-color","border-radius","box-shadow","border","opacity"]}
]
},
panels:{defaults:[]}
});

addBlocks();
buildLibraries();

const saved = await loadSavedPage();

if(saved && saved.site_settings){
siteSettings = saved.site_settings || {};
}

if(saved && saved.pages && Object.keys(saved.pages).length){
pages = saved.pages;
activePage = saved.active_page || "home";
}else if(saved && saved.html){
pages.home = {html:saved.html, css:saved.css || starterCss};
}else{
pages.home = {html:pageTemplates.home, css:starterCss};
}

loadPageIntoEditor(activePage);
renderPageSelect();
renderPageList();
populateSettingsForm();

renderPresetLibrary();
renderStockImages();
renderBackgroundLibrary();
renderFontLibrary();

setupSearches();
setupFormspreeEndpoint();

setTimeout(()=>editor.refresh(),300);
}

/* ADD ELEMENTS */
function addBlocks(){
editor.BlockManager.add("hero-section",{label:"Hero Section",category:"Sections",content:`<section class="content-section" style="min-height:80vh;display:flex;align-items:center;text-align:center;background:linear-gradient(135deg,#07111f,#141b5f);color:white;"><div style="max-width:800px;margin:auto;"><p style="letter-spacing:3px;color:#cbd5e1;">YOUR TAGLINE HERE</p><h1>Build Something Beautiful</h1><p style="color:#dbeafe;">Add your business message here.</p><a href="#contact" class="main-btn">Get Started</a></div></section>`});
editor.BlockManager.add("heading",{label:"Heading",category:"Text",content:`<h2>New Heading</h2>`});
editor.BlockManager.add("paragraph",{label:"Paragraph",category:"Text",content:`<p>Add your text here.</p>`});
editor.BlockManager.add("button-primary",{label:"Button",category:"Buttons",content:`<a href="#" class="main-btn">Button Text</a>`});
editor.BlockManager.add("image",{label:"Image",category:"Images",content:`<img class="site-image" src="https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=900&q=80">`});
editor.BlockManager.add("services-grid",{label:"Services Grid",category:"Sections",content:`<section class="content-section"><div style="max-width:1000px;margin:auto;text-align:center;"><h2>Our Services</h2><p>Highlight what your business offers.</p><div class="grid-3" style="margin-top:35px;"><div class="card"><h3>Service One</h3><p>Describe this service.</p></div><div class="card"><h3>Service Two</h3><p>Describe this service.</p></div><div class="card"><h3>Service Three</h3><p>Describe this service.</p></div></div></div></section>`});
editor.BlockManager.add("pricing-section",{label:"Pricing",category:"Sections",content:`<section class="content-section" style="background:#07111f;color:white;text-align:center;"><h2>Pricing Packages</h2><div class="grid-3" style="margin-top:35px;"><div class="card"><h3>Starter</h3><h2>$100</h2><p>Simple site to get started.</p></div><div class="card"><h3>Popular</h3><h2>$250</h2><p>Best for growing businesses.</p></div><div class="card"><h3>Premium</h3><h2>$500</h2><p>Full professional setup.</p></div></div></section>`});
editor.BlockManager.add("contact-form",{label:"Contact Form",category:"Forms",content:`<section class="content-section" id="contact" style="background:#f8fafc;"><div style="max-width:680px;margin:auto;"><h2 style="text-align:center;">Contact Us</h2><p style="text-align:center;">Fill out the form below and we’ll be in touch.</p><form data-needs-formspree="true" action="${siteSettings.formspree || "FORM_ENDPOINT_HERE"}" method="POST" style="background:white;padding:28px;border-radius:24px;box-shadow:0 15px 45px rgba(0,0,0,.1);"><p style="font-size:14px;color:#666;text-align:center;margin-bottom:18px;">Form setup needed: add your Formspree endpoint in Site Settings.</p><input name="name" placeholder="Your Name" required style="width:100%;padding:14px;margin-bottom:12px;border:1px solid #e6e6ef;border-radius:12px;"><input name="email" type="email" placeholder="Your Email" required style="width:100%;padding:14px;margin-bottom:12px;border:1px solid #e6e6ef;border-radius:12px;"><input name="phone" placeholder="Phone Number" style="width:100%;padding:14px;margin-bottom:12px;border:1px solid #e6e6ef;border-radius:12px;"><textarea name="message" placeholder="How can we help?" required style="width:100%;padding:14px;margin-bottom:12px;border:1px solid #e6e6ef;border-radius:12px;min-height:130px;"></textarea><button type="submit" class="main-btn" style="border:none;cursor:pointer;">Send Message</button></form></div></section>`});
editor.BlockManager.add("map-section",{label:"Map / Location",category:"Business",content:`<section class="content-section"><div style="max-width:1000px;margin:auto;text-align:center;"><h2>Visit Us</h2><p>${siteSettings.address || "123 Business Street, City, State"}</p><div style="border-radius:24px;overflow:hidden;box-shadow:0 15px 45px rgba(0,0,0,.12);"><iframe src="https://www.google.com/maps?q=${encodeURIComponent(siteSettings.address || "Tampa FL")}&output=embed" width="100%" height="360" style="border:0;" loading="lazy"></iframe></div></div></section>`});
editor.BlockManager.add("divider",{label:"Divider",category:"Graphics",content:`<div style="height:2px;width:80%;margin:40px auto;background:linear-gradient(90deg,transparent,#7B5CFF,transparent);"></div>`});
}

/* SITE SETTINGS */
function populateSettingsForm(){
document.getElementById("settingBusinessName").value = siteSettings.businessName || "";
document.getElementById("settingLogoUrl").value = siteSettings.logoUrl || "";
document.getElementById("settingEmail").value = siteSettings.email || "";
document.getElementById("settingPhone").value = siteSettings.phone || "";
document.getElementById("settingAddress").value = siteSettings.address || "";
document.getElementById("settingFormspree").value = siteSettings.formspree || "";
}

function saveSiteSettings(){
siteSettings = {
businessName:document.getElementById("settingBusinessName").value.trim(),
logoUrl:document.getElementById("settingLogoUrl").value.trim(),
email:document.getElementById("settingEmail").value.trim(),
phone:document.getElementById("settingPhone").value.trim(),
address:document.getElementById("settingAddress").value.trim(),
formspree:document.getElementById("settingFormspree").value.trim()
};

alert("Site settings saved. Click Save Draft or Publish to store them.");
}

function applySettingsToPage(){
const html = editor.getHtml();
let updated = html;

if(siteSettings.businessName){
updated = updated.replaceAll("Business Name", siteSettings.businessName);
}

if(siteSettings.email){
updated = updated.replaceAll("you@example.com", siteSettings.email);
}

if(siteSettings.phone){
updated = updated.replaceAll("(555) 555-5555", siteSettings.phone);
}

editor.setComponents(updated);
editor.refresh();
}

/* HEADER CUSTOMIZER */
function logoHtml(){
const logoUrl = siteSettings.logoUrl || "https://via.placeholder.com/120x120?text=Logo";
return `<img src="${logoUrl}" alt="Logo" style="width:52px;height:52px;border-radius:14px;object-fit:cover;">`;
}

function insertHeader(type){
const wrapper = editor.DomComponents.getWrapper();
wrapper.find("header").forEach(header => header.remove());

const name = siteSettings.businessName || "Business Name";
const logo = logoHtml();

const headers = {
logoText:`<header style="position:sticky;top:0;z-index:999;background:white;border-bottom:1px solid #e6e6ef;padding:18px 26px;"><div style="max-width:1200px;margin:auto;display:flex;align-items:center;justify-content:space-between;gap:20px;"><div style="display:flex;align-items:center;gap:12px;font-weight:900;font-size:22px;color:#111827;">${logo}<span>${name}</span></div><nav class="header-nav" style="display:flex;gap:22px;align-items:center;"><a href="?page=home">Home</a><a href="?page=about">About</a><a href="?page=services">Services</a><a href="?page=contact">Contact</a></nav></div></header>`,

logoOnly:`<header style="position:sticky;top:0;z-index:999;background:white;border-bottom:1px solid #e6e6ef;padding:18px 26px;"><div style="max-width:1200px;margin:auto;display:flex;align-items:center;justify-content:space-between;gap:20px;">${logo}<nav class="header-nav" style="display:flex;gap:22px;align-items:center;"><a href="?page=home">Home</a><a href="?page=services">Services</a><a href="?page=contact">Contact</a></nav></div></header>`,

textOnly:`<header style="position:sticky;top:0;z-index:999;background:white;border-bottom:1px solid #e6e6ef;padding:18px 26px;"><div style="max-width:1200px;margin:auto;display:flex;align-items:center;justify-content:space-between;gap:20px;"><strong style="font-size:24px;color:#111827;">${name}</strong><nav class="header-nav" style="display:flex;gap:22px;align-items:center;"><a href="?page=home">Home</a><a href="?page=about">About</a><a href="?page=services">Services</a><a href="?page=contact">Contact</a></nav></div></header>`,

menu:`<header style="position:sticky;top:0;z-index:999;background:white;border-bottom:1px solid #e6e6ef;padding:18px 26px;"><div style="max-width:1200px;margin:auto;display:flex;align-items:center;justify-content:space-between;gap:20px;position:relative;"><div style="display:flex;align-items:center;gap:12px;font-weight:900;font-size:22px;color:#111827;">${logo}<span>${name}</span></div><button onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display==='block'?'none':'block'" style="border:none;background:#7B5CFF;color:white;border-radius:12px;padding:12px 15px;font-weight:900;cursor:pointer;">☰ Menu</button><nav style="display:none;position:absolute;right:0;top:62px;background:white;border:1px solid #e6e6ef;border-radius:18px;box-shadow:0 20px 50px rgba(0,0,0,.14);padding:16px;min-width:210px;"><a href="?page=home">Home</a><br><a href="?page=about">About</a><br><a href="?page=services">Services</a><br><a href="?page=contact">Contact</a></nav></div></header>`
};

wrapper.components().add(headers[type], { at:0 });
customizeHeader();
editor.refresh();
}

function customizeHeader(){
const header = editor.DomComponents.getWrapper().find("header")[0];
if(!header) return;

const style = document.getElementById("headerStyle").value;
const customColor = document.getElementById("headerColor").value;
const textColor = document.getElementById("headerTextColor").value;
const logoSize = document.getElementById("headerLogoSize").value;
const links = document.getElementById("headerLinks").value.split(",").map(l=>l.trim()).filter(Boolean);

let headerStyle = {
borderBottom:"1px solid #e6e6ef",
padding:"18px 26px"
};

if(style === "white") headerStyle.background = "white";
if(style === "dark"){
headerStyle.background = "#07111f";
headerStyle.borderBottom = "1px solid rgba(255,255,255,.14)";
}
if(style === "glass"){
headerStyle.background = "rgba(255,255,255,.72)";
headerStyle.backdropFilter = "blur(18px)";
}
if(style === "gradient") headerStyle.background = "linear-gradient(135deg,#7B5CFF,#9F7BFF)";
if(style === "custom") headerStyle.background = customColor;

header.addStyle(headerStyle);

header.find("a").forEach(a=>{
a.addStyle({
color:textColor,
textDecoration:"none",
fontWeight:"800"
});
});

header.find("span").forEach(span=>{
span.addStyle({color:textColor});
});

header.find("strong").forEach(strong=>{
strong.addStyle({color:textColor});
});

header.find("img").forEach(img=>{
img.addStyle({
width:`${logoSize}px`,
height:`${logoSize}px`,
objectFit:"cover"
});
});

const nav = header.find("nav")[0];
if(nav && links.length){
nav.components("");
links.forEach(link=>{
const slug = link.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"") || "home";
nav.append(`<a href="?page=${slug}" style="color:${textColor};text-decoration:none;font-weight:800;">${link}</a>`);
});
}

editor.refresh();
}

/* LIBRARIES */
function buildLibraries(){
stylePresets = [
{category:"buttons",name:"Purple Gradient Button",keywords:"purple gradient rounded modern",css:{background:"linear-gradient(135deg,#7B5CFF,#9F7BFF)",color:"#fff",borderRadius:"999px",boxShadow:"0 12px 28px rgba(123,92,255,.35)",fontWeight:"800",padding:"14px 30px"}},
{category:"buttons",name:"Black Luxury Button",keywords:"black luxury premium dark",css:{background:"#020617",color:"#fff",borderRadius:"14px",boxShadow:"0 14px 34px rgba(0,0,0,.25)",fontWeight:"800",padding:"14px 30px"}},
{category:"buttons",name:"Gold Premium Button",keywords:"gold luxury premium elegant",css:{background:"linear-gradient(135deg,#B7791F,#FACC15)",color:"#111",borderRadius:"999px",fontWeight:"900",padding:"14px 32px"}},
{category:"text",name:"Luxury Heading",keywords:"luxury serif elegant heading",css:{fontFamily:"Georgia, serif",fontSize:"56px",fontWeight:"700",letterSpacing:"-1px",lineHeight:"1.05"}},
{category:"cards",name:"Soft White Card",keywords:"white soft clean card",css:{background:"#fff",borderRadius:"24px",boxShadow:"0 18px 45px rgba(20,20,40,.10)",padding:"30px",border:"1px solid #e6e6ef"}}
];

stockImages = [
{name:"Luxury Office",category:"business",keywords:"business office premium corporate modern dark",src:"https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1200&q=80"},
{name:"Floral Arrangement",category:"floral",keywords:"floral flowers bouquet pink elegant wedding",src:"https://images.unsplash.com/photo-1525310072745-f49212b5ac6d?auto=format&fit=crop&w=1200&q=80"},
{name:"Bar Counter",category:"bar",keywords:"bar drinks restaurant nightlife",src:"https://images.unsplash.com/photo-1514933651103-005eec06c04b?auto=format&fit=crop&w=1200&q=80"},
{name:"Landscaping Lawn",category:"landscaping",keywords:"landscaping lawn grass green",src:"https://images.unsplash.com/photo-1558904541-efa843a96f01?auto=format&fit=crop&w=1200&q=80"},
{name:"Beauty Salon",category:"beauty",keywords:"beauty salon spa clean",src:"https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=1200&q=80"}
];

backgroundPresets = [
{category:"colors",name:"White",keywords:"white clean",css:{background:"#ffffff",color:"#111827"}},
{category:"colors",name:"Black",keywords:"black dark luxury",css:{background:"#020617",color:"#ffffff"}},
{category:"gradients",name:"Purple Glow",keywords:"purple gradient glow",css:{background:"linear-gradient(135deg,#7B5CFF,#9F7BFF)",color:"#ffffff"}},
{category:"gradients",name:"Dark Blue Motion",keywords:"dark blue animated premium",css:{background:"linear-gradient(135deg,#07111f,#102a4c,#141b5f)",color:"#ffffff"}}
];

stockImages.forEach(img=>{
backgroundPresets.push({category:"images",name:`${img.name} Background`,keywords:img.keywords,css:{background:`linear-gradient(rgba(0,0,0,.45),rgba(0,0,0,.45)), url('${img.src}') center/cover no-repeat`,color:"#ffffff"}});
});

fontPresets = [
{name:"Modern Clean",keywords:"modern clean simple",css:{fontFamily:"Inter, Arial, sans-serif",fontWeight:"700",letterSpacing:"-0.5px"}},
{name:"Luxury Serif",keywords:"luxury serif elegant",css:{fontFamily:"Georgia, serif",fontWeight:"700",letterSpacing:"-0.8px"}},
{name:"Bold Impact",keywords:"bold strong impact",css:{fontFamily:"Impact, sans-serif",fontWeight:"900"}}
];
}

/* RENDERERS */
function renderPresetLibrary(){renderGenericLibrary("presetLibrary","presetCount",stylePresets,currentPresetCategory,"styleSearch",applyStylePreset);}
function renderBackgroundLibrary(){renderGenericLibrary("backgroundLibrary","backgroundCount",backgroundPresets,currentBackgroundCategory,"backgroundSearch",applyBackground);}
function renderFontLibrary(){renderFontCards();}

function renderGenericLibrary(boxId,countId,data,category,searchId,action){
const box = document.getElementById(boxId);
if(!box) return;
const search = (document.getElementById(searchId)?.value || "").toLowerCase();
const filtered = data.filter(item=>(category==="all"||item.category===category)&&`${item.name} ${item.category||""} ${item.keywords}`.toLowerCase().includes(search));
document.getElementById(countId).textContent = `${filtered.length} found`;
box.innerHTML = "";
filtered.forEach(item=>{
const btn = document.createElement("button");
btn.className = "preset-card clean-preview-card";
btn.innerHTML = `<span>${item.category || "font"}</span><div class="style-preview-box">Aa</div><strong>${item.name}</strong>`;
Object.assign(btn.querySelector(".style-preview-box").style,item.css);
btn.onclick = ()=>action(item);
box.appendChild(btn);
});
}

function renderFontCards(){
const box = document.getElementById("fontLibrary");
if(!box) return;
const search = (document.getElementById("fontSearch")?.value || "").toLowerCase();
const filtered = fontPresets.filter(font=>`${font.name} ${font.keywords}`.toLowerCase().includes(search));
document.getElementById("fontCount").textContent = `${filtered.length} fonts found`;
box.innerHTML = "";
filtered.forEach(font=>{
const card = document.createElement("button");
card.className = "preset-card clean-preview-card";
card.innerHTML = `<span>font</span><div class="style-preview-box">Aa</div><strong>${font.name}</strong>`;
Object.assign(card.querySelector(".style-preview-box").style,font.css);
card.onclick = ()=>applyFont(font);
box.appendChild(card);
});
}

function renderStockImages(){
const box = document.getElementById("stockImages");
if(!box) return;
const search = (document.getElementById("imageSearch")?.value || "").toLowerCase();
const filtered = stockImages.filter(img=>(currentImageCategory==="all"||img.category===currentImageCategory)&&`${img.name} ${img.category} ${img.keywords}`.toLowerCase().includes(search));
document.getElementById("imageCount").textContent = `${filtered.length} images found`;
box.innerHTML = "";
filtered.forEach(img=>{
const card = document.createElement("button");
card.className = "stock-card";
card.innerHTML = `<img src="${img.src}"><span>${img.name}</span>`;
card.onclick = ()=>addImageToPage(img.src);
box.appendChild(card);
});
}

/* FILTERS */
function setupSearches(){
document.getElementById("styleSearch")?.addEventListener("input",renderPresetLibrary);
document.getElementById("imageSearch")?.addEventListener("input",renderStockImages);
document.getElementById("backgroundSearch")?.addEventListener("input",renderBackgroundLibrary);
document.getElementById("fontSearch")?.addEventListener("input",renderFontLibrary);
}

function setPresetCategory(category,btn){currentPresetCategory=category;setActiveFilter(btn);renderPresetLibrary();}
function setImageCategory(category,btn){currentImageCategory=category;setActiveFilter(btn);renderStockImages();}
function setBackgroundCategory(category,btn){currentBackgroundCategory=category;setActiveFilter(btn);renderBackgroundLibrary();}
function setActiveFilter(btn){btn.parentElement.querySelectorAll("button").forEach(b=>b.classList.remove("active"));btn.classList.add("active");}

/* APPLY */
function applyStylePreset(item){const selected=editor.getSelected(); if(!selected){editor.addComponents(`<a href="#" class="main-btn" style="${styleObjToString(item.css)}">${item.name}</a>`);return;} selected.addStyle(item.css); editor.refresh();}
function applyBackground(bg){const selected=editor.getSelected(); if(!selected){editor.addComponents(`<section class="content-section" style="${styleObjToString(bg.css)};text-align:center;"><h2>New Background Section</h2><p>Add your content here.</p></section>`);return;} selected.addStyle(bg.css); editor.refresh();}
function applyFont(font){const selected=editor.getSelected(); if(!selected){editor.addComponents(`<h2 style="${styleObjToString(font.css)}">${font.name}</h2>`);return;} selected.addStyle(font.css); editor.refresh();}
function addImageToPage(src){editor.addComponents(`<img class="site-image" src="${src}">`); editor.refresh();}

/* PAGES */
function saveCurrentPageToMemory(){pages[activePage]={html:editor.getHtml(),css:editor.getCss()};}
function loadPageIntoEditor(pageName){activePage=pageName; const page=pages[pageName]||{html:pageTemplates.home,css:starterCss}; editor.setComponents(page.html); editor.setStyle(page.css||starterCss); document.getElementById("currentPageLabel").textContent=`${formatPageName(pageName)} Page`; setTimeout(()=>editor.refresh(),300);}
function switchPage(pageName){saveCurrentPageToMemory();loadPageIntoEditor(pageName);renderPageList();}
function createNewPage(){const name=prompt("Page name?"); if(!name)return; const slug=slugify(name); if(pages[slug]){alert("That page already exists.");return;} saveCurrentPageToMemory(); pages[slug]={html:`<section class="content-section"><h1>${formatPageName(slug)}</h1><p>Start building this page.</p></section>`,css:starterCss}; loadPageIntoEditor(slug); renderPageSelect(); renderPageList();}
function createPresetPage(type){saveCurrentPageToMemory(); pages[type]={html:pageTemplates[type]||`<section class="content-section"><h1>${formatPageName(type)}</h1><p>Start building this page.</p></section>`,css:starterCss}; loadPageIntoEditor(type); renderPageSelect(); renderPageList();}
function deletePage(pageName){if(pageName==="home"){alert("Home page cannot be deleted.");return;} if(!confirm(`Delete ${formatPageName(pageName)} page?`))return; delete pages[pageName]; activePage="home"; loadPageIntoEditor("home"); renderPageSelect(); renderPageList();}
function renderPageSelect(){const select=document.getElementById("pageSelect"); select.innerHTML=""; Object.keys(pages).forEach(page=>{const option=document.createElement("option"); option.value=page; option.textContent=formatPageName(page); option.selected=page===activePage; select.appendChild(option);});}
function renderPageList(){const box=document.getElementById("pageList"); if(!box)return; box.innerHTML=""; Object.keys(pages).forEach(page=>{const item=document.createElement("div"); item.className=page===activePage?"page-item active":"page-item"; item.innerHTML=`<button onclick="switchPage('${page}')">${formatPageName(page)}</button>${page!=="home"?`<button class="delete-page" onclick="deletePage('${page}')">Delete</button>`:""}`; box.appendChild(item);});}

/* SAVE */
async function loadSavedPage(){const {data,error}=await db.from("visual_pages").select("*").eq("user_id",currentUser.id).single(); if(error)return null; return data;}
async function savePage(){saveSiteSettings(); saveCurrentPageToMemory(); const {error}=await db.from("visual_pages").upsert({user_id:currentUser.id,html:pages.home?.html||editor.getHtml(),css:pages.home?.css||editor.getCss(),pages,site_settings:siteSettings,active_page:activePage,status:"draft",updated_at:new Date().toISOString()},{onConflict:"user_id"}); if(error){alert("Save failed");return;} alert("Saved");}
async function publishPage(){saveSiteSettings(); saveCurrentPageToMemory(); const {error}=await db.from("visual_pages").upsert({user_id:currentUser.id,html:pages.home?.html||editor.getHtml(),css:pages.home?.css||editor.getCss(),pages,site_settings:siteSettings,active_page:activePage,status:"published",updated_at:new Date().toISOString()},{onConflict:"user_id"}); if(error){alert("Publish failed");return;} alert("Published");}

/* FORMS */
function setupFormspreeEndpoint(){editor.on("component:add",()=>{setTimeout(()=>{editor.DomComponents.getWrapper().find("form").forEach(form=>{const attrs=form.getAttributes(); if(attrs["data-needs-formspree"]==="true"&&attrs.action==="FORM_ENDPOINT_HERE"){if(siteSettings.formspree){form.addAttributes({action:siteSettings.formspree,"data-needs-formspree":"false"});}else{form.addAttributes({"data-needs-formspree":"later"});}}});},300);});}

/* HELPERS */
function styleObjToString(obj){return Object.entries(obj).map(([k,v])=>`${k.replace(/[A-Z]/g,m=>"-"+m.toLowerCase())}:${v}`).join(";");}
function slugify(text){return text.toLowerCase().trim().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");}
function formatPageName(slug){return slug.replace(/-/g," ").replace(/\b\w/g,l=>l.toUpperCase());}
