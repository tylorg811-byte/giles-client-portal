let editor;
let currentUser;
let activePage = "home";
let pages = {};
let savedRecord = null;

let currentPresetCategory = "all";
let currentImageCategory = "all";
let currentBackgroundCategory = "all";

let stylePresets = [];
let stockImages = [];
let backgroundPresets = [];
let fontPresets = [];

/* =========================
   STARTER PAGES
=========================*/
const starterCss = `
body{
margin:0;
font-family:Arial,sans-serif;
background:#fff;
color:#111827;
}

h1{
font-size:52px;
line-height:1.05;
margin:20px 0;
}

h2{
font-size:38px;
margin:0 0 18px;
}

p{
font-size:18px;
line-height:1.6;
color:#555;
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

.card{
padding:30px;
border-radius:24px;
background:white;
box-shadow:0 15px 45px rgba(0,0,0,.12);
}

.grid-3{
display:grid;
grid-template-columns:repeat(auto-fit,minmax(220px,1fr));
gap:24px;
max-width:1100px;
margin:auto;
}

.site-image{
max-width:100%;
border-radius:20px;
display:block;
}

@media(max-width:700px){
h1{font-size:38px;}
h2{font-size:30px;}
}
`;

const pageTemplates = {
  home: `
<section class="content-section" style="min-height:85vh;display:flex;align-items:center;background:linear-gradient(135deg,#07111f,#141b5f);color:white;text-align:center;">
  <div style="max-width:760px;margin:auto;">
    <p style="letter-spacing:3px;color:#cbd5e1;">AFFORDABLE — YOUR WAY</p>
    <h1>Look Professional.<br>Get More Customers.</h1>
    <p style="color:#dbeafe;">Affordable websites designed to turn visitors into paying customers.</p>
    <a href="#" class="main-btn">Message Me</a>
  </div>
</section>

<section class="content-section">
  <div style="max-width:900px;margin:auto;text-align:center;">
    <h2>Website Packages</h2>
    <p>Choose a website package that fits your business and budget.</p>
  </div>
</section>
`,

  about: `
<section class="content-section" style="background:#f8fafc;text-align:center;">
  <div style="max-width:850px;margin:auto;">
    <h1>About Us</h1>
    <p>Share your story, your experience, and what makes your business different.</p>
  </div>
</section>

<section class="content-section">
  <div style="max-width:850px;margin:auto;">
    <h2>Our Story</h2>
    <p>Replace this with your business background, mission, and why customers trust you.</p>
  </div>
</section>
`,

  services: `
<section class="content-section" style="text-align:center;">
  <h1>Our Services</h1>
  <p>Highlight what your business offers.</p>
</section>

<section class="content-section">
  <div class="grid-3">
    <div class="card"><h2>Service One</h2><p>Describe this service.</p></div>
    <div class="card"><h2>Service Two</h2><p>Describe this service.</p></div>
    <div class="card"><h2>Service Three</h2><p>Describe this service.</p></div>
  </div>
</section>
`,

  contact: `
<section class="content-section" style="text-align:center;background:#07111f;color:white;">
  <div style="max-width:760px;margin:auto;">
    <h1>Contact Us</h1>
    <p style="color:#dbeafe;">Ready to get started? Reach out today.</p>
    <a href="mailto:you@example.com" class="main-btn">Send Message</a>
  </div>
</section>
`,

  gallery: `
<section class="content-section" style="text-align:center;">
  <h1>Gallery</h1>
  <p>Showcase your work with professional images.</p>
</section>

<section class="content-section">
  <div class="grid-3">
    <img class="site-image" src="https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=900&q=80">
    <img class="site-image" src="https://images.unsplash.com/photo-1494526585095-c41746248156?auto=format&fit=crop&w=900&q=80">
    <img class="site-image" src="https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=900&q=80">
  </div>
</section>
`
};

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

    blockManager:{ appendTo:"#blocks" },

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
  buildLibraries();

  savedRecord = await loadSavedPage();

  if(savedRecord && savedRecord.pages && Object.keys(savedRecord.pages).length){
    pages = savedRecord.pages;
    activePage = savedRecord.active_page || "home";
  } else if(savedRecord && savedRecord.html){
    pages = {
      home: {
        html: savedRecord.html,
        css: savedRecord.css || starterCss
      }
    };
    activePage = "home";
  } else {
    pages = {
      home: {
        html: pageTemplates.home,
        css: starterCss
      }
    };
    activePage = "home";
  }

  loadPageIntoEditor(activePage);
  renderPageSelect();
  renderPageList();

  renderPresetLibrary();
  renderStockImages();
  renderBackgroundLibrary();
  renderFontLibrary();

  setupSearches();
  setupImageUploader();
  addWixControls();
  addSectionAddButtons();

  setTimeout(()=>editor.refresh(),300);
}

/* =========================
   ELEMENT BLOCKS
=========================*/
function addBlocks(){

  editor.BlockManager.add("hero-section",{
    label:"Hero Section",
    category:"Sections",
    content:`
<section class="content-section" style="min-height:80vh;display:flex;align-items:center;text-align:center;background:linear-gradient(135deg,#07111f,#141b5f);color:white;">
  <div style="max-width:800px;margin:auto;">
    <p style="letter-spacing:3px;color:#cbd5e1;">YOUR TAGLINE HERE</p>
    <h1>Build Something Beautiful</h1>
    <p style="color:#dbeafe;">Add your business message here.</p>
    <a href="#contact" class="main-btn">Get Started</a>
  </div>
</section>`
  });

  editor.BlockManager.add("heading",{
    label:"Heading",
    category:"Text",
    content:`<h2>New Heading</h2>`
  });

  editor.BlockManager.add("paragraph",{
    label:"Paragraph",
    category:"Text",
    content:`<p>Add your text here.</p>`
  });

  editor.BlockManager.add("button-primary",{
    label:"Button",
    category:"Buttons",
    content:`<a href="#" class="main-btn">Button Text</a>`
  });

  editor.BlockManager.add("image",{
    label:"Image",
    category:"Images",
    content:`<img class="site-image" src="https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=900&q=80">`
  });

  editor.BlockManager.add("two-column",{
    label:"Two Columns",
    category:"Sections",
    content:`
<section class="content-section">
  <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:32px;align-items:center;max-width:1100px;margin:auto;">
    <div>
      <h2>Section Title</h2>
      <p>Add content here.</p>
      <a href="#" class="main-btn">Learn More</a>
    </div>
    <img class="site-image" src="https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=900&q=80">
  </div>
</section>`
  });

  editor.BlockManager.add("services-grid",{
    label:"Services Grid",
    category:"Sections",
    content:`
<section class="content-section">
  <div style="max-width:1000px;margin:auto;text-align:center;">
    <h2>Our Services</h2>
    <p>Highlight what your business offers.</p>
    <div class="grid-3" style="margin-top:35px;">
      <div class="card"><h3>Service One</h3><p>Describe this service.</p></div>
      <div class="card"><h3>Service Two</h3><p>Describe this service.</p></div>
      <div class="card"><h3>Service Three</h3><p>Describe this service.</p></div>
    </div>
  </div>
</section>`
  });

  editor.BlockManager.add("pricing-section",{
    label:"Pricing",
    category:"Sections",
    content:`
<section class="content-section" style="background:#07111f;color:white;text-align:center;">
  <h2>Pricing Packages</h2>
  <div class="grid-3" style="margin-top:35px;">
    <div class="card"><h3>Starter</h3><h2>$100</h2><p>Simple site to get started.</p></div>
    <div class="card"><h3>Popular</h3><h2>$250</h2><p>Best for growing businesses.</p></div>
    <div class="card"><h3>Premium</h3><h2>$500</h2><p>Full professional setup.</p></div>
  </div>
</section>`
  });

  editor.BlockManager.add("testimonial",{
    label:"Testimonial",
    category:"Sections",
    content:`
<section class="content-section" style="text-align:center;background:#f8fafc;">
  <div style="max-width:760px;margin:auto;">
    <h2>What Clients Say</h2>
    <div class="card">
      <p>“Add a customer testimonial here. Make it sound real, specific, and trustworthy.”</p>
      <strong>— Customer Name</strong>
    </div>
  </div>
</section>`
  });

  editor.BlockManager.add("gallery-grid",{
    label:"Gallery",
    category:"Images",
    content:`
<section class="content-section">
  <div class="grid-3">
    <img class="site-image" src="https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=900&q=80">
    <img class="site-image" src="https://images.unsplash.com/photo-1494526585095-c41746248156?auto=format&fit=crop&w=900&q=80">
    <img class="site-image" src="https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=900&q=80">
  </div>
</section>`
  });

  editor.BlockManager.add("contact-form",{
  label:"Contact Form",
  category:"Forms",
  content:`
<section class="content-section" id="contact" style="background:#f8fafc;">
  <div style="max-width:680px;margin:auto;">
    <h2 style="text-align:center;">Contact Us</h2>
    <p style="text-align:center;">Fill out the form below and we’ll be in touch.</p>

    <form data-needs-formspree="true" action="FORM_ENDPOINT_HERE" method="POST" style="background:white;padding:28px;border-radius:24px;box-shadow:0 15px 45px rgba(0,0,0,.1);">
      <p style="font-size:14px;color:#666;text-align:center;margin-bottom:18px;">
        Form setup needed: add your Formspree endpoint so submissions go to your email.
      </p>

      <input name="name" placeholder="Your Name" required style="width:100%;padding:14px;margin-bottom:12px;border:1px solid #e6e6ef;border-radius:12px;">
      <input name="email" type="email" placeholder="Your Email" required style="width:100%;padding:14px;margin-bottom:12px;border:1px solid #e6e6ef;border-radius:12px;">
      <input name="phone" placeholder="Phone Number" style="width:100%;padding:14px;margin-bottom:12px;border:1px solid #e6e6ef;border-radius:12px;">
      <textarea name="message" placeholder="How can we help?" required style="width:100%;padding:14px;margin-bottom:12px;border:1px solid #e6e6ef;border-radius:12px;min-height:130px;"></textarea>
      <button type="submit" class="main-btn" style="border:none;cursor:pointer;">Send Message</button>
    </form>
  </div>
</section>`
});

  editor.BlockManager.add("booking-form",{
  label:"Booking Form",
  category:"Forms",
  content:`
<section class="content-section" style="background:#fff;">
  <div style="max-width:760px;margin:auto;">
    <h2 style="text-align:center;">Book an Appointment</h2>

    <form data-needs-formspree="true" action="FORM_ENDPOINT_HERE" method="POST" style="background:#f8fafc;padding:28px;border-radius:24px;">
      <p style="font-size:14px;color:#666;text-align:center;margin-bottom:18px;">
        Form setup needed: add your Formspree endpoint so bookings go to your email.
      </p>

      <input name="name" placeholder="Full Name" required style="width:100%;padding:14px;margin-bottom:12px;border:1px solid #e6e6ef;border-radius:12px;">
      <input name="email" type="email" placeholder="Email" required style="width:100%;padding:14px;margin-bottom:12px;border:1px solid #e6e6ef;border-radius:12px;">
      <input name="date" type="date" required style="width:100%;padding:14px;margin-bottom:12px;border:1px solid #e6e6ef;border-radius:12px;">
      <input name="time" type="time" required style="width:100%;padding:14px;margin-bottom:12px;border:1px solid #e6e6ef;border-radius:12px;">
      <textarea name="notes" placeholder="Notes" style="width:100%;padding:14px;margin-bottom:12px;border:1px solid #e6e6ef;border-radius:12px;"></textarea>
      <button type="submit" class="main-btn" style="border:none;cursor:pointer;">Request Booking</button>
    </form>
  </div>
</section>`
});

  editor.BlockManager.add("faq-section",{
    label:"FAQ",
    category:"Sections",
    content:`
<section class="content-section">
  <div style="max-width:800px;margin:auto;">
    <h2 style="text-align:center;">Frequently Asked Questions</h2>
    <div class="card"><h3>Question One?</h3><p>Answer goes here.</p></div>
    <br>
    <div class="card"><h3>Question Two?</h3><p>Answer goes here.</p></div>
  </div>
</section>`
  });

  editor.BlockManager.add("hours-section",{
    label:"Business Hours",
    category:"Business",
    content:`
<section class="content-section" style="background:#07111f;color:white;text-align:center;">
  <h2>Business Hours</h2>
  <p style="color:#dbeafe;">Monday - Friday: 9AM - 5PM</p>
  <p style="color:#dbeafe;">Saturday: 10AM - 2PM</p>
  <p style="color:#dbeafe;">Sunday: Closed</p>
</section>`
  });

  editor.BlockManager.add("map-section",{
    label:"Map / Location",
    category:"Business",
    content:`
<section class="content-section">
  <div style="max-width:1000px;margin:auto;text-align:center;">
    <h2>Visit Us</h2>
    <p>123 Business Street, City, State</p>
    <div style="border-radius:24px;overflow:hidden;box-shadow:0 15px 45px rgba(0,0,0,.12);">
      <iframe src="https://www.google.com/maps?q=Tampa%20FL&output=embed" width="100%" height="360" style="border:0;" loading="lazy"></iframe>
    </div>
  </div>
</section>`
  });

  editor.BlockManager.add("divider",{
    label:"Divider",
    category:"Graphics",
    content:`<div style="height:2px;width:80%;margin:40px auto;background:linear-gradient(90deg,transparent,#7B5CFF,transparent);"></div>`
  });

  editor.BlockManager.add("spacer",{
    label:"Spacer",
    category:"Graphics",
    content:`<div style="height:70px;"></div>`
  });

}

/* =========================
   LIBRARIES
=========================*/
function buildLibraries(){
  buildStylePresets();
  buildStockImages();
  buildBackgrounds();
  buildFonts();
}

function buildStylePresets(){
  stylePresets = [
    {category:"buttons", name:"Purple Gradient Button", keywords:"purple gradient rounded modern", css:{background:"linear-gradient(135deg,#7B5CFF,#9F7BFF)",color:"#fff",borderRadius:"999px",boxShadow:"0 12px 28px rgba(123,92,255,.35)",fontWeight:"800",padding:"14px 30px"}},
    {category:"buttons", name:"Black Luxury Button", keywords:"black luxury premium dark", css:{background:"#020617",color:"#fff",borderRadius:"14px",boxShadow:"0 14px 34px rgba(0,0,0,.25)",fontWeight:"800",padding:"14px 30px"}},
    {category:"buttons", name:"Gold Premium Button", keywords:"gold luxury premium elegant", css:{background:"linear-gradient(135deg,#B7791F,#FACC15)",color:"#111",borderRadius:"999px",fontWeight:"900",padding:"14px 32px"}},
    {category:"buttons", name:"Blue Tech Button", keywords:"blue tech clean modern", css:{background:"linear-gradient(135deg,#0EA5E9,#22D3EE)",color:"#fff",borderRadius:"12px",fontWeight:"800",padding:"14px 30px"}},
    {category:"buttons", name:"Pink Beauty Button", keywords:"pink beauty feminine soft", css:{background:"linear-gradient(135deg,#EC4899,#F9A8D4)",color:"#fff",borderRadius:"999px",fontWeight:"800",padding:"14px 30px"}},
    {category:"buttons", name:"Outline Button", keywords:"outline simple minimal white", css:{background:"transparent",color:"#111827",border:"2px solid currentColor",borderRadius:"999px",fontWeight:"800",padding:"12px 28px"}},
    {category:"text", name:"Luxury Heading", keywords:"luxury serif elegant heading", css:{fontFamily:"Georgia, serif",fontSize:"56px",fontWeight:"700",letterSpacing:"-1px",lineHeight:"1.05"}},
    {category:"text", name:"Modern Bold Heading", keywords:"modern bold clean heading", css:{fontFamily:"Inter, Arial, sans-serif",fontSize:"48px",fontWeight:"900",letterSpacing:"-1.5px",lineHeight:"1.05"}},
    {category:"text", name:"Small Caps Label", keywords:"small caps label uppercase spaced", css:{fontSize:"12px",fontWeight:"900",letterSpacing:"3px",textTransform:"uppercase",color:"#7B5CFF"}},
    {category:"text", name:"Soft Paragraph", keywords:"paragraph soft readable gray", css:{fontSize:"18px",lineHeight:"1.7",color:"#667085"}},
    {category:"cards", name:"Soft White Card", keywords:"white soft clean card", css:{background:"#fff",borderRadius:"24px",boxShadow:"0 18px 45px rgba(20,20,40,.10)",padding:"30px",border:"1px solid #e6e6ef"}},
    {category:"cards", name:"Dark Glass Card", keywords:"dark glass blur card", css:{background:"rgba(15,23,42,.72)",color:"#fff",borderRadius:"24px",boxShadow:"0 18px 50px rgba(0,0,0,.25)",padding:"30px",border:"1px solid rgba(255,255,255,.12)"}},
    {category:"cards", name:"Purple Glow Card", keywords:"purple glow modern card", css:{background:"#fff",borderRadius:"26px",boxShadow:"0 0 40px rgba(123,92,255,.38)",padding:"32px",border:"1px solid rgba(123,92,255,.25)"}},
    {category:"images", name:"Rounded Image", keywords:"image rounded soft", css:{borderRadius:"24px",boxShadow:"0 16px 38px rgba(0,0,0,.15)"}},
    {category:"images", name:"Luxury Image Frame", keywords:"image luxury border frame", css:{borderRadius:"18px",boxShadow:"0 20px 50px rgba(0,0,0,.22)",border:"8px solid #fff"}},
    {category:"images", name:"Black & White Image", keywords:"image grayscale black white", css:{filter:"grayscale(1)",borderRadius:"18px"}},
    {category:"gradients", name:"Purple Gradient", keywords:"purple gradient", css:{background:"linear-gradient(135deg,#7B5CFF,#9F7BFF)",color:"#fff"}},
    {category:"gradients", name:"Ocean Gradient", keywords:"blue ocean gradient", css:{background:"linear-gradient(135deg,#0EA5E9,#22D3EE)",color:"#fff"}},
    {category:"gradients", name:"Sunset Gradient", keywords:"orange pink sunset gradient", css:{background:"linear-gradient(135deg,#F97316,#EC4899)",color:"#fff"}},
    {category:"gradients", name:"Dark Navy Gradient", keywords:"dark navy gradient luxury", css:{background:"linear-gradient(135deg,#07111f,#141b5f)",color:"#fff"}}
  ];

  const colors = [
    ["Red","#EF4444"],["Orange","#F97316"],["Gold","#FACC15"],["Green","#10B981"],
    ["Teal","#14B8A6"],["Blue","#0EA5E9"],["Indigo","#6366F1"],["Purple","#7B5CFF"],
    ["Pink","#EC4899"],["Black","#020617"],["Gray","#64748B"]
  ];

  colors.forEach(([label,color])=>{
    stylePresets.push({
      category:"buttons",
      name:`${label} Button`,
      keywords:`${label.toLowerCase()} button color solid`,
      css:{background:color,color:"#fff",borderRadius:"999px",fontWeight:"800",padding:"14px 30px"}
    });

    stylePresets.push({
      category:"cards",
      name:`${label} Accent Card`,
      keywords:`${label.toLowerCase()} card color accent`,
      css:{border:`2px solid ${color}`,borderRadius:"22px",padding:"30px",boxShadow:`0 18px 45px ${hexToRgba(color,.18)}`}
    });
  });
}

function buildStockImages(){
  stockImages = [
    {name:"Luxury Office", category:"business", keywords:"business office premium corporate modern dark", src:"https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1200&q=80"},
    {name:"Laptop Workspace", category:"business", keywords:"website laptop desk work design", src:"https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=1200&q=80"},
    {name:"Team Meeting", category:"business", keywords:"team meeting business corporate", src:"https://images.unsplash.com/photo-1556761175-b413da4baf72?auto=format&fit=crop&w=1200&q=80"},
    {name:"Floral Arrangement", category:"floral", keywords:"floral flowers bouquet pink elegant wedding", src:"https://images.unsplash.com/photo-1525310072745-f49212b5ac6d?auto=format&fit=crop&w=1200&q=80"},
    {name:"Wedding Flowers", category:"floral", keywords:"wedding flowers bouquet white luxury", src:"https://images.unsplash.com/photo-1526047932273-341f2a7631f9?auto=format&fit=crop&w=1200&q=80"},
    {name:"Flower Shop", category:"floral", keywords:"flower shop florist floral business", src:"https://images.unsplash.com/photo-1487530903081-59e0e3331512?auto=format&fit=crop&w=1200&q=80"},
    {name:"Bar Counter", category:"bar", keywords:"bar drinks restaurant nightlife", src:"https://images.unsplash.com/photo-1514933651103-005eec06c04b?auto=format&fit=crop&w=1200&q=80"},
    {name:"Cocktail Bar", category:"bar", keywords:"cocktail bar drink lounge luxury", src:"https://images.unsplash.com/photo-1470337458703-46ad1756a187?auto=format&fit=crop&w=1200&q=80"},
    {name:"Patriotic Hall", category:"bar", keywords:"hall venue event community", src:"https://images.unsplash.com/photo-1511795409834-ef04bbd61622?auto=format&fit=crop&w=1200&q=80"},
    {name:"Landscaping Lawn", category:"landscaping", keywords:"landscaping lawn grass green", src:"https://images.unsplash.com/photo-1558904541-efa843a96f01?auto=format&fit=crop&w=1200&q=80"},
    {name:"Garden Path", category:"landscaping", keywords:"garden path landscape plants", src:"https://images.unsplash.com/photo-1416879595882-3373a0480b5b?auto=format&fit=crop&w=1200&q=80"},
    {name:"Outdoor Home", category:"landscaping", keywords:"outdoor home yard lawn", src:"https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80"},
    {name:"Beauty Salon", category:"beauty", keywords:"beauty salon spa clean", src:"https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=1200&q=80"},
    {name:"Barber Shop", category:"beauty", keywords:"barber haircut salon", src:"https://images.unsplash.com/photo-1585747860715-2ba37e788b70?auto=format&fit=crop&w=1200&q=80"},
    {name:"Spa Luxury", category:"beauty", keywords:"spa luxury wellness beauty", src:"https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=1200&q=80"}
  ];
}

function buildBackgrounds(){
  backgroundPresets = [
    {category:"colors", name:"White", keywords:"white clean", css:{background:"#ffffff",color:"#111827"}},
    {category:"colors", name:"Soft Gray", keywords:"gray light clean", css:{background:"#f8fafc",color:"#111827"}},
    {category:"colors", name:"Black", keywords:"black dark luxury", css:{background:"#020617",color:"#ffffff"}},
    {category:"colors", name:"Navy", keywords:"navy blue dark", css:{background:"#07111f",color:"#ffffff"}},
    {category:"colors", name:"Purple", keywords:"purple brand", css:{background:"#7B5CFF",color:"#ffffff"}},
    {category:"gradients", name:"Purple Glow", keywords:"purple gradient glow", css:{background:"linear-gradient(135deg,#7B5CFF,#9F7BFF)",color:"#ffffff"}},
    {category:"gradients", name:"Dark Blue Motion", keywords:"dark blue animated premium", css:{background:"linear-gradient(135deg,#07111f,#102a4c,#141b5f)",color:"#ffffff"}},
    {category:"gradients", name:"Gold Luxury", keywords:"gold luxury gradient", css:{background:"linear-gradient(135deg,#B7791F,#FACC15)",color:"#111827"}},
    {category:"gradients", name:"Ocean Blue", keywords:"blue ocean clean", css:{background:"linear-gradient(135deg,#0EA5E9,#22D3EE)",color:"#ffffff"}}
  ];

  stockImages.forEach(img=>{
    backgroundPresets.push({
      category:"images",
      name:`${img.name} Background`,
      keywords:img.keywords,
      css:{
        background:`linear-gradient(rgba(0,0,0,.45),rgba(0,0,0,.45)), url('${img.src}') center/cover no-repeat`,
        color:"#ffffff"
      }
    });
  });
}

function buildFonts(){
  fontPresets = [
    {name:"Modern Clean", keywords:"modern clean simple", css:{fontFamily:"Inter, Arial, sans-serif",fontWeight:"700",letterSpacing:"-0.5px"}},
    {name:"Luxury Serif", keywords:"luxury serif elegant", css:{fontFamily:"Georgia, serif",fontWeight:"700",letterSpacing:"-0.8px"}},
    {name:"Bold Impact", keywords:"bold strong impact", css:{fontFamily:"Impact, sans-serif",fontWeight:"900",letterSpacing:"0px"}},
    {name:"Classic Editorial", keywords:"classic editorial serif", css:{fontFamily:"'Times New Roman', serif",fontWeight:"700"}},
    {name:"Friendly Rounded", keywords:"friendly rounded soft", css:{fontFamily:"Verdana, sans-serif",fontWeight:"700"}},
    {name:"Tech Mono", keywords:"tech mono code", css:{fontFamily:"'Courier New', monospace",fontWeight:"700"}},
    {name:"Premium Sans", keywords:"premium sans business", css:{fontFamily:"Trebuchet MS, Arial, sans-serif",fontWeight:"800"}}
  ];
}

/* =========================
   RENDERERS
=========================*/
function renderPresetLibrary(){
  const box = document.getElementById("presetLibrary");
  if(!box) return;

  const search = (document.getElementById("styleSearch")?.value || "").toLowerCase();

  const filtered = stylePresets.filter(item=>{
    const cat = currentPresetCategory === "all" || item.category === currentPresetCategory;
    const text = `${item.name} ${item.category} ${item.keywords}`.toLowerCase();
    return cat && text.includes(search);
  });

  document.getElementById("presetCount").textContent = `${filtered.length} styles found`;

  box.innerHTML = "";

  filtered.forEach(item=>{
    const btn = document.createElement("button");
    btn.className = "preset-card clean-preview-card";

    btn.innerHTML = `
      <span>${item.category}</span>
      <div class="style-preview-box">Aa</div>
      <strong>${item.name}</strong>
    `;

    const preview = btn.querySelector(".style-preview-box");

    if(item.css){
      Object.assign(preview.style, item.css);
    }

    btn.onclick = ()=>applyStylePreset(item);
    box.appendChild(btn);
  });
}

function renderStockImages(){
  const box = document.getElementById("stockImages");
  if(!box) return;

  const search = (document.getElementById("imageSearch")?.value || "").toLowerCase();

  const filtered = stockImages.filter(img=>{
    const cat = currentImageCategory === "all" || img.category === currentImageCategory;
    const text = `${img.name} ${img.category} ${img.keywords}`.toLowerCase();
    return cat && text.includes(search);
  });

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

function renderBackgroundLibrary(){
  const box = document.getElementById("backgroundLibrary");
  if(!box) return;

  const search = (document.getElementById("backgroundSearch")?.value || "").toLowerCase();

  const filtered = backgroundPresets.filter(bg=>{
    const cat = currentBackgroundCategory === "all" || bg.category === currentBackgroundCategory;
    const text = `${bg.name} ${bg.category} ${bg.keywords}`.toLowerCase();
    return cat && text.includes(search);
  });

  document.getElementById("backgroundCount").textContent = `${filtered.length} backgrounds found`;

  box.innerHTML = "";

  filtered.forEach(bg=>{
    const card = document.createElement("button");
    card.className = "preset-card clean-preview-card";

    card.innerHTML = `
      <span>${bg.category}</span>
      <div class="style-preview-box bg-preview"></div>
      <strong>${bg.name}</strong>
    `;

    const preview = card.querySelector(".style-preview-box");

    if(bg.css){
      Object.assign(preview.style, bg.css);
    }

    card.onclick = ()=>applyBackground(bg);
    box.appendChild(card);
  });
}

function renderFontLibrary(){
  const box = document.getElementById("fontLibrary");
  if(!box) return;

  const search = (document.getElementById("fontSearch")?.value || "").toLowerCase();

  const filtered = fontPresets.filter(font=>{
    const text = `${font.name} ${font.keywords}`.toLowerCase();
    return text.includes(search);
  });

  document.getElementById("fontCount").textContent = `${filtered.length} fonts found`;

  box.innerHTML = "";

  filtered.forEach(font=>{
    const card = document.createElement("button");
    card.className = "preset-card clean-preview-card";

    card.innerHTML = `
      <span>font</span>
      <div class="style-preview-box">Aa</div>
      <strong>${font.name}</strong>
    `;

    const preview = card.querySelector(".style-preview-box");

    if(font.css){
      Object.assign(preview.style, font.css);
    }

    card.onclick = ()=>applyFont(font);
    box.appendChild(card);
  });
}

/* =========================
   SEARCH + FILTERS
=========================*/
function setupSearches(){
  document.getElementById("styleSearch")?.addEventListener("input", renderPresetLibrary);
  document.getElementById("imageSearch")?.addEventListener("input", renderStockImages);
  document.getElementById("backgroundSearch")?.addEventListener("input", renderBackgroundLibrary);
  document.getElementById("fontSearch")?.addEventListener("input", renderFontLibrary);
}

function setPresetCategory(category, btn){
  currentPresetCategory = category;
  setActiveFilter(btn);
  renderPresetLibrary();
}

function setImageCategory(category, btn){
  currentImageCategory = category;
  setActiveFilter(btn);
  renderStockImages();
}

function setBackgroundCategory(category, btn){
  currentBackgroundCategory = category;
  setActiveFilter(btn);
  renderBackgroundLibrary();
}

function setActiveFilter(btn){
  btn.parentElement.querySelectorAll("button").forEach(b=>b.classList.remove("active"));
  btn.classList.add("active");
}

/* =========================
   APPLY / ADD ACTIONS
=========================*/
function applyStylePreset(item){
  const selected = editor.getSelected();

  if(!selected){
    editor.addComponents(`<a href="#" class="main-btn" style="${styleObjToString(item.css)}">${item.name}</a>`);
    return;
  }

  selected.addStyle(item.css);
  editor.refresh();
}

function applyBackground(bg){
  const selected = editor.getSelected();

  if(!selected){
    editor.addComponents(`
      <section class="content-section" style="${styleObjToString(bg.css)};text-align:center;">
        <div style="max-width:850px;margin:auto;">
          <h2>New Background Section</h2>
          <p>Add your content here.</p>
          <a href="#" class="main-btn">Call To Action</a>
        </div>
      </section>
    `);

    editor.refresh();
    return;
  }

  selected.addStyle(bg.css);
  editor.refresh();
}

/* =========================
   UPLOADS
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

  addImageToPage(data.publicUrl);
  status.textContent = "Image uploaded and added.";
  input.value = "";
}

/* =========================
   PAGE MANAGER
=========================*/
function saveCurrentPageToMemory(){
  pages[activePage] = {
    html: editor.getHtml(),
    css: editor.getCss()
  };
}

function loadPageIntoEditor(pageName){
  activePage = pageName;
  const page = pages[pageName] || { html: pageTemplates.home, css: starterCss };

  editor.setComponents(page.html);
  editor.setStyle(page.css || starterCss);

  document.getElementById("currentPageLabel").textContent = `${formatPageName(pageName)} Page`;

  setTimeout(()=>editor.refresh(),300);
}

function switchPage(pageName){
  saveCurrentPageToMemory();
  loadPageIntoEditor(pageName);
  renderPageList();
}

function createNewPage(){
  const name = prompt("Page name? Example: testimonials, booking, menu");
  if(!name) return;

  const slug = slugify(name);

  if(pages[slug]){
    alert("That page already exists.");
    return;
  }

  saveCurrentPageToMemory();

  pages[slug] = {
    html:`<section class="content-section"><h1>${formatPageName(slug)}</h1><p>Start building this page.</p></section>`,
    css:starterCss
  };

  loadPageIntoEditor(slug);
  renderPageSelect();
  renderPageList();
}

function createPresetPage(type){
  const slug = type;

  if(pages[slug] && !confirm(`${formatPageName(slug)} already exists. Replace it?`)){
    return;
  }

  saveCurrentPageToMemory();

  pages[slug] = {
    html:pageTemplates[type] || pageTemplates.home,
    css:starterCss
  };

  loadPageIntoEditor(slug);
  renderPageSelect();
  renderPageList();
}

function deletePage(pageName){
  if(pageName === "home"){
    alert("Home page cannot be deleted.");
    return;
  }

  if(!confirm(`Delete ${formatPageName(pageName)} page?`)) return;

  delete pages[pageName];
  activePage = "home";
  loadPageIntoEditor("home");
  renderPageSelect();
  renderPageList();
}

function renderPageSelect(){
  const select = document.getElementById("pageSelect");
  select.innerHTML = "";

  Object.keys(pages).forEach(page=>{
    const option = document.createElement("option");
    option.value = page;
    option.textContent = formatPageName(page);
    if(page === activePage) option.selected = true;
    select.appendChild(option);
  });
}

function renderPageList(){
  const box = document.getElementById("pageList");
  if(!box) return;

  box.innerHTML = "";

  Object.keys(pages).forEach(page=>{
    const item = document.createElement("div");
    item.className = page === activePage ? "page-item active" : "page-item";
    item.innerHTML = `
      <button onclick="switchPage('${page}')">${formatPageName(page)}</button>
      ${page !== "home" ? `<button class="delete-page" onclick="deletePage('${page}')">Delete</button>` : ""}
    `;
    box.appendChild(item);
  });
}

/* =========================
   SAVE / PUBLISH
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
  saveCurrentPageToMemory();

  const { error } = await db
    .from("visual_pages")
    .upsert({
      user_id: currentUser.id,
      html: pages.home?.html || editor.getHtml(),
      css: pages.home?.css || editor.getCss(),
      pages: pages,
      active_page: activePage,
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
  saveCurrentPageToMemory();

  const { error } = await db
    .from("visual_pages")
    .upsert({
      user_id: currentUser.id,
      html: pages.home?.html || editor.getHtml(),
      css: pages.home?.css || editor.getCss(),
      pages: pages,
      active_page: activePage,
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

/* =========================
   HELPERS
=========================*/
function styleObjToString(obj){
  return Object.entries(obj).map(([k,v])=>{
    const cssKey = k.replace(/[A-Z]/g, m => "-" + m.toLowerCase());
    return `${cssKey}:${v}`;
  }).join(";");
}

function slugify(text){
  return text.toLowerCase().trim().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
}

function formatPageName(slug){
  return slug.replace(/-/g," ").replace(/\b\w/g, l=>l.toUpperCase());
}

function hexToRgba(hex, alpha){
  const bigint = parseInt(hex.replace("#",""),16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}
