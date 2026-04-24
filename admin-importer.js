let importedPage = {
  html: "",
  css: "",
  title: "",
  slug: "home"
};

document.addEventListener("DOMContentLoaded", setupImporterTools);

function setupImporterTools(){
  const htmlBox = document.getElementById("importHtml");
  const fileInput = document.getElementById("importFile");

  if(htmlBox){
    htmlBox.addEventListener("input",()=>{
      const count = document.getElementById("importCharCount");
      if(count){
        count.textContent = `${htmlBox.value.length.toLocaleString()} characters`;
      }
    });
  }

  if(fileInput){
    fileInput.addEventListener("change", async function(){
      const file = this.files && this.files[0];

      if(!file){
        alert("No file selected.");
        return;
      }

      try{
        const text = await file.text();

        const importBox = document.getElementById("importHtml");
        const count = document.getElementById("importCharCount");

        importBox.value = text;

        if(count){
          count.textContent = `${text.length.toLocaleString()} characters`;
        }

        analyzeImportHtml();

        this.value = "";
      }catch(error){
        console.error(error);
        alert("Could not read this HTML file.");
      }
    });
  }
}

/* IMPORTANT: This lets admin.js call importer tab without breaking */
const oldShowAdminPage = window.showAdminPage;

window.showAdminPage = function(page){
  if(typeof oldShowAdminPage === "function"){
    oldShowAdminPage(page);
  }

  if(page === "importer"){
    setTimeout(()=>{
      populateImportClientSelect();
    },300);
  }
};

async function populateImportClientSelect(){
  const select = document.getElementById("importClientSelect");
  if(!select) return;

  select.innerHTML = `<option value="">Loading clients...</option>`;

  const { data, error } = await db
    .from("client_sites")
    .select("*")
    .order("created_at", { ascending:false });

  if(error){
    console.error(error);
    select.innerHTML = `<option value="">Could not load clients</option>`;
    return;
  }

  const sites = data || [];

  select.innerHTML = "";

  sites.forEach(site=>{
    if(!site.client_user_id) return;

    const option = document.createElement("option");
    option.value = site.client_user_id;
    option.textContent = site.business_name || site.client_email || site.client_user_id;
    select.appendChild(option);
  });

  if(!select.innerHTML){
    select.innerHTML = `<option value="">No clients with user IDs found</option>`;
  }
}

function analyzeImportHtml(){
  const raw = document.getElementById("importHtml").value.trim();
  const resultBox = document.getElementById("importDetected");

  if(!raw){
    resultBox.innerHTML = "Paste HTML first.";
    return;
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(raw, "text/html");

  doc.querySelectorAll("script,noscript,iframe[src*='javascript']").forEach(el=>el.remove());

  let css = "";

  doc.querySelectorAll("style").forEach(style=>{
    css += "\n" + style.innerHTML;
    style.remove();
  });

  doc.querySelectorAll("link[rel='stylesheet']").forEach(link=>{
    const href = link.getAttribute("href") || "";
    css += `\n/* External stylesheet not imported automatically: ${href} */`;
    link.remove();
  });

  const title = doc.querySelector("title")?.innerText?.trim() || "Imported Page";

  let bodyHtml = doc.body ? doc.body.innerHTML : raw;

  bodyHtml = bodyHtml
    .replaceAll('contenteditable="true"', "")
    .replaceAll("contenteditable='true'", "");

  const guessedSlug = guessSlug(title);

  importedPage = {
    html: bodyHtml,
    css: css || starterImportedCss(),
    title,
    slug: guessedSlug
  };

  document.getElementById("importPageName").value = guessedSlug;

  const sections = doc.body ? doc.body.querySelectorAll("section, header, main, footer, div").length : 0;
  const images = doc.body ? doc.body.querySelectorAll("img").length : 0;
  const links = doc.body ? doc.body.querySelectorAll("a").length : 0;

  resultBox.innerHTML = `
    <div class="import-page-row">
      <div>
        <strong>${escapeHtml(title)}</strong>
        <p style="margin-top:6px;color:#b8c4d8;">Cleaned and ready to import.</p>
      </div>

      <div>
        <span class="badge">${sections} blocks</span>
        <span class="badge">${images} images</span>
        <span class="badge">${links} links</span>
      </div>

      <div>
        <span class="badge full">Ready</span>
      </div>
    </div>

    <div style="margin-top:16px;">
      <p><strong>Important:</strong> Inline CSS is imported. External CSS files are noted but not downloaded automatically yet.</p>
    </div>
  `;
}

async function importPageToClient(){
  const clientId = document.getElementById("importClientSelect").value;
  const pageName = document.getElementById("importPageName").value.trim();
  const message = document.getElementById("importMessage");

  if(!clientId){
    message.textContent = "Choose a client first.";
    return;
  }

  if(!importedPage.html){
    message.textContent = "Analyze HTML before importing.";
    return;
  }

  if(!pageName){
    message.textContent = "Enter a page name.";
    return;
  }

  const slug = slugifyImport(pageName);

  message.textContent = "Importing page...";

  const { data: existing, error: loadError } = await db
    .from("visual_pages")
    .select("*")
    .eq("user_id", clientId)
    .single();

  if(loadError && loadError.code !== "PGRST116"){
    console.error(loadError);
  }

  const pages = existing?.pages || {};

  pages[slug] = {
    html: importedPage.html,
    css: importedPage.css
  };

  const upsertPayload = {
    user_id: clientId,
    html: pages.home?.html || importedPage.html,
    css: pages.home?.css || importedPage.css,
    pages: pages,
    active_page: existing?.active_page || "home",
    site_settings: existing?.site_settings || {},
    status: existing?.status || "draft",
    updated_at: new Date().toISOString()
  };

  const { error } = await db
    .from("visual_pages")
    .upsert(upsertPayload, { onConflict:"user_id" });

  if(error){
    console.error(error);
    message.textContent = "Import failed. Check console.";
    return;
  }

  await db
    .from("client_sites")
    .update({
      site_status: "draft",
      updated_at: new Date().toISOString()
    })
    .eq("client_user_id", clientId);

  message.innerHTML = `
    Imported <strong>${escapeHtml(slug)}</strong> successfully.
    Open the client editor to review and publish.
  `;
}

function starterImportedCss(){
  return `
body{margin:0;font-family:Arial,sans-serif;background:#fff;color:#111827;}
img{max-width:100%;height:auto;}
section{box-sizing:border-box;}
a{color:inherit;}
`;
}

function guessSlug(title){
  const t = title.toLowerCase();

  if(t.includes("about")) return "about";
  if(t.includes("service")) return "services";
  if(t.includes("contact")) return "contact";
  if(t.includes("gallery")) return "gallery";
  if(t.includes("work")) return "work";
  if(t.includes("event")) return "events";

  return "home";
}

function slugifyImport(text){
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g,"-")
    .replace(/^-|-$/g,"") || "home";
}

window.populateImportClientSelect = populateImportClientSelect;
