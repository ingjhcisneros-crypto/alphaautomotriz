
const $ = id => document.getElementById(id);
const nodoEl = id => document.querySelector('[data-id="'+id+'"]');
const n0 = v => Math.round(v).toLocaleString('es-PE');
const n1 = v => (Math.round(v*10)/10).toLocaleString('es-PE');
const n2 = v => (Math.round(v*100)/100).toLocaleString('es-PE');
const pc = v => (v*100).toFixed(1)+'%';
const expo = m => -m*Math.log(1-Math.random());
const iso = d => new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,10);
const dISO = s => new Date(s+'T00:00:00');
const ahoraLocal = () => { const d = new Date(); return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16); };
const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const DIAS_SEM = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
const MESES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
const fechaLarga = d => DIAS_SEM[d.getDay()]+' '+d.getDate()+' de '+MESES[d.getMonth()]+' de '+d.getFullYear();
const prom = a => { const v = (a||[]).filter(x => x > 0); return v.length ? v.reduce((x,y)=>x+y,0)/v.length : 0; };
function banda(v){
  if(v >= 0.85) return {c:'var(--lima)',t:'Excelente'};
  if(v >= 0.75) return {c:'var(--accent2)',t:'Bueno'};
  if(v >= 0.65) return {c:'var(--warning)',t:'Regular'};
  return {c:'var(--danger)',t:'Malo'};
}
let FECHA_SIS = iso(new Date());
const HOY = () => FECHA_SIS;
/* Las claves se guardan como SHA-256 de «usuario:clave», nunca en texto plano. */
async function hashClave(user, pass){
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(user).toLowerCase()+':'+pass));
  return Array.from(new Uint8Array(b)).map(x => x.toString(16).padStart(2,'0')).join(''); }
async function asegurarHashes(){
  for(const u of USUARIOS){ if(u.pass != null){ u.hash = await hashClave(u.user, u.pass); delete u.pass; } } }
async function claveValida(u, p){ return !!u && !!u.hash && u.hash === await hashClave(u.user, p); }
/* Diálogos: el visor de artefactos de claude.ai no muestra alert/confirm/prompt, así que se usan los diálogos
   propios de la aplicación (window.CMMS.ui). Sin ellos (antes de que cargue la app) se cae a los nativos. */
const uiCMMS = () => window.CMMS && window.CMMS.ui;
function avisoL(m, tipo){ const u = uiCMMS(); if(u) u.aviso(m, tipo || 'warn', 5500); else window.alert(m); }
async function confirmarL(titulo, m, si){ const u = uiCMMS(); return u ? !!(await u.confirmar(titulo, '<p>'+esc(m)+'</p>', si || 'Continuar', true)) : window.confirm(m); }
async function pedirL(titulo, m, tipo){
  const u = uiCMMS(); if(!u) return window.prompt(m);
  const bot = [{t:'Cancelar', v:null}, {t:'Aceptar', v: c => c.querySelector('#dlgEntrada').value}];
  bot.onMontar = c => { const i = c.querySelector('#dlgEntrada'); i.focus(); i.addEventListener('keydown', e => { if(e.key === 'Enter') c.querySelector('[data-i="1"]').click(); }); };
  return u.dialogo(titulo, '<p>'+esc(m)+'</p><input id="dlgEntrada" type="'+(tipo || 'text')+'" autocomplete="off" style="width:100%;margin-top:8px">', bot); }
async function pedirClave(msg){
  const c = await pedirL('Confirmar con la clave principal', msg+' Ingresa la clave del usuario principal.', 'password');
  if(c === null) return false;
  if(!(await claveValida(USUARIOS[0], c))){ avisoL('Clave incorrecta. No se realizó ningún cambio.'); return false; }
  return true;
}
function abrirCapa(id){ $(id).classList.add('abierta'); document.body.classList.add('bloqueado'); }
function cerrarCapa(id){ $(id).classList.remove('abierta'); document.body.classList.remove('bloqueado'); }

(function(){
  const cv = $('redes'); if(!cv) return;
  const cx = cv.getContext('2d');
  let W, H, pts = [];
  function medir(){ W = cv.width = cv.offsetWidth; H = cv.height = cv.offsetHeight;
    const n = Math.min(90, Math.round(W*H/16000));
    pts = []; for(let i = 0; i < n; i++) pts.push({x:Math.random()*W, y:Math.random()*H,
      vx:(Math.random()-0.5)*0.28, vy:(Math.random()-0.5)*0.28, r:1+Math.random()*1.8}); }
  function pinta(){
    if($('portal').classList.contains('oculto')){ requestAnimationFrame(pinta); return; }
    cx.clearRect(0,0,W,H);
    const g = cx.createRadialGradient(W*0.5,H*0.1,0,W*0.5,H*0.1,Math.max(W,H)*0.9);
    g.addColorStop(0,'rgba(61,234,36,0.07)'); g.addColorStop(1,'rgba(7,11,16,0)');
    cx.fillStyle = g; cx.fillRect(0,0,W,H);
    for(let i = 0; i < pts.length; i++){
      const p = pts[i];
      p.x += p.vx; p.y += p.vy;
      if(p.x < 0 || p.x > W) p.vx *= -1;
      if(p.y < 0 || p.y > H) p.vy *= -1;
      for(let j = i+1; j < pts.length; j++){
        const q = pts[j], dx = p.x-q.x, dy = p.y-q.y, d = Math.hypot(dx,dy);
        if(d < 140){ cx.strokeStyle = 'rgba(61,234,36,'+(0.13*(1-d/140))+')'; cx.lineWidth = 1;
          cx.beginPath(); cx.moveTo(p.x,p.y); cx.lineTo(q.x,q.y); cx.stroke(); } }
      cx.fillStyle = 'rgba(61,234,36,0.5)';
      cx.beginPath(); cx.arc(p.x,p.y,p.r,0,7); cx.fill(); }
    requestAnimationFrame(pinta); }
  window.addEventListener('resize', medir); medir(); pinta();
})();

const ALCANCE = {
  'Administrador':'Acceso total, incluida la gestión de usuarios',
  'Ingeniero de mantenimiento':'Programa, agenda, anomalías y cálculo del OEE',
  'Técnico de mantenimiento':'Consulta del programa y cierre de órdenes con evidencia',
  'Operador de línea':'Cierre de rutinas autónomas y reporte de anomalías'
};
let USUARIOS = [
  {nombre:'Gutierrez y Cisneros', user:'gutierres&cisneros@upc.pe', hash:'76e842564f293386e8ba02c4c021ceb630d02a36669d03c98188676e66ef72c0', rol:'Administrador'},
  {nombre:'Ing. de mantenimiento', user:'ing@lexacaucho.pe', hash:'f5a7ec3774acd6d948b7075e0bab60a0ca2e41857e969646c2ad6f7f46cfe3f8', rol:'Ingeniero de mantenimiento'},
  {nombre:'Téc. de mantenimiento', user:'tec@lexacaucho.pe', hash:'5a44d86c3ad4b82d13f9218e998ffdee1ca10b85479b16631b45e40daedc3621', rol:'Técnico de mantenimiento'},
  {nombre:'Operador de línea', user:'ope@lexacaucho.pe', hash:'815dcae52e322271bdf8dbeb705f97f3826527cc9255e4f8e85640445029720e', rol:'Operador de línea'}
];
let SESION = null, LOGOS = {upc:null, emp:null, fav:null}, verClaves = false;
$('btnEntrar').onclick = entrar;
['inUser','inPass'].forEach(i => $(i).addEventListener('keydown', e=>{ if(e.key === 'Enter') entrar(); }));
async function entrar(){
  const u = $('inUser').value.trim(), p = $('inPass').value;
  await asegurarHashes();
  const cand = USUARIOS.find(a => a.user.toLowerCase() === u.toLowerCase());
  const x = (await claveValida(cand, p)) ? cand : null;
  if(!x){ $('loginMsg').className = 'login-msg error'; $('loginMsg').textContent = 'Usuario o clave incorrectos.'; return; }
  SESION = x;
  $('loginMsg').className = 'login-msg ok'; $('loginMsg').textContent = 'Acceso concedido.';
  $('portal').classList.add('oculto'); $('app').classList.add('on');
  $('uNombre').textContent = x.nombre; $('uRol').textContent = x.rol;
  arrancarApp();
}
$('btnSalir').onclick = function(){ SESION = null; $('app').classList.remove('on'); $('portal').classList.remove('oculto'); $('inPass').value = ''; };
$('btnTema').onclick = function(){
  document.body.classList.toggle('claro');
  this.innerHTML = document.body.classList.contains('claro') ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
  if(S){ dibujar(); encajar(); refrescar(); } };
const puedeEditar = () => SESION && (SESION.rol === 'Administrador' || SESION.rol === 'Ingeniero de mantenimiento');
function aplicarLogos(){
  $('slotUpc').innerHTML = LOGOS.upc ? '<img src="'+LOGOS.upc+'">' : '<span class="ph">Logo UPC</span>';
  $('slotEmp').innerHTML = LOGOS.emp ? '<img src="'+LOGOS.emp+'">' : '<span class="ph">Logo de la empresa</span>';
  $('railUpc').innerHTML = LOGOS.upc ? '<img src="'+LOGOS.upc+'">' : '<span class="ph">Logo UPC</span>';
  $('railEmp').innerHTML = LOGOS.emp ? '<img src="'+LOGOS.emp+'">' : '<span class="marca-txt">LEXACAUCHO</span>';
  if(LOGOS.fav) $('favicon').href = LOGOS.fav; }
[['logoUpc','upc'],['logoEmp','emp'],['logoFav','fav']].forEach(function(k){
  $(k[0]).onchange = function(e){
    const f = e.target.files[0]; if(!f) return;
    const r = new FileReader(); r.onload = function(){ LOGOS[k[1]] = r.result; aplicarLogos(); }; r.readAsDataURL(f); }; });

/* ===== planta ===== */
const PRENSAS = ['prensa1','prensa2','prensa3','prensa4','prensa5'];
const MAQUINAS = ['dosificado','molino','extruder'].concat(PRENSAS,['autoclave','acabado']);
const CALDEROS = ['caldero1','caldero2'];
const CON_SETUP = ['extruder'].concat(PRENSAS);
const CON_VAPOR = ['extruder'].concat(PRENSAS,['autoclave']);
const FAMILIAS = ['caldero','molino','extruder','prensa','autoclave'];
const NOM_FAM = {caldero:'Caldero', molino:'Molino', extruder:'Extruder', prensa:'Prensa', autoclave:'Autoclave'};
/* nueve máquinas del análisis de OEE */
const OEE_EQ = ['caldero','molino','extruder'].concat(PRENSAS,['autoclave']);
const NOM_OEE = {caldero:'Caldero', molino:'Molino', extruder:'Extruder', prensa1:'Prensa 1', prensa2:'Prensa 2',
  prensa3:'Prensa 3', prensa4:'Prensa 4', prensa5:'Prensa 5', autoclave:'Autoclave'};
const UNIDS = {caldero:CALDEROS, molino:['molino'], extruder:['extruder'], autoclave:['autoclave']};
PRENSAS.forEach(p => UNIDS[p] = [p]);
const REFEQ = k => k === 'caldero' ? 'caldero1' : k;
const TRAMOS = [['t1','Dosificado a molienda'],['t2','Molienda a laminado'],['t3','Laminado a prensado'],
  ['t4','Prensado a curado'],['t5','Curado a acabado'],['t6','Acabado a almacén']];
function base(){
  const e = (etapa,nombre,tipo,cap,uni,D,R,C,x) =>
    Object.assign({etapa,nombre,tipo,cap,uni,D,R,C,mtbf:0,mttr:0,cambios:0,min:0,vapor:0,
      esperaCap:1, modoR:'velocidad', familia:'', codigo:'', mant:true, activo:true}, x||{});
  return {
    ficha:{ largo:5, ancho:1.5, espesorMm:6.35, densidad:1.5 },  /* 71.44 kg por lámina */
    jornada:{ horas:8, turnos:2, dias:26, inicio:'08:00', almuerzo:1, cap:2, capDia:1 },
    proceso:{ loteKg:110, cargaKg:110, cicloMin:9.4, laminasAutoclave:16 },
    traslados:{ t1:[35], t2:[45], t3:[60], t4:[90], t5:[60], t6:[40] },
    equipos:{
      dosificado:e('Dosificado','Dosificado','serie',780,'kg/h',100,100,100,{modoR:'masa',mant:false}),
      molino:    e('Molienda','Molino','serie',660,'kg/h',96,95,100,{modoR:'masa',mtbf:120,mttr:2,familia:'molino',codigo:'PROG-01-M'}),
      extruder:  e('Laminado','Extruder','serie',0,'kg/h',94,85,100,{modoR:'masa',mtbf:96,mttr:2.5,cambios:2,min:65,familia:'extruder',codigo:'PROG-01-E'}),
      prensa1:   e('Prensado','Prensa 1','paralelo',2.2,'und/h',96,80,98,{mtbf:180,mttr:1.5,cambios:2,min:35,familia:'prensa',codigo:'PROG-01-P'}),
      prensa2:   e('Prensado','Prensa 2','paralelo',2.2,'und/h',97,85,98,{mtbf:200,mttr:1.5,cambios:2,min:35,familia:'prensa',codigo:'PROG-02-P'}),
      prensa3:   e('Prensado','Prensa 3','paralelo',2.2,'und/h',96,80,98,{mtbf:180,mttr:1.5,cambios:2,min:35,familia:'prensa',codigo:'PROG-03-P'}),
      prensa4:   e('Prensado','Prensa 4','paralelo',2.2,'und/h',97,85,98,{mtbf:200,mttr:1.5,cambios:2,min:35,familia:'prensa',codigo:'PROG-04-P'}),
      prensa5:   e('Prensado','Prensa 5','paralelo',2.2,'und/h',97,85,98,{mtbf:200,mttr:1.5,cambios:2,min:35,familia:'prensa',codigo:'PROG-05-P'}),
      autoclave: e('Curado','Autoclave','serie',8,'und/h',96,80,99,{mtbf:53,mttr:2.1,esperaCap:32,familia:'autoclave',codigo:'PROG-01-A'}),
      acabado:   e('Acabado','Acabado','serie',607,'kg/h',100,100,100,{esperaCap:32,mant:false}),
      caldero1:  e('Vapor','Caldero 1','soporte',2000,'kg/h',95,90,100,{vapor:60,mtbf:400,mttr:4,familia:'caldero',codigo:'PROG-01-C'}),
      caldero2:  e('Vapor','Caldero 2','soporte',2000,'kg/h',95,90,100,{vapor:60,mtbf:400,mttr:4,familia:'caldero',codigo:'PROG-02-C'})
    } };
}
let M = base();
const eq = id => M.equipos[id];
const nombreEq = id => eq(id) ? eq(id).nombre : (NOM_OEE[id]||id);
const equiposMant = () => Object.keys(M.equipos).filter(k => M.equipos[k].mant);
/* Fuente única: la masa por lámina viene de Parámetros del periodo (window.CMMS). */
let MASA_EXT = null;
function kgLamina(){ if(MASA_EXT) return MASA_EXT; const f = M.ficha; return Math.max(0.001,(f.largo*100)*(f.ancho*100)*(f.espesorMm/10)*f.densidad/1000); }
const horasDia = () => M.jornada.horas*M.jornada.turnos;
const extruderKgH = () => M.proceso.cargaKg*60/M.proceso.cicloMin;
function capKgH(id){
  const e = eq(id); if(!e) return 0;
  if(id === 'extruder') return extruderKgH();
  return e.uni === 'kg/h' ? e.cap : e.cap*kgLamina(); }
function capLamH(id){
  const e = eq(id); if(!e) return 0;
  if(id === 'extruder') return 60/M.proceso.cicloMin;
  return e.uni === 'kg/h' ? e.cap/kgLamina() : e.cap; }
function capNominal(k){ const id = REFEQ(k); return eq(id).uni === 'kg/h' ? capKgH(id) : capLamH(id); }
const unidadCap = k => eq(REFEQ(k)).uni === 'kg/h' ? 'kg/h' : 'lám/h';
function nominalPlh(id){
  const e = eq(id), P = M.proceso;
  if(!e || e.tipo === 'soporte') return 0;
  if(id === 'extruder') return 60/P.cicloMin;
  if(id === 'dosificado' || id === 'molino') return e.cap/P.cargaKg;
  if(id === 'acabado') return e.cap/kgLamina();
  return e.cap; }
function factorVapor(){
  let c = 0;
  CALDEROS.forEach(function(id){
    const k = eq(id); if(!k.activo) return;
    const m = S && S.maq[id];
    const disp = (m && S.tp > 0) ? (1-m.tAver/S.tp) : k.D/100;
    c += (k.vapor/100)*disp*(k.R/100); });
  return Math.max(0.05, Math.min(1,c)); }
function paramFalla(id){
  const e = eq(id);
  if(e.mtbf > 0 && e.mttr > 0) return {mtbf:e.mtbf, mttr:e.mttr};
  if(e.D < 100){ const t = e.mttr > 0 ? e.mttr : 1.5; return {mtbf:t*(e.D/(100-e.D)), mttr:t}; }
  return null; }
function duracion(id,item){
  const e = eq(id), P = M.proceso;
  let s;
  if(id === 'dosificado')     s = P.loteKg/e.cap*3600;
  else if(id === 'molino')    s = (item?item.kg:P.loteKg)/e.cap*3600;
  else if(id === 'extruder')  s = P.cicloMin*60;
  else if(id === 'autoclave') s = P.laminasAutoclave/(e.cap*Math.max(0.05,e.R/100))*3600;
  else if(id === 'acabado')   s = ((item&&item.laminas)||1)*kgLamina()/(e.cap*Math.max(0.05,e.R/100))*3600;
  else                        s = 3600/(e.cap*Math.max(0.05,e.R/100));
  if(CON_VAPOR.indexOf(id) >= 0) s /= factorVapor();
  return s; }

/* ===== calendario ===== */
function pascua(y){
  const a = y%19, b = Math.floor(y/100), c = y%100, d = Math.floor(b/4), e = b%4;
  const f = Math.floor((b+8)/25), g = Math.floor((b-f+1)/3), h = (19*a+b-d-g+15)%30;
  const i = Math.floor(c/4), k = c%4, l = (32+2*e+2*i-h-k)%7, m = Math.floor((a+11*h+22*l)/451);
  return new Date(y, Math.floor((h+l-7*m+114)/31)-1, ((h+l-7*m+114)%31)+1); }
const FIJOS = [['01-01','Año nuevo'],['05-01','Día del trabajo'],['06-07','Batalla de Arica'],['06-29','San Pedro y San Pablo'],
  ['07-23','Fuerzas Armadas'],['07-28','Fiestas Patrias'],['07-29','Fiestas Patrias'],['08-06','Batalla de Junín'],
  ['08-30','Santa Rosa de Lima'],['10-08','Combate de Angamos'],['11-01','Todos los Santos'],['12-08','Inmaculada Concepción'],
  ['12-09','Batalla de Ayacucho'],['12-25','Navidad']];
/* Fuente única del calendario: los feriados y días no laborables de los periodos definidos en Parámetros.
   Fuera de cualquier periodo se usa el calendario nacional calculado. */
let FER_CMMS = null, RANGOS_CMMS = [], OMIT_CMMS = [];
const omision = d => { const s = iso(d); return OMIT_CMMS.find(o => s >= o.desde && s <= o.hasta) || null; };
const cacheFer = {};
function feriadosMap(y){
  if(cacheFer[y]) return cacheFer[y];
  const m = {};
  FIJOS.forEach(f => m[y+'-'+f[0]] = f[1]);
  const p = pascua(y);
  [[3,'Jueves Santo'],[2,'Viernes Santo']].forEach(function(k){ const d = new Date(p); d.setDate(d.getDate()-k[0]); m[iso(d)] = k[1]; });
  cacheFer[y] = m; return m; }
function motivoFeriado(d){
  const s = iso(d);
  if(FER_CMMS && RANGOS_CMMS.some(r => s >= r[0] && s <= r[1])) return FER_CMMS[s] || null;
  return feriadosMap(d.getFullYear())[s] || null; }
const esFeriado = d => !!motivoFeriado(d);
const esLaborable = d => d.getDay() !== 0 && !esFeriado(d) && !omision(d);
function proximoHabil(d){ const x = new Date(d); let g = 0; while(!esLaborable(x) && g++ < 120) x.setDate(x.getDate()+1); return x; }
function bloques(){
  const J = M.jornada, p = J.inicio.split(':'), h0 = (+p[0])+(+p[1])/60, mitad = J.horas/2, b = [];
  for(let i = 0; i < J.turnos; i++){
    const ini = h0+i*(J.horas+J.almuerzo);
    b.push({t:'prod', a:ini, b:ini+mitad, turno:i+1});
    b.push({t:'alm', a:ini+mitad, b:ini+mitad+J.almuerzo, turno:i+1});
    b.push({t:'prod', a:ini+mitad+J.almuerzo, b:ini+J.horas+J.almuerzo, turno:i+1}); }
  return b; }
function estadoJornada(fecha){
  const J = M.jornada, p = J.inicio.split(':'), h0 = (+p[0])+(+p[1])/60;
  let h = fecha.getHours()+fecha.getMinutes()/60+fecha.getSeconds()/3600;
  let diaJor = new Date(fecha);
  if(h < h0){ h += 24; diaJor.setDate(diaJor.getDate()-1); }
  if(diaJor.getDay() === 0) return {prod:false, txt:'Domingo, planta detenida', turno:null};
  const fer = motivoFeriado(diaJor); if(fer) return {prod:false, txt:'Feriado: '+fer, turno:null};
  const esCap = diaJor.getDay() === +J.capDia && J.cap > 0;
  for(const x of bloques()){
    if(h >= x.a && h < x.b){
      if(x.t === 'alm') return {prod:false, txt:'Almuerzo del turno '+x.turno, turno:x.turno};
      const ini = h0+(x.turno-1)*(J.horas+J.almuerzo);
      if(esCap && h < ini+J.cap) return {prod:false, txt:'Capacitación del turno '+x.turno, turno:x.turno};
      return {prod:true, txt:'En producción', turno:x.turno}; } }
  return {prod:false, txt:'Fuera de turno', turno:null}; }

/* ===== simulación ===== */
let S = null, SIM_INI = null;
function nuevoEstado(){
  const st = {t:0,tp:0,corriendo:false,corrio:false,vel:120,ultimo:0,transitos:[],buenas:0,mermaTotal:0,entradaTotal:0,maq:{},seq:0,turnos:[0]};
  MAQUINAS.concat(CALDEROS).forEach(function(id){
    st.maq[id] = {estado:'libre',espera:[],dentro:null,salida:null,trabajo:null,restante:0,ciclo:0,merma:0,entrada:0,hechos:0,
      tOcup:0,tAver:0,tSetup:0,tBloq:0,paradas:0,proxFalla:Infinity,proxSetup:Infinity,hasta:0}; });
  return st; }
function programarFalla(id){ const p = paramFalla(id); S.maq[id].proxFalla = p ? S.tp+expo(p.mtbf*3600) : Infinity; }
function programarSetup(id){
  const e = eq(id);
  if(CON_SETUP.indexOf(id) < 0 || e.cambios <= 0){ S.maq[id].proxSetup = Infinity; return; }
  S.maq[id].proxSetup = S.tp+(horasDia()*3600)/e.cambios; }
function inicializar(){
  S = nuevoEstado();
  const p = M.jornada.inicio.split(':');
  SIM_INI = proximoHabil(dISO(HOY())); SIM_INI.setHours(+p[0], +p[1], 0, 0);
  MAQUINAS.concat(CALDEROS).forEach(function(id){ programarFalla(id); programarSetup(id); }); }
const relojSim = () => new Date(SIM_INI.getTime()+S.t*1000);
const RUTA_T = {dosificado:'t1',molino:'t2',extruder:'t3',prensa:'t4',autoclave:'t5',acabado:'t6'};
function traslado(a){ const k = PRENSAS.indexOf(a) >= 0 ? 'prensa' : a; const v = prom(M.traslados[RUTA_T[k]]); return v > 0 ? v : 30; }
const enRuta = d => S.transitos.filter(t => t.b === d).length;
function haySitio(d){ return d === 'fin' ? true : S.maq[d].espera.length+enRuta(d) < eq(d).esperaCap; }
function enviar(a,b,item,cuantos){
  const n = cuantos||1, d = traslado(a);
  for(let i = 0; i < n; i++) S.transitos.push({a:a,b:b,ini:S.tp+i*d*0.06,fin:S.tp+d+i*d*0.06,item:item,id:++S.seq}); }
function prensaLibre(){
  const l = PRENSAS.filter(p => eq(p).activo && haySitio(p));
  if(!l.length) return null;
  return l.reduce((x,y)=> S.maq[y].espera.length < S.maq[x].espera.length ? y : x); }
function destino(id){
  if(id === 'dosificado') return eq('molino').activo ? 'molino' : null;
  if(id === 'molino')     return eq('extruder').activo ? 'extruder' : null;
  if(id === 'extruder')   return prensaLibre();
  if(PRENSAS.indexOf(id) >= 0) return eq('autoclave').activo ? 'autoclave' : null;
  if(id === 'autoclave')  return eq('acabado').activo ? 'acabado' : null;
  if(id === 'acabado')    return 'fin';
  return null; }
function empezar(id){
  const m = S.maq[id], P = M.proceso;
  if(id === 'dosificado'){
    m.dentro = {kg:P.loteKg}; S.entradaTotal += P.loteKg; m.entrada += P.loteKg;
    m.ciclo = duracion(id,m.dentro); m.restante = m.ciclo; m.estado = 'ocupado'; return; }
  if(id === 'extruder'){
    if(!m.dentro && m.espera.length){ const it = m.espera.shift(); m.dentro = {kg:it.kg}; m.entrada += it.kg; }
    if(!m.dentro) return;
    if(m.dentro.kg < P.cargaKg){ m.merma += m.dentro.kg; S.mermaTotal += m.dentro.kg; m.dentro = null; return; }
    m.trabajo = {kg:P.cargaKg}; m.ciclo = duracion(id); m.restante = m.ciclo; m.estado = 'ocupado'; return; }
  if(id === 'autoclave'){
    if(m.espera.length < P.laminasAutoclave) return;
    m.dentro = {laminas:P.laminasAutoclave};
    for(let i = 0; i < P.laminasAutoclave; i++) m.espera.shift();
    m.entrada += P.laminasAutoclave*kgLamina();
    m.ciclo = duracion(id,m.dentro); m.restante = m.ciclo; m.estado = 'ocupado'; return; }
  if(!m.espera.length) return;
  m.dentro = m.espera.shift();
  m.entrada += m.dentro.kg||(m.dentro.laminas||0)*kgLamina();
  m.ciclo = duracion(id,m.dentro); m.restante = m.ciclo; m.estado = 'ocupado'; }
function terminar(id){
  const m = S.maq[id], e = eq(id), P = M.proceso;
  m.restante = 0; m.estado = 'libre';
  if(id === 'dosificado'){ const s = P.loteKg*e.R/100, p = P.loteKg-s;
    m.merma += p; S.mermaTotal += p; m.hechos++; m.salida = {kg:s}; m.dentro = null; return; }
  if(id === 'molino'){ const en = m.dentro.kg, s = en*e.R/100, p = en-s;
    m.merma += p; S.mermaTotal += p; m.hechos++; m.salida = {kg:s}; m.dentro = null; return; }
  if(id === 'extruder'){ const en = m.trabajo.kg, s = en*e.R/100, p = en-s;
    m.merma += p; S.mermaTotal += p; m.hechos++;
    m.dentro.kg -= en; if(m.dentro.kg < 0.001) m.dentro = null;
    m.trabajo = null; m.salida = {kg:s}; return; }
  if(PRENSAS.indexOf(id) >= 0){
    const en = m.dentro.kg, w = kgLamina(); m.dentro = null;
    if(en < w || Math.random() > e.C/100){ m.merma += en; S.mermaTotal += en; return; }
    m.merma += en-w; S.mermaTotal += en-w; m.hechos++; m.salida = {laminas:1}; return; }
  if(id === 'autoclave'){
    const n = m.dentro.laminas; m.dentro = null; let b = 0;
    for(let i = 0; i < n; i++){ if(Math.random() <= e.C/100) b++; else { m.merma += kgLamina(); S.mermaTotal += kgLamina(); } }
    m.hechos += b; m.salida = b ? {laminas:b} : null; return; }
  const n = m.dentro.laminas||1; m.dentro = null; m.hechos += n; m.salida = {laminas:n}; }
function tick(id,dt){
  const m = S.maq[id], e = eq(id);
  if(!e.activo) return;
  if(m.estado !== 'averiado' && S.tp >= m.proxFalla){
    m.estado = 'averiado'; m.paradas++;
    const p = paramFalla(id); m.hasta = S.tp+expo((p?p.mttr:1)*3600); m.proxFalla = Infinity;
  } else if(m.estado === 'libre' && !m.salida && S.tp >= m.proxSetup){
    m.estado = 'setup'; m.hasta = S.tp+e.min*60; m.proxSetup = Infinity; }
  if(m.estado === 'averiado'){ m.tAver += dt;
    if(S.tp >= m.hasta){ m.estado = m.restante > 0 ? 'ocupado' : 'libre'; programarFalla(id); } return; }
  if(m.estado === 'setup'){ m.tSetup += dt;
    if(S.tp >= m.hasta){ m.estado = 'libre'; programarSetup(id); } return; }
  if(m.salida){
    const d = destino(id);
    if(d && haySitio(d)){
      if(d === 'acabado') enviar(id,d,{laminas:1}, m.salida.laminas||1);
      else if(d === 'fin'){ S.buenas += m.salida.laminas||1; anotarTurno(m.salida.laminas||1); }
      else enviar(id,d,m.salida,1);
      m.salida = null;
    } else { m.estado = 'bloqueado'; m.tBloq += dt; return; } }
  if(m.estado === 'ocupado'){ m.tOcup += dt; m.restante -= dt; if(m.restante <= 0) terminar(id); return; }
  m.estado = 'libre'; empezar(id); }
function tickCaldero(id,dt){
  const m = S.maq[id]; if(!eq(id).activo) return;
  if(m.estado !== 'averiado' && S.tp >= m.proxFalla){
    m.estado = 'averiado'; m.paradas++;
    const p = paramFalla(id); m.hasta = S.tp+expo((p?p.mttr:2)*3600); m.proxFalla = Infinity; }
  if(m.estado === 'averiado'){ m.tAver += dt; if(S.tp >= m.hasta){ m.estado = 'libre'; programarFalla(id); } } }
function turnoIdx(){ return Math.floor(S.tp/(M.jornada.horas*3600)); }
function anotarTurno(n){ const i = turnoIdx(); while(S.turnos.length <= i) S.turnos.push(0); S.turnos[i] += n; }
function avanzar(dt){
  S.t += dt;
  if(!estadoJornada(relojSim()).prod) return;
  S.tp += dt;
  const i = turnoIdx(); while(S.turnos.length <= i) S.turnos.push(0);
  for(let k = S.transitos.length-1; k >= 0; k--){
    const tr = S.transitos[k];
    if(S.tp >= tr.fin){ S.transitos.splice(k,1);
      if(tr.b === 'fin'){ S.buenas += tr.item.laminas||1; anotarTurno(tr.item.laminas||1); }
      else S.maq[tr.b].espera.push(tr.item); } }
  CALDEROS.forEach(id => tickCaldero(id,dt));
  MAQUINAS.forEach(id => tick(id,dt)); }
const rutas = {};
function pos(el){ const l = $('lienzo'); let x = 0,y = 0,n = el;
  while(n && n !== l){ x += n.offsetLeft; y += n.offsetTop; n = n.offsetParent; }
  return {izq:x,der:x+el.offsetWidth,arr:y,aba:y+el.offsetHeight,cx:x+el.offsetWidth/2,cy:y+el.offsetHeight/2}; }
const caja = id => pos(nodoEl(id));
function curvaH(a,b){ const dx = Math.max(24,(b.izq-a.der)*0.55);
  return 'M '+a.der+' '+a.cy+' C '+(a.der+dx)+' '+a.cy+', '+(b.izq-dx)+' '+b.cy+', '+b.izq+' '+b.cy; }
function enlaces(){ return [['inicio','dosificado'],['dosificado','molino'],['molino','extruder']]
  .concat(PRENSAS.map(p=>['extruder',p]),PRENSAS.map(p=>[p,'autoclave']),[['autoclave','acabado'],['acabado','fin']]); }
function dibujar(){
  const svg = $('cables'), l = $('lienzo'), W = l.offsetWidth, H = l.offsetHeight;
  svg.setAttribute('width',W); svg.setAttribute('height',H); svg.setAttribute('viewBox','0 0 '+W+' '+H);
  const gris = getComputedStyle(document.body).getPropertyValue('--dim').trim()||'#5a7186';
  let s = '';
  enlaces().forEach(p => s += '<path id="r_'+p[0]+'_'+p[1]+'" d="'+curvaH(caja(p[0]),caja(p[1]))+
    '" fill="none" stroke="'+gris+'" stroke-width="1.4" stroke-dasharray="2 6" opacity="0.6"/>');
  s += '<g id="particulas"></g>'; svg.innerHTML = s;
  enlaces().forEach(p => rutas[p[0]+'>'+p[1]] = document.getElementById('r_'+p[0]+'_'+p[1])); }
function pintarParticulas(){
  const g = document.getElementById('particulas'); if(!g) return;
  const verde = getComputedStyle(document.body).getPropertyValue('--lima').trim()||'#3dea24';
  let s = '';
  S.transitos.forEach(function(tr){
    const p = rutas[tr.a+'>'+tr.b]; if(!p || S.tp < tr.ini) return;
    const dur = tr.fin-tr.ini, u = dur > 0 ? Math.max(0,Math.min(1,(S.tp-tr.ini)/dur)) : 1;
    const pt = p.getPointAtLength(u*p.getTotalLength());
    const r = tr.item.kg ? Math.max(4,Math.min(9,3+Math.sqrt(tr.item.kg)/6)) : 5;
    s += '<circle cx="'+pt.x.toFixed(1)+'" cy="'+pt.y.toFixed(1)+'" r="'+(r*2)+'" fill="'+verde+'" opacity="0.13"/>'+
         '<circle cx="'+pt.x.toFixed(1)+'" cy="'+pt.y.toFixed(1)+'" r="'+r.toFixed(1)+'" fill="'+verde+'"/>'; });
  g.innerHTML = s; }
const util = id => S.tp > 0 ? S.maq[id].tOcup/S.tp : 0;
function cuelloDeBotella(){
  if(S.corrio && S.tp > 1800){
    let mejor = null, u = -1;
    MAQUINAS.forEach(function(id){ if(!eq(id).activo) return; const v = util(id); if(v > u){ u = v; mejor = id; } });
    return mejor; }
  let mejor = null, c = Infinity;
  ['dosificado','molino','extruder','prensado','autoclave','acabado'].forEach(function(k){
    let cap;
    if(k === 'prensado') cap = PRENSAS.filter(p=>eq(p).activo).reduce((a,p)=>a+nominalPlh(p)*eq(p).R/100,0);
    else cap = eq(k).activo ? nominalPlh(k)*(eq(k).modoR === 'masa' ? 1 : eq(k).R/100) : 0;
    if(cap < c){ c = cap; mejor = k; } });
  return mejor; }
function textoVivo(id){
  const m = S.maq[id];
  if(m.estado === 'averiado')  return 'Avería, '+n1((m.hasta-S.tp)/60)+' min';
  if(m.estado === 'setup')     return 'Cambio de formato';
  if(m.estado === 'bloqueado') return 'Bloqueado';
  if(id === 'extruder' && m.dentro) return n0(m.dentro.kg)+' kg en tolva';
  if(m.dentro && m.dentro.kg) return n0(m.dentro.kg)+' kg';
  if(m.dentro && m.dentro.laminas) return m.dentro.laminas+' láminas';
  return m.estado === 'ocupado' ? 'Procesando' : 'Libre'; }
function pintarNodos(){
  const cuello = cuelloDeBotella(), lista = cuello === 'prensado' ? PRENSAS : [cuello];
  const j = estadoJornada(relojSim());
  Object.keys(M.equipos).forEach(function(id){
    const el = nodoEl(id); if(!el) return;
    const e = eq(id), m = S.maq[id];
    el.classList.toggle('apagado',!e.activo || !j.prod);
    el.classList.toggle('averiado',m.estado === 'averiado' && j.prod);
    el.classList.toggle('setup',m.estado === 'setup' && j.prod);
    el.classList.toggle('bloqueado',m.estado === 'bloqueado' && j.prod);
    el.classList.toggle('trabajando',m.estado === 'ocupado' && j.prod);
    el.classList.toggle('cuello',lista.indexOf(id) >= 0);
    const dd = el.querySelector('.datos');
    if(dd) dd.textContent = e.tipo === 'soporte' ? n0(e.cap)+' kg/h vapor, D '+e.D+'%'
      : (id === 'extruder' ? n0(extruderKgH())+' kg/h' : n1(e.cap)+' '+(e.uni === 'kg/h'?'kg/h':'lám/h'))+', R '+e.R+'%';
    if(e.tipo === 'soporte') return;
    const vv = el.querySelector('.vivo'); if(vv) vv.textContent = j.prod ? textoVivo(id) : j.txt;
    const b = el.querySelector('.prog > i');
    if(b){ const av = (m.estado === 'ocupado' && m.ciclo) ? 1-m.restante/m.ciclo : 0;
      b.style.width = (Math.max(0,Math.min(1,av))*100).toFixed(0)+'%';
      b.style.background = m.estado === 'averiado' ? 'var(--danger)' : m.estado === 'setup' ? 'var(--warning)'
        : m.estado === 'bloqueado' ? 'var(--info)' : 'var(--lima)'; }
    const esp = el.querySelector('.espera');
    if(esp){ const kg = m.espera.reduce((a,x)=>a+(x.kg||(x.laminas||0)*kgLamina()),0);
      esp.textContent = (id === 'autoclave'||id === 'acabado')
        ? m.espera.reduce((a,x)=>a+(x.laminas||1),0)+' láminas en espera'
        : m.espera.length+' lote'+(m.espera.length===1?'':'s')+', '+n0(kg)+' kg';
      esp.classList.toggle('hay',m.espera.length > 0); }
    const mer = el.querySelector('.merma');
    if(mer){ mer.textContent = 'merma '+n0(m.merma)+' kg'; mer.classList.toggle('hay',m.merma > 0.5); } });
  return cuello; }
function pintarTarjetas(){
  const c = $('eqCards'); c.innerHTML = '';
  Object.keys(M.equipos).forEach(function(id){
    const e = eq(id), oee = (e.D/100)*(e.R/100)*(e.C/100), b = banda(oee);
    const cap = id === 'extruder' ? n0(extruderKgH())+' kg/h' : n1(e.cap)+' '+(e.uni === 'kg/h'?'kg/h':'láminas por hora');
    c.insertAdjacentHTML('beforeend',
      '<div class="eq" style="border-left-color:'+b.c+'" data-abrir="'+id+'" tabindex="0">'+
      '<div class="cab"><div><div class="et">'+e.etapa+'</div><div class="nom">'+e.nombre+'</div></div>'+
      '<div><div class="oee" style="color:'+b.c+'">'+(oee*100).toFixed(0)+'%</div>'+
      '<div class="jui" style="color:'+b.c+'">'+b.t+'</div></div></div>'+
      '<div class="drc"><div><b>'+e.D+'</b><span>Disp.</span></div><div><b>'+e.R+'</b><span>Rend.</span></div>'+
      '<div><b>'+e.C+'</b><span>Cal.</span></div></div><div class="cap">'+cap+'</div></div>'); });
  c.querySelectorAll('[data-abrir]').forEach(function(x){ x.onclick = ()=> abrirEquipo(x.dataset.abrir); }); }
function hhmm(h){ h = ((h%24)+24)%24; const H = Math.floor(h), Mi = Math.round((h-H)*60);
  return String(H).padStart(2,'0')+':'+String(Mi).padStart(2,'0'); }
function pintarJornada(){
  const d = relojSim(), j = estadoJornada(d);
  $('simHora').textContent = String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0')+':'+String(d.getSeconds()).padStart(2,'0');
  $('simFecha').textContent = fechaLarga(d);
  $('simEstado').textContent = j.txt;
  $('simEstado').style.color = j.prod ? 'var(--accent)' : (j.txt.indexOf('Almuerzo') === 0 || j.txt.indexOf('Capacit') === 0 ? 'var(--warning)' : 'var(--muted)');
  $('simTurno').textContent = j.turno ? 'Turno '+j.turno : 'sin turno';
  $('simTrans').textContent = n1(S.t/3600)+' h';
  $('simProd').textContent = n1(S.tp/3600)+' h';
  const J = M.jornada, p = J.inicio.split(':'), h0 = (+p[0])+(+p[1])/60, largo = J.turnos*(J.horas+J.almuerzo);
  let f = '';
  bloques().forEach(function(x){
    f += '<i style="width:'+((x.b-x.a)/24*100)+'%;background:'+(x.t === 'prod'?'var(--lima)':'var(--warning)')+
         ';opacity:'+(x.t === 'prod'?0.85:0.6)+'"></i>'; });
  f += '<i style="width:'+((24-largo)/24*100)+'%;background:var(--border2)"></i>';
  let h = d.getHours()+d.getMinutes()/60; if(h < h0) h += 24;
  f += '<span style="position:absolute;left:'+Math.max(0,Math.min(100,(h-h0)/24*100))+'%;top:-3px;bottom:-3px;width:2px;background:var(--text)"></span>';
  $('simFranja').innerHTML = f;
  $('jHorario').textContent = 'Turno 1 de '+hhmm(h0)+' a '+hhmm(h0+J.horas/2)+', almuerzo hasta '+hhmm(h0+J.horas/2+J.almuerzo)+
    ', cierre a '+hhmm(h0+J.horas+J.almuerzo)+'. El último turno termina a las '+hhmm(h0+largo)+
    '. La capacitación ocupa las primeras '+J.cap+' h de cada turno los '+DIAS_SEM[+J.capDia]+'.'; }
function teorico(){ const pr = PRENSAS.filter(p=>eq(p).activo).reduce((a,p)=>a+nominalPlh(p),0);
  return Math.min(nominalPlh('dosificado'),nominalPlh('molino'),nominalPlh('extruder'),pr||0.01,nominalPlh('autoclave'),nominalPlh('acabado')); }
function pintarKpis(cuello){
  const hrs = S.tp/3600, T = teorico(), ritmo = hrs > 0 ? S.buenas/hrs : 0;
  const oee = (hrs > 0 && T > 0) ? S.buenas/(T*hrs) : 0, bo = banda(oee);
  $('kBuenas').textContent = n0(S.buenas);
  $('kRitmo').textContent = hrs > 0.3 ? n2(ritmo) : '–';
  $('kOee').textContent = hrs > 0.3 ? pc(oee) : '–';
  $('kOee').style.color = hrs > 0.3 ? bo.c : '';
  $('kMerma').textContent = n0(S.mermaTotal);
  $('kRend').textContent = S.entradaTotal > 0 ? pc(S.buenas*kgLamina()/S.entradaTotal) : '–';
  $('kMes').textContent = n0((hrs > 0.3 ? ritmo : T)*horasDia()*M.jornada.dias);
  const idC = cuello === 'prensado' ? 'prensa1' : cuello;
  $('kCuello').textContent = cuello === 'prensado' ? 'Prensado' : nombreEq(idC);
  $('kD').textContent = (S.tp > 0 && S.maq[idC]) ? pc(1-S.maq[idC].tAver/S.tp) : '–'; }
function pintarTurnos(){
  const i = turnoIdx(), cerr = S.turnos.slice(0,i);
  $('tActual').textContent = n0(S.turnos[i]||0); $('tTotal').textContent = n0(S.buenas);
  $('tPromedio').textContent = cerr.length ? n1(cerr.reduce((a,b)=>a+b,0)/cerr.length) : '–';
  $('tMejor').textContent = cerr.length ? n0(Math.max.apply(null,cerr)) : '–';
  $('turnoActual').textContent = 'Turno '+(i+1);
  $('turnoInfo').textContent = M.jornada.horas+' horas netas por turno, '+M.jornada.turnos+' turnos por día';
  const tira = $('turnoTira'); tira.innerHTML = '';
  for(let k = Math.max(0,S.turnos.length-14); k < S.turnos.length; k++)
    tira.insertAdjacentHTML('beforeend','<div class="turno '+(k === i?'act':'')+'"><b>'+n0(S.turnos[k])+
      '</b><span>Turno '+(k+1)+(k === i?', en curso':'')+'</span></div>'); }
function pintarTablaSim(cuello){
  const tb = $('tablaEtapas'); tb.innerHTML = '';
  const lista = cuello === 'prensado' ? PRENSAS : [cuello];
  MAQUINAS.forEach(function(id){
    const e = eq(id), m = S.maq[id], u = util(id);
    const nom = id === 'extruder' ? n0(extruderKgH())+' kg/h' : (e.uni === 'kg/h'?n0(e.cap)+' kg/h':n1(e.cap)+' lám/h');
    const cic = id === 'dosificado' ? n1(M.proceso.loteKg/e.cap*60)+' min' : id === 'extruder' ? M.proceso.cicloMin+' min'
      : n1(duracion(id,{kg:M.proceso.cargaKg,laminas:M.proceso.laminasAutoclave})/60)+' min';
    tb.insertAdjacentHTML('beforeend','<tr><td>'+e.etapa+'</td><td class="nombre">'+e.nombre+' '+
      (lista.indexOf(id)>=0?'<span class="marcador m-warn">restringe</span>':'')+'</td><td class="num">'+nom+
      '</td><td class="num">'+cic+'</td>'+
      '<td><div class="barrita"><i style="width:'+(Math.min(1,u)*100).toFixed(0)+'%;background:'+
      (lista.indexOf(id)>=0?'var(--warning)':'var(--lima)')+'"></i></div><div class="sub">'+pc(u)+'</div></td>'+
      '<td class="num">'+m.espera.length+'</td><td class="num">'+n0(m.entrada)+' kg</td>'+
      '<td class="num">'+(m.merma > 0.5?n0(m.merma)+' kg':'—')+'</td>'+
      '<td class="chico tenue">'+m.paradas+' paradas, '+n1((m.tAver+m.tSetup)/3600)+' h</td></tr>'); }); }
function refrescar(){ const c = pintarNodos(); pintarJornada(); pintarKpis(c); pintarTablaSim(c); pintarTarjetas(); pintarTurnos(); }
let frames = 0;
function bucle(ts){
  if(!S.corriendo) return;
  if(!S.ultimo) S.ultimo = ts;
  const dtReal = Math.min(0.1,(ts-S.ultimo)/1000); S.ultimo = ts;
  let r = dtReal*S.vel;
  while(r > 0){ const p = Math.min(5,r); avanzar(p); r -= p; }
  pintarParticulas();
  if(++frames % 5 === 0) refrescar();
  requestAnimationFrame(bucle); }
function correr(v){ S.corriendo = v; S.corrio = S.corrio||v;
  $('btnPlay').innerHTML = v ? '<i class="fas fa-pause"></i> Pausar':'<i class="fas fa-play"></i> Continuar';
  if(v){ S.ultimo = 0; requestAnimationFrame(bucle); } }
$('btnCero').onclick = function(){ inicializar(); pintarParticulas(); refrescar(); correr(true); };
$('btnPlay').onclick = function(){ correr(!S.corriendo); };
$('btnDetener').onclick = function(){ correr(false); inicializar(); pintarParticulas(); refrescar(); };
document.querySelectorAll('.velo').forEach(function(b){
  b.onclick = function(){ document.querySelectorAll('.velo').forEach(x=>x.classList.remove('on'));
    b.classList.add('on'); S.vel = +b.dataset.v; }; });
let Z = 1, TX = 0, TY = 0;
function aplicar(){ $('lienzo').style.transform = 'translate('+TX+'px,'+TY+'px) scale('+Z+')'; $('zVal').textContent = Math.round(Z*100)+'%'; }
function encajar(){ const d = $('diagrama'), l = $('lienzo'); if(!d.clientWidth) return;
  Z = Math.max(0.25,Math.min(2,Math.min((d.clientWidth-16)/l.offsetWidth,(d.clientHeight-16)/l.offsetHeight)));
  TX = (d.clientWidth-l.offsetWidth*Z)/2; TY = (d.clientHeight-l.offsetHeight*Z)/2; aplicar(); }
function zoomEn(f,cx,cy){ const d = $('diagrama');
  const px = cx != null ? cx : d.clientWidth/2, py = cy != null ? cy : d.clientHeight/2;
  const nz = Math.max(0.25,Math.min(2.4,Z*f));
  TX = px-(px-TX)*(nz/Z); TY = py-(py-TY)*(nz/Z); Z = nz; aplicar(); }
$('zIn').onclick = ()=> zoomEn(1.15); $('zOut').onclick = ()=> zoomEn(1/1.15); $('zHome').onclick = encajar;
(function(){ const d = $('diagrama'); let ar = false,x0 = 0,y0 = 0,mov = 0;
  d.addEventListener('mousedown',function(e){ ar = true; mov = 0; x0 = e.clientX; y0 = e.clientY; d.classList.add('agarrando'); });
  window.addEventListener('mousemove',function(e){ if(!ar) return;
    const dx = e.clientX-x0, dy = e.clientY-y0; mov += Math.abs(dx)+Math.abs(dy);
    TX += dx; TY += dy; x0 = e.clientX; y0 = e.clientY; aplicar(); });
  window.addEventListener('mouseup',function(){ if(ar){ ar = false; d.classList.remove('agarrando'); d.dataset.mov = mov; } });
  d.addEventListener('wheel',function(e){ e.preventDefault(); const r = d.getBoundingClientRect();
    zoomEn(e.deltaY < 0 ? 1.12 : 1/1.12, e.clientX-r.left, e.clientY-r.top); },{passive:false});
})();
$('chkDatos').onchange = e => $('lienzo').classList.toggle('mostrar-datos',e.target.checked);
let editando = null;
function abrirEquipo(id){
  const e = eq(id); if(!e) return;
  editando = id;
  $('qEtapa').textContent = e.etapa; $('qNombre').textContent = e.nombre;
  $('qTipo').textContent = {serie:'En serie: si se detiene, se detiene la línea',
    paralelo:'En paralelo con las demás prensas',soporte:'Soporte: alimenta laminado, prensado y curado'}[e.tipo];
  $('qCap').value = e.cap; $('qUni').value = e.uni; $('qD').value = e.D; $('qR').value = e.R; $('qC').value = e.C;
  $('qMtbf').value = e.mtbf; $('qMttr').value = e.mttr; $('qCambios').value = e.cambios; $('qMin').value = e.min;
  $('qVapor').value = e.vapor; $('qActivo').checked = e.activo;
  const sop = e.tipo === 'soporte';
  $('bloqueVapor').style.display = sop ? 'flex':'none';
  $('bloqueCap').style.display = id === 'extruder' ? 'none':'grid';
  $('bloqueSetup').style.display = CON_SETUP.indexOf(id) >= 0 ? 'grid':'none';
  $('qNota').textContent = id === 'extruder' ? 'La capacidad resulta de la carga por ciclo y el tiempo de ciclo.' : '';
  oeeVista(); abrirCapa('telon'); }
function oeeVista(){ const v = (+$('qD').value/100)*(+$('qR').value/100)*(+$('qC').value/100), b = banda(v);
  $('qOee').textContent = (v*100).toFixed(1)+'%'; $('qOee').style.color = b.c;
  $('qJuicio').textContent = b.t; $('qJuicio').style.color = b.c; }
['qD','qR','qC'].forEach(i => $(i).addEventListener('input',oeeVista));
$('btnDesdeMtbf').onclick = function(){
  const a = +$('qMtbf').value, b = +$('qMttr').value;
  if(a+b <= 0){ $('qAviso').innerHTML = '<span class="marcador m-warn">Carga MTBF y MTTR primero</span>'; return; }
  $('qD').value = (a/(a+b)*100).toFixed(1);
  $('qAviso').innerHTML = '<span class="marcador m-ok">Disponibilidad calculada</span>'; oeeVista(); };
$('btnGuardar').onclick = function(){
  if(!puedeEditar()){ avisoL('Tu perfil no permite modificar parámetros de equipo.'); return; }
  const e = eq(editando);
  e.D = +$('qD').value; e.R = +$('qR').value; e.C = +$('qC').value;
  e.mtbf = +$('qMtbf').value; e.mttr = +$('qMttr').value;
  e.cambios = +$('qCambios').value||0; e.min = +$('qMin').value||0;
  e.vapor = +$('qVapor').value||0; e.activo = $('qActivo').checked;
  if(S.maq[editando]){ programarFalla(editando); programarSetup(editando); }
  cerrarCapa('telon'); refrescar(); pintarCiclos(); pintarOEE(); };
$('btnCerrar').onclick = ()=> cerrarCapa('telon');
$('telon').addEventListener('click',e=>{ if(e.target.id === 'telon') cerrarCapa('telon'); });
document.addEventListener('keydown',e=>{ if(e.key === 'Escape'){ ['telon','telonOT','telonDoc','telonTarea'].forEach(cerrarCapa); } });
document.querySelectorAll('.nodo').forEach(function(el){
  el.addEventListener('click',function(){
    if(+($('diagrama').dataset.mov||0) > 6){ $('diagrama').dataset.mov = 0; return; }
    abrirEquipo(el.dataset.id); }); });

/* ===== especificaciones ===== */
function fichaVista(){
  const pr = (window.CMMS && CMMS.servicio.E.productos) || [];
  $('espProductos').innerHTML = '<thead><tr><th>Código</th><th>Formato</th><th class="num">Largo (m)</th><th class="num">Ancho (m)</th><th class="num">Espesor (mm)</th><th class="num">Masa (kg)</th><th class="num">Participación</th><th class="num">Costo (S/)</th><th class="num">Precio (S/)</th></tr></thead><tbody>'+
    pr.map(p => '<tr><td class="nombre">'+p.id+'</td><td>'+esc(p.formato)+'</td><td class="num">'+n2(p.largo_m)+'</td><td class="num">'+n2(p.ancho_m)+'</td><td class="num">'+n2(p.espesor_mm)+'</td><td class="num">'+n2(p.masa_kg)+'</td><td class="num">'+Math.round(p.participacion*100)+' %</td><td class="num">'+p.costo+'</td><td class="num">'+p.precio+'</td></tr>').join('')+'</tbody>';
  $('fPeso').textContent = n2(kgLamina()); }
function pintarCiclos(){
  const tb = $('ciclosTabla'); tb.innerHTML = '';
  MAQUINAS.concat(CALDEROS).forEach(function(id){
    const e = eq(id), esExt = id === 'extruder', sop = e.tipo === 'soporte';
    tb.insertAdjacentHTML('beforeend','<tr><td>'+e.etapa+'</td><td class="nombre">'+e.nombre+'</td>'+
      '<td class="num">'+(esExt ? n0(extruderKgH()) : n1(e.cap))+'</td>'+
      '<td>'+(esExt ? 'kg/h' : e.uni === 'kg/h' ? 'kg/h' : 'láminas/h')+'</td>'+
      '<td class="num">'+n0(capKgH(id))+'</td>'+
      '<td class="num">'+(sop ? '—' : n2(capLamH(id)))+'</td>'+
      '<td class="num">'+(sop ? '—' : n1(60/Math.max(0.001,capLamH(id)))+' min')+'</td></tr>'); });
  }
function pintarTraslados(){
  const c = $('traslados'); c.innerHTML = '';
  TRAMOS.forEach(function(t){
    const arr = M.traslados[t[0]];
    let inp = '';
    for(let i = 0; i < 10; i++) inp += '<input type="number" step="1" min="0" placeholder="'+(i+1)+'" value="'+
      (arr[i] != null ? arr[i] : '')+'" data-tr="'+t[0]+'" data-i="'+i+'">';
    c.insertAdjacentHTML('beforeend','<div class="blq"><div class="cabb"><b>'+t[1]+'</b>'+
      '<span class="chico tenue">promedio <b style="color:var(--accent)">'+n1(prom(arr))+' s</b>, '+
      arr.filter(x=>x>0).length+' mediciones</span></div><div class="med">'+inp+'</div></div>'); });
  c.querySelectorAll('[data-tr]').forEach(i => i.onchange = function(){
    M.traslados[this.dataset.tr][+this.dataset.i] = +this.value||0; pintarTraslados(); }); }

/* ===== plan maestro ===== */
function P(act,crit,frec,min,resp,x){ return Object.assign({tipo:'Planificado',paso:'Preventivo',act,crit,frec,min,resp},x||{}); }
function A(paso,act,crit,frec,min,x){ return Object.assign({tipo:'Autónomo',paso,act,crit,frec,min,resp:'Operario'},x||{}); }
function Q(act,crit,frec,min,resp,x){ return Object.assign({tipo:'Calidad',paso:'Control de calidad',act,crit,frec,min,resp},x||{}); }
const PLANES = {
caldero:[
 A('Limpieza','Limpiar superficie externa del caldero','Envolvente sin hollín ni derrames','Diario',8,{loto:true}),
 A('Limpieza','Purga de fondo del caldero','Purgar hasta que el agua salga clara y registrar','Diario',5,{nuevo:true}),
 A('Limpieza','Drenar condensados de las trampas de vapor','Cada trampa descarga sin fuga de vapor vivo','Diario',5),
 A('Limpieza','Limpiar el área perimetral','Piso libre de combustible y un metro de despeje','Diario',8),
 A('Inspección','Verificar el nivel de agua en el visor','Entre la mitad y dos tercios del visor','Diario',2),
 A('Inspección','Purgar la columna de nivel y probar la alarma','El nivel retorna en menos de diez segundos','Diario',5,{nuevo:true}),
 A('Inspección','Registrar la presión de vapor','Variación menor a 0.5 bar en el turno','Diario',2,{ajustada:true}),
 A('Inspección','Registrar la temperatura de vapor','200 ± 5 °C respecto de la receta','Diario',2),
 A('Inspección','Verificar el aspecto de la llama','Llama estable, sin humo negro','Diario',3,{ajustada:true}),
 A('Lubricación','Lubricar vástagos de válvulas manuales','Maniobra sin agarrotamiento','Semanal',6),
 A('Lubricación','Aplicar grasa en bombas auxiliares','Grasa NLGI 2, sin fuga por el sello','Semanal',5),
 A('Lubricación','Engrasar articulaciones del quemador','Movimiento libre y sin juego','Semanal',5),
 A('Ajustes menores','Verificar manómetros contra el patrón de trabajo','Desviación menor al 2 %','Semanal',5,{ajustada:true}),
 A('Ajustes menores','Verificar que la presión esté en el rango autorizado','Prohibido modificar el presostato','Semanal',3,{ajustada:true}),
 A('Ajustes menores','Verificar la estabilidad del flujo de combustible','El reglaje es del especialista','Interdiario',3,{ajustada:true}),
 P('Limpieza de quemadores','Boquillas y electrodos libres de carbón','Semanal',90,'Técnico'),
 P('Verificar bombas de alimentación','Caudal y presión dentro de curva','Semanal',25,'Técnico'),
 P('Análisis químico del agua de alimentación','pH, dureza y sólidos dentro de límites','Semanal',75,'Técnico',{ajustada:true}),
 P('Inspección de tuberías de vapor','Sin fuga ni corrosión externa','Quincenal',30,'Técnico'),
 P('Calibración de instrumentos','Dentro de tolerancia contra patrón trazable','Quincenal',60,'Técnico'),
 P('Inspección de aislamiento térmico','Temperatura superficial menor a 60 °C','Quincenal',45,'Técnico'),
 P('Revisión del control automático','Sensores y actuadores dentro del rango','Mensual',90,'Técnico'),
 P('Prueba de válvulas de seguridad','Apertura y cierre a la presión de tarado','Mensual',60,'Técnico'),
 P('Cambio de empaques y sellos','Sin fuga tras treinta minutos a presión','Mensual',120,'Técnico'),
 P('Inspección interna del hogar','Sin incrustación mayor a un milímetro','Trimestral',150,'Técnico',{ajustada:true}),
 P('Limpieza de tubos de humo','Temperatura de gases dentro de diseño','Bimestral',240,'Técnico'),
 P('Inspección de refractarios','Sin fisuras pasantes','Bimestral',120,'Técnico'),
 P('Calibración del sistema de combustión','Exceso de aire y monóxido en límites','Bimestral',180,'Especialista'),
 P('Análisis de gases de combustión','Eficiencia dentro del objetivo','Semestral',150,'Especialista'),
 P('Reacondicionamiento general','Protocolo de pruebas conforme','Anual',480,'Especialista',{ajustada:true}),
 Q('Registrar presión y temperatura por turno','Sin puntos fuera de límites de control','Diario',10,'Operario'),
 Q('Verificar la estabilidad térmica del vapor','Diferencia máxima de 5 °C entre consumos','Semanal',45,'Técnico'),
 Q('Verificar el tratamiento de agua','Parámetros dentro de límites','Semanal',40,'Técnico'),
 Q('Determinar el título del vapor','Título igual o mayor al 97 %','Mensual',90,'Especialista')],
molino:[
 A('Limpieza','Limpiar la superficie de los rodillos','Sin costra ni residuo, equipo bloqueado','Diario',10,{loto:true}),
 A('Limpieza','Remover residuos de bandeja y guardas','Libres de acumulación','Diario',8,{loto:true}),
 A('Limpieza','Limpiar el área de trabajo','Piso sin residuos ni aceite','Diario',8),
 A('Inspección','Inspeccionar la superficie de los rodillos','Sin ralladuras ni desgaste desigual','Diario',5),
 A('Inspección','Verificar la temperatura de los rodillos','Diferencia máxima de 5 °C','Diario',3),
 A('Inspección','Verificar el nivel de aceite en el visor','Entre marcas, sin emulsión','Diario',3),
 A('Inspección','Probar el paro de emergencia y la barra','Se detiene en menos de un cuarto de vuelta','Diario',3,{nuevo:true}),
 A('Lubricación','Lubricar los puntos de engrase accesibles','Todos con grasa fresca','Semanal',8),
 A('Lubricación','Aplicar aceite en guías','Película continua sin arrastre seco','Semanal',5),
 A('Lubricación','Engrasar los cojinetes accesibles','Grasa fresca visible en la purga','Semanal',6),
 A('Ajustes menores','Verificar la apertura entre rodillos con galga','Dentro de ±0.2 mm de la receta','Semanal',5,{ajustada:true}),
 A('Ajustes menores','Verificar la temperatura de trabajo','Dentro de la banda de receta','Interdiario',3),
 A('Ajustes menores','Verificar la alineación y reportar','La corrección la ejecuta el técnico','Semanal',5,{ajustada:true}),
 P('Lubricación de puntos no accesibles','Puntos bajo guarda según carta','Mensual',30,'Técnico',{ajustada:true}),
 P('Inspección de bandas y poleas','Tensión y alineación dentro del rango','Semanal',25,'Técnico'),
 P('Limpieza del sistema de enfriamiento','Circuito sin obstrucción','Semanal',35,'Técnico'),
 P('Verificar alineación de rodillos con comparador','Paralelismo dentro de tolerancia','Quincenal',90,'Técnico'),
 P('Inspección de estructura y soportes','Sin grietas ni pernos flojos','Quincenal',45,'Técnico'),
 P('Calibración del sistema de presión','Presión de cilindros en consigna','Quincenal',60,'Técnico'),
 P('Cambio de aceite hidráulico','Sin partículas en el filtro','Mensual',120,'Técnico'),
 P('Inspección de sellos y empaques','Sin fuga tras una hora','Mensual',60,'Técnico'),
 P('Prueba funcional del sistema de seguridad','Enclavamientos según protocolo','Mensual',45,'Técnico'),
 P('Medición de vibraciones','Dentro del criterio de aceptación','Mensual',75,'Técnico'),
 P('Balanceado dinámico de rodillos','Vibración residual dentro del criterio','Semestral',180,'Especialista',{ajustada:true}),
 P('Cambio de rodamientos por condición','Cuando la vibración supera el criterio','Anual',180,'Técnico',{ajustada:true}),
 P('Rectificado de rodillos','Rugosidad y cilindricidad en especificación','Anual',300,'Especialista',{ajustada:true}),
 P('Reacondicionamiento de cojinetes','Juego radial dentro de tolerancia','Anual',240,'Especialista',{ajustada:true}),
 P('Calibración general del equipo','Parámetros en la hoja de ajuste','Semestral',360,'Especialista'),
 Q('Verificar homogeneidad de la mezcla','Dureza dentro de ±3 Shore A del patrón','Diario',20,'Inspector'),
 Q('Medir la apertura entre rodillos','Dentro de ±0.2 mm de la receta','Semanal',30,'Técnico'),
 Q('Verificar la banda térmica en tres puntos','Diferencia máxima de 5 °C','Semanal',25,'Técnico'),
 Q('Ensayo reométrico de la mezcla','Tiempos dentro de la especificación','Mensual',120,'Especialista')],
extruder:[
 A('Limpieza','Limpiar el cabezal y el dado','Sin material degradado, equipo bloqueado','Diario',10,{loto:true}),
 A('Limpieza','Limpiar la tolva de alimentación','Sin puentes de material ni contaminación','Diario',8),
 A('Limpieza','Remover residuos del área','Área despejada y piso limpio','Diario',6),
 A('Inspección','Verificar el laminado a la salida','Espesor uniforme, sin líneas ni grumos','Diario',5,{ajustada:true}),
 A('Inspección','Registrar la temperatura por zonas','Cada zona dentro de ±5 °C','Diario',3),
 A('Inspección','Registrar la presión de extrusión','Sin picos mayores al 10 %','Diario',2),
 A('Inspección','Verificar guardas y paro de emergencia','Guardas en su sitio y paro operativo','Diario',3,{nuevo:true}),
 A('Lubricación','Lubricar los puntos accesibles','Todos con grasa fresca','Semanal',6),
 A('Lubricación','Aplicar grasa en cojinetes externos','Grasa visible en la purga','Semanal',5),
 A('Lubricación','Engrasar el mecanismo de alimentación','Sin agarrotamiento','Semanal',5),
 A('Ajustes menores','Ajustar la velocidad de extrusión','Dentro de ±2 % de la receta','Semanal',3),
 A('Ajustes menores','Corregir el perfil térmico por zonas','Zonas estabilizadas en tolerancia','Interdiario',5),
 A('Ajustes menores','Corregir el flujo de alimentación','Alimentación continua y estable','Semanal',4),
 P('Lubricación del motor y puntos bajo guarda','Sin ruido anómalo tras el arranque','Mensual',25,'Técnico',{ajustada:true}),
 P('Inspección de resistencias eléctricas','Continuidad y aislamiento de referencia','Semanal',40,'Técnico'),
 P('Limpieza del sistema de ventilación','Temperatura del tablero en rango','Semanal',45,'Técnico'),
 P('Calibración de controladores de temperatura','Desviación menor a 2 °C','Quincenal',90,'Técnico'),
 P('Inspección del acoplamiento motor-reductor','Alineación dentro de tolerancia','Quincenal',30,'Técnico'),
 P('Verificar tolva y dosificador','Dosificación dentro de ±2 %','Quincenal',50,'Técnico'),
 P('Cambio de aceite del reductor','Sin partículas metálicas en el imán','Mensual',60,'Técnico'),
 P('Verificar el control automático','Sensores dentro del rango de consigna','Mensual',75,'Técnico'),
 P('Medición del desgaste del tornillo','Diámetro dentro de tolerancia','Mensual',60,'Técnico'),
 P('Cambio de filtros de aceite','Presión diferencial dentro del rango','Mensual',30,'Técnico'),
 P('Inspección interna del barril','Sin rayado longitudinal','Trimestral',180,'Técnico',{ajustada:true}),
 P('Calibración de sensores de presión','Desviación dentro del 2 %','Bimestral',120,'Especialista'),
 P('Reemplazo de bandas calefactoras','Según continuidad o termografía','Anual',240,'Técnico',{ajustada:true}),
 P('Rectificado del tornillo sin fin','Geometría dentro de tolerancia','Anual',480,'Especialista',{ajustada:true}),
 P('Reacondicionamiento completo','Protocolo de pruebas conforme','Anual',600,'Especialista',{ajustada:true}),
 Q('Medir el espesor en cinco puntos del ancho','6.35 mm ±0.5, variación menor al 5 %','Diario',20,'Inspector'),
 Q('Verificar el perfil térmico contra receta','Todas las zonas dentro de ±5 °C','Diario',10,'Operario'),
 Q('Controlar el gramaje del laminado','Peso por metro dentro de ±3 %','Diario',15,'Inspector'),
 Q('Correlacionar desgaste con variación de espesor','Tendencia documentada','Mensual',60,'Ingeniero')],
prensa:[
 A('Limpieza','Limpiar la superficie de los moldes','Sin residuo ni desmoldante, prensa bloqueada','Diario',10,{loto:true,ajustada:true}),
 A('Limpieza','Limpiar el área de trabajo','Piso sin residuo ni aceite','Diario',8),
 A('Limpieza','Remover residuos del área de moldeo','Sin acumulación en canales ni bordes','Diario',7),
 A('Inspección','Inspeccionar el estado de los moldes','Sin marcas ni desgaste transferible','Diario',6),
 A('Inspección','Registrar la presión hidráulica','Dentro del rango en todo el ciclo','Diario',2),
 A('Inspección','Registrar la temperatura de los platos','Ambos dentro de ±5 °C','Diario',3),
 A('Inspección','Verificar guarda y paro de emergencia','El enclavamiento impide el cierre','Diario',3,{nuevo:true}),
 A('Lubricación','Lubricar los puntos de engrase','Todos con grasa fresca','Semanal',8),
 A('Lubricación','Aplicar grasa en articulaciones','Movimiento libre','Semanal',6),
 A('Lubricación','Engrasar las guías de deslizamiento','Cierre sin ruido','Semanal',5),
 A('Ajustes menores','Ajustar la presión de trabajo','Dentro de ±3 % de la receta','Semanal',4),
 A('Ajustes menores','Corregir la temperatura de moldes','Estabilizada dentro de tolerancia','Interdiario',4),
 A('Ajustes menores','Verificar el paralelismo con galga','La corrección la ejecuta el técnico','Semanal',5,{ajustada:true}),
 P('Lubricación de columnas y puntos bajo guarda','Sin desgaste en columnas','Mensual',45,'Técnico',{ajustada:true}),
 P('Inspección de mangueras hidráulicas','Sin abrasión ni fuga','Semanal',30,'Técnico'),
 P('Verificar el nivel de aceite hidráulico','Entre marcas, sin turbidez','Semanal',15,'Técnico'),
 P('Calibración de la presión de trabajo','Válvulas dentro de consigna','Quincenal',75,'Técnico'),
 P('Inspección de cilindros hidráulicos','Vástagos sin rayado','Quincenal',90,'Técnico'),
 P('Limpieza del circuito de enfriamiento','Retorno dentro del rango','Quincenal',60,'Técnico'),
 P('Cambio de filtros hidráulicos','Presión diferencial dentro del rango','Mensual',45,'Técnico'),
 P('Inspección de válvulas hidráulicas','Sin fuga interna','Mensual',120,'Técnico'),
 P('Verificar paralelismo con comparador','Dentro de tolerancia de fabricante','Mensual',90,'Técnico'),
 P('Calibración de termostatos','Desviación menor a 2 °C','Mensual',90,'Técnico'),
 P('Análisis de aceite hidráulico','Agua y partículas dentro de límites','Trimestral',45,'Especialista',{nuevo:true}),
 P('Calibración del sistema de control','Parámetros en la hoja de ajuste','Bimestral',150,'Especialista'),
 P('Cambio de aceite hidráulico','Cuando el análisis lo indica','Semestral',120,'Técnico',{ajustada:true}),
 P('Reemplazo de sellos hidráulicos','Sin fuga tras la prueba','Anual',180,'Técnico',{ajustada:true}),
 P('Rectificado de moldes por condición','Acabado dentro de especificación','Anual',360,'Especialista',{ajustada:true}),
 P('Reacondicionamiento del sistema hidráulico','Protocolo conforme','Anual',480,'Especialista',{ajustada:true}),
 Q('Verificar temperatura de platos en cuatro puntos','Diferencia máxima de 5 °C','Semanal',30,'Técnico'),
 Q('Registrar presión y tiempo por ciclo','Ambos dentro de la receta','Diario',10,'Operario'),
 Q('Inspeccionar el acabado de la lámina','Sin marcas ni porosidad','Diario',15,'Inspector')],
autoclave:[
 A('Limpieza','Limpiar el interior de la cámara','Despresurizada, ventilada y bloqueada','Diario',10,{loto:true}),
 A('Limpieza','Drenar condensados de cámara y línea','Drenaje completo antes del primer ciclo','Diario',8),
 A('Limpieza','Limpiar el área externa','Perímetro despejado','Diario',7),
 A('Inspección','Inspeccionar puerta, empaque y seguros','Empaque sin cortes, seguros completos','Diario',5),
 A('Inspección','Registrar la presión de trabajo','Dentro del rango de la receta','Diario',2),
 A('Inspección','Registrar la temperatura de cámara','Dentro de ±3 °C de la receta','Diario',2),
 A('Inspección','Verificar enclavamiento y válvula de alivio','Impide abrir con presión residual','Semanal',5,{nuevo:true}),
 A('Lubricación','Lubricar las bisagras de puerta','Apertura sin esfuerzo excesivo','Semanal',5),
 A('Lubricación','Aplicar grasa en mecanismos','Sin agarrotamiento','Semanal',5),
 A('Lubricación','Engrasar el sistema de cierre','Cierre sin resistencia anómala','Semanal',5),
 A('Ajustes menores','Ajustar la presión de operación','Dentro de los límites autorizados','Interdiario',3),
 A('Ajustes menores','Ajustar la temperatura de cámara','Estabilizada dentro de ±3 °C','Interdiario',3),
 A('Ajustes menores','Verificar la alineación de la puerta','Cierre uniforme en el perímetro','Semanal',4,{ajustada:true}),
 P('Lubricación del mecanismo interno de cierre','Sin juego en los seguros','Mensual',30,'Técnico',{ajustada:true}),
 P('Limpieza profunda con desengrasante','Superficie sin película residual','Mensual',60,'Técnico',{ajustada:true}),
 P('Inspección de tuberías de vapor','Sin fuga ni corrosión','Semanal',40,'Técnico'),
 P('Calibración de instrumentos','Dentro de tolerancia contra patrón','Quincenal',90,'Técnico'),
 P('Inspección de aislamiento térmico','Temperatura superficial en el límite','Quincenal',45,'Técnico'),
 P('Prueba de sistemas de seguridad','Válvulas actúan a la presión de tarado','Quincenal',60,'Técnico'),
 P('Verificar el sistema de control','La secuencia ejecuta la receta','Mensual',90,'Técnico'),
 P('Calibración de válvulas reguladoras','Presión dentro del 2 %','Mensual',105,'Técnico'),
 P('Inspección de la estructura interna','Sin corrosión localizada','Trimestral',120,'Técnico',{ajustada:true}),
 P('Reemplazo de empaques de puerta','Sin fuga en estanqueidad','Bimestral',120,'Técnico'),
 P('Calibración del sistema de control','Parámetros en la hoja de ajuste','Bimestral',180,'Especialista'),
 P('Cambio de empaques internos','Sin fuga interna','Semestral',90,'Técnico',{ajustada:true}),
 P('Inspección ultrasónica del casco','Espesor sobre el mínimo de cálculo','Anual',150,'Especialista',{ajustada:true}),
 P('Prueba hidrostática','Sin deformación permanente ni fuga','Anual',240,'Especialista',{ajustada:true}),
 P('Inspección integral y certificación','Certificado vigente','Anual',300,'Especialista',{ajustada:true}),
 Q('Validar el ciclo de curado contra receta','Las tres variables dentro de tolerancia','Diario',10,'Operario'),
 Q('Ensayo de dureza sobre lámina curada','Dentro de la especificación','Diario',20,'Inspector'),
 Q('Ensayo de resistencia a la abrasión','Pérdida de volumen dentro del límite','Mensual',120,'Especialista'),
 Q('Mapeo térmico de la cámara','Diferencia máxima de 3 °C','Semestral',180,'Especialista')]};
const DIAS_FREC = {'Diario':1,'Interdiario':2,'Semanal':7,'Quincenal':15,'Mensual':30,'Bimestral':60,'Trimestral':90,'Semestral':180,'Anual':365};
const ORDEN_FREC = ['Diario','Interdiario','Semanal','Quincenal','Mensual','Bimestral','Trimestral','Semestral','Anual'];
const OFFSET_FREC = {'Diario':0,'Interdiario':0,'Semanal':0,'Quincenal':7,'Mensual':14,'Bimestral':21,'Trimestral':21,'Semestral':28,'Anual':28};
let PROG = {ini:null, meses:12};
let OTS = [], ANOM = [], SEQ = 0;
const tareasDe = fam => (PLANES[fam]||[]);
const agrupable = t => t.tipo === 'Autónomo' || (t.tipo === 'Calidad' && (t.frec === 'Diario' || t.frec === 'Interdiario'));
function crearOT(id,tipo,frec,titulo,items,fecha,min,loto,resp){
  return { id:'', eqId:id, codigo:eq(id).codigo, tipo:tipo, frec:frec, act:titulo, resp:resp, min:min, loto:loto,
    fecha:fecha, estado:'Programada', enJornada:true,
    items:items.map(t => ({act:t.act, crit:t.crit, paso:t.paso, min:t.min, ok:null, nota:''})),
    evidencia:null, obs:'', real:null, cerradaPor:null, cerradaEn:null, motivoNo:'' }; }
function generarOTs(){
  const prev = {};
  OTS.forEach(o => { if(o.estado !== 'Programada') prev[o.eqId+'|'+o.fecha+'|'+o.act] = o; });
  const ini = dISO(PROG.ini || HOY());
  const fin = new Date(ini); fin.setMonth(fin.getMonth()+PROG.meses);
  OTS = []; SEQ = 0;
  equiposMant().forEach(function(id){
    const tareas = tareasDe(eq(id).familia); if(!tareas.length) return;
    const grupos = {};
    tareas.filter(agrupable).forEach(function(t){ const k = t.tipo+'|'+t.frec; (grupos[k] = grupos[k]||[]).push(t); });
    Object.keys(grupos).forEach(function(k){
      const par = k.split('|'), tipo = par[0], frec = par[1], items = grupos[k];
      const paso = DIAS_FREC[frec], off = OFFSET_FREC[frec];
      let f = new Date(ini); f.setDate(f.getDate()+off);
      while(f < fin){
        let real = new Date(f), saltar = false;
        if(paso <= 2){ if(!esLaborable(real)) saltar = true; } else real = proximoHabil(real);
        if(!saltar && real < fin)
          OTS.push(crearOT(id, tipo, frec, 'Rutina '+tipo.toLowerCase()+' '+frec.toLowerCase()+', '+eq(id).nombre,
            items, iso(real), items.reduce((a,t)=>a+t.min,0), items.some(t=>t.loto), 'Operario'));
        f.setDate(f.getDate()+paso); } });
    const indiv = tareas.filter(t => !agrupable(t)), porFrec = {};
    indiv.forEach(t => (porFrec[t.frec] = porFrec[t.frec]||[]).push(t));
    ORDEN_FREC.forEach(function(fr){
      (porFrec[fr]||[]).forEach(function(t,k){
        const paso = DIAS_FREC[fr], off = OFFSET_FREC[fr]+Math.min(k,Math.max(0,paso-1));
        let f = new Date(ini); f.setDate(f.getDate()+off);
        while(f < fin){
          const real = proximoHabil(f);
          if(real < fin) OTS.push(crearOT(id, t.tipo, fr, t.act, [t], iso(real), t.min, !!t.loto, t.resp));
          f.setDate(f.getDate()+paso); } }); }); });
  OTS.sort((a,b)=> a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0);
  OTS.forEach(function(o,i){
    o.id = 'OT-'+String(i+1).padStart(5,'0');
    const p = prev[o.eqId+'|'+o.fecha+'|'+o.act];
    if(p){ o.estado = p.estado; o.items = p.items; o.evidencia = p.evidencia; o.obs = p.obs;
      o.real = p.real; o.cerradaPor = p.cerradaPor; o.cerradaEn = p.cerradaEn; o.motivoNo = p.motivoNo;
      o.enJornada = p.enJornada !== false; } });
  $('progNota').textContent = 'Se generaron '+n0(OTS.length)+' órdenes entre '+iso(ini)+' y '+iso(fin)+
    ', omitiendo domingos, feriados y periodos excluidos.';
  pintarPlan(); pintarAgenda(); pintarHistorial(); pintarOEE(); }
const estadoOT = o => o.estado === 'Ejecutada' ? 'Cumplida' : o.estado === 'No cumplida' ? 'No cumplida'
  : (o.fecha < HOY() ? 'Vencida' : 'Programada');
let planFiltro = 'todos', planEqF = 'todos';
function pintarPlan(){
  const tb = $('planTabla'); tb.innerHTML = '';
  let n = 0, cnt = {Planificado:0,'Autónomo':0,Calidad:0}, diaAut = 0;
  const fams = planEqF === 'todos' ? FAMILIAS : [planEqF];
  fams.forEach(function(fam){
    const unid = fam === 'caldero' ? 2 : fam === 'prensa' ? 5 : 1;
    tareasDe(fam).forEach(function(t,idx){
      if(planFiltro !== 'todos' && t.tipo !== planFiltro) return;
      n++; cnt[t.tipo]++;
      if(t.tipo === 'Autónomo' && t.frec === 'Diario') diaAut += t.min*unid;
      const bg = t.tipo === 'Planificado' ? 'm-info' : t.tipo === 'Autónomo' ? 'm-ok' : 'm-warn';
      tb.insertAdjacentHTML('beforeend',
        '<tr><td class="nombre">'+NOM_FAM[fam]+'</td><td class="chico">'+esc(t.paso)+'</td>'+
        '<td>'+esc(t.act)+(t.loto?' <span class="loto">bloqueo</span>':'')+
        (t.nuevo?' <span class="marcador m-ok">nueva</span>':'')+
        (t.ajustada?' <span class="marcador m-warn">ajustada</span>':'')+'</td>'+
        '<td class="chico tenue" style="max-width:270px">'+esc(t.crit)+'</td>'+
        '<td><span class="marcador '+bg+'">'+t.tipo+'</span></td>'+
        '<td>'+t.frec+'<div class="sub">cada '+DIAS_FREC[t.frec]+' días</div></td>'+
        '<td>'+t.resp+'</td><td class="num">'+t.min+' min</td>'+
        '<td><div class="fila"><button class="btn btn-ghost btn-sm" data-ed="'+fam+'|'+idx+'"><i class="fas fa-pen"></i></button>'+
        '<button class="btn btn-danger btn-sm" data-del="'+fam+'|'+idx+'"><i class="fas fa-trash"></i></button></div></td></tr>'); }); });
  let min = 0;
  OTS.forEach(function(o){
    const fam = eq(o.eqId).familia;
    if(planEqF !== 'todos' && fam !== planEqF) return;
    if(planFiltro !== 'todos' && o.tipo !== planFiltro) return;
    min += o.min; });
  $('plTareas').textContent = n; $('plPlan').textContent = cnt.Planificado;
  $('plAuto').textContent = cnt['Autónomo']; $('plCal').textContent = cnt.Calidad;
  $('plHoras').textContent = n0(min/60)+' h'; $('plDia').textContent = n1(diaAut/60)+' h';
  tb.querySelectorAll('[data-ed]').forEach(b => b.onclick = ()=> abrirTarea(b.dataset.ed));
  tb.querySelectorAll('[data-del]').forEach(b => b.onclick = async function(){
    if(!puedeEditar()){ avisoL('Tu perfil no permite modificar el plan.'); return; }
    const p = b.dataset.del.split('|');
    if(!(await confirmarL('Eliminar tarea', 'Se eliminará la tarea del plan y del calendario. ¿Continuar?', 'Eliminar'))) return;
    PLANES[p[0]].splice(+p[1],1); generarOTs(); });
  if($('vTit').dataset.v === 'plan')
    $('vSub').textContent = (planEqF === 'todos' ? 'Los cinco equipos' : NOM_FAM[planEqF])+
      (planFiltro === 'todos' ? ', los tres pilares' : ', mantenimiento '+planFiltro.toLowerCase()); }
document.querySelectorAll('#planTipo .pest').forEach(function(t){
  t.onclick = function(){ document.querySelectorAll('#planTipo .pest').forEach(x=>x.classList.remove('on'));
    t.classList.add('on'); planFiltro = t.dataset.t; pintarPlan(); }; });
$('planEqF').addEventListener('change', function(){ planEqF = this.value; pintarPlan(); });
let tareaEdit = null;
function abrirTarea(ref){
  if(!puedeEditar()){ avisoL('Tu perfil no permite modificar el plan.'); return; }
  $('tFrec').innerHTML = ORDEN_FREC.map(f => '<option>'+f+'</option>').join('');
  $('tEq').innerHTML = FAMILIAS.map(f => '<option value="'+f+'">'+NOM_FAM[f]+'</option>').join('');
  if(ref){
    const p = ref.split('|'), t = PLANES[p[0]][+p[1]];
    tareaEdit = {fam:p[0], idx:+p[1]};
    $('tTitulo').textContent = 'Editar tarea';
    $('tEq').value = p[0]; $('tTipo').value = t.tipo; $('tPaso').value = t.paso; $('tAct').value = t.act;
    $('tCrit').value = t.crit; $('tFrec').value = t.frec; $('tResp').value = t.resp;
    $('tMin').value = t.min; $('tLoto').value = t.loto ? 'si':'no';
  } else {
    tareaEdit = null; $('tTitulo').textContent = 'Nueva tarea';
    $('tTipo').value = 'Planificado'; $('tPaso').value = 'Preventivo'; $('tAct').value = '';
    $('tCrit').value = ''; $('tFrec').value = 'Mensual'; $('tResp').value = 'Técnico';
    $('tMin').value = 30; $('tLoto').value = 'no'; }
  avisoTarea(); abrirCapa('telonTarea'); }
function avisoTarea(){
  const t = $('tTipo').value, m = +$('tMin').value||0;
  $('tAviso').textContent = (t === 'Autónomo' && m > 10)
    ? 'Una tarea autónoma no debería superar los 10 minutos. Si necesita más, corresponde al mantenimiento planificado.' : ''; }
['tTipo','tMin'].forEach(i => $(i).addEventListener('input', avisoTarea));
$('btnNuevaTarea').onclick = ()=> abrirTarea(null);
$('tCerrar').onclick = $('tCancelar').onclick = ()=> cerrarCapa('telonTarea');
$('tGuardar').onclick = function(){
  const act = $('tAct').value.trim(), crit = $('tCrit').value.trim();
  if(!act || !crit){ avisoL('La actividad y el criterio son obligatorios.'); return; }
  const t = {tipo:$('tTipo').value, paso:$('tPaso').value, act:act, crit:crit, frec:$('tFrec').value,
    resp:$('tResp').value, min:+$('tMin').value||10, loto:$('tLoto').value === 'si'};
  const fam = $('tEq').value;
  if(tareaEdit){
    if(tareaEdit.fam === fam) PLANES[fam][tareaEdit.idx] = t;
    else { PLANES[tareaEdit.fam].splice(tareaEdit.idx,1); PLANES[fam].push(t); }
  } else PLANES[fam].push(t);
  cerrarCapa('telonTarea'); generarOTs(); };

/* ===== agenda ===== */
const TIPOS = ['Planificado','Autónomo','Calidad'];
function pintarAgenda(){
  const f = $('agFecha').value || HOY(), d = dISO(f);
  const dia = OTS.filter(o => o.fecha === f);
  const cont = $('agLista'); cont.innerHTML = '';
  let cnt = {Planificado:0,'Autónomo':0,Calidad:0}, hechas = 0;
  dia.forEach(o => { cnt[o.tipo]++; if(o.estado === 'Ejecutada') hechas++; });
  $('agTot').textContent = dia.length; $('agPla').textContent = cnt.Planificado;
  $('agAut').textContent = cnt['Autónomo']; $('agCal').textContent = cnt.Calidad;
  const cum = dia.length ? hechas/dia.length : null;
  $('agCum').textContent = cum != null ? pc(cum) : '–';
  $('agCum').style.color = cum != null ? banda(cum).c : '';
  const mot = motivoFeriado(d), om = omision(d);
  $('agAviso').textContent = fechaLarga(d)+(mot ? '. Feriado: '+mot : om ? '. Periodo omitido: '+om.motivo
    : (d.getDay() === 0 ? '. Domingo, no se programa mantenimiento' : ''))+
    (dia.length ? '. '+n1(dia.reduce((a,o)=>a+o.min,0)/60)+' horas-hombre programadas' : '');
  if(!dia.length){ cont.innerHTML = '<div class="panel"><p class="vacio">No hay órdenes programadas para este día.</p></div>'; return; }
  const porEq = {};
  dia.forEach(o => (porEq[o.eqId] = porEq[o.eqId]||[]).push(o));
  equiposMant().forEach(function(id){
    const lista = porEq[id]; if(!lista) return;
    const he = lista.filter(o => o.estado === 'Ejecutada').length, cu = he/lista.length;
    let h = '<div class="ag-eq"><div class="cab"><b>'+eq(id).nombre+'</b>'+
      '<span class="chico tenue">'+eq(id).codigo+'</span>'+
      '<span class="marcador '+(cu === 1?'m-ok':'m-warn')+'">'+pc(cu)+' cumplido, '+he+' de '+lista.length+'</span>'+
      '<span class="chico tenue">'+n1(lista.reduce((a,o)=>a+o.min,0)/60)+' h-hombre</span>'+
      '<button class="btn btn-ghost btn-sm" data-pdf="'+id+'"><i class="fas fa-file-pdf"></i> Orden en PDF</button></div><div class="ag-col">';
    TIPOS.forEach(function(t){
      const s = lista.filter(o => o.tipo === t);
      h += '<div class="ag-pil"><h4>'+t+'</h4>';
      if(!s.length) h += '<div class="vacio">Sin tareas hoy</div>';
      s.forEach(function(o){
        const st = estadoOT(o);
        h += '<div class="ag-ot"><div class="t">'+esc(o.act)+'</div>'+
          '<div class="d">'+o.resp+', '+o.min+' min, '+o.items.length+' punto'+(o.items.length===1?'':'s')+
          (o.loto?'. Requiere bloqueo':'')+'</div><div class="fila">'+
          '<span class="marcador '+(st === 'Cumplida'?'m-ok':st === 'Programada'?'m-warn':'m-bad')+'">'+st+'</span>'+
          (o.estado === 'Ejecutada' ? '<span class="marcador '+(o.enJornada?'m-info':'m-warn')+'">'+
            (o.enJornada?'en jornada':'fuera de turno')+'</span>' : '')+
          (o.estado === 'Programada' ? '<button class="btn btn-primary btn-sm" data-ag="'+o.id+'">Cerrar</button>' : '')+
          '</div></div>'; });
      h += '</div>'; });
    cont.insertAdjacentHTML('beforeend', h+'</div></div>'); });
  cont.querySelectorAll('[data-ag]').forEach(b => b.onclick = ()=> abrirCierre(b.dataset.ag));
  cont.querySelectorAll('[data-pdf]').forEach(b => b.onclick = ()=> docMaquina(b.dataset.pdf, f)); }
$('agHoy').onclick = function(){ $('agFecha').value = HOY(); pintarAgenda(); };
$('agFecha').addEventListener('change', pintarAgenda);
$('agAnt').onclick = function(){ const d = dISO($('agFecha').value||HOY()); d.setDate(d.getDate()-1); $('agFecha').value = iso(d); pintarAgenda(); };
$('agSig').onclick = function(){ const d = dISO($('agFecha').value||HOY()); d.setDate(d.getDate()+1); $('agFecha').value = iso(d); pintarAgenda(); };
function pintarHistorial(){
  const d1 = $('hDesde').value || PROG.ini, d2 = $('hHasta').value || HOY();
  const fe = $('hEq').value, ft = $('hTipo').value;
  const lista = OTS.filter(function(o){
    if(o.fecha < d1 || o.fecha > d2) return false;
    if(fe && fe !== 'todos' && o.eqId !== fe) return false;
    if(ft && o.tipo !== ft) return false;
    return true; });
  let eje = 0, no = 0, pen = 0, hrs = 0;
  lista.forEach(function(o){
    const s = estadoOT(o);
    if(s === 'Cumplida'){ eje++; if(o.enJornada) hrs += (o.real != null ? o.real : o.min)/60; }
    else if(s === 'No cumplida' || s === 'Vencida') no++; else pen++; });
  const bse = eje+no, cum = bse ? eje/bse : null;
  $('hTot').textContent = n0(lista.length); $('hEje').textContent = n0(eje);
  $('hNo').textContent = n0(no); $('hPen').textContent = n0(pen);
  $('hHrs').textContent = n1(hrs)+' h';
  $('hCum').textContent = cum != null ? pc(cum) : '–';
  $('hCum').style.color = cum != null ? banda(cum).c : '';
  const tb = $('hTabla'); tb.innerHTML = '';
  lista.slice().reverse().slice(0,400).forEach(function(o){
    const st = estadoOT(o);
    tb.insertAdjacentHTML('beforeend','<tr><td>'+o.fecha+'</td><td class="nombre">'+eq(o.eqId).nombre+'</td>'+
      '<td>'+o.tipo+'</td><td>'+esc(o.act)+(o.motivoNo?'<div class="sub">'+esc(o.motivoNo)+'</div>':'')+'</td>'+
      '<td class="num">'+(o.real != null ? o.real : o.min)+' min</td>'+
      '<td>'+(o.estado === 'Ejecutada' ? '<span class="marcador '+(o.enJornada?'m-info':'m-warn')+'">'+
        (o.enJornada?'En jornada':'Fuera de turno')+'</span>' : '—')+'</td>'+
      '<td><span class="marcador '+(st === 'Cumplida'?'m-ok':st === 'Programada'?'m-warn':'m-bad')+'">'+st+'</span></td>'+
      '<td class="chico tenue">'+esc(o.cerradaPor||'—')+'</td>'+
      '<td><button class="btn btn-ghost btn-sm" data-hd="'+o.id+'"><i class="fas fa-file-lines"></i></button></td></tr>'); });
  tb.querySelectorAll('[data-hd]').forEach(b => b.onclick = ()=> verDocumento(b.dataset.hd)); }
['hDesde','hHasta','hEq','hTipo'].forEach(i => $(i).addEventListener('change', pintarHistorial));
$('hReset').onclick = function(){ $('hDesde').value = PROG.ini; $('hHasta').value = HOY(); pintarHistorial(); };

/* ===== cierre ===== */
let cerrando = null, fotoTmp = null;
function abrirCierre(id){
  const o = OTS.find(x => x.id === id); if(!o) return;
  cerrando = o; fotoTmp = null;
  $('cOT').textContent = o.id+', '+o.fecha+', '+eq(o.eqId).nombre;
  $('cTitulo').textContent = o.act;
  $('cLoto').innerHTML = o.loto ? '<span class="loto">Requiere bloqueo y etiquetado antes de iniciar</span>' : '';
  $('cObs').value = ''; $('cReal').value = o.min; $('cFoto').value = ''; $('cJor').value = 'si';
  $('cPreview').innerHTML = '<span class="ph">Sin evidencia cargada</span>';
  o.items.forEach(i => { i.ok = null; i.nota = ''; });
  notaJornada(); pintarLista(); validarCierre(); abrirCapa('telonOT'); }
function notaJornada(){
  $('cJorNota').textContent = $('cJor').value === 'si'
    ? 'El tiempo empleado descuenta del tiempo de carga o entra como pérdida de eficiencia, según el pilar.'
    : 'Al ejecutarse fuera de turno, en las horas no programadas, el tiempo no afecta el cálculo del OEE.'; }
$('cJor').addEventListener('change', notaJornada);
function pintarLista(){
  const c = $('cLista'); c.innerHTML = '';
  cerrando.items.forEach(function(it,i){
    c.insertAdjacentHTML('beforeend','<div class="punto"><div class="t">'+esc(it.act)+'</div>'+
      '<div class="c">Criterio: '+esc(it.crit)+'</div><div class="op">'+
      '<button data-si="'+i+'" class="'+(it.ok === true?'si':'')+'">Conforme</button>'+
      '<button data-no="'+i+'" class="'+(it.ok === false?'no':'')+'">No conforme</button>'+
      '<span class="mini tenue">'+it.min+' min</span></div>'+
      (it.ok === false ? '<textarea data-nota="'+i+'" placeholder="Describe el hallazgo">'+esc(it.nota)+'</textarea>':'')+'</div>'); });
  c.querySelectorAll('[data-si]').forEach(b => b.onclick = function(){
    cerrando.items[+b.dataset.si].ok = true; cerrando.items[+b.dataset.si].nota = ''; pintarLista(); validarCierre(); });
  c.querySelectorAll('[data-no]').forEach(b => b.onclick = function(){
    cerrando.items[+b.dataset.no].ok = false; pintarLista(); validarCierre(); });
  c.querySelectorAll('[data-nota]').forEach(t => t.oninput = function(){
    cerrando.items[+t.dataset.nota].nota = t.value; validarCierre(); }); }
$('cFoto').onchange = function(e){
  const f = e.target.files[0]; if(!f) return;
  const r = new FileReader();
  r.onload = function(){ fotoTmp = r.result; $('cPreview').innerHTML = '<img src="'+fotoTmp+'">'; validarCierre(); };
  r.readAsDataURL(f); };
$('cObs').addEventListener('input', validarCierre);
function validarCierre(){
  if(!cerrando) return;
  const sinResp = cerrando.items.filter(i => i.ok === null).length;
  const sinNota = cerrando.items.filter(i => i.ok === false && i.nota.trim().length < 5).length;
  const obsOK = $('cObs').value.trim().length >= 15;
  $('cConfirmar').disabled = !(!sinResp && !sinNota && !!fotoTmp && obsOK);
  const f = [];
  if(sinResp) f.push('faltan '+sinResp+' punto(s)');
  if(sinNota) f.push(sinNota+' no conformidad(es) sin describir');
  if(!fotoTmp) f.push('falta la evidencia');
  if(!obsOK) f.push('la observación necesita 15 caracteres');
  $('cAviso').textContent = f.join('. '); }
$('cConfirmar').onclick = function(){
  if(!cerrando) return;
  cerrando.evidencia = fotoTmp; cerrando.obs = $('cObs').value.trim();
  cerrando.real = +$('cReal').value||cerrando.min; cerrando.estado = 'Ejecutada';
  cerrando.enJornada = $('cJor').value === 'si';
  cerrando.cerradaPor = SESION ? SESION.nombre : '';
  cerrando.cerradaEn = new Date().toLocaleString('es-PE');
  cerrando.items.filter(i => i.ok === false).forEach(function(i){
    ANOM.push({fecha:HOY(), eqId:cerrando.eqId, clase:'No conformidad', punto:i.act, crit:i.crit, nota:i.nota,
      ot:cerrando.id, tipo:cerrando.tipo, por:cerrando.cerradaPor, revisado:false, revPor:null}); });
  if(cerrando.tipo === 'Autónomo' || cerrando.tipo === 'Calidad')
    ANOM.push({fecha:HOY(), eqId:cerrando.eqId, clase:'Observación', punto:cerrando.act,
      crit:'Observación del ejecutante al cierre', nota:cerrando.obs, ot:cerrando.id, tipo:cerrando.tipo,
      por:cerrando.cerradaPor, revisado:false, revPor:null});
  cerrarCapa('telonOT'); pintarAgenda(); pintarHistorial(); pintarAnom(); pintarOEE(); pintarMttoReg(); pintarAutoej(); };
$('cNoCumple').onclick = async function(){
  if(!cerrando) return;
  const m = await pedirL('Tarea no ejecutada', 'Motivo por el que la tarea no se ejecutó (mínimo 5 caracteres):');
  if(!m || m.trim().length < 5){ avisoL('Indica un motivo de al menos 5 caracteres.'); return; }
  cerrando.estado = 'No cumplida'; cerrando.motivoNo = m.trim();
  cerrando.cerradaPor = SESION ? SESION.nombre : '';
  ANOM.push({fecha:HOY(), eqId:cerrando.eqId, clase:'Observación', punto:'Tarea no ejecutada: '+cerrando.act,
    crit:'La tarea estaba programada y no se ejecutó', nota:m.trim(), ot:cerrando.id, tipo:cerrando.tipo,
    por:cerrando.cerradaPor, revisado:false, revPor:null});
  cerrarCapa('telonOT'); pintarAgenda(); pintarHistorial(); pintarAnom(); };
$('cCerrar').onclick = ()=> cerrarCapa('telonOT');
$('dCerrar').onclick = ()=> cerrarCapa('telonDoc');
/* En el visor de claude.ai no se puede imprimir: la orden se convierte a PDF y se ofrece como descarga. */
$('dPdf').onclick = function(){
  const P = window.CMMS && CMMS.pdf;
  if(P && P.enVisor() && window.__PDFVISOR__) P.elementoAPdf($('docOT'), ($('docOT').querySelector('.cab') ? 'Orden_de_trabajo' : 'Documento')+'_'+HOY());
  else window.print(); };

function encabezado(titulo, acento, sub, der){
  return '<div class="cab">'+
    '<div class="logo">'+(LOGOS.emp ? '<img src="'+LOGOS.emp+'">' : 'Espacio para el<br>logo de la empresa')+'</div>'+
    '<div class="tit"><h1>'+titulo+' <em>'+acento+'</em></h1><p>'+sub+'</p></div>'+
    '<div class="cod">'+der+'</div></div>'; }
function firmas(quien){
  return '<div class="firmas">'+
    '<div class="firma"><div class="linea"></div><div class="nom">'+esc(quien||'')+'</div><div class="rol">Ejecutado por</div></div>'+
    '<div class="firma"><div class="linea"></div><div class="nom">Gutiérrez Xiomara</div><div class="rol">Supervisado por</div></div>'+
    '<div class="firma"><div class="linea"></div><div class="nom">Ing. de la Empresa</div><div class="rol">Aprobado por</div></div></div>'+
    '<div class="pie"><span>LEXACAUCHO · Línea de láminas antiabrasivas</span><span>Generado el '+
    new Date().toLocaleDateString('es-PE')+'</span></div>'; }
function verDocumento(id){
  const o = OTS.find(x => x.id === id); if(!o) return;
  let filas = '';
  o.items.forEach(function(i,k){
    filas += '<tr><td>'+(k+1)+'</td><td>'+esc(i.act)+'</td><td>'+esc(i.crit)+'</td><td class="chk">'+i.min+'</td>'+
      '<td class="chk">'+(i.ok === true?'Sí':i.ok === false?'No':'')+'</td><td class="hall">'+esc(i.nota||'')+'</td></tr>'; });
  $('docOT').innerHTML = encabezado('Orden de trabajo de','mantenimiento',
    'Línea de láminas antiabrasivas · Área de laminado',
    '<b>'+o.id+'</b><br>'+o.codigo+'<br>'+o.fecha)+
    '<h2>Datos de la orden</h2><table class="datos"><tbody>'+
    '<tr><th>Equipo</th><td>'+eq(o.eqId).nombre+'</td><th>Pilar</th><td>'+o.tipo+'</td></tr>'+
    '<tr><th>Actividad</th><td colspan="3">'+esc(o.act)+'</td></tr>'+
    '<tr><th>Frecuencia</th><td>'+o.frec+'</td><th>Responsable</th><td>'+o.resp+'</td></tr>'+
    '<tr><th>Tiempo estimado</th><td>'+o.min+' min</td><th>Tiempo real</th><td>'+(o.real != null ? o.real+' min':'—')+'</td></tr>'+
    '<tr><th>Estado</th><td>'+estadoOT(o)+'</td><th>Ejecución</th><td>'+
      (o.estado === 'Ejecutada' ? (o.enJornada ? 'Dentro de la jornada' : 'Fuera de turno') : '—')+'</td></tr>'+
    '<tr><th>Ejecutada por</th><td colspan="3">'+esc(o.cerradaPor||'—')+'</td></tr>'+
    (o.loto ? '<tr><th>Seguridad</th><td colspan="3"><b>Requiere bloqueo y etiquetado antes de iniciar.</b></td></tr>':'')+
    '</tbody></table>'+
    '<h2>Puntos a verificar</h2><table><thead><tr><th>N.º</th><th>Actividad</th><th>Criterio de conformidad</th>'+
    '<th class="chk">Min</th><th class="chk">Conf.</th><th class="hall">Hallazgo</th></tr></thead><tbody>'+filas+'</tbody></table>'+
    '<h2>Observación</h2><table><tbody><tr><td style="height:18mm">'+esc(o.obs||o.motivoNo||'')+'</td></tr></tbody></table>'+
    (o.evidencia ? '<h2>Evidencia</h2><div style="text-align:center"><img src="'+o.evidencia+
      '" style="max-height:70mm;max-width:100%;border:1px solid #d3dae0;border-radius:3px"></div>':'')+
    firmas(o.cerradaPor);
  abrirCapa('telonDoc'); }
function docMaquina(id, fecha){
  const lista = OTS.filter(o => o.eqId === id && o.fecha === fecha);
  if(!lista.length) return;
  let filas = '', n = 0;
  TIPOS.forEach(function(t){
    const s = lista.filter(o => o.tipo === t); if(!s.length) return;
    filas += '<tr><td colspan="6" style="background:#f2f9ef;font-weight:600;color:#1f5c10">Mantenimiento '+t.toLowerCase()+'</td></tr>';
    s.forEach(function(o){ o.items.forEach(function(i){
      n++;
      filas += '<tr><td>'+n+'</td><td>'+esc(i.paso||'')+'</td><td>'+esc(i.act)+(o.loto?' <b>[bloqueo]</b>':'')+'</td>'+
        '<td>'+esc(i.crit)+'</td><td class="chk">'+i.min+'</td><td class="hall"></td></tr>'; }); }); });
  const tot = lista.reduce((a,o)=>a+o.min,0);
  $('docOT').innerHTML = encabezado('Orden de trabajo','diaria',
    'Línea de láminas antiabrasivas · Área de laminado',
    '<b>'+eq(id).nombre+'</b><br>'+eq(id).codigo+'<br>'+fecha)+
    '<h2>Resumen del día</h2><table class="datos"><tbody>'+
    '<tr><th>Equipo</th><td>'+eq(id).nombre+'</td><th>Órdenes</th><td>'+lista.length+'</td></tr>'+
    '<tr><th>Tiempo programado</th><td>'+n1(tot/60)+' horas-hombre</td><th>Requiere bloqueo</th>'+
    '<td>'+(lista.some(o=>o.loto)?'Sí, en las tareas marcadas':'No')+'</td></tr></tbody></table>'+
    '<h2>Tareas del día</h2><table><thead><tr><th>N.º</th><th>Paso</th><th>Actividad</th>'+
    '<th>Criterio de conformidad</th><th class="chk">Min</th><th class="hall">Conforme y hallazgo</th></tr></thead><tbody>'+filas+'</tbody></table>'+
    '<h2>Observaciones del turno</h2><table><tbody><tr><td style="height:22mm"></td></tr></tbody></table>'+
    firmas('');
  abrirCapa('telonDoc'); }

/* ===== anomalías ===== */
let anFiltro = 'todos';
function pintarAnom(){
  const tb = $('anTabla'); tb.innerHTML = '';
  ANOM.slice().reverse().forEach(function(a,i){
    const k = ANOM.length-1-i;
    if(anFiltro === 'pend' && a.revisado) return;
    if(anFiltro !== 'todos' && anFiltro !== 'pend' && a.clase !== anFiltro) return;
    tb.insertAdjacentHTML('beforeend','<tr><td class="chico">'+a.fecha+'</td><td class="nombre">'+nombreEq(a.eqId)+'</td>'+
      '<td><span class="marcador '+(a.clase === 'No conformidad'?'m-bad':'m-info')+'">'+a.clase+'</span></td>'+
      '<td>'+esc(a.punto)+'<div class="sub">'+esc(a.nota)+'</div></td>'+
      '<td class="chico tenue" style="max-width:220px">'+esc(a.crit)+'</td>'+
      '<td class="chico tenue">'+a.ot+'<div class="sub">'+esc(a.por||'')+'</div></td>'+
      '<td>'+(a.revisado ? '<span class="marcador m-ok">Revisado</span><div class="sub">'+esc(a.revPor||'')+'</div>'
        : '<span class="marcador m-warn">Sin revisar</span>')+'</td>'+
      '<td>'+(a.revisado ? '' : '<button class="btn btn-ghost btn-sm" data-rev="'+k+'">Marcar revisado</button>')+'</td></tr>'); });
  tb.querySelectorAll('[data-rev]').forEach(b => b.onclick = function(){
    const a = ANOM[+b.dataset.rev]; a.revisado = true; a.revPor = (SESION?SESION.nombre:'')+', '+HOY(); pintarAnom(); });
  $('anTot').textContent = ANOM.length;
  $('anNC').textContent = ANOM.filter(a => a.clase === 'No conformidad').length;
  $('anObs').textContent = ANOM.filter(a => a.clase === 'Observación').length;
  $('anPend').textContent = ANOM.filter(a => !a.revisado).length;
  const por = {}; ANOM.forEach(a => por[a.eqId] = (por[a.eqId]||0)+1);
  const k = Object.keys(por).sort((a,b)=>por[b]-por[a])[0];
  $('anEq').textContent = k ? nombreEq(k) : '–'; }
document.querySelectorAll('#anFiltro .pest').forEach(function(t){
  t.onclick = function(){ document.querySelectorAll('#anFiltro .pest').forEach(x=>x.classList.remove('on'));
    t.classList.add('on'); anFiltro = t.dataset.f; pintarAnom(); }; });

/* ===== documentos PDF por filtro =====
   Cada filtro del programa, del historial y de las anomalías emite su propio PDF con el estilo del sistema
   (motor único de impresión en src/app/ui/pdf.js). */
function pdfCMMS(){ return window.CMMS && CMMS.pdf; }
const minH = m => n1(m/60)+' h';
function pdfPlan(){
  const P = pdfCMMS(); if(!P) return;
  const fams = planEqF === 'todos' ? FAMILIAS : [planEqF];
  const tipos = planFiltro === 'todos' ? TIPOS : [planFiltro];
  const cols = [{t:'N.º'},{t:'Paso'},{t:'Actividad'},{t:'Criterio de conformidad'},{t:'Frecuencia'},{t:'Responsable'},{t:'Min',n:true}];
  const secciones = [], resumen = [];
  let nTot = 0, minTot = 0, otsTot = 0, hOT = 0;
  fams.forEach(function(fam){
    const unid = fam === 'caldero' ? 2 : fam === 'prensa' ? 5 : 1;
    const ts = tareasDe(fam).filter(t => tipos.indexOf(t.tipo) >= 0); if(!ts.length) return;
    let html = '', n = 0;
    tipos.forEach(function(tp){
      const g = ts.filter(t => t.tipo === tp); if(!g.length) return;
      g.sort((a,b)=> DIAS_FREC[a.frec]-DIAS_FREC[b.frec]);
      if(tipos.length > 1) html += '<h3>Mantenimiento '+tp.toLowerCase()+'</h3>';
      html += P.tablaPDF(cols, g.map(t => [++n, t.paso||'', {html: esc(t.act)+(t.loto?' <span class="chip bad">bloqueo</span>':'')}, t.crit||'', t.frec+' (cada '+DIAS_FREC[t.frec]+' d)', t.resp, t.min])); });
    const ots = OTS.filter(o => eq(o.eqId).familia === fam && tipos.indexOf(o.tipo) >= 0);
    const ej = ots.filter(o => o.estado === 'Ejecutada').length, vence = ots.filter(o => o.estado !== 'Ejecutada' && o.fecha < HOY()).length;
    const minF = ts.reduce((a,t)=>a+t.min,0), minO = ots.reduce((a,o)=>a+o.min,0);
    nTot += ts.length; minTot += minF; otsTot += ots.length; hOT += minO;
    resumen.push([NOM_FAM[fam], unid, ts.length, minF, ots.length, ej, vence, minH(minO), ej+vence ? pc(ej/(ej+vence)) : '—']);
    secciones.push({ titulo: NOM_FAM[fam]+(unid > 1 ? ' ('+unid+' unidades)' : ''), html }); });
  if(!secciones.length){ avisoL('El filtro actual no tiene tareas.'); return; }
  secciones.unshift({ titulo: 'Resumen por equipo', html: P.tablaPDF([{t:'Equipo'},{t:'Unid.',n:true},{t:'Tareas',n:true},{t:'Min por ciclo',n:true},{t:'Órdenes del periodo',n:true},{t:'Ejecutadas',n:true},{t:'Vencidas',n:true},{t:'Horas-hombre',n:true},{t:'Cumplimiento',n:true}], resumen) +
    '<p class="nota">Las órdenes planificadas y de calidad ejecutadas en jornada descuentan del tiempo de carga del equipo en el cálculo del OEE.</p>' });
  P.imprimir({ titulo: 'Plan maestro', acento: planFiltro === 'todos' ? 'de mantenimiento' : planFiltro.toLowerCase(),
    subtitulo: 'Línea de láminas antiabrasivas · programa desde '+PROG.ini+' · '+PROG.meses+' meses',
    archivo: 'Plan_'+(planFiltro === 'todos' ? 'todos' : planFiltro.normalize('NFD').replace(/[^\w]/g,''))+'_'+(planEqF === 'todos' ? 'linea' : planEqF),
    filtros: ['Pilar: '+(planFiltro === 'todos' ? 'todos' : planFiltro), 'Equipo: '+(planEqF === 'todos' ? 'todos' : NOM_FAM[planEqF])],
    kpis: [[String(nTot),'Tareas'],[minH(minTot),'Duración de un ciclo'],[n0(otsTot),'Órdenes del periodo'],[n0(hOT/60)+' h','Horas-hombre programadas']],
    secciones, firmas: true }); }
function pdfHistorial(){
  const P = pdfCMMS(); if(!P) return;
  const d1 = $('hDesde').value || PROG.ini, d2 = $('hHasta').value || HOY(), fe = $('hEq').value, ft = $('hTipo').value;
  const lista = OTS.filter(o => o.fecha >= d1 && o.fecha <= d2 && (!fe || fe === 'todos' || o.eqId === fe) && (!ft || o.tipo === ft));
  const por = {};
  lista.forEach(function(o){ const k = eq(o.eqId).nombre, s = estadoOT(o), r = por[k] = por[k] || {n:0,c:0,no:0,p:0,h:0};
    r.n++; if(s === 'Cumplida'){ r.c++; if(o.enJornada) r.h += (o.real != null ? o.real : o.min)/60; } else if(s === 'Programada') r.p++; else r.no++; });
  const T = Object.values(por).reduce((a,r)=>({n:a.n+r.n,c:a.c+r.c,no:a.no+r.no,p:a.p+r.p,h:a.h+r.h}),{n:0,c:0,no:0,p:0,h:0});
  const cum = r => r.c+r.no ? pc(r.c/(r.c+r.no)) : '—';
  const inc = lista.filter(o => estadoOT(o) !== 'Cumplida' && estadoOT(o) !== 'Programada');
  P.imprimir({ titulo: 'Historial de', acento: 'cumplimiento', archivo: 'Historial_cumplimiento',
    filtros: ['Desde '+d1, 'Hasta '+d2, 'Equipo: '+(fe && fe !== 'todos' ? eq(fe).nombre : 'todos'), 'Pilar: '+(ft || 'todos')],
    kpis: [[n0(T.n),'Órdenes'],[n0(T.c),'Cumplidas'],[n0(T.no),'No cumplidas o vencidas'],[cum(T),'Cumplimiento'],[n1(T.h)+' h','Horas en jornada']],
    secciones: [
      { titulo: 'Resumen por equipo', html: P.tablaPDF([{t:'Equipo'},{t:'Órdenes',n:true},{t:'Cumplidas',n:true},{t:'No cumplidas',n:true},{t:'Programadas',n:true},{t:'Horas',n:true},{t:'Cumplimiento',n:true}],
        Object.keys(por).map(k => [k, por[k].n, por[k].c, por[k].no, por[k].p, n1(por[k].h), cum(por[k])]).concat([['Total', T.n, T.c, T.no, T.p, n1(T.h), cum(T)]]), Object.keys(por).map(()=>'').concat(['tot'])) },
      { titulo: 'Órdenes no cumplidas o vencidas ('+inc.length+')', html: inc.length ? P.tablaPDF([{t:'Fecha'},{t:'OT'},{t:'Equipo'},{t:'Pilar'},{t:'Actividad'},{t:'Estado'}],
        inc.map(o => [o.fecha, o.id, eq(o.eqId).nombre, o.tipo, o.act+(o.motivoNo?' · '+o.motivoNo:''), {html:'<span class="chip bad">'+estadoOT(o)+'</span>'}])) : '<p class="nota">Sin incumplimientos en el filtro.</p>' }
    ], firmas: true }); }
function pdfAnom(){
  const P = pdfCMMS(); if(!P) return;
  const lista = ANOM.filter(a => anFiltro === 'todos' || (anFiltro === 'pend' ? !a.revisado : a.clase === anFiltro)).slice().reverse();
  if(!lista.length){ avisoL('El filtro actual no tiene registros.'); return; }
  const por = {}; lista.forEach(a => { const k = nombreEq(a.eqId); por[k] = por[k] || {nc:0,ob:0,p:0}; if(a.clase === 'No conformidad') por[k].nc++; else por[k].ob++; if(!a.revisado) por[k].p++; });
  P.imprimir({ titulo: 'Registro de', acento: 'anomalías', archivo: 'Anomalias',
    filtros: ['Filtro: '+(anFiltro === 'todos' ? 'todos' : anFiltro === 'pend' ? 'sin revisar' : anFiltro)],
    kpis: [[String(lista.length),'Registros'],[String(lista.filter(a => a.clase === 'No conformidad').length),'No conformidades'],[String(lista.filter(a => !a.revisado).length),'Sin revisar']],
    secciones: [
      { titulo: 'Resumen por equipo', html: P.tablaPDF([{t:'Equipo'},{t:'No conformidades',n:true},{t:'Observaciones',n:true},{t:'Sin revisar',n:true}], Object.keys(por).map(k => [k, por[k].nc, por[k].ob, por[k].p])) },
      { titulo: 'Detalle', html: P.tablaPDF([{t:'Fecha'},{t:'Equipo'},{t:'Clase'},{t:'Detalle'},{t:'Criterio'},{t:'Origen'},{t:'Revisión'}],
        lista.map(a => [a.fecha, nombreEq(a.eqId), {html:'<span class="chip '+(a.clase === 'No conformidad'?'bad':'warn')+'">'+esc(a.clase)+'</span>'}, a.punto+(a.nota?' · '+a.nota:''), a.crit||'', a.ot+(a.por?' · '+a.por:''), a.revisado ? 'Revisado '+(a.revPor||'') : 'Sin revisar'])) }
    ], firmas: true }); }
$('planPdf').onclick = pdfPlan; $('hPdf').onclick = pdfHistorial; $('anPdf').onclick = pdfAnom;

/* ===== OEE =====
   El cálculo del OEE ya no vive aquí: lo hace el módulo único src/core/oee.js (window.CMMS).
   Se retiraron los datos de ejemplo que este archivo sembraba en memoria. */
function pintarOEE(){ if(window.CMMS && CMMS.alCambiarLegado) CMMS.alCambiarLegado(); }
const LEG_A_ID = {molino:'MOL', extruder:'EXT', prensa1:'PR1', prensa2:'PR2', prensa3:'PR3', prensa4:'PR4', prensa5:'PR5', autoclave:'AUT', caldero1:'CAL1', caldero2:'CAL2'};
/* Lleva disponibilidad, rendimiento, calidad, MTBF y MTTR calculados desde los registros a la animación. */
function alSimulador(){
  const r = window.CMMS && CMMS.resultado(); if(!r) return 0;
  let n = 0;
  Object.keys(LEG_A_ID).forEach(function(id){
    const x = r.maquina[LEG_A_ID[id]]; const e = M.equipos[id]; if(!x || !e) return;
    const t = x.total; if(!(t.carga > 0)) return;
    e.D = Math.round(t.D*1000)/10; e.R = Math.round(t.R*1000)/10; e.C = Math.round(t.Q*1000)/10;
    const c = r.confiabilidad.find(k => k.id === LEG_A_ID[id]);
    if(c && c.mtbf) { e.mtbf = Math.round(c.mtbf*10)/10; e.mttr = Math.round(c.mttr*100)/100; }
    if(S && S.maq[id]) programarFalla(id); n++; });
  if(S) refrescar(); return n; }
/* ===== administración ===== */
function pintarSistema(){
  const d = dISO(FECHA_SIS), mot = motivoFeriado(d), om = omision(d);
  $('sysEstado').textContent = esLaborable(d) ? 'Día laborable' : (mot ? 'Feriado' : om ? 'Periodo omitido' : 'Domingo');
  $('sysEstado2').textContent = fechaLarga(d)+(mot ? '. '+mot : om ? '. '+om.motivo : '');
  $('chipFecha').textContent = fechaLarga(d); }
function fijarFecha(f){ FECHA_SIS = f; $('sysFecha').value = f; pintarSistema(); pintarAgenda(); pintarHistorial(); }
$('sysFecha').addEventListener('change', function(){ if(this.value) fijarFecha(this.value); });
$('sysReal').onclick = function(){ fijarFecha(iso(new Date())); };
$('sysM1').onclick = function(){ const d = dISO(FECHA_SIS); d.setDate(d.getDate()-1); fijarFecha(iso(d)); };
$('sysP1').onclick = function(){ const d = dISO(FECHA_SIS); d.setDate(d.getDate()+1); fijarFecha(iso(d)); };
$('sysP7').onclick = function(){ const d = dISO(FECHA_SIS); d.setDate(d.getDate()+7); fijarFecha(iso(d)); };

/* ===== usuarios ===== */
function pintarUsuarios(){
  const tb = $('usTabla'); tb.innerHTML = '';
  USUARIOS.forEach(function(u,i){
    const bg = u.rol === 'Administrador' ? 'm-ok' : u.rol.indexOf('Ingeniero') === 0 ? 'm-info'
      : u.rol.indexOf('Técnico') === 0 ? 'm-warn' : 'm-bad';
    tb.insertAdjacentHTML('beforeend','<tr><td class="nombre">'+esc(u.nombre)+'</td><td>'+esc(u.user)+'</td>'+
      '<td class="chico">•••••• <button class="btn btn-ghost btn-sm" data-rc="'+i+'" title="Restablecer clave"><i class="fas fa-key"></i></button></td>'+
      '<td><span class="marcador '+bg+'">'+u.rol+'</span></td><td class="chico tenue">'+ALCANCE[u.rol]+'</td>'+
      '<td>'+(i === 0?'<span class="chico tenue">principal</span>':'<button class="btn btn-danger btn-sm" data-du="'+i+'"><i class="fas fa-trash"></i></button>')+'</td></tr>'); });
  tb.querySelectorAll('[data-du]').forEach(b => b.onclick = async function(){
    if(!SESION || SESION.rol !== 'Administrador'){ avisoL('Solo un administrador puede eliminar usuarios.'); return; }
    if(!(await pedirClave('Eliminar al usuario '+USUARIOS[+b.dataset.du].user+'.'))) return;
    USUARIOS.splice(+b.dataset.du,1); pintarUsuarios(); pintarOEE(); });
  tb.querySelectorAll('[data-rc]').forEach(b => b.onclick = async function(){
    const x = USUARIOS[+b.dataset.rc];
    if(!SESION || (SESION !== x && SESION.rol !== 'Administrador')){ avisoL('Solo el propio usuario o un administrador puede cambiar esta clave.'); return; }
    if(!(await pedirClave('Restablecer la clave de '+x.user+'.'))) return;
    const n = await pedirL('Nueva clave', 'Nueva clave para '+x.user+' (mínimo 6 caracteres):', 'password');
    if(n == null) return; if(n.length < 6){ avisoL('La clave debe tener al menos 6 caracteres.'); return; }
    x.hash = await hashClave(x.user, n); delete x.pass; pintarOEE(); avisoL('Clave actualizada.', 'ok'); }); }
$('verClaves').onclick = function(){
  avisoL('Por seguridad las claves se guardan cifradas (SHA-256) y no pueden mostrarse. Use el botón de llave de cada usuario para restablecerla.'); };
$('nuAdd').onclick = async function(){
  const n = $('nuNombre').value.trim(), u = $('nuUser').value.trim(), p = $('nuPass').value.trim();
  if(!n||!u||!p){ avisoL('Completa nombre, usuario y clave.'); return; }
  if(!SESION || SESION.rol !== 'Administrador'){ avisoL('Solo un administrador puede crear usuarios.'); return; }
  if(p.length < 4){ avisoL('La clave debe tener al menos 4 caracteres.'); return; }
  if(USUARIOS.some(x => x.user.toLowerCase() === u.toLowerCase())){ avisoL('Ese usuario ya existe.'); return; }
  USUARIOS.push({nombre:n,user:u,hash:await hashClave(u,p),rol:$('nuRol').value});
  ['nuNombre','nuUser','nuPass'].forEach(i => $(i).value = ''); pintarUsuarios(); pintarOEE(); };

/* ===== navegación ===== */
function cargarGlobales(){ fichaVista(); pintarCiclos(); pintarTraslados(); pintarJornadaAdm(); }
/* Jornada: solo lectura, sale de Parámetros del periodo. */
function pintarJornadaAdm(){
  const J = M.jornada, fin = (+J.inicio.slice(0,2) + J.turnos*(J.horas+J.almuerzo)) % 24;
  $('admJornada').innerHTML = [[J.inicio+' – '+String(fin).padStart(2,'0')+J.inicio.slice(2), 'Ventana operativa'], [J.turnos+' × '+J.horas+' h', 'Turnos × horas netas'],
    [J.almuerzo+' h', 'Almuerzo por turno'], [J.cap+' h · '+DIAS_SEM[J.capDia], 'Capacitación semanal por turno'], [PROG.ini+' · '+PROG.meses+' meses', 'Programa de mantenimiento']]
    .map(x => '<div class="m"><div class="v" style="font-size:1rem">'+x[0]+'</div><div class="k">'+x[1]+'</div></div>').join(''); }
document.querySelectorAll('#menu a').forEach(function(a){
  a.onclick = function(){
    document.querySelectorAll('#menu a').forEach(x=>x.classList.remove('activo'));
    a.classList.add('activo');
    document.querySelectorAll('.vista').forEach(v=>v.classList.remove('on'));
    $('v-'+a.dataset.vista).classList.add('on');
    const p = a.dataset.tit.split('|');
    $('vTit').innerHTML = p[0]+' <span>'+p[1]+'</span>';
    $('vTit').dataset.v = a.dataset.vista;
    $('vSub').textContent = a.dataset.sub;
    window.scrollTo({top:0});
    if(a.dataset.vista === 'sim'){ dibujar(); encajar(); refrescar(); }
    if(a.dataset.vista === 'plan') pintarPlan();
    if(a.dataset.vista === 'agenda'){ pintarAgenda(); pintarHistorial(); }
    if(a.dataset.vista === 'espec'){ pintarCiclos(); pintarTraslados(); }
    if(window.CMMS && CMMS.alNavegar) CMMS.alNavegar(a.dataset.vista); }; });
function llenarSelects(){
  $('planEqF').innerHTML = '<option value="todos">Todos los equipos</option>'+
    FAMILIAS.map(f => '<option value="'+f+'">'+NOM_FAM[f]+'</option>').join('');
  $('hEq').innerHTML = '<option value="todos">Todos los equipos</option>'+
    equiposMant().map(k => '<option value="'+k+'">'+eq(k).nombre+'</option>').join(''); }
let arrancado = false;
function arrancarApp(){
  if(arrancado){ dibujar(); encajar(); refrescar(); return; }
  arrancado = true;
  llenarSelects(); cargarGlobales(); inicializar();
  dibujar(); requestAnimationFrame(encajar); refrescar();
  const hoy = iso(new Date());
  if(!PROG.ini){ const d0 = new Date(); d0.setMonth(d0.getMonth()-3); d0.setDate(1); PROG.ini = iso(d0); PROG.meses = 12; }
  $('sysFecha').value = FECHA_SIS; $('agFecha').value = FECHA_SIS;
  $('hDesde').value = PROG.ini; $('hHasta').value = hoy;
  generarOTs(); pintarAnom();
  pintarUsuarios(); pintarSistema(); aplicarLogos();
  if(window.CMMS && CMMS.alIniciarSesion) CMMS.alIniciarSesion(SESION); }
/* Persistencia del estado propio de los módulos heredados (plan, órdenes, anomalías, usuarios, marca,
   calendario de mantenimiento y parámetros de la animación). Lo guarda src/app/persistencia.js en IndexedDB. */
window.LEGADO = {
  instantanea(){ return { M, PROG, OTS, ANOM, SEQ, USUARIOS, LOGOS, FECHA_SIS, PLANES }; },
  restaurar(o){
    if(!o) return;
    if(o.M){ const b = base(); M = Object.assign(b, o.M); M.equipos = Object.assign(b.equipos, o.M.equipos||{}); }
    if(o.PROG) PROG = o.PROG; if(o.OTS) OTS = o.OTS; if(o.ANOM) ANOM = o.ANOM; if(o.SEQ != null) SEQ = o.SEQ;
    if(o.USUARIOS && o.USUARIOS.length) USUARIOS = o.USUARIOS; if(o.LOGOS) LOGOS = o.LOGOS;
    if(o.FECHA_SIS) FECHA_SIS = o.FECHA_SIS;
    if(o.PLANES) Object.keys(o.PLANES).forEach(k => PLANES[k] = o.PLANES[k]);
    aplicarLogos(); },
  alSimulador, asegurarHashes,
  /* Tras recibir datos de otro usuario (base compartida del artefacto) se repintan los módulos heredados. */
  refrescarTodo(){ if(!arrancado) return; [llenarSelects, pintarPlan, pintarAgenda, pintarHistorial, pintarAnom, pintarUsuarios, pintarSistema].forEach(f => { try { f(); } catch(e){ console.error(e); } }); },
  /* Recibe de Parámetros la jornada, los feriados, los periodos omitidos, las capacidades del catálogo, los lotes
     de la simulación y el inicio del programa de mantenimiento (independiente del periodo de datos recolectados). */
  sincronizar(c){
    const P = c.periodo, J = M.jornada;
    Object.assign(J, { inicio: P.hora_inicio, turnos: P.turnos_dia, almuerzo: P.horas_almuerzo, horas: P.horas_turno - P.horas_almuerzo,
      cap: P.horas_capacitacion, capDia: P.dia_capacitacion || 1, dias: Math.round(c.laborables / 12) || J.dias });
    MASA_EXT = +P.masa_unitaria_kg || null;
    FER_CMMS = {}; RANGOS_CMMS = c.periodos.map(p => [p.fecha_inicio, p.fecha_fin]);
    c.periodos.forEach(p => (p.feriados || []).forEach(f => FER_CMMS[f.fecha] = f.motivo));
    const omAntes = JSON.stringify(OMIT_CMMS); OMIT_CMMS = (c.omisiones || []).slice();
    const cat = {}; c.equipos.forEach(e => cat[e.id] = e);
    Object.keys(LEG_A_ID).forEach(function(id){ const e = M.equipos[id], x = cat[LEG_A_ID[id]]; if(!e || !x) return;
      e.activo = x.activo; if(x.capacidad_ficha && id !== 'extruder'){ e.cap = x.capacidad_ficha; e.uni = x.unidad === 'kg/h' ? 'kg/h' : 'und/h'; } });
    M.proceso.loteKg = c.sim.molino_lote_kg; M.proceso.cargaKg = c.sim.molino_lote_kg;
    if(cat.EXT && cat.EXT.capacidad_ficha) M.proceso.cicloMin = Math.round(c.sim.molino_lote_kg*60/cat.EXT.capacidad_ficha*100)/100;
    M.proceso.laminasAutoclave = c.sim.autoclave_lote;
    M.equipos.acabado.cap = Math.round(c.sim.acabado_lam_h*kgLamina()); M.equipos.acabado.uni = 'kg/h';
    const G = c.programa || {inicio: P.fecha_inicio, meses: 12};
    const cambia = PROG.ini !== G.inicio || PROG.meses !== G.meses || omAntes !== JSON.stringify(OMIT_CMMS);
    PROG.ini = G.inicio; PROG.meses = G.meses;
    if(arrancado){ if(cambia) generarOTs(); cargarGlobales(); llenarSelects(); pintarSistema(); if(S) refrescar(); }
    return cambia; },
  sesion(){ return SESION; }
};
window.addEventListener('resize', function(){ if(SESION){ dibujar(); encajar(); } });
