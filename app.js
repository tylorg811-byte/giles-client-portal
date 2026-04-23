const SUPABASE_URL = "https://ujxuirmeikbzakqaerec.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_gLnNGeQUUbjLoQlN5g2t9g_XXQpy9P3";

const db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function showTab(tabId, btn){
  document.querySelectorAll(".tab-section").forEach(section=>{
    section.classList.remove("active-tab");
  });

  document.querySelectorAll(".nav-btn").forEach(button=>{
    button.classList.remove("active");
  });

  document.getElementById(tabId).classList.add("active-tab");
  btn.classList.add("active");
}

async function login(){
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;
  const message = document.getElementById("message");

  message.textContent = "Logging in...";

  const { error } = await db.auth.signInWithPassword({
    email,
    password
  });

  if(error){
    message.textContent = "Login failed. Check email and password.";
    return;
  }

  window.location.href = "dashboard.html";
}

async function checkUser(){
  const { data } = await db.auth.getUser();

  if(!data.user){
    window.location.href = "index.html";
    return;
  }

  document.getElementById("userEmail").textContent = data.user.email;
}

async function logout(){
  await db.auth.signOut();
  window.location.href = "index.html";
}

async function loadDashboard(){
  const { data: userData } = await db.auth.getUser();

  if(!userData.user){
    window.location.href = "index.html";
    return;
  }

  const userId = userData.user.id;

  const { data: site } = await db
    .from("sites")
    .select("*")
    .eq("user_id", userId)
    .single();

  if(site){
    document.getElementById("siteName").textContent = site.site_name || "My Website";
    document.getElementById("siteLink").href = site.live_url || "#";
  }

  const { data: content } = await db
    .from("site_content")
    .select("*")
    .eq("user_id", userId)
    .single();

  if(content){
    document.getElementById("heroTitle").value = content.hero_title || "";
    document.getElementById("heroSubtitle").value = content.hero_subtitle || "";
    document.getElementById("phone").value = content.phone || "";
    document.getElementById("announcement").value = content.announcement || "";
    document.getElementById("service1").value = content.service_1 || "";
    document.getElementById("service2").value = content.service_2 || "";
    document.getElementById("service3").value = content.service_3 || "";

    showGallery(content.gallery_images || []);
  }

  loadLogs(userId);
}

async function saveContent(){
  const { data: userData } = await db.auth.getUser();
  const message = document.getElementById("saveMessage");

  if(!userData.user){
    window.location.href = "index.html";
    return;
  }

  const userId = userData.user.id;

  const { error } = await db
    .from("site_content")
    .upsert({
      user_id:userId,
      hero_title:document.getElementById("heroTitle").value,
      hero_subtitle:document.getElementById("heroSubtitle").value,
      phone:document.getElementById("phone").value,
      announcement:document.getElementById("announcement").value
    }, { onConflict:"user_id" });

  if(error){
    message.textContent = "Something went wrong saving changes.";
    return;
  }

  await addLog(userId, "Updated homepage content");
  message.textContent = "Content saved successfully.";
  loadDashboard();
}

async function saveServices(){
  const { data: userData } = await db.auth.getUser();
  const message = document.getElementById("servicesMessage");

  if(!userData.user){
    window.location.href = "index.html";
    return;
  }

  const userId = userData.user.id;

  const { error } = await db
    .from("site_content")
    .upsert({
      user_id:userId,
      service_1:document.getElementById("service1").value,
      service_2:document.getElementById("service2").value,
      service_3:document.getElementById("service3").value
    }, { onConflict:"user_id" });

  if(error){
    message.textContent = "Something went wrong saving services.";
    return;
  }

  await addLog(userId, "Updated services");
  message.textContent = "Services saved successfully.";
  loadDashboard();
}

async function uploadImage(){
  const { data: userData } = await db.auth.getUser();
  const message = document.getElementById("uploadMessage");
  const fileInput = document.getElementById("imageUpload");

  if(!userData.user){
    window.location.href = "index.html";
    return;
  }

  if(!fileInput.files.length){
    message.textContent = "Choose an image first.";
    return;
  }

  const userId = userData.user.id;
  const file = fileInput.files[0];
  const filePath = `${userId}/${Date.now()}-${file.name}`;

  message.textContent = "Uploading...";

  const { error: uploadError } = await db.storage
    .from("site-images")
    .upload(filePath, file);

  if(uploadError){
    message.textContent = "Image upload failed. Make sure the site-images bucket exists.";
    return;
  }

  const { data: publicUrl } = db.storage
    .from("site-images")
    .getPublicUrl(filePath);

  const imageUrl = publicUrl.publicUrl;

  const { data: existing } = await db
    .from("site_content")
    .select("gallery_images")
    .eq("user_id", userId)
    .single();

  const currentImages = existing?.gallery_images || [];
  const updatedImages = [...currentImages, imageUrl];

  const { error } = await db
    .from("site_content")
    .upsert({
      user_id:userId,
      gallery_images:updatedImages
    }, { onConflict:"user_id" });

  if(error){
    message.textContent = "Image saved, but gallery update failed.";
    return;
  }

  await addLog(userId, "Uploaded a gallery image");
  message.textContent = "Image uploaded successfully.";
  fileInput.value = "";
  loadDashboard();
}

function showGallery(images){
  const gallery = document.getElementById("galleryPreview");
  gallery.innerHTML = "";

  if(!images || images.length === 0){
    gallery.innerHTML = "<p>No images uploaded yet.</p>";
    return;
  }

  images.forEach(url=>{
    const img = document.createElement("img");
    img.src = url;
    gallery.appendChild(img);
  });
}

async function loadLogs(userId){
  const { data: logs } = await db
    .from("change_logs")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending:false });

  const logList = document.getElementById("changeLog");
  logList.innerHTML = "";

  if(logs && logs.length > 0){
    logs.forEach(log=>{
      const li = document.createElement("li");
      li.textContent = log.change_summary;
      logList.appendChild(li);
    });
  } else {
    logList.innerHTML = "<li>No changes yet.</li>";
  }
}

async function addLog(userId, summary){
  await db
    .from("change_logs")
    .insert({
      user_id:userId,
      change_summary:summary
    });
}
