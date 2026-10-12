/* =========================================================
   Sondage de rue
   - creer.html       : on ajoute des questions à une liste
   - repondre.html    : toutes les questions s'affichent l'une sous l'autre
   - statistique.html : résultats de chaque question
   Tout est enregistré dans le navigateur du téléphone (localStorage).
   ========================================================= */
const STORAGE_KEY = "sondage-rue-v3";
const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const LETTERS = "ABCDEFGH";
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2,6);

// Quelle page est ouverte ? (<body data-page="creer|repondre|stats">)
const PAGE = document.body.dataset.page;
// Ajoute un écouteur seulement si l'élément existe sur cette page
const on = (sel, ev, fn) => { const el = $(sel); if(el) el.addEventListener(ev, fn); };

/* ---------- Données ----------
   questions : [{ id, text, options:[...] }]
   responses : [{ answers:{ <questionId>: <index de la réponse> }, at }]  (aucune info sur la personne)
*/
let data = load();
function load(){
  try{
    const d = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if(d && Array.isArray(d.questions) && Array.isArray(d.responses)) return d;
  }catch(e){}
  return migrate();
}
// Récupère les données des versions précédentes de l'app, s'il y en a
function migrate(){
  const fresh = { questions:[], responses:[] };
  try{
    const v2 = JSON.parse(localStorage.getItem("sondage-rue-v2"));
    if(v2 && Array.isArray(v2.forms)){
      v2.forms.slice().reverse().forEach(f=> f.questions.forEach(q=> fresh.questions.push(q)));
      v2.responses.forEach(r=> fresh.responses.push({ answers:r.answers, at:r.at }));
    }
    const v1 = JSON.parse(localStorage.getItem("sondage-rue-v1"));
    if(v1 && Array.isArray(v1.polls)){
      v1.polls.slice().reverse().forEach(p=> fresh.questions.push({ id:p.id, text:p.question, options:p.options }));
      v1.responses.forEach(r=> fresh.responses.push({ answers:{ [r.pollId]: r.choice }, at:r.at }));
    }
  }catch(e){}
  return fresh;
}
function save(){
  try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); return true; }
  catch(e){ return false; }
}
function tally(q){
  const c = q.options.map(()=>0);
  data.responses.forEach(r=>{ const a = r.answers[q.id]; if(c[a]!==undefined) c[a]++; });
  return c;
}
const plural = (n, word) => `${n} ${word}${n>1?'s':''}`;

function render(){
  if(PAGE==="repondre") renderRepondre();
  if(PAGE==="stats") renderStats();
  if(PAGE==="creer") renderManage();
}

/* =========================================================
   PAGE RÉPONDRE : toutes les questions, l'une sous l'autre
   ========================================================= */
let picked = {};          // choix de la personne en cours { questionId: index }
let showMissing = false;  // surligne les questions oubliées après un essai d'envoi
let thanksTimer = null;

function renderRepondre(){
  const el = $("#v-repondre");
  if(!data.questions.length){
    el.innerHTML = `<div class="card empty"><strong>Aucune question</strong><a href="creer.html">Crée tes questions</a> pour commencer.</div>`;
    return;
  }
  const done = data.questions.filter(q=>picked[q.id]!==undefined).length;
  el.innerHTML = `
    <div class="card form-head">
      <div class="eyebrow" style="justify-content:center">Sondage anonyme</div>
      <h2>Merci de répondre !</h2>
      <div class="note">${plural(data.questions.length,'question')} · aucune information personnelle n'est demandée</div>
    </div>
    ${data.questions.map((q,qi)=>{
      const missing = showMissing && picked[q.id]===undefined;
      return `<div class="card q-block ${missing?'missing':''}" id="block-${esc(q.id)}">
        <div class="qnum">Question ${qi+1}</div>
        <h3>${esc(q.text)}</h3>
        <div class="choices">
          ${q.options.map((o,i)=>`<button type="button" class="choice ${picked[q.id]===i?'on':''}" data-q="${esc(q.id)}" data-choice="${i}" aria-pressed="${picked[q.id]===i}">
            <span class="letter">${LETTERS[i]}</span><span>${esc(o)}</span></button>`).join("")}
        </div>
        ${missing ? '<div class="req">Choisis une réponse pour cette question.</div>' : ''}
      </div>`;
    }).join("")}
    <div>
      <button type="button" class="btn primary validate" id="send">Envoyer mes réponses</button>
      <div class="progress" style="margin-top:10px">${done} / ${data.questions.length} répondue${done>1?'s':''} · ${plural(data.responses.length,'personne')} interrogée${data.responses.length>1?'s':''}</div>
    </div>`;
}
on("#v-repondre", "click", e=>{
  if(e.target.closest(".thanks")){ clearTimeout(thanksTimer); renderRepondre(); window.scrollTo(0,0); return; }

  const c = e.target.closest("[data-choice]");
  if(c){
    const y = window.scrollY;
    picked[c.dataset.q] = Number(c.dataset.choice);
    renderRepondre();
    window.scrollTo(0,y);
    return;
  }

  if(e.target.closest("#send")){
    const missing = data.questions.find(q=>picked[q.id]===undefined);
    if(missing){
      showMissing = true; renderRepondre();
      document.getElementById("block-"+missing.id).scrollIntoView({behavior:"smooth", block:"center"});
      return;
    }
    data.responses.push({ answers:{...picked}, at:new Date().toISOString() });
    if(!save()){ data.responses.pop(); alert("Impossible d'enregistrer : la mémoire du navigateur est pleine ou bloquée."); return; }
    picked = {}; showMissing = false;
    window.scrollTo(0,0);
    $("#v-repondre").innerHTML = `<div class="card thanks"><div class="big">Merci !</div><p>Tes réponses sont enregistrées.</p><p class="note" style="margin-top:18px">Appuie n'importe où pour la personne suivante</p></div>`;
    clearTimeout(thanksTimer);
    thanksTimer = setTimeout(()=>{ renderRepondre(); window.scrollTo(0,0); }, 3000);
  }
});

/* =========================================================
   PAGE STATISTIQUES
   ========================================================= */
let confirmReset = false;
function renderStats(){
  const el = $("#v-stats");
  if(!data.questions.length){
    el.innerHTML = `<div class="card empty"><strong>Pas encore de statistiques</strong><a href="creer.html">Crée tes questions</a>, puis fais répondre les gens.</div>`;
    return;
  }
  const total = data.responses.length;
  let html = `<div class="card">
      <div class="eyebrow">Résultats</div>
      <div class="kpis" style="margin-top:12px">
        <div class="kpi"><b>${total}</b><span>personne${total>1?'s':''} interrogée${total>1?'s':''}</span></div>
        <div class="kpi"><b>${data.questions.length}</b><span>question${data.questions.length>1?'s':''}</span></div>
      </div>
      <div class="row">
        <button class="btn ghost" id="csv" ${total?'':'disabled'}>Exporter en CSV</button>
        ${confirmReset
          ? `<span class="note err">Effacer les ${total} réponses ?</span>
             <button class="btn danger" id="doReset">Oui, effacer</button>
             <button class="btn ghost" id="cancelReset">Annuler</button>`
          : `<button class="btn danger" id="askReset" ${total?'':'disabled'}>Remettre à zéro</button>`}
      </div>
    </div>`;
  html += data.questions.map((q,qi)=>{
    const c = tally(q), sum = c.reduce((a,b)=>a+b,0), max = Math.max(...c);
    return `<article class="card">
      <div class="qnum">Question ${qi+1} · ${plural(sum,'réponse')}</div>
      <h3 style="font-family:var(--display);font-weight:600;font-size:19px;margin:4px 0 14px">${esc(q.text)}</h3>
      <div class="bars">
        ${q.options.map((o,i)=>{
          const pct = sum ? Math.round(c[i]*100/sum) : 0;
          return `<div class="${sum && c[i]===max ? 'lead':''}">
            <div class="bar-head"><span class="lbl">${LETTERS[i]}. ${esc(o)}</span><span class="val">${pct} % · ${c[i]}</span></div>
            <div class="track"><div class="fill" style="width:${pct}%"></div></div></div>`;
        }).join("")}
      </div>
    </article>`;
  }).join("");
  el.innerHTML = html;
}
on("#v-stats", "click", e=>{
  const t = e.target.closest("button"); if(!t) return;
  if(t.id==="askReset") confirmReset = true;
  else if(t.id==="cancelReset") confirmReset = false;
  else if(t.id==="doReset"){ data.responses = []; confirmReset = false; save(); }
  else if(t.id==="csv"){ exportCsv(); return; }
  renderStats();
});

// Une ligne par personne, une colonne par question (comme Google Forms)
function exportCsv(){
  const q = s => '"' + String(s).replace(/"/g,'""') + '"';
  let csv = ["Date", ...data.questions.map(x=>x.text)].map(q).join(";") + "\n";
  data.responses.forEach(r=>{
    const row = [new Date(r.at).toLocaleString("fr-FR"), ...data.questions.map(x=> x.options[r.answers[x.id]] ?? "")];
    csv += row.map(q).join(";") + "\n";
  });
  const blob = new Blob(["﻿"+csv], { type:"text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "sondage-de-rue.csv";
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(a.href), 1000);
}

/* =========================================================
   PAGE CRÉER : ajouter des questions à la liste
   ========================================================= */
let optValues = ["",""];
function renderOptInputs(){
  $("#optInputs").innerHTML = optValues.map((v,i)=>`<div class="optin">
    <input type="text" id="opt-${i}" maxlength="80" value="${esc(v)}" placeholder="Réponse ${LETTERS[i]}" data-i="${i}">
    ${optValues.length>2 ? `<button type="button" class="btn ghost" data-rm="${i}" aria-label="Retirer la réponse ${LETTERS[i]}">✕</button>`:''}
  </div>`).join("");
  $("#addOpt").disabled = optValues.length>=8;
}
on("#optInputs", "input", e=>{ if(e.target.dataset.i!==undefined) optValues[+e.target.dataset.i] = e.target.value; });
on("#optInputs", "click", e=>{ const b=e.target.closest("[data-rm]"); if(b){ optValues.splice(+b.dataset.rm,1); renderOptInputs(); } });
on("#addOpt", "click", ()=>{ if(optValues.length<8){ optValues.push(""); renderOptInputs(); $("#opt-"+(optValues.length-1)).focus(); } });

on("#newQuestion", "submit", e=>{
  e.preventDefault();
  const msg = $("#createMsg");
  const text = $("#q").value.trim();
  const options = optValues.map(s=>s.trim()).filter(Boolean);
  if(!text){ msg.className="note err"; msg.textContent="Écris la question."; return; }
  if(options.length<2){ msg.className="note err"; msg.textContent="Il faut au moins deux réponses."; return; }
  data.questions.push({ id:uid(), text, options });
  if(!save()){ data.questions.pop(); msg.className="note err"; msg.textContent="Impossible d'enregistrer dans ce navigateur."; return; }
  $("#q").value = ""; optValues = ["",""]; renderOptInputs();
  msg.className="note ok"; msg.textContent=`Question ajoutée (${data.questions.length} au total).`;
  renderManage();
  $("#q").focus();
});

let confirmDel = null;
function renderManage(){
  const el = $("#manage");
  $("#count").textContent = data.questions.length ? `· ${data.questions.length}` : "";
  if(!data.questions.length){ el.innerHTML = `<p class="note">Aucune question pour l’instant.</p>`; return; }
  el.innerHTML = data.questions.map((q,qi)=>`<div class="mrow">
      <div class="q"><span class="qnum">Q${qi+1}</span> ${esc(q.text)}
        <div class="note">${q.options.map((o,i)=>`${LETTERS[i]}. ${esc(o)}`).join(" · ")}</div></div>
      <div class="row" style="margin:0">
        ${confirmDel===q.id
          ? `<span class="note err">Supprimer cette question et ses réponses ?</span>
             <button class="btn danger" data-del="${esc(q.id)}">Oui, supprimer</button>
             <button class="btn ghost" data-cancel>Annuler</button>`
          : `<button class="btn ghost" data-up="${qi}" ${qi===0?'disabled':''} aria-label="Monter">↑</button>
             <button class="btn ghost" data-down="${qi}" ${qi===data.questions.length-1?'disabled':''} aria-label="Descendre">↓</button>
             <button class="btn danger" data-ask="${esc(q.id)}">Supprimer</button>`}
      </div></div>`).join("");
}
on("#manage", "click", e=>{
  const t = e.target.closest("button"); if(!t) return;
  const move = (i,j)=>{ const a=data.questions; [a[i],a[j]]=[a[j],a[i]]; save(); };
  if(t.dataset.ask) confirmDel = t.dataset.ask;
  else if(t.hasAttribute("data-cancel")) confirmDel = null;
  else if(t.dataset.up!==undefined) move(+t.dataset.up, +t.dataset.up-1);
  else if(t.dataset.down!==undefined) move(+t.dataset.down, +t.dataset.down+1);
  else if(t.dataset.del){
    const id = t.dataset.del;
    data.questions = data.questions.filter(q=>q.id!==id);
    data.responses.forEach(r=>{ delete r.answers[id]; });
    data.responses = data.responses.filter(r=>Object.keys(r.answers).length);
    confirmDel = null; save();
  }
  renderManage();
});

/* ---------- Mise à jour en direct ---------- */
// Si les données changent (autre onglet) ou qu'on revient sur la page, on ré-affiche
// (sauf sur « Répondre », pour ne pas effacer les choix de la personne en cours)
function refresh(){
  data = load();
  if(PAGE!=="repondre") render();
}
window.addEventListener("storage", e=>{ if(e.key===STORAGE_KEY) refresh(); });
document.addEventListener("visibilitychange", ()=>{ if(!document.hidden) refresh(); });

/* ---------- Démarrage ---------- */
if(PAGE==="creer") renderOptInputs();
save();   // enregistre tout de suite les données récupérées d'une ancienne version
render();