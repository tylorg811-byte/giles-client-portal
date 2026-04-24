const SUPABASE_URL = "PASTE_YOUR_SUPABASE_URL_HERE";
const SUPABASE_ANON_KEY = "PASTE_YOUR_SUPABASE_ANON_KEY_HERE";

const db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function login(){
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;
  const message = document.getElementById("message");

  message.textContent = "Logging in...";

  const { error } = await db.auth.signInWithPassword({ email, password });

  if(error){
    message.textContent = "Login failed. Check email and password.";
    return;
  }

  window.location.href = "editor.html";
}

async function checkUser(){
  const { data } = await db.auth.getUser();

  if(!data.user){
    window.location.href = "index.html";
    return null;
  }

  const userEmail = document.getElementById("userEmail");
  if(userEmail) userEmail.textContent = data.user.email;

  return data.user;
}

async function logout(){
  await db.auth.signOut();
  window.location.href = "index.html";
}
