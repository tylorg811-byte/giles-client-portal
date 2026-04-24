const SUPABASE_URL = "https://ujxuirmeikbzakqaerec.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_gLnNGeQUUbjLoQlN5g2t9g_XXQpy9P3";

let db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/* LOGIN */
async function login(){
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  const message = document.getElementById("message");

  message.textContent = "Logging in...";

  if(!email || !password){
    message.textContent = "Enter your email and password.";
    return;
  }

  const { error } = await db.auth.signInWithPassword({ email, password });

  if(error){
    message.textContent = error.message;
    return;
  }

  window.location.href = "dashboard.html";
}

/* CHECK USER */
async function checkUser(){
  const { data, error } = await db.auth.getUser();

  if(error || !data.user){
    window.location.href = "login.html";
    return null;
  }

  const userEmail = document.getElementById("userEmail");
  if(userEmail){
    userEmail.textContent = data.user.email;
  }

  return data.user;
}

/* LOGOUT */
async function logout(){
  await db.auth.signOut();
  window.location.href = "login.html";
}

/* FORGOT PASSWORD */
async function sendPasswordReset(){
  const email = document.getElementById("resetEmail").value.trim();
  const message = document.getElementById("message");

  if(!email){
    message.textContent = "Enter your email first.";
    return;
  }

  message.textContent = "Sending reset email...";

  const { error } = await db.auth.resetPasswordForEmail(email, {
    redirectTo: "https://tylorg811-byte.github.io/giles-client-portal/reset.html"
  });

  if(error){
    message.textContent = error.message;
    return;
  }

  message.textContent = "Password reset email sent. Check your inbox.";
}

/* UPDATE PASSWORD */
async function updatePassword(){
  const password = document.getElementById("newPassword").value;
  const confirm = document.getElementById("confirmPassword").value;
  const message = document.getElementById("message");

  if(!password || !confirm){
    message.textContent = "Fill out both password fields.";
    return;
  }

  if(password !== confirm){
    message.textContent = "Passwords do not match.";
    return;
  }

  message.textContent = "Updating password...";

  const { error } = await db.auth.updateUser({
    password: password
  });

  if(error){
    message.textContent = error.message;
    return;
  }

  message.textContent = "Password updated. Redirecting...";
  setTimeout(() => {
    window.location.href = "login.html";
  }, 1200);
}

/* DASHBOARD DATA */
async function loadDashboard(){
  const user = await checkUser();
  if(!user) return;

  document.getElementById("welcomeName").textContent = user.email;

  const { data: page } = await db
    .from("visual_pages")
    .select("*")
    .eq("user_id", user.id)
    .single();

  if(page){
    document.getElementById("siteStatus").textContent = page.status || "draft";
    document.getElementById("lastUpdated").textContent = page.updated_at
      ? new Date(page.updated_at).toLocaleString()
      : "No updates yet";
  }

  const { data: views } = await db
    .from("analytics_events")
    .select("*")
    .eq("user_id", user.id)
    .eq("event_type", "page_view");

  const { data: clicks } = await db
    .from("analytics_events")
    .select("*")
    .eq("user_id", user.id)
    .eq("event_type", "button_click");

  document.getElementById("viewsCount").textContent = views ? views.length : 0;
  document.getElementById("clicksCount").textContent = clicks ? clicks.length : 0;

  const { data: logs } = await db
    .from("change_logs")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending:false })
    .limit(5);

  const logBox = document.getElementById("recentChanges");
  logBox.innerHTML = "";

  if(logs && logs.length){
    logs.forEach(log => {
      const li = document.createElement("li");
      li.textContent = log.change_summary;
      logBox.appendChild(li);
    });
  } else {
    logBox.innerHTML = "<li>No recent changes yet.</li>";
  }
}
