const SUPABASE_URL = "https://ujxuirmeikbzakqaerec.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_gLnNGeQUUbjLoQlN5g2t9g_XXQpy9P3";

const db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function login(){
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  const message = document.getElementById("message");

  message.textContent = "Checking login...";

  if(!email || !password){
    message.textContent = "Enter your email and password.";
    return;
  }

  console.log("Trying login with:", email);

  const timeout = setTimeout(() => {
    message.textContent = "Login is taking too long. Check Supabase key, user, or internet.";
  }, 8000);

  try{
    const { data, error } = await db.auth.signInWithPassword({
      email: email,
      password: password
    });

    clearTimeout(timeout);

    console.log("Login data:", data);
    console.log("Login error:", error);

    if(error){
      message.textContent = error.message;
      return;
    }

    message.textContent = "Login successful. Redirecting...";
    window.location.href = "editor.html";

  }catch(err){
    clearTimeout(timeout);
    console.error("Unexpected login error:", err);
    message.textContent = err.message || "Unexpected login error.";
  }
}

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

async function logout(){
  await db.auth.signOut();
  window.location.href = "index.html";
}
