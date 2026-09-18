let selected=null;
const naira=n=>new Intl.NumberFormat("en-NG",{style:"currency",currency:"NGN",maximumFractionDigits:0}).format(n);
async function load(){
 const r=await fetch("/api/config"); const c=await r.json();
 document.getElementById("opayName").textContent=c.opayName;
 document.getElementById("opayNumber").textContent=c.opayNumber || "Organizer will provide account number";
 const box=document.getElementById("ticketCards");
 box.innerHTML=c.tickets.map(t=>`<div class="ticket" data-code="${t.code}"><h3>${t.name}</h3><strong>${naira(t.price)}</strong><p class="muted">Limited availability · ${t.capacity} tickets</p><button class="btn small">Select ${t.name}</button></div>`).join("");
 box.querySelectorAll(".ticket").forEach(el=>el.onclick=()=>{
   box.querySelectorAll(".ticket").forEach(x=>x.classList.remove("selected")); el.classList.add("selected");
   selected=c.tickets.find(t=>t.code===el.dataset.code);
   document.getElementById("ticketType").value=selected.code; document.getElementById("ticketDisplay").value=`${selected.name} — ${naira(selected.price)}`;
   document.getElementById("regForm").scrollIntoView({behavior:"smooth"});
 });
}
document.getElementById("regForm").addEventListener("submit",async e=>{
 e.preventDefault(); const msg=document.getElementById("formMsg");
 if(!selected){msg.className="message err";msg.textContent="Please select a ticket first.";return}
 const body={fullName:fullName.value,phone:phone.value,email:email.value,ticketType:ticketType.value,paymentReference:paymentReference.value};
 const r=await fetch("/api/register",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
 const d=await r.json(); msg.className="message "+(r.ok?"ok":"err"); msg.textContent=r.ok?`${d.message} Registration #${d.registrationId}. Ticket code: ${d.ticketCode}`:(d.error||"Registration failed.");
 if(r.ok)e.target.reset();
});
load();