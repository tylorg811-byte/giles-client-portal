const SUPABASE_URL = "https://ujxuirmeikbzakqaerec.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_gLnNGeQUUbjLoQlN5g2t9g_XXQpy9P3";

const db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

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
    document.getElementById("siteName").textContent = site.site_name;
    document.getElementById("siteLink").href = site.live_url;
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
  }

  const { data: logs } = await db
    .from("change_logs")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending:false });

  const logList = document.getElementById("changeLog");
  logList.innerHTML = "";

  if(logs && logs.length > 0){
    logs.forEach(log => {
      const li = document.createElement("li");
      li.textContent = log.change_summary;
      logList.appendChild(li);
    });
  } else {
    logList.innerHTML = "<li>No changes yet.</li>";
  }
}

async function saveContent(){
  const { data: userData } = await db.auth.getUser();
  const message = document.getElementById("saveMessage");

  if(!userData.user){
    window.location.href = "index.html";
    return;
  }

  const userId = userData.user.id;

  const heroTitle = document.getElementById("heroTitle").value;
  const heroSubtitle = document.getElementById("heroSubtitle").value;
  const phone = document.getElementById("phone").value;

  const { error } = await db
    .from("site_content")
    .upsert({
      user_id:userId,
      hero_title:heroTitle,
      hero_subtitle:heroSubtitle,
      phone:phone
    });

  if(error){
    message.textContent = "Something went wrong saving changes.";
    return;
  }

  await db
    .from("change_logs")
    .insert({
      user_id:userId,
      change_summary:"Updated homepage content"
    });

  message.textContent = "Changes saved successfully.";
  loadDashboard();
}
