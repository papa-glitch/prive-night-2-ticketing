let attendees=[];
const money=n=>new Intl.NumberFormat("en-NG",{style:"currency",currency:"NGN",maximumFractionDigits:0}).format(Number(n||0));
async function api(url,opts={}){const r=await fetch(url,opts);if(r.status===401){showLogin();throw new Error("unauthorized")}const d=await r.json();if(!r.ok)throw new Error(d.error||"Request failed");return d}
function showLogin(){loginView.hidden=false;dashboardView.hidden=true}
function showDash(){loginView.hidden=true;dashboardView.hidden=false}
async function load(){
 try{
  const me=await api("/api/admin/me"); adminEmail.textContent=me.email; showDash();
  const d=await api("/api/admin/dashboard"); attendees=d.attendees;
  sold.textContent=d.totals.registrations; revenue.textContent=money(d.totals.revenue); pending.textContent=d.totals.pending; confirmed.textContent=d.totals.confirmed;
  ticketStats.innerHTML=d.tickets.map(t=>{const x=d.byType.find(a=>a.ticket_type===t.code)||{total:0,verified:0};return `<div class="ticket-admin"><b>${t.name}</b><h3>${money(t.price)}</h3><span class="muted">${x.verified} verified · ${x.total} registered / ${t.capacity}</span><div class="bar"><i style="width:${Math.min(100,x.total/t.capacity*100)}%"></i></div></div>`}).join("");
  renderTables(attendees);
  const s=await api("/api/admin/settings"); for(const [k,v] of Object.entries(s)){const el=document.querySelector(`[name="${k}"]`);if(el)el.value=v}
 }catch(e){}
}
function renderTables(list){
 attendeeRows.innerHTML=list.map(a=>`<tr><td><b>${esc(a.full_name)}</b><br><small>${esc(a.ticket_code||"")}</small></td><td>${esc(a.phone)}</td><td>${a.ticket_type}</td><td>${money(a.amount)}</td><td><span class="status ${a.payment_status}">${a.payment_status}</span></td><td><button class="action" onclick="verify(${a.id},'verified')">Verify</button> <button class="action" onclick="verify(${a.id},'rejected')">Reject</button></td></tr>`).join("");
 paymentRows.innerHTML=list.filter(a=>a.payment_status!=="verified").map(a=>`<tr><td>${esc(a.full_name)}</td><td>${esc(a.payment_reference)}</td><td>${money(a.amount)}</td><td><span class="status ${a.payment_status}">${a.payment_status}</span></td><td><button class="action" onclick="verify(${a.id},'verified')">Verify</button> <button class="action" onclick="verify(${a.id},'rejected')">Reject</button></td></tr>`).join("") || `<tr><td colspan="5" class="muted">No pending payments.</td></tr>`;
}
async function verify(id,status){if(!confirm(`Mark this payment ${status}?`))return;try{await api(`/api/admin/attendees/${id}/payment`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({status})});load()}catch(e){alert(e.message)}}
function esc(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]))}
loginForm.onsubmit=async e=>{e.preventDefault();try{await api("/api/admin/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:loginEmail.value,password:loginPassword.value})});loginMsg.textContent="";load()}catch(x){loginMsg.className="message err";loginMsg.textContent=x.message}};
logout.onclick=async()=>{await api("/api/admin/logout",{method:"POST"});showLogin()};
refresh.onclick=load;
search.oninput=()=>{const q=search.value.toLowerCase();renderTables(attendees.filter(a=>[a.full_name,a.phone,a.email,a.payment_reference,a.ticket_code,a.ticket_type].join(" ").toLowerCase().includes(q)))};
settingsForm.onsubmit=async e=>{e.preventDefault();const body=Object.fromEntries(new FormData(settingsForm));try{await api("/api/admin/settings",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});settingsMsg.className="message ok";settingsMsg.textContent="Settings saved."}catch(x){settingsMsg.className="message err";settingsMsg.textContent=x.message}};
load();