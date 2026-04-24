const SUPABASE_URL = "https://ujxuirmeikbzakqaerec.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_gLnNGeQUUbjLoQlN5g2t9g_XXQpy9P3";

let db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function login(){
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  const message = document.getElementById("message");

  message.textContent = "Logging in...";

  if(!email || !password){
    message.textContent = "Enter your email and password.";
    return;
  }

  const { data, error } = await db.auth.signInWithPassword({
    email,
    password
  });

  if(error){
    message.textContent = error.message;
    return;
  }

  window.location.href = "editor.html";
}

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

async function logout(){
  await db.auth.signOut();
  window.location.href = "login.html";
}
