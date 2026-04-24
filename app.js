const SUPABASE_URL = "https://ujxuirmeikbzakqaerec.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_gLnNGeQUUbjLoQlN5g2t9g_XXQpy9P3";

const db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/* =========================
   LOGIN
=========================*/
async function login(){
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  const message = document.getElementById("message");

  message.textContent = "Logging in...";

  if(!email || !password){
    message.textContent = "Enter your email and password.";
    return;
  }

  try{
    const { data, error } = await db.auth.signInWithPassword({
      email,
      password
    });

    if(error){
      message.textContent = error.message;
      console.error("Login error:", error);
      return;
    }

    message.textContent = "Login successful...";
    setTimeout(() => {
      window.location.href = "editor.html";
    }, 500);

  } catch(err){
    console.error("Unexpected error:", err);
    message.textContent = "Something went wrong. Try again.";
  }
}

/* =========================
   CHECK USER SESSION
=========================*/
async function checkUser(){
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

/* =========================
   LOGOUT
=========================*/
async function logout(){
  await db.auth.signOut();
  window.location.href = "index.html";
}
