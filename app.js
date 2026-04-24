const SUPABASE_URL = "https://ujxuirmeikbzakqaerec.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_gLnNGeQUUbjLoQlN5g2t9g_XXQpy9P3";

let db;

document.addEventListener("DOMContentLoaded", () => {
  db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
});

async function login(){
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  const message = document.getElementById("message");

  message.textContent = "Logging in...";

  if(!email || !password){
    message.textContent = "Enter your email and password.";
    return;
  }

  if(!db){
    message.textContent = "Supabase did not load. Refresh and try again.";
    return;
  }

  const { data, error } = await db.auth.signInWithPassword({
    email,
    password
  });

  console.log("Login data:", data);
  console.log("Login error:", error);

  if(error){
    message.textContent = error.message;
    return;
  }

  message.textContent = "Login successful...";
  window.location.href = "editor.html";
}

async function checkUser(){
  if(!db){
    db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }

  const { data, error } = await db.auth.getUser();

  if(error || !data.user){
    window.location.href = "index.html";
    return null;
  }

  const userEmail = document.getElementById("userEmail");
  if(userEmail){
    userEmail.textContent = data.user.email;
  }

  return data.user;
}

async function logout(){
  if(!db){
    db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }

  await db.auth.signOut();
  window.location.href = "index.html";
}
