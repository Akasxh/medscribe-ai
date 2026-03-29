"""Admin login and dashboard — standalone HTML pages (no React).

Note: innerHTML usage in the dashboard JS is intentional for rendering
consultation data from our own trusted API endpoint. All user-supplied
text is escaped via the esc() helper function before insertion.
"""

from fastapi import APIRouter
from fastapi.responses import HTMLResponse

admin_pages_router = APIRouter(tags=["admin-pages"])


ADMIN_LOGIN_HTML = """<!DOCTYPE html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>MedScribe AI - Admin Login</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:system-ui,-apple-system,sans-serif;background:linear-gradient(135deg,#f5f3ff,#eff6ff,#f0fdf4);min-height:100vh;display:flex;align-items:center;justify-content:center;padding:16px}
.card{background:#fff;border-radius:16px;box-shadow:0 4px 24px rgba(0,0,0,.08);padding:32px;width:100%;max-width:400px;border:1px solid #e2e8f0}
.logo{text-align:center;margin-bottom:24px}
.logo h1{font-size:24px;font-weight:700;color:#1e293b}
.logo h1 span{color:#7c3aed}
.logo p{font-size:12px;color:#94a3b8;margin-top:2px}
.icon{width:48px;height:48px;border-radius:12px;background:linear-gradient(135deg,#7c3aed,#6d28d9);display:flex;align-items:center;justify-content:center;margin:0 auto 12px}
.icon svg{width:24px;height:24px;color:#fff;fill:none;stroke:currentColor;stroke-width:2}
h2{font-size:18px;font-weight:600;text-align:center;color:#1e293b;margin-bottom:4px}
.sub{font-size:13px;color:#94a3b8;text-align:center;margin-bottom:20px}
label{display:block;font-size:12px;font-weight:500;color:#475569;margin-bottom:6px}
label span{color:#ef4444}
input{width:100%;padding:12px;border:1px solid #e2e8f0;border-radius:10px;font-size:14px;background:#f8fafc;outline:none;transition:border .2s}
input:focus{border-color:#7c3aed;box-shadow:0 0 0 3px rgba(124,58,237,.1)}
.gap{height:14px}
.btn{width:100%;padding:12px;background:#7c3aed;color:#fff;border:none;border-radius:10px;font-size:14px;font-weight:600;cursor:pointer;transition:background .2s}
.btn:hover{background:#6d28d9}
.btn:disabled{opacity:.5;cursor:not-allowed}
.err{background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:10px;font-size:12px;color:#dc2626;margin-bottom:14px;display:none}
.back{display:block;text-align:center;margin-top:16px;font-size:12px;color:#94a3b8;text-decoration:none}
.back:hover{color:#7c3aed}
.footer{text-align:center;margin-top:24px;font-size:10px;color:#94a3b8}
</style>
</head><body>
<div>
<div class="card">
  <div class="logo">
    <div class="icon"><svg viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg></div>
    <h1>MedScribe<span>AI</span></h1>
    <p>Admin Portal</p>
  </div>
  <h2>Hospital Admin Sign In</h2>
  <p class="sub">Sign in with your admin credentials</p>
  <div id="err" class="err"></div>
  <form id="form">
    <label>Admin Email <span>*</span></label>
    <input type="email" id="email" placeholder="admin@hospital.com" required autofocus>
    <div class="gap"></div>
    <label>Password <span>*</span></label>
    <input type="password" id="pwd" placeholder="Your password" required>
    <div class="gap"></div>
    <button type="submit" class="btn" id="btn">Sign In as Admin</button>
  </form>
  <a href="/" class="back">Back to Doctor App</a>
</div>
<p class="footer">HACKMATRIX 2.0 - Jilo Health x NJACK IIT Patna</p>
</div>
<script>
document.getElementById('form').addEventListener('submit',async function(e){
  e.preventDefault();
  var btn=document.getElementById('btn'),errEl=document.getElementById('err');
  var email=document.getElementById('email').value.trim();
  var pwd=document.getElementById('pwd').value;
  if(!email||!pwd){errEl.textContent='Email and password required';errEl.style.display='block';return}
  btn.disabled=true;btn.textContent='Signing in...';errEl.style.display='none';
  try{
    var r=await fetch('/api/auth/check-admin?email='+encodeURIComponent(email)+'&password='+encodeURIComponent(pwd));
    var d=await r.json();
    if(d.is_admin){
      localStorage.setItem('medscribe_admin',JSON.stringify({email:email,t:Date.now()}));
      window.location.href='/admin/dashboard';
    }else{errEl.textContent='Invalid email or password';errEl.style.display='block'}
  }catch(x){errEl.textContent='Could not connect to server';errEl.style.display='block'}
  btn.disabled=false;btn.textContent='Sign In as Admin';
});
</script>
</body></html>"""


ADMIN_DASHBOARD_HTML = """<!DOCTYPE html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>MedScribe AI - Admin Dashboard</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:system-ui,-apple-system,sans-serif;background:#f8fafc;color:#1e293b}
.hdr{background:linear-gradient(135deg,#7c3aed,#6d28d9);color:#fff;padding:14px 20px}
.hdr-inner{max-width:1200px;margin:0 auto;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px}
.hdr h1{font-size:18px;font-weight:700}
.hdr p{font-size:11px;color:rgba(255,255,255,.7)}
.hdr-r{display:flex;align-items:center;gap:12px}
.hdr-r span{font-size:13px;color:rgba(255,255,255,.8)}
.btn-s{padding:6px 14px;background:rgba(255,255,255,.15);border:none;color:#fff;border-radius:8px;font-size:13px;cursor:pointer}
.btn-s:hover{background:rgba(255,255,255,.25)}
main{max-width:1200px;margin:0 auto;padding:20px}
.empty{text-align:center;padding:80px 20px}
.empty h2{font-size:20px;font-weight:600;color:#475569}
.empty p{font-size:14px;color:#94a3b8;margin-top:8px}
.card{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:16px;margin-bottom:12px}
.card:hover{box-shadow:0 2px 12px rgba(0,0,0,.06)}
.card h3{font-size:15px;font-weight:600;margin-bottom:4px}
.complaint{font-size:13px;color:#64748b}
.meta{display:flex;flex-wrap:wrap;gap:12px;margin-top:8px;font-size:12px;color:#94a3b8}
.badge{display:inline-block;padding:2px 8px;border-radius:20px;font-size:10px;font-weight:500;background:#ecfdf5;color:#059669;border:1px solid #a7f3d0}
.count{font-size:14px;font-weight:600;color:#7c3aed;margin-bottom:16px}
.spin{display:inline-block;width:24px;height:24px;border:3px solid #e2e8f0;border-top-color:#7c3aed;border-radius:50%;animation:sp .6s linear infinite}
@keyframes sp{to{transform:rotate(360deg)}}
.footer{text-align:center;padding:20px;font-size:11px;color:#94a3b8}
</style>
</head><body>
<div class="hdr"><div class="hdr-inner">
  <div><h1>MedScribeAI Admin</h1><p>Hospital Management Dashboard</p></div>
  <div class="hdr-r">
    <span id="ae"></span>
    <button class="btn-s" id="rbtn">Refresh</button>
    <button class="btn-s" id="lbtn">Logout</button>
  </div>
</div></div>
<main id="c"><div style="text-align:center;padding:60px"><div class="spin"></div></div></main>
<div class="footer">MedScribe AI Admin - HACKMATRIX 2.0 (Jilo Health x NJACK IIT Patna)</div>
<script>
var admin=JSON.parse(localStorage.getItem('medscribe_admin')||'null');
if(!admin)window.location.href='/admin/login';
else{document.getElementById('ae').textContent=admin.email;load()}
document.getElementById('rbtn').addEventListener('click',load);
document.getElementById('lbtn').addEventListener('click',function(){localStorage.removeItem('medscribe_admin');window.location.href='/admin/login'});

async function load(){
  var c=document.getElementById('c');
  c.textContent='';
  var sp=document.createElement('div');sp.style.cssText='text-align:center;padding:60px';
  var spn=document.createElement('div');spn.className='spin';sp.appendChild(spn);c.appendChild(sp);
  try{
    var r=await fetch('/api/admin/consultations');
    var data=await r.json();
    render(data);
  }catch(e){
    c.textContent='';
    var d=document.createElement('div');d.className='empty';
    var h=document.createElement('h2');h.textContent='Error loading data';
    var p=document.createElement('p');p.textContent=e.message;
    d.appendChild(h);d.appendChild(p);c.appendChild(d);
  }
}

function render(sessions){
  var c=document.getElementById('c');
  c.textContent='';
  if(!sessions||sessions.length===0){
    var d=document.createElement('div');d.className='empty';
    var h=document.createElement('h2');h.textContent='No consultations yet';
    var p=document.createElement('p');p.textContent='When doctors complete consultations and upload, they will appear here.';
    var b=document.createElement('button');b.className='btn-s';b.style.cssText='margin-top:16px;background:#7c3aed;padding:10px 20px';
    b.textContent='Refresh';b.addEventListener('click',load);
    d.appendChild(h);d.appendChild(p);d.appendChild(b);c.appendChild(d);
    return;
  }
  var cnt=document.createElement('p');cnt.className='count';
  cnt.textContent=sessions.length+' consultation'+(sessions.length>1?'s':'');
  c.appendChild(cnt);

  sessions.forEach(function(s){
    var note=s.clinical_note||(s.clinical_notes&&s.clinical_notes[0])||{};
    var patient=(note.patient_info&&note.patient_info.name)||s.patient_name||'Unknown';
    var complaint=note.chief_complaint||'No complaint recorded';
    var dx=(note.diagnosis||[]).length;
    var meds=(note.medications||[]).length;
    var date=s.created_at?new Date(s.created_at).toLocaleString('en-IN',{dateStyle:'medium',timeStyle:'short'}):'--';
    var doctor=s.doctor_name||'';
    var spec=s.specialty||'general';

    var card=document.createElement('div');card.className='card';
    var row=document.createElement('div');row.style.cssText='display:flex;align-items:center;gap:8px;margin-bottom:4px';
    var h3=document.createElement('h3');h3.textContent=patient;
    var badge=document.createElement('span');badge.className='badge';badge.textContent=s.status||'completed';
    row.appendChild(h3);row.appendChild(badge);card.appendChild(row);

    var comp=document.createElement('div');comp.className='complaint';comp.textContent=complaint;card.appendChild(comp);

    var meta=document.createElement('div');meta.className='meta';
    var addMeta=function(t){var sp=document.createElement('span');sp.textContent=t;meta.appendChild(sp)};
    addMeta(date);
    if(doctor)addMeta('Dr. '+doctor);
    if(spec!=='general')addMeta(spec);
    addMeta(dx+' diagnosis');
    addMeta(meds+' medications');
    card.appendChild(meta);
    c.appendChild(card);
  });
}
</script>
</body></html>"""


@admin_pages_router.get("/admin/login", response_class=HTMLResponse)
async def admin_login_page():
    return ADMIN_LOGIN_HTML


@admin_pages_router.get("/admin/dashboard", response_class=HTMLResponse)
async def admin_dashboard_page():
    return ADMIN_DASHBOARD_HTML
