(function(){
  "use strict";

  /* ============================================================
     CONFIG — mesmo projeto Supabase do portal (index.html da raiz)
     ============================================================ */
  const SUPABASE_URL = "https://kqrpjjyyzojtpknwelxc.supabase.co";
  const SUPABASE_ANON_KEY = "sb_publishable_1QM8Tnw7rOJLzvtJ4VaTKw_UNe2uJCr";

  const DRIVER_EMAIL_DOMAIN = "motorista.local";   // igual ao de logistica/netlify/functions/lg-users.js
  const USERS_FN = "/.netlify/functions/lg-users";
  const BUCKET = "comprovantes";

  // Rastreamento: em movimento envia a cada 30 s; parado, um "sinal de vida" a cada 2 min
  const SEND_INTERVAL_MS = 30 * 1000;
  const HEARTBEAT_MS = 2 * 60 * 1000;
  const MIN_DISTANCE_M = 80;
  const ONLINE_MIN = 5;    // posição com menos de 5 min  → motorista "online"
  const RECENT_MIN = 30;   // posição com menos de 30 min → "recente"

  const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  /* ============================================================
     ICONS
     ============================================================ */
  const ICONS = {
    truck: '<rect x="1" y="7" width="15" height="10" rx="1"/><path d="M16 10h3.5L22 13.5V17h-6"/><circle cx="5.5" cy="18.5" r="1.8"/><circle cx="17.5" cy="18.5" r="1.8"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>',
    map: '<polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/>',
    list: '<line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><circle cx="3.5" cy="6" r="1"/><circle cx="3.5" cy="12" r="1"/><circle cx="3.5" cy="18" r="1"/>',
    upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
    building: '<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01M16 6h.01M12 6h.01M12 10h.01M12 14h.01M16 10h.01M16 14h.01M8 10h.01M8 14h.01"/>',
    users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
    edit: '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5Z"/>',
    trash: '<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
    file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>',
    camera: '<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>',
    play: '<polygon points="6 3 20 12 6 21 6 3"/>',
    check: '<polyline points="20 6 9 17 4 12"/>',
    nav: '<polygon points="3 11 22 2 13 21 11 13 3 11"/>',
    pin: '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>',
    x: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
    refresh: '<polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>',
    clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>'
  };
  function icon(name){
    return `<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ""}</svg>`;
  }
  document.querySelectorAll("[data-icon]").forEach(el => { el.innerHTML = icon(el.dataset.icon); });

  /* ============================================================
     UTILS
     ============================================================ */
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  const esc = (v) => String(v == null ? "" : v).replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
  const digits = (v) => String(v == null ? "" : v).replace(/\D/g, "");
  const fmtCpf = (v) => { const d = digits(v); return d.length === 11 ? d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4") : (v || ""); };
  const fmtCnpj = (v) => { const d = digits(v); return d.length === 14 ? d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5") : (v || ""); };
  const initials = (n) => String(n || "?").trim().split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]).join("").toUpperCase() || "?";
  const isSyntheticEmail = (e) => String(e || "").endsWith("@" + DRIVER_EMAIL_DOMAIN);

  function fmtDateTime(ts){
    if (!ts) return "—";
    const d = new Date(ts);
    return d.toLocaleDateString("pt-BR") + " " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  }
  function fmtDate(d){
    if (!d) return "—";
    const [y, m, day] = String(d).slice(0, 10).split("-");
    return `${day}/${m}/${y}`;
  }
  function minutesAgo(ts){ return ts ? (Date.now() - new Date(ts).getTime()) / 60000 : Infinity; }
  function timeAgo(ts){
    if (!ts) return "sem posição";
    const m = minutesAgo(ts);
    if (m < 1) return "agora";
    if (m < 60) return `há ${Math.floor(m)} min`;
    if (m < 60 * 24) return `há ${Math.floor(m / 60)} h`;
    return fmtDateTime(ts);
  }
  function freshness(ts){
    const m = minutesAgo(ts);
    return m <= ONLINE_MIN ? "online" : m <= RECENT_MIN ? "recent" : "";
  }
  function distanceM(a, b){
    const R = 6371000, toRad = (x) => x * Math.PI / 180;
    const dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  }
  function todayStartISO(){ const d = new Date(); d.setHours(0, 0, 0, 0); return d.toISOString(); }
  function debounce(fn, ms){ let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }
  function errMsg(e){ return (e && (e.message || e.error_description || e.error)) || String(e); }

  // Nome do motorista da rota: o cadastrado no app ou, se ainda não tem acesso, o que veio no arquivo
  function routeDriverHtml(r){
    if (r.driver_id) return esc(userName(r.driver_id));
    if (r.motorista_nome) return `${esc(r.motorista_nome)} <span class="badge st-pendente" title="Motorista ainda sem acesso ao app">sem acesso</span>`;
    return `<span class="badge st-pendente">Definir</span>`;
  }
  const routeDriverText = (r) => (r.driver_id ? userName(r.driver_id) : (r.motorista_nome || ""));
  const fmtQtd = (r) => (r.peso == null ? "—" : String(r.peso).replace(".", ",") + (r.unidade ? " " + r.unidade : ""));
  function fmtJanela(r){
    if (!r.periodo_inicio) return "—";
    const a = new Date(r.periodo_inicio), b = r.periodo_fim ? new Date(r.periodo_fim) : null;
    const hm = (d) => d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    const sameDay = b && a.toDateString() === b.toDateString();
    return `${a.toLocaleDateString("pt-BR")} ${hm(a)}` + (b ? ` – ${sameDay ? "" : b.toLocaleDateString("pt-BR") + " "}${hm(b)}` : "");
  }
  const fmtDoc = (v) => { const d = digits(v); return d.length === 11 ? fmtCpf(d) : (d || ""); };

  const STATUS_LABEL = { pendente: "Pendente", em_rota: "Em rota", entregue: "Entregue", cancelada: "Cancelada" };
  const ROLE_LABEL = { contratante: "Contratante", transportadora: "Transportadora", motorista: "Motorista" };
  const statusBadge = (s) => `<span class="badge st-${esc(s)}">${esc(STATUS_LABEL[s] || s)}</span>`;

  /* ---------- toast ---------- */
  let toastTimer = null;
  function toast(msg, isErr){
    const el = $("#toast");
    $("#toast-text").textContent = msg;
    el.classList.toggle("err", !!isErr);
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("show"), isErr ? 5000 : 2800);
  }

  /* ---------- modal ---------- */
  let modalCleanup = null;
  function openModal(html, opts){
    closeModal();
    const body = $("#modal-body");
    body.className = "modal" + (opts && opts.wide ? " wide" : "");
    body.innerHTML = html;
    $("#modal-overlay").hidden = false;
    $$("[data-close]", body).forEach(b => b.addEventListener("click", closeModal));
    return body;
  }
  function closeModal(){
    if (modalCleanup) { try { modalCleanup(); } catch (_) {} modalCleanup = null; }
    $("#modal-overlay").hidden = true;
    $("#modal-body").innerHTML = "";
  }
  $("#modal-overlay").addEventListener("mousedown", (e) => { if (e.target.id === "modal-overlay") closeModal(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !$("#modal-overlay").hidden) closeModal(); });
  const modalHead = (title, sub) => `
    <div class="modal-head">
      <div><h3>${title}</h3>${sub ? `<div class="muted small" style="margin-top:4px;">${sub}</div>` : ""}</div>
      <button class="modal-close" data-close aria-label="Fechar">${icon("x")}</button>
    </div>`;
  function confirmDialog(title, text, okLabel, danger){
    return new Promise((resolve) => {
      const m = openModal(`${modalHead(esc(title))}
        <p style="margin:0;line-height:1.55;">${text}</p>
        <div class="form-actions">
          <button class="btn btn-ghost" data-close>Cancelar</button>
          <button class="btn ${danger ? "btn-danger" : "btn-primary"}" id="cf-ok">${esc(okLabel || "Confirmar")}</button>
        </div>`);
      let done = false;
      modalCleanup = () => { if (!done) resolve(false); };
      $("#cf-ok", m).addEventListener("click", () => { done = true; closeModal(); resolve(true); });
    });
  }
  function setFormError(el, msg){ el.textContent = msg || ""; el.style.display = msg ? "block" : "none"; }

  /* ---------- atualização automática ---------- */
  // Recarrega a tela a cada `ms` enquanto a aba estiver visível, e logo ao voltar para a aba.
  // Funciona mesmo se o Realtime do Supabase estiver desligado ou a conexão cair.
  function autoRefresh(fn, ms){
    let busy = false;
    const run = async () => {
      if (busy || document.visibilityState !== "visible") return;
      busy = true;
      try { await fn(); markUpdated(); } catch (_) { /* tenta de novo no próximo ciclo */ }
      busy = false;
    };
    const timer = setInterval(run, ms);
    const onVisible = () => { if (document.visibilityState === "visible") run(); };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    teardown.push(() => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    });
    return run;
  }
  const liveBadge = () => `<span class="live" title="A tela se atualiza sozinha"><span class="live-dot"></span>Ao vivo · <span class="live-at">${new Date().toLocaleTimeString("pt-BR")}</span></span>`;
  function markUpdated(){ $$(".live-at").forEach(el => { el.textContent = new Date().toLocaleTimeString("pt-BR"); }); }

  /* ---------- links temporários dos comprovantes (bucket privado) ---------- */
  const signedCache = new Map();   // storage_path -> { url, exp }
  async function signDocs(docs){
    const now = Date.now();
    const need = Array.from(new Set(docs.map(d => d.storage_path))).filter(p => { const c = signedCache.get(p); return !c || c.exp < now; });
    if (need.length) {
      const { data } = await sb.storage.from(BUCKET).createSignedUrls(need, 3600);
      (data || []).forEach(s => { if (s.signedUrl) signedCache.set(s.path, { url: s.signedUrl, exp: now + 50 * 60 * 1000 }); });
    }
    return (path) => (signedCache.get(path) || {}).url;
  }

  // Cartões de comprovante (Painel e aba Comprovantes). `docs` vem com lg_routes(...) embutido.
  function docTilesHtml(docs, urlOf){
    return docs.map(d => {
      const r = d.lg_routes || {};
      const url = urlOf(d.storage_path);
      const isImg = /^image\//.test(d.mime_type);
      const thumb = isImg && url ? `<img src="${esc(url)}" alt="" loading="lazy">` : `<span class="doc-tile-icon">${icon("file")}<small>${esc((d.file_name.split(".").pop() || "").toUpperCase())}</small></span>`;
      return `<div class="doc-tile">
        ${url ? `<a class="doc-tile-thumb" href="${esc(url)}" target="_blank" rel="noopener" title="Abrir ${esc(d.file_name)}">${thumb}</a>` : `<div class="doc-tile-thumb">${thumb}</div>`}
        <div class="doc-tile-body">
          <div class="doc-tile-code">${esc(r.codigo || "—")}</div>
          <div class="muted small ellipsis">${esc(r.cliente || r.destino || "")}</div>
          <div class="muted small ellipsis">${esc(userName(d.uploaded_by))}${isContratante() && r.carrier_id ? " · " + esc(carrierName(r.carrier_id)) : ""}</div>
          <div class="muted small">${fmtDateTime(d.created_at)}</div>
        </div>
        <div class="doc-tile-actions">
          ${url ? `<a class="btn btn-ghost btn-sm" href="${esc(url)}" target="_blank" rel="noopener">Abrir</a>` : ""}
          <button class="btn btn-ghost btn-sm" data-open-route="${esc(d.route_id)}">Rota</button>
        </div>
      </div>`;
    }).join("");
  }
  const DOC_SELECT = "id,route_id,file_name,mime_type,storage_path,size_bytes,created_at,uploaded_by,lg_routes(codigo,cliente,destino,carrier_id,driver_id,status)";

  // Clique em qualquer [data-open-route] da tela abre o detalhe da rota
  document.addEventListener("click", (e) => {
    const el = e.target.closest && e.target.closest("[data-open-route]");
    if (!el || !$("#app") || $("#app").hidden) return;
    e.preventDefault();
    openRouteDetail(el.getAttribute("data-open-route"));
  });

  /* ---------- Leaflet ---------- */
  function makeMap(el, opts){
    const map = L.map(el, Object.assign({ zoomControl: true, attributionControl: true }, opts || {})).setView([-15.8, -47.9], 4);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(map);
    return map;
  }
  const pinIcon = (text, cls) => L.divIcon({
    className: "",
    html: `<div class="pin ${cls || ""}"><span>${esc(text)}</span></div>`,
    iconSize: [30, 30], iconAnchor: [15, 30], popupAnchor: [0, -28]
  });

  /* ============================================================
     STATE
     ============================================================ */
  const state = {
    me: null,          // linha de lg_users do usuário logado
    carrier: null,     // transportadora do usuário (transportadora/motorista)
    carriers: [],
    users: [],
    view: null
  };
  let teardown = [];   // funções de limpeza da tela atual (mapas, realtime, timers)
  function runTeardown(){ teardown.forEach(fn => { try { fn(); } catch (_) {} }); teardown = []; }

  const carrierName = (id) => (state.carriers.find(c => c.id === id) || {}).nome || "—";
  const userName = (id) => (state.users.find(u => u.id === id) || {}).nome || (id === state.me?.id ? state.me.nome : "—");
  const drivers = () => state.users.filter(u => u.role === "motorista");
  const isContratante = () => state.me && state.me.role === "contratante";

  async function loadRefs(){
    const [c, u] = await Promise.all([
      sb.from("lg_carriers").select("*").order("nome"),
      sb.from("lg_users").select("*").order("nome")
    ]);
    if (c.error) throw c.error;
    if (u.error) throw u.error;
    state.carriers = c.data || [];
    state.users = u.data || [];
  }

  /* ============================================================
     LOGIN
     ============================================================ */
  const loginForm = $("#login-form");
  const loginError = $("#login-error");
  function showLoginError(msg){ loginError.textContent = msg; loginError.style.display = msg ? "block" : "none"; }

  function loginToEmail(input){
    const v = input.trim();
    if (!v.includes("@") && digits(v).length >= 5) return `${digits(v)}@${DRIVER_EMAIL_DOMAIN}`;
    return v.toLowerCase();
  }

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    showLoginError("");
    const btn = loginForm.querySelector("button[type=submit]");
    btn.disabled = true; btn.textContent = "Entrando...";
    const { error } = await sb.auth.signInWithPassword({
      email: loginToEmail($("#login-user").value),
      password: $("#login-password").value
    });
    btn.disabled = false; btn.textContent = "Entrar";
    if (error) {
      showLoginError(error.message === "Invalid login credentials" ? "Usuário ou senha incorretos." : error.message);
      return;
    }
    enterApp();
  });

  $("#logout-btn").addEventListener("click", async () => {
    if (tracker.active && !(await confirmDialog("Sair do aplicativo?", "Sua localização deixará de ser enviada enquanto você estiver desconectado.", "Sair", true))) return;
    tracker.stop();
    await sb.auth.signOut();
    location.hash = "";
    location.reload();
  });

  async function enterApp(){
    const { data: { user } } = await sb.auth.getUser();
    if (!user) { $("#login-screen").hidden = false; return; }

    const { data: me, error } = await sb.from("lg_users").select("*").eq("id", user.id).maybeSingle();
    if (error || !me) {
      await sb.auth.signOut();
      $("#login-screen").hidden = false;
      showLoginError(error ? errMsg(error) : "Seu usuário não tem acesso ao rastreamento. Peça para ser cadastrado.");
      return;
    }
    if (!me.ativo) {
      await sb.auth.signOut();
      $("#login-screen").hidden = false;
      showLoginError("Seu acesso está desativado. Fale com o responsável.");
      return;
    }
    state.me = me;
    if (me.carrier_id) {
      const { data: c } = await sb.from("lg_carriers").select("*").eq("id", me.carrier_id).maybeSingle();
      state.carrier = c || null;
    }

    $("#login-screen").hidden = true;
    $("#app").hidden = false;
    $("#user-chip").innerHTML = `<b>${esc(me.nome)}</b><span>${esc(ROLE_LABEL[me.role])}${state.carrier ? " · " + esc(state.carrier.nome) : ""}</span>`;
    $("#topbar-sub").textContent = me.role === "contratante" ? "Visão do contratante — todas as transportadoras"
      : me.role === "transportadora" ? (state.carrier ? state.carrier.nome : "Transportadora")
      : "Olá, " + me.nome.split(" ")[0];

    if (me.role !== "motorista") {
      try { await loadRefs(); } catch (e) { toast("Erro ao carregar cadastros: " + errMsg(e), true); }
    }
    buildNav();
    const fromHash = location.hash.replace("#", "");
    go(navItems().some(n => n.id === fromHash) ? fromHash : navItems()[0].id);
  }

  /* ============================================================
     NAV / ROUTER
     ============================================================ */
  function navItems(){
    switch (state.me.role) {
      case "contratante": return [
        { id: "painel", label: "Painel", icon: "map", render: renderPainel },
        { id: "rotas", label: "Rotas", icon: "list", render: renderRotas },
        { id: "comprovantes", label: "Comprovantes", icon: "file", render: renderComprovantes },
        { id: "importar", label: "Importar cargas", icon: "upload", render: renderImportar },
        { id: "transportadoras", label: "Transportadoras", icon: "building", render: renderTransportadoras },
        { id: "usuarios", label: "Usuários", icon: "users", render: renderUsuarios }
      ];
      case "transportadora": return [
        { id: "painel", label: "Painel", icon: "map", render: renderPainel },
        { id: "rotas", label: "Rotas", icon: "list", render: renderRotas },
        { id: "comprovantes", label: "Comprovantes", icon: "file", render: renderComprovantes },
        { id: "usuarios", label: "Motoristas", icon: "users", render: renderUsuarios }
      ];
      default: return [{ id: "motorista", label: "Minhas rotas", icon: "truck", render: renderMotorista }];
    }
  }
  function buildNav(){
    const items = navItems();
    const nav = $("#topnav");
    nav.hidden = items.length < 2;
    nav.innerHTML = items.map(n => `<button data-view="${n.id}">${icon(n.icon)}<span>${esc(n.label)}</span></button>`).join("");
    $$("button", nav).forEach(b => b.addEventListener("click", () => go(b.dataset.view)));
  }
  function go(viewId){
    const item = navItems().find(n => n.id === viewId) || navItems()[0];
    runTeardown();
    closeModal();
    state.view = item.id;
    if (navItems().length > 1) history.replaceState(null, "", "#" + item.id);
    $$("#topnav button").forEach(b => b.classList.toggle("active", b.dataset.view === item.id));
    const content = $("#content");
    content.innerHTML = `<div class="empty">Carregando...</div>`;
    Promise.resolve(item.render(content)).catch(e => {
      content.innerHTML = `<div class="card card-pad"><div class="result-box result-err">Erro ao carregar: ${esc(errMsg(e))}</div></div>`;
    });
  }

  /* ============================================================
     PAINEL (contratante / transportadora)
     ============================================================ */
  async function renderPainel(content){
    content.innerHTML = `
      <div class="page-head">
        <div>
          <h2>Painel de acompanhamento</h2>
          <p>${isContratante() ? "Localização em tempo real dos motoristas de todas as transportadoras." : "Localização em tempo real dos seus motoristas."}</p>
        </div>
        <div class="row">
          ${isContratante() ? `<select class="select" id="dash-carrier"><option value="">Todas as transportadoras</option>${state.carriers.map(c => `<option value="${c.id}">${esc(c.nome)}</option>`).join("")}</select>` : ""}
          ${liveBadge()}
        </div>
      </div>
      <div class="kpis" id="dash-kpis"></div>
      <div class="dash">
        <div class="map" id="dash-map"></div>
        <div class="card">
          <div class="card-pad" style="padding-bottom:6px;"><div class="card-title" style="margin:0;">Motoristas <span class="muted small" id="dash-count"></span></div></div>
          <div class="driver-list" id="dash-drivers"></div>
        </div>
      </div>
      <div class="card" style="margin-top:16px;">
        <div class="card-pad" style="padding-bottom:0;">
          <div class="card-title">Comprovantes recebidos <button class="btn btn-ghost btn-sm" id="dash-alldocs">${icon("file")} Ver todos</button></div>
        </div>
        <div class="doc-grid" id="dash-docs"><div class="empty">Carregando...</div></div>
      </div>`;

    const map = makeMap($("#dash-map"));
    teardown.push(() => map.remove());
    const markers = new Map();     // driver_id -> marker
    let statusById = new Map();    // driver_id -> lg_driver_status
    let routes = [];
    let fitted = false;

    const filterCarrier = () => ($("#dash-carrier") || {}).value || "";
    const visibleDrivers = () => drivers().filter(d => d.ativo && (!filterCarrier() || d.carrier_id === filterCarrier()));
    const routeById = (id) => routes.find(r => r.id === id);
    const activeRouteOf = (driverId) => routes.find(r => r.driver_id === driverId && r.status === "em_rota");

    function popupHtml(d, st){
      const r = (st.route_id && routeById(st.route_id)) || activeRouteOf(d.id);
      const kmh = st.speed != null && st.speed >= 0 ? Math.round(st.speed * 3.6) + " km/h" : "—";
      return `<b>${esc(d.nome)}</b><br>
        <span class="muted">${esc(carrierName(d.carrier_id))}${d.placa ? " · " + esc(d.placa) : ""}</span><br>
        ${r ? `Rota <b>${esc(r.codigo)}</b> → ${esc(r.destino || "—")}<br>` : ""}
        Atualizado ${esc(timeAgo(st.recorded_at))} · ${kmh}
        ${r ? `<br><a href="#" data-open-route="${esc(r.id)}">Ver rota e comprovantes</a>` : ""}`;
    }

    function drawMarkers(){
      const vis = new Set(visibleDrivers().map(d => d.id));
      for (const [id, m] of markers) { if (!vis.has(id) || !statusById.has(id)) { m.remove(); markers.delete(id); } }
      for (const d of visibleDrivers()) {
        const st = statusById.get(d.id);
        if (!st) continue;
        const ic = pinIcon(initials(d.nome), freshness(st.recorded_at));
        let m = markers.get(d.id);
        if (!m) { m = L.marker([st.lat, st.lng], { icon: ic }).addTo(map).bindPopup(""); markers.set(d.id, m); }
        else { m.setLatLng([st.lat, st.lng]); m.setIcon(ic); }
        m.setPopupContent(popupHtml(d, st));
      }
      if (!fitted && markers.size) {
        fitted = true;
        const b = L.latLngBounds(Array.from(markers.values()).map(m => m.getLatLng()));
        map.fitBounds(b.pad(0.25), { maxZoom: 13 });
      }
    }

    function drawList(){
      const list = visibleDrivers().map(d => ({ d, st: statusById.get(d.id) }))
        .sort((a, b) => (b.st ? new Date(b.st.recorded_at) : 0) - (a.st ? new Date(a.st.recorded_at) : 0));
      $("#dash-count").textContent = `(${list.length})`;
      $("#dash-drivers").innerHTML = list.length ? list.map(({ d, st }) => {
        const r = activeRouteOf(d.id);
        return `<div class="driver-item" data-id="${d.id}">
          <div class="avatar ${st ? freshness(st.recorded_at) : ""}">${esc(initials(d.nome))}</div>
          <div class="grow" style="min-width:0;">
            <div class="name">${esc(d.nome)}</div>
            <div class="meta">${isContratante() ? esc(carrierName(d.carrier_id)) + " · " : ""}${r ? "Rota " + esc(r.codigo) : "Sem rota em andamento"}</div>
          </div>
          <div class="meta" style="text-align:right;white-space:nowrap;">${esc(timeAgo(st && st.recorded_at))}</div>
        </div>`;
      }).join("") : `<div class="empty">Nenhum motorista cadastrado${filterCarrier() ? " nesta transportadora" : ""}.</div>`;
      $$("#dash-drivers .driver-item").forEach(el => el.addEventListener("click", () => {
        const m = markers.get(el.dataset.id);
        if (!m) { toast("Este motorista ainda não enviou localização."); return; }
        map.setView(m.getLatLng(), Math.max(map.getZoom(), 14));
        m.openPopup();
      }));
    }

    function drawKpis(){
      const fc = filterCarrier();
      const rs = routes.filter(r => !fc || r.carrier_id === fc);
      const today = todayStartISO();
      const online = visibleDrivers().filter(d => { const st = statusById.get(d.id); return st && freshness(st.recorded_at) === "online"; }).length;
      const k = [
        { label: "Pendentes", value: rs.filter(r => r.status === "pendente").length, color: "var(--st-pendente)" },
        { label: "Em rota", value: rs.filter(r => r.status === "em_rota").length, color: "var(--st-em_rota)" },
        { label: "Entregues hoje", value: rs.filter(r => r.status === "entregue" && r.finished_at >= today).length, color: "var(--st-entregue)" },
        { label: "Motoristas online", value: `${online}<span class="muted" style="font-size:15px;"> / ${visibleDrivers().length}</span>`, color: "var(--green-light)" },
        { label: "Sem motorista", value: rs.filter(r => r.status === "pendente" && !r.driver_id).length, color: "var(--orange)" }
      ];
      $("#dash-kpis").innerHTML = k.map(x => `<div class="card kpi"><div class="label"><span class="dot" style="background:${x.color}"></span>${x.label}</div><div class="value">${x.value}</div></div>`).join("");
    }

    let docs = [];
    async function drawDocs(){
      const fc = filterCarrier();
      const list = docs.filter(d => !fc || (d.lg_routes && d.lg_routes.carrier_id === fc)).slice(0, 8);
      const el = $("#dash-docs");
      if (!el) return;
      if (!list.length) { el.innerHTML = `<div class="empty">Nenhum comprovante recebido ainda${fc ? " desta transportadora" : ""}.</div>`; return; }
      const urlOf = await signDocs(list);
      el.innerHTML = docTilesHtml(list, urlOf);
    }
    async function loadDocs(){
      const { data, error } = await sb.from("lg_documents").select(DOC_SELECT).order("created_at", { ascending: false }).limit(40);
      if (error) throw error;
      docs = data || [];
    }

    const drawAll = () => { drawKpis(); drawMarkers(); drawList(); drawDocs().catch(() => {}); };

    async function loadRoutes(){
      const { data, error } = await sb.from("lg_routes")
        .select("id,codigo,status,carrier_id,driver_id,destino,cliente,finished_at")
        .or(`status.in.(pendente,em_rota),finished_at.gte.${todayStartISO()}`)
        .limit(5000);
      if (error) throw error;
      routes = data || [];
    }
    async function loadStatus(){
      const { data, error } = await sb.from("lg_driver_status").select("*");
      if (error) throw error;
      statusById = new Map((data || []).map(s => [s.driver_id, s]));
    }
    async function loadAll(){ await Promise.all([loadRoutes(), loadStatus(), loadDocs()]); drawAll(); }

    await loadAll();
    setTimeout(() => map.invalidateSize(), 50);

    $("#dash-alldocs").addEventListener("click", () => go("comprovantes"));
    const sel = $("#dash-carrier");
    if (sel) sel.addEventListener("change", () => { fitted = false; drawAll(); });

    const reloadRoutes = debounce(async () => { try { await loadRoutes(); drawAll(); } catch (_) {} }, 800);
    const channel = sb.channel("lg-dash-" + Date.now())
      .on("postgres_changes", { event: "*", schema: "public", table: "lg_driver_status" }, (p) => {
        if (p.eventType === "DELETE") statusById.delete(p.old.driver_id);
        else statusById.set(p.new.driver_id, p.new);
        drawMarkers(); drawList(); drawKpis();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "lg_routes" }, reloadRoutes)
      .subscribe();
    teardown.push(() => sb.removeChannel(channel));

    // Atualização automática: posições, rotas e comprovantes a cada 15 s;
    // cadastros (motoristas novos) a cada ~2 min
    let tick = 0;
    autoRefresh(async () => {
      if (++tick % 8 === 0) await loadRefs();
      await loadAll();
    }, 15 * 1000);
  }

  /* ============================================================
     ROTAS (contratante / transportadora)
     ============================================================ */
  async function renderRotas(content){
    content.innerHTML = `
      <div class="page-head">
        <div>
          <h2>Rotas</h2>
          <p>${isContratante() ? "Todas as cargas importadas do sistema." : "Cargas destinadas à sua transportadora. Atribua o motorista de cada uma."}</p>
        </div>
        <div class="row">
          ${liveBadge()}
          <button class="btn btn-ghost btn-sm" id="rt-export">${icon("download")} Exportar CSV</button>
        </div>
      </div>
      <div class="filters">
        <input class="input grow" id="rt-q" placeholder="Buscar código, cliente, destino, NF, placa..." style="min-width:220px;">
        <select class="select" id="rt-status">
          <option value="abertas">Abertas (pendentes + em rota)</option>
          <option value="">Todos os status</option>
          ${Object.keys(STATUS_LABEL).map(s => `<option value="${s}">${STATUS_LABEL[s]}</option>`).join("")}
        </select>
        ${isContratante() ? `<select class="select" id="rt-carrier"><option value="">Todas as transportadoras</option>${state.carriers.map(c => `<option value="${c.id}">${esc(c.nome)}</option>`).join("")}</select>` : ""}
        <select class="select" id="rt-driver"><option value="">Todos os motoristas</option><option value="__none">Sem motorista</option>${drivers().map(d => `<option value="${d.id}">${esc(d.nome)}</option>`).join("")}</select>
        <input class="input" type="date" id="rt-from" title="Previsão a partir de">
        <input class="input" type="date" id="rt-to" title="Previsão até">
      </div>
      <div class="card">
        <div class="table-wrap"><table class="tbl">
          <thead><tr>
            <th>Código</th><th>Cliente</th><th>Destino</th>
            ${isContratante() ? "<th>Transportadora</th>" : ""}
            <th>Motorista</th><th class="hide-sm">Placa</th><th class="hide-sm">Previsão</th><th>Status</th><th title="Comprovantes">Doc.</th>
          </tr></thead>
          <tbody id="rt-body"><tr><td colspan="9" class="empty">Carregando...</td></tr></tbody>
        </table></div>
      </div>
      <div class="muted small" id="rt-foot" style="margin-top:8px;"></div>`;

    let rows = [];
    async function load(){
      let q = sb.from("lg_routes").select("*, lg_documents(count)").order("data_prevista", { ascending: false, nullsFirst: false }).order("created_at", { ascending: false }).limit(2000);
      const st = $("#rt-status").value;
      if (st === "abertas") q = q.in("status", ["pendente", "em_rota"]);
      else if (st) q = q.eq("status", st);
      const c = ($("#rt-carrier") || {}).value;
      if (c) q = q.eq("carrier_id", c);
      const d = $("#rt-driver").value;
      if (d === "__none") q = q.is("driver_id", null); else if (d) q = q.eq("driver_id", d);
      if ($("#rt-from").value) q = q.gte("data_prevista", $("#rt-from").value);
      if ($("#rt-to").value) q = q.lte("data_prevista", $("#rt-to").value);
      const { data, error } = await q;
      if (error) throw error;
      rows = data || [];
      draw();
    }
    function filtered(){
      const term = $("#rt-q").value.trim().toLowerCase();
      if (!term) return rows;
      return rows.filter(r => [r.codigo, r.cliente, r.destino, r.origem, r.nota_fiscal, r.placa, r.placas_carreta, r.produto, r.operacao, r.status_sistema, routeDriverText(r), r.motorista_cpf]
        .some(v => String(v || "").toLowerCase().includes(term)));
    }
    function draw(){
      const list = filtered();
      const cols = isContratante() ? 9 : 8;
      $("#rt-body").innerHTML = list.length ? list.map(r => {
        const docs = (r.lg_documents && r.lg_documents[0] && r.lg_documents[0].count) || 0;
        return `<tr class="clickable" data-id="${r.id}">
          <td><b>${esc(r.codigo)}</b>${r.operacao ? `<div class="muted small">${esc(r.operacao)}</div>` : r.nota_fiscal ? `<div class="muted small">NF ${esc(r.nota_fiscal)}</div>` : ""}</td>
          <td>${esc(r.cliente || "—")}</td>
          <td>${esc(r.destino || "—")}</td>
          ${isContratante() ? `<td>${esc(carrierName(r.carrier_id))}</td>` : ""}
          <td>${routeDriverHtml(r)}</td>
          <td class="hide-sm mono">${esc(r.placa || "—")}${r.placas_carreta ? `<div class="muted small">${esc(r.placas_carreta)}</div>` : ""}</td>
          <td class="hide-sm">${fmtDate(r.data_prevista)}</td>
          <td>${statusBadge(r.status)}${r.status_sistema ? `<div class="muted small" title="Status no sistema de agendamento">${esc(r.status_sistema)}</div>` : ""}</td>
          <td>${docs ? `<span class="doc-chip">${icon("file")}${docs}</span>` : `<span class="muted">—</span>`}</td>
        </tr>`;
      }).join("") : `<tr><td colspan="${cols}" class="empty">Nenhuma rota encontrada com esses filtros.</td></tr>`;
      $("#rt-foot").textContent = `${list.length} rota(s)` + (rows.length >= 2000 ? " — mostrando as 2000 mais recentes; use os filtros para refinar." : "");
      $$("#rt-body tr.clickable").forEach(tr => tr.addEventListener("click", () => openRouteDetail(tr.dataset.id, load)));
    }

    $("#rt-q").addEventListener("input", debounce(draw, 150));
    ["rt-status", "rt-carrier", "rt-driver", "rt-from", "rt-to"].forEach(id => { const el = $("#" + id); if (el) el.addEventListener("change", () => load().catch(e => toast(errMsg(e), true))); });
    $("#rt-export").addEventListener("click", () => exportRoutesCsv(filtered()));

    await load();

    const reload = debounce(() => { if ($("#modal-overlay").hidden) load().catch(() => {}); }, 1000);
    const channel = sb.channel("lg-rotas-" + Date.now())
      .on("postgres_changes", { event: "*", schema: "public", table: "lg_routes" }, reload)
      .subscribe();
    teardown.push(() => sb.removeChannel(channel));
    autoRefresh(load, 20 * 1000);
  }

  function exportRoutesCsv(list){
    const head = ["codigo", "status", "status_sistema", "transportadora", "motorista", "documento_motorista", "placa", "carretas", "terminal_origem", "destino", "cliente", "operacao", "nota_fiscal", "produto", "quantidade", "unidade", "data_prevista", "janela", "iniciada_em", "entregue_em", "comprovantes"];
    const cell = (v) => { const s = String(v == null ? "" : v); return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const lines = [head.join(";")].concat(list.map(r => [
      r.codigo, STATUS_LABEL[r.status], r.status_sistema, carrierName(r.carrier_id), routeDriverText(r), fmtDoc(r.motorista_cpf), r.placa, r.placas_carreta, r.origem, r.destino,
      r.cliente, r.operacao, r.nota_fiscal, r.produto, r.peso == null ? "" : String(r.peso).replace(".", ","), r.unidade, fmtDate(r.data_prevista).replace("—", ""), fmtJanela(r).replace("—", ""),
      r.started_at ? fmtDateTime(r.started_at) : "", r.finished_at ? fmtDateTime(r.finished_at) : "",
      (r.lg_documents && r.lg_documents[0] && r.lg_documents[0].count) || 0
    ].map(cell).join(";")));
    const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `rotas-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  /* ---------- detalhe da rota ---------- */
  async function openRouteDetail(routeId, onChange){
    const m = openModal(`${modalHead("Carregando...")}<div class="empty">Carregando rota...</div>`, { wide: true });
    const [rRes, dRes, lRes] = await Promise.all([
      sb.from("lg_routes").select("*").eq("id", routeId).single(),
      sb.from("lg_documents").select("*").eq("route_id", routeId).order("created_at"),
      sb.from("lg_locations").select("lat,lng,recorded_at,speed").eq("route_id", routeId).order("recorded_at").limit(10000)
    ]);
    if (rRes.error) { m.innerHTML = `${modalHead("Erro")}<div class="result-box result-err">${esc(errMsg(rRes.error))}</div>`; $$("[data-close]", m).forEach(b => b.addEventListener("click", closeModal)); return; }
    const r = rRes.data, docs = dRes.data || [], pts = lRes.data || [];
    const open = r.status === "pendente" || r.status === "em_rota";
    const canAssign = open && (isContratante() || (state.me.role === "transportadora" && r.carrier_id === state.me.carrier_id));
    const driversOf = (carrierId) => drivers().filter(d => d.carrier_id === carrierId && (d.ativo || d.id === r.driver_id));
    const carrierDrivers = driversOf(r.carrier_id);
    // sugere o motorista cadastrado com o mesmo documento que veio no arquivo
    const suggestedDriver = (carrierId) => r.driver_id || ((r.motorista_cpf && driversOf(carrierId).find(d => d.cpf === r.motorista_cpf)) || {}).id || "";
    const driverOptions = (carrierId) => `<option value="">— sem motorista —</option>` + driversOf(carrierId).map(d => `<option value="${d.id}" ${d.id === suggestedDriver(carrierId) ? "selected" : ""}>${esc(d.nome)}${d.placa ? " (" + esc(d.placa) + ")" : ""}</option>`).join("");
    const field = (k, v) => `<div><div class="k">${k}</div><div class="v">${v}</div></div>`;
    const opt = (k, v) => (v ? field(k, esc(v)) : "");

    m.innerHTML = `
      ${modalHead(`Rota ${esc(r.codigo)} ${statusBadge(r.status)}`, `${esc(r.origem || "—")} → ${esc(r.destino || "—")}`)}
      <div class="timeline">
        <span>${icon("clock")} Importada ${fmtDateTime(r.created_at)}</span>
        <span>${icon("play")} Iniciada ${fmtDateTime(r.started_at)}</span>
        <span>${icon("check")} Entregue ${fmtDateTime(r.finished_at)}</span>
      </div>
      <div class="detail-grid">
        ${field("Cliente", esc(r.cliente || "—"))}
        ${field("Terminal / origem", esc(r.origem || "—"))}
        ${field("Destino", esc(r.destino || "—"))}
        ${opt("Operação", r.operacao)}
        ${field("Produto", esc(r.produto || "—"))}
        ${field("Quantidade", esc(fmtQtd(r)))}
        ${field("Previsão", fmtDate(r.data_prevista))}
        ${r.periodo_inicio ? field("Janela", esc(fmtJanela(r))) : ""}
        ${field("Transportadora", esc(carrierName(r.carrier_id)))}
        ${field("Motorista", routeDriverHtml(r))}
        ${opt("Documento do motorista", fmtDoc(r.motorista_cpf))}
        ${opt("Telefone do motorista", r.motorista_telefone)}
        ${field("Placa (tração)", esc(r.placa || "—"))}
        ${opt("Carretas", r.placas_carreta)}
        ${opt("Equipamento", r.equipamento)}
        ${opt("Status no sistema", r.status_sistema)}
        ${opt("Último evento", r.ultimo_evento)}
        ${opt("Tempo no terminal", r.tempo_terminal)}
        ${opt("Nota fiscal", r.nota_fiscal)}
        ${opt("Agendado por", [r.agendado_por, r.agendado_email].filter(Boolean).join(" · "))}
        ${opt("Observação", r.observacao)}
      </div>

      ${canAssign ? `
      <div class="card card-pad" style="background:#FBFAF6;margin-bottom:14px;">
        <div class="row">
          ${isContratante() ? `<div class="fl grow" style="min-width:200px;"><label>Transportadora</label>
            <select class="select" id="rd-carrier">${state.carriers.filter(c => c.ativo || c.id === r.carrier_id).map(c => `<option value="${c.id}" ${c.id === r.carrier_id ? "selected" : ""}>${esc(c.nome)}</option>`).join("")}</select></div>` : ""}
          <div class="fl grow" style="min-width:200px;"><label>Motorista</label>
            <select class="select" id="rd-driver">${driverOptions(r.carrier_id)}</select></div>
          <div class="fl" style="width:140px;"><label>Placa</label><input class="input" id="rd-placa" value="${esc(r.placa)}" placeholder="ABC1D23"></div>
          <button class="btn btn-primary" id="rd-assign" style="align-self:flex-end;">Salvar</button>
        </div>
        <div class="muted small" id="rd-driver-hint" style="margin-top:8px;">${carrierDrivers.length ? (r.motorista_nome && !r.driver_id && !suggestedDriver(r.carrier_id) ? `O motorista do arquivo (${esc(r.motorista_nome)}) ainda não tem acesso — ao ser cadastrado com o documento ${esc(fmtDoc(r.motorista_cpf))}, esta rota passa para ele automaticamente.` : "") : "Nenhum motorista cadastrado nesta transportadora ainda."}</div>
      </div>` : ""}

      <div class="section-title">Trajeto <span class="muted small" style="font-weight:400;">(${pts.length} posição(ões) registrada(s))</span></div>
      <div class="map map-sm" id="rd-map"></div>

      <div class="section-title" style="display:flex;justify-content:space-between;align-items:center;">
        <span>Documentos de entrega</span>
        ${isContratante() ? `<button class="btn btn-ghost btn-sm" id="rd-upload">${icon("upload")} Anexar</button>` : ""}
      </div>
      <div class="doc-list" id="rd-docs">${docs.length ? "" : `<div class="muted small">Nenhum comprovante enviado ainda.</div>`}</div>

      ${isContratante() ? `
      <div class="form-actions" style="justify-content:space-between;flex-wrap:wrap;">
        <button class="btn btn-danger btn-sm" id="rd-delete">${icon("trash")} Excluir rota</button>
        <div class="row">
          ${open ? `<button class="btn btn-ghost btn-sm" id="rd-cancel">Cancelar rota</button>` : `<button class="btn btn-ghost btn-sm" id="rd-reopen">Reabrir rota</button>`}
          ${open && docs.length ? `<button class="btn btn-primary btn-sm" id="rd-finish">${icon("check")} Marcar como entregue</button>` : ""}
        </div>
      </div>` : ""}`;
    $$("[data-close]", m).forEach(b => b.addEventListener("click", closeModal));

    // mapa do trajeto
    const map = makeMap($("#rd-map", m));
    // Verifica a cada 15 s se chegou comprovante ou mudou o status/posição; se mudou, redesenha
    const signature = (route, docCount, ptCount) => [route.status, route.driver_id, route.updated_at, docCount, ptCount].join("|");
    const sig0 = signature(r, docs.length, pts.length);
    const poll = setInterval(async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const [a, b, c] = await Promise.all([
          sb.from("lg_routes").select("status,driver_id,updated_at").eq("id", routeId).single(),
          sb.from("lg_documents").select("id", { count: "exact", head: true }).eq("route_id", routeId),
          sb.from("lg_locations").select("id", { count: "exact", head: true }).eq("route_id", routeId)
        ]);
        if (a.error || b.error || c.error) return;
        if (signature(a.data, b.count, c.count) !== sig0) openRouteDetail(routeId, onChange);
      } catch (_) {}
    }, 15 * 1000);
    modalCleanup = () => { clearInterval(poll); map.remove(); };
    const layers = [];
    if (pts.length) {
      const line = L.polyline(pts.map(p => [p.lat, p.lng]), { color: "#28437E", weight: 4, opacity: 0.8 }).addTo(map);
      layers.push(line);
      L.marker([pts[0].lat, pts[0].lng], { icon: pinIcon("I", "recent") }).addTo(map).bindPopup(`Início · ${fmtDateTime(pts[0].recorded_at)}`);
      const last = pts[pts.length - 1];
      layers.push(L.marker([last.lat, last.lng], { icon: pinIcon(initials(userName(r.driver_id)), freshness(last.recorded_at) || "online") })
        .addTo(map).bindPopup(`Última posição · ${fmtDateTime(last.recorded_at)}`));
    }
    if (r.dest_lat != null && r.dest_lng != null) {
      layers.push(L.marker([r.dest_lat, r.dest_lng], { icon: pinIcon("D", "dest") }).addTo(map).bindPopup(`Destino · ${esc(r.destino)}`));
    }
    docs.filter(d => d.lat != null).forEach(d => layers.push(L.marker([d.lat, d.lng], { icon: pinIcon("C", "online") }).addTo(map).bindPopup(`Comprovante enviado aqui · ${fmtDateTime(d.created_at)}`)));
    setTimeout(() => {
      map.invalidateSize();
      if (layers.length) map.fitBounds(L.featureGroup(layers).getBounds().pad(0.2), { maxZoom: 15 });
    }, 60);

    // documentos
    renderDocList($("#rd-docs", m), docs, isContratante() ? async (doc) => {
      if (!(await confirmDialog("Excluir documento?", `O arquivo <b>${esc(doc.file_name)}</b> será removido.`, "Excluir", true))) { openRouteDetail(routeId, onChange); return; }
      await sb.storage.from(BUCKET).remove([doc.storage_path]);
      const { error } = await sb.from("lg_documents").delete().eq("id", doc.id);
      if (error) toast(errMsg(error), true); else toast("Documento excluído.");
      openRouteDetail(routeId, onChange);
    } : null);

    const after = async (msg) => { toast(msg); if (onChange) await onChange(); openRouteDetail(routeId, onChange); };
    const on = (id, fn) => { const el = $("#" + id, m); if (el) el.addEventListener("click", async () => { el.disabled = true; try { await fn(); } catch (e) { toast(errMsg(e), true); el.disabled = false; } }); };

    const carrierSel = $("#rd-carrier", m);
    if (carrierSel) carrierSel.addEventListener("change", () => {
      $("#rd-driver", m).innerHTML = driverOptions(carrierSel.value);
      $("#rd-driver-hint", m).textContent = driversOf(carrierSel.value).length ? "" : "Nenhum motorista cadastrado nesta transportadora ainda.";
    });
    on("rd-assign", async () => {
      if (carrierSel && carrierSel.value !== r.carrier_id) {
        const { error: cErr } = await sb.from("lg_routes").update({ carrier_id: carrierSel.value, driver_id: null }).eq("id", r.id);
        if (cErr) throw cErr;
      }
      const { error } = await sb.rpc("lg_assign_driver", { p_route: r.id, p_driver: $("#rd-driver", m).value || null, p_placa: $("#rd-placa", m).value });
      if (error) throw error;
      await after("Rota atualizada.");
    });
    on("rd-upload", async () => {
      const files = await pickFiles();
      if (!files.length) { $("#rd-upload", m).disabled = false; return; }
      await uploadDocs(r.id, files, null);
      await after("Documento anexado.");
    });
    on("rd-finish", async () => {
      const { error } = await sb.rpc("lg_finish_route", { p_route: r.id });
      if (error) throw error;
      await after("Rota marcada como entregue.");
    });
    on("rd-cancel", async () => {
      if (!(await confirmDialog("Cancelar rota?", `A rota <b>${esc(r.codigo)}</b> sairá da lista do motorista.`, "Cancelar rota", true))) { openRouteDetail(routeId, onChange); return; }
      const { error } = await sb.from("lg_routes").update({ status: "cancelada", finished_at: new Date().toISOString() }).eq("id", r.id);
      if (error) throw error;
      await after("Rota cancelada.");
    });
    on("rd-reopen", async () => {
      const { error } = await sb.from("lg_routes").update({ status: r.started_at ? "em_rota" : "pendente", finished_at: null }).eq("id", r.id);
      if (error) throw error;
      await after("Rota reaberta.");
    });
    on("rd-delete", async () => {
      if (!(await confirmDialog("Excluir rota?", `A rota <b>${esc(r.codigo)}</b>, seu trajeto e os comprovantes serão apagados. Esta ação não pode ser desfeita.`, "Excluir", true))) { openRouteDetail(routeId, onChange); return; }
      if (docs.length) await sb.storage.from(BUCKET).remove(docs.map(d => d.storage_path));
      const { error } = await sb.from("lg_routes").delete().eq("id", r.id);
      if (error) throw error;
      closeModal();
      toast("Rota excluída.");
      if (onChange) await onChange();
    });
  }

  async function renderDocList(el, docs, onDelete){
    if (!docs.length) return;
    const urlOf = await signDocs(docs);
    el.innerHTML = docs.map(d => {
      const url = urlOf(d.storage_path);
      const isImg = /^image\//.test(d.mime_type);
      return `<div class="doc-item">
        ${isImg && url ? `<img class="doc-thumb" src="${esc(url)}" alt="">` : `<div class="doc-thumb">${icon("file")}</div>`}
        <div class="grow">
          <div class="name">${esc(d.file_name)}</div>
          <div class="muted small">Enviado ${fmtDateTime(d.created_at)} por ${esc(userName(d.uploaded_by))}${d.size_bytes ? " · " + Math.ceil(d.size_bytes / 1024) + " KB" : ""}</div>
        </div>
        ${url ? `<a class="btn btn-ghost btn-sm" href="${esc(url)}" target="_blank" rel="noopener">Abrir</a>` : ""}
        ${onDelete ? `<button class="btn btn-danger btn-sm" data-del="${d.id}" aria-label="Excluir">${icon("trash")}</button>` : ""}
      </div>`;
    }).join("");
    if (onDelete) $$("[data-del]", el).forEach(b => b.addEventListener("click", () => onDelete(docs.find(d => d.id === b.dataset.del))));
  }

  /* ---------- upload de comprovantes ---------- */
  function pickFiles(capture){
    return new Promise((resolve) => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/*,application/pdf";
      input.multiple = true;
      if (capture) input.setAttribute("capture", "environment");
      input.style.display = "none";
      document.body.appendChild(input);
      let settled = false;
      const finish = (files) => { if (settled) return; settled = true; resolve(files); input.remove(); };
      input.addEventListener("change", () => finish(Array.from(input.files || [])));
      input.addEventListener("cancel", () => finish([]));
      input.click();
    });
  }

  async function compressImage(file){
    if (!/^image\/(jpeg|png|webp|heic|heif)$/i.test(file.type) || file.size < 700 * 1024 || !window.createImageBitmap) return file;
    try {
      const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
      const scale = Math.min(1, 1920 / Math.max(bmp.width, bmp.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(bmp.width * scale);
      canvas.height = Math.round(bmp.height * scale);
      canvas.getContext("2d").drawImage(bmp, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise(res => canvas.toBlob(res, "image/jpeg", 0.82));
      if (!blob || blob.size >= file.size) return file;
      return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
    } catch (_) {
      return file;
    }
  }

  async function uploadDocs(routeId, files, position){
    for (let i = 0; i < files.length; i++) {
      toast(`Enviando documento ${i + 1} de ${files.length}...`);
      const file = await compressImage(files[i]);
      const safe = file.name.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9._-]+/g, "_").slice(-80) || "documento";
      const path = `${routeId}/${Date.now()}-${i}-${safe}`;
      const up = await sb.storage.from(BUCKET).upload(path, file, { contentType: file.type || "application/octet-stream", upsert: false });
      if (up.error) throw new Error("Falha no envio do arquivo: " + errMsg(up.error));
      const { error } = await sb.from("lg_documents").insert({
        route_id: routeId,
        uploaded_by: state.me.id,
        storage_path: path,
        file_name: file.name,
        mime_type: file.type || "",
        size_bytes: file.size,
        lat: position ? position.lat : null,
        lng: position ? position.lng : null
      });
      if (error) { await sb.storage.from(BUCKET).remove([path]); throw error; }
    }
  }

  /* ============================================================
     COMPROVANTES (contratante / transportadora)
     ============================================================ */
  async function renderComprovantes(content){
    content.innerHTML = `
      <div class="page-head">
        <div>
          <h2>Comprovantes de entrega</h2>
          <p>Documentos enviados pelos motoristas no fim de cada rota. Clique na imagem para abrir em tamanho real.</p>
        </div>
        ${liveBadge()}
      </div>
      <div class="filters">
        <input class="input grow" id="cp-q" placeholder="Buscar código, cliente, motorista, arquivo..." style="min-width:220px;">
        ${isContratante() ? `<select class="select" id="cp-carrier"><option value="">Todas as transportadoras</option>${state.carriers.map(c => `<option value="${c.id}">${esc(c.nome)}</option>`).join("")}</select>` : ""}
        <select class="select" id="cp-driver"><option value="">Todos os motoristas</option>${drivers().map(d => `<option value="${d.id}">${esc(d.nome)}</option>`).join("")}</select>
        <input class="input" type="date" id="cp-from" title="Enviados a partir de">
        <input class="input" type="date" id="cp-to" title="Enviados até">
      </div>
      <div class="card"><div class="doc-grid" id="cp-grid"><div class="empty">Carregando...</div></div></div>
      <div class="muted small" id="cp-foot" style="margin-top:8px;"></div>`;

    let rows = [];
    const LIMIT = 300;
    async function load(){
      let q = sb.from("lg_documents").select(DOC_SELECT).order("created_at", { ascending: false }).limit(LIMIT);
      const from = $("#cp-from").value, to = $("#cp-to").value;
      if (from) q = q.gte("created_at", new Date(from + "T00:00:00").toISOString());
      if (to) q = q.lt("created_at", new Date(new Date(to + "T00:00:00").getTime() + 86400000).toISOString());
      const d = $("#cp-driver").value;
      if (d) q = q.eq("uploaded_by", d);
      const { data, error } = await q;
      if (error) throw error;
      rows = data || [];
      await draw();
    }
    function filtered(){
      const term = $("#cp-q").value.trim().toLowerCase();
      const c = ($("#cp-carrier") || {}).value;
      return rows.filter(x => {
        const r = x.lg_routes || {};
        if (c && r.carrier_id !== c) return false;
        if (!term) return true;
        return [r.codigo, r.cliente, r.destino, x.file_name, userName(x.uploaded_by)].some(v => String(v || "").toLowerCase().includes(term));
      });
    }
    async function draw(){
      const list = filtered();
      const el = $("#cp-grid");
      if (!el) return;
      if (!list.length) { el.innerHTML = `<div class="empty">Nenhum comprovante encontrado.</div>`; $("#cp-foot").textContent = ""; return; }
      const urlOf = await signDocs(list);
      el.innerHTML = docTilesHtml(list, urlOf);
      $("#cp-foot").textContent = `${list.length} comprovante(s)` + (rows.length >= LIMIT ? ` — mostrando os ${LIMIT} mais recentes; use as datas para ver os anteriores.` : "");
    }

    $("#cp-q").addEventListener("input", debounce(() => draw().catch(() => {}), 150));
    const c = $("#cp-carrier");
    if (c) c.addEventListener("change", () => draw().catch(() => {}));
    ["cp-driver", "cp-from", "cp-to"].forEach(id => $("#" + id).addEventListener("change", () => load().catch(e => toast(errMsg(e), true))));

    await load();
    autoRefresh(async () => { if ($("#modal-overlay").hidden) await load(); }, 20 * 1000);
  }

  /* ============================================================
     IMPORTAR CARGAS (contratante)
     ============================================================ */
  // syn: nomes de coluna reconhecidos automaticamente (comparados sem acento/pontuação).
  // Cabeçalhos em várias linhas (células mescladas) viram um nome só: "Motorista" + "Nome" → "motorista nome".
  const IMPORT_FIELDS = [
    { key: "codigo", label: "Código da carga / agendamento", req: true, syn: ["#", "numero", "agendamento", "numero agendamento", "id agendamento", "codigo", "cod", "carga", "codigo carga", "cod carga", "id carga", "numero carga", "n carga", "no carga", "ordem", "ordem carregamento", "romaneio", "viagem", "shipment", "pedido"] },
    { key: "transportadora_cnpj", label: "CNPJ da transportadora", syn: ["transportador cnpj cpf", "transportador cnpj", "cnpj", "cnpj transportadora", "transportadora cnpj", "cnpj transp", "cnpj transportador"] },
    { key: "transportadora_nome", label: "Nome da transportadora", syn: ["transportador nome", "transportadora", "transportador", "nome transportadora", "transp", "transportadora nome", "razao social transportadora"] },
    { key: "motorista_cpf", label: "CPF / documento do motorista", syn: ["motorista documento identificacao", "documento identificacao", "motorista documento", "documento motorista", "cpf", "cpf motorista", "motorista cpf"] },
    { key: "motorista_nome", label: "Nome do motorista", syn: ["motorista nome", "nome motorista", "motorista"] },
    { key: "motorista_telefone", label: "Telefone do motorista", syn: ["motorista telefone", "telefone motorista", "telefone"] },
    { key: "placa", label: "Placa (tração)", syn: ["veiculo placa tracao", "placa tracao", "placa", "placa veiculo", "veiculo", "placa cavalo", "cavalo"] },
    { key: "placas_carreta", label: "Placas das carretas", syn: ["veiculo placa s carreta s", "placa s carreta s", "placas carreta", "placas carretas", "carretas", "placa carreta"] },
    { key: "equipamento", label: "Equipamento", syn: ["veiculo equipamento", "equipamento", "tipo veiculo"] },
    { key: "origem", label: "Terminal / origem", syn: ["terminal", "origem", "cidade origem", "local origem", "local carregamento"] },
    { key: "destino", label: "Destino", syn: ["destino", "cliente endereco", "cidade destino", "local destino", "local entrega", "endereco", "endereco entrega", "municipio destino"] },
    { key: "cliente", label: "Cliente", syn: ["cliente nome", "cliente", "destinatario", "nome cliente", "razao social", "razao social cliente"] },
    { key: "operacao", label: "Operação (janela)", syn: ["janela descricao", "descricao janela", "operacao"] },
    { key: "produto", label: "Produto", syn: ["contrato produtos", "produtos", "produto", "material", "mercadoria", "descricao produto"] },
    { key: "peso", label: "Quantidade / peso", syn: ["quantidade", "peso", "peso kg", "peso t", "peso ton", "toneladas", "peso liquido", "peso bruto"] },
    { key: "unidade", label: "Unidade", syn: ["unidade", "unidade medida", "un"] },
    { key: "status_sistema", label: "Status no sistema", syn: ["status", "status agendamento", "situacao"] },
    { key: "ultimo_evento", label: "Último evento", syn: ["ultimo evento", "evento"] },
    { key: "tempo_terminal", label: "Tempo no terminal", syn: ["tempo no terminal", "tempo terminal"] },
    { key: "data_prevista", label: "Data prevista", syn: ["cota", "data cota", "data", "data prevista", "previsao", "data entrega", "previsao entrega", "data carregamento", "data saida", "data emissao"] },
    { key: "periodo_inicio", label: "Início da janela (data e hora)", syn: ["periodo inicio", "inicio janela", "janela inicio", "inicio"] },
    { key: "periodo_fim", label: "Fim da janela (data e hora)", syn: ["periodo fim", "fim janela", "janela fim", "fim"] },
    { key: "nota_fiscal", label: "Nota fiscal", syn: ["notas fiscais numero", "nf", "nota", "nota fiscal", "nfe", "nf e", "numero nf", "n nf", "notas fiscais"] },
    { key: "agendado_por", label: "Agendado por", syn: ["agendado por nome", "agendado por"] },
    { key: "agendado_email", label: "E-mail de quem agendou", syn: ["agendado por e mail", "agendado por email", "email agendamento"] },
    { key: "dest_lat", label: "Latitude do destino", syn: ["lat", "latitude", "dest lat", "lat destino", "latitude destino"] },
    { key: "dest_lng", label: "Longitude do destino", syn: ["lng", "lon", "long", "longitude", "dest lng", "lng destino", "longitude destino"] },
    { key: "observacao", label: "Observação", syn: ["obs", "observacao", "observacoes"] }
  ];
  const NUMBER_FIELDS = ["peso", "dest_lat", "dest_lng"];
  const DRIVER_FIELDS = ["motorista_nome", "motorista_cpf", "motorista_telefone"];
  const DATETIME_FIELDS = ["periodo_inicio", "periodo_fim"];
  const normHeader = (s) => String(s == null ? "" : s).replace(/#/g, " numero ").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

  // Liga cada campo à primeira coluna com nome conhecido — ignorando colunas sem nenhum dado
  function autoMap(headers, data, dataStart){
    const normed = headers.map(normHeader);
    const sample = data.slice(dataStart, dataStart + 300);
    const hasData = (i) => sample.some(r => r && String(r[i] == null ? "" : r[i]).trim() !== "");
    const used = new Set();
    const mapping = {};
    for (const f of IMPORT_FIELDS) {
      const cands = [...f.syn.map(normHeader), normHeader(f.key)];   // sinônimos têm prioridade, na ordem listada
      for (const cand of cands) {
        const idx = normed.findIndex((h, i) => !used.has(i) && h && h === cand && hasData(i));
        if (idx >= 0) { mapping[f.key] = idx; used.add(idx); break; }
      }
    }
    return mapping;
  }

  // Descobre o cabeçalho: 1ª linha não vazia; se houver células mescladas para baixo a partir dela
  // (relatórios com cabeçalho em 2–3 linhas), junta as linhas num nome só por coluna.
  function detectHeader(data, merges){
    const headerIdx = data.findIndex(r => (r || []).some(c => String(c == null ? "" : c).trim() !== ""));
    if (headerIdx < 0) return null;
    let depth = 1;
    (merges || []).forEach(m => { if (m.s.r === headerIdx && m.e.r > m.s.r) depth = Math.max(depth, Math.min(4, m.e.r - headerIdx + 1)); });
    const width = Math.max(...data.slice(headerIdx, headerIdx + depth + 50).map(r => (r || []).length));
    const grid = [];
    for (let d = 0; d < depth; d++) grid.push(Array.from({ length: width }, (_, c) => String((data[headerIdx + d] || [])[c] == null ? "" : data[headerIdx + d][c]).trim()));
    (merges || []).forEach(m => {
      if (m.e.r < headerIdx || m.s.r >= headerIdx + depth) return;
      const v = String((data[m.s.r] || [])[m.s.c] == null ? "" : data[m.s.r][m.s.c]).trim();
      for (let r = Math.max(m.s.r, headerIdx); r <= Math.min(m.e.r, headerIdx + depth - 1); r++)
        for (let c = m.s.c; c <= m.e.c && c < width; c++) if (!grid[r - headerIdx][c]) grid[r - headerIdx][c] = v;
    });
    const headers = Array.from({ length: width }, (_, c) => {
      const parts = [];
      grid.forEach(row => { const v = row[c]; if (v && !parts.includes(v)) parts.push(v); });
      return parts.join(" › ");
    });
    return { headerIdx, dataStart: headerIdx + depth, headers };
  }

  function parseCsvText(text){
    const firstLine = text.split(/\r?\n/).find(l => l.trim()) || "";
    const delim = [";", "\t", ",", "|"].map(d => [d, firstLine.split(d).length]).sort((a, b) => b[1] - a[1])[0][0];
    const rows = [];
    let row = [], cell = "", inQ = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (inQ) {
        if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else inQ = false; }
        else cell += ch;
      } else if (ch === '"' && cell === "") inQ = true;
      else if (ch === delim) { row.push(cell); cell = ""; }
      else if (ch === "\n" || ch === "\r") {
        if (ch === "\r" && text[i + 1] === "\n") i++;
        row.push(cell); rows.push(row); row = []; cell = "";
      } else cell += ch;
    }
    if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
    return rows;
  }

  async function readImportFile(file){
    const buf = await file.arrayBuffer();
    if (/\.(csv|txt)$/i.test(file.name)) {
      let text = new TextDecoder("utf-8").decode(buf);
      if (text.includes("�")) text = new TextDecoder("windows-1252").decode(buf);   // arquivos exportados do Excel/ERP em ANSI
      return { data: parseCsvText(text.replace(/^﻿/, "")), merges: [] };
    }
    if (!window.XLSX) throw new Error("Leitor de planilhas ainda carregando; tente novamente em alguns segundos.");
    const wb = XLSX.read(buf, { type: "array", cellDates: true });
    const ws = wb.Sheets[wb.SheetNames[0]];
    // começa na célula A1 para os índices baterem com as células mescladas (!merges)
    const range = XLSX.utils.decode_range(ws["!ref"] || "A1");
    range.s.r = 0; range.s.c = 0;
    return { data: XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: "", blankrows: true, range }), merges: ws["!merges"] || [] };
  }

  const pad2 = (n) => String(n).padStart(2, "0");
  function normDate(v){
    if (v == null || v === "") return "";
    if (v instanceof Date && !isNaN(v)) return `${v.getFullYear()}-${pad2(v.getMonth() + 1)}-${pad2(v.getDate())}`;
    if (typeof v === "number" && v > 20000 && v < 80000) {           // número serial do Excel
      const d = new Date(Math.round((v - 25569) * 86400000));
      return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
    }
    const s = String(v).trim();
    let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (m) return `${m[1]}-${pad2(m[2])}-${pad2(m[3])}`;
    m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/);
    if (m) {
      const y = m[3].length === 2 ? "20" + m[3] : m[3];
      if (+m[2] >= 1 && +m[2] <= 12 && +m[1] >= 1 && +m[1] <= 31) return `${y}-${pad2(m[2])}-${pad2(m[1])}`;
    }
    return null;   // inválida
  }
  // Data e hora → ISO (hora local do navegador). Aceita "dd/mm/aaaa hh:mm", ISO, Date e serial do Excel.
  function normDateTime(v){
    if (v == null || v === "") return "";
    if (v instanceof Date && !isNaN(v)) return v.toISOString();
    if (typeof v === "number" && v > 20000 && v < 80000) {
      const ms = Math.round((v - 25569) * 86400000), u = new Date(ms);
      return new Date(u.getUTCFullYear(), u.getUTCMonth(), u.getUTCDate(), u.getUTCHours(), u.getUTCMinutes()).toISOString();
    }
    const s = String(v).trim();
    let m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})(?:[ T,]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
    if (m) {
      const y = m[3].length === 2 ? 2000 + +m[3] : +m[3];
      const d = new Date(y, +m[2] - 1, +m[1], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0));
      return isNaN(d) ? null : d.toISOString();
    }
    m = s.match(/^\d{4}-\d{2}-\d{2}/);
    if (m) { const d = new Date(s.length === 10 ? s + "T00:00:00" : s); return isNaN(d) ? null : d.toISOString(); }
    return null;
  }
  function normNumber(v){
    if (v == null || v === "") return "";
    if (typeof v === "number") return isFinite(v) ? String(v) : "";
    let s = String(v).trim().replace(/\s/g, "");
    if (s.includes(",") && s.includes(".")) s = s.replace(/\./g, "").replace(",", ".");
    else if (s.includes(",")) s = s.replace(",", ".");
    return s !== "" && isFinite(Number(s)) ? String(Number(s)) : null;
  }
  function normText(v){
    if (v == null) return "";
    if (v instanceof Date) return normDate(v);
    if (typeof v === "number") return Number.isInteger(v) ? String(v) : String(v);
    return String(v).trim();
  }

  function buildImportRows(data, dataStart, mapping){
    const out = [], localErrors = [];
    let skipped = 0;
    for (let i = dataStart; i < data.length; i++) {
      const raw = data[i] || [];
      if (!raw.some(c => String(c == null ? "" : c).trim() !== "")) continue;
      // linha de total/resumo (ex.: "132 veículos"): sem transportadora, sem motorista e quase vazia
      const filled = Object.values(mapping).filter(ci => String(raw[ci] == null ? "" : raw[ci]).trim() !== "").length;
      const val = (k) => (mapping[k] != null ? String(raw[mapping[k]] == null ? "" : raw[mapping[k]]).trim() : "");
      if (!val("transportadora_cnpj") && !val("transportadora_nome") && !val("motorista_cpf") && filled <= 2) { skipped++; continue; }
      const line = i + 1;
      const row = { linha: line };
      const get = (k) => (mapping[k] != null ? raw[mapping[k]] : "");
      for (const f of IMPORT_FIELDS) {
        const v = get(f.key);
        if (f.key === "data_prevista") {
          const d = normDate(v);
          if (d === null) { localErrors.push({ linha: line, codigo: normText(get("codigo")), aviso: `Data "${v}" não reconhecida — ignorada.` }); row[f.key] = ""; }
          else row[f.key] = d;
        } else if (DATETIME_FIELDS.includes(f.key)) {
          const d = normDateTime(v);
          if (d === null) { localErrors.push({ linha: line, codigo: normText(get("codigo")), aviso: `${f.label} "${v}" não reconhecida — ignorada.` }); row[f.key] = ""; }
          else row[f.key] = d;
        } else if (NUMBER_FIELDS.includes(f.key)) {
          const n = normNumber(v);
          if (n === null) { localErrors.push({ linha: line, codigo: normText(get("codigo")), aviso: `${f.label} "${v}" não é um número — ignorado.` }); row[f.key] = ""; }
          else row[f.key] = n;
        } else {
          row[f.key] = normText(v);
        }
      }
      // sem coluna de data: usa o dia do início da janela
      if (!row.data_prevista && row.periodo_inicio) {
        const d = new Date(row.periodo_inicio);
        row.data_prevista = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
      }
      out.push(row);
    }
    return { rows: out, localWarnings: localErrors, skipped };
  }

  async function renderImportar(content){
    content.innerHTML = `
      <div class="page-head">
        <div>
          <h2>Importar cargas</h2>
          <p>O arquivo exportado do sistema é que "dá carga" nas rotas: cada linha vira (ou atualiza) uma rota, ligada à transportadora e, se informado, ao motorista.</p>
        </div>
        <a class="btn btn-ghost btn-sm" href="modelo-importacao.csv" download>${icon("download")} Baixar modelo</a>
      </div>
      <div class="card card-pad" style="margin-bottom:16px;">
        <label class="dropzone" id="imp-drop">
          <input type="file" id="imp-file" accept=".csv,.txt,.xlsx,.xls" hidden>
          <div style="margin-bottom:6px;">${icon("upload")}</div>
          <b>Clique para escolher</b> ou arraste o arquivo aqui<br>
          <span class="small">Relatório de agendamentos (.xlsx), outra planilha Excel ou CSV — o cabeçalho pode ter várias linhas</span>
        </label>
        <div id="imp-stage"></div>
      </div>
      <div class="card">
        <div class="card-pad" style="padding-bottom:0;"><div class="card-title">Últimas importações</div></div>
        <div class="table-wrap"><table class="tbl"><thead><tr><th>Data</th><th>Arquivo</th><th>Linhas</th><th>Novas</th><th>Atualizadas</th><th>Erros</th></tr></thead>
        <tbody id="imp-hist"><tr><td colspan="6" class="empty">Carregando...</td></tr></tbody></table></div>
      </div>`;

    async function loadHistory(){
      const { data, error } = await sb.from("lg_import_batches").select("*").order("created_at", { ascending: false }).limit(15);
      if (error) { $("#imp-hist").innerHTML = `<tr><td colspan="6" class="empty">${esc(errMsg(error))}</td></tr>`; return; }
      $("#imp-hist").innerHTML = (data || []).length ? data.map(b => `<tr>
        <td>${fmtDateTime(b.created_at)}</td><td>${esc(b.file_name || "—")}</td><td>${b.total}</td><td>${b.inserted}</td><td>${b.updated}</td>
        <td>${b.failed ? `<span class="badge badge-off">${b.failed}</span>` : "0"}</td></tr>`).join("")
        : `<tr><td colspan="6" class="empty">Nenhuma importação ainda.</td></tr>`;
    }
    loadHistory();

    const drop = $("#imp-drop"), input = $("#imp-file");
    input.addEventListener("change", () => { if (input.files[0]) handleFile(input.files[0]); input.value = ""; });
    drop.addEventListener("dragover", (e) => { e.preventDefault(); drop.classList.add("over"); });
    drop.addEventListener("dragleave", () => drop.classList.remove("over"));
    drop.addEventListener("drop", (e) => { e.preventDefault(); drop.classList.remove("over"); if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]); });

    async function handleFile(file){
      const stage = $("#imp-stage");
      stage.innerHTML = `<div class="empty">Lendo ${esc(file.name)}...</div>`;
      let data, merges;
      try { ({ data, merges } = await readImportFile(file)); }
      catch (e) { stage.innerHTML = `<div class="result-box result-err">Não foi possível ler o arquivo: ${esc(errMsg(e))}</div>`; return; }
      const hd = detectHeader(data, merges);
      if (!hd || data.length - hd.dataStart < 1) { stage.innerHTML = `<div class="result-box result-err">O arquivo está vazio ou só tem o cabeçalho.</div>`; return; }
      const { dataStart, headers } = hd;
      const mapping = autoMap(headers, data, dataStart);
      const totalLines = buildImportRows(data, dataStart, mapping).rows.length;

      const colOpts = (sel) => `<option value="">(não usar)</option>` + headers.map((h, i) => `<option value="${i}" ${sel === i ? "selected" : ""}>${esc(h || "Coluna " + (i + 1))}</option>`).join("");
      stage.innerHTML = `
        <div class="section-title">${esc(file.name)} — ${totalLines} linha(s)</div>
        <div class="muted small">Confira de qual coluna do arquivo vem cada informação. Reconhecemos automaticamente as colunas com nomes conhecidos.</div>
        <div class="map-grid">
          ${IMPORT_FIELDS.map(f => `<div class="fl"><label>${esc(f.label)}${f.req ? ' <span class="req">*</span>' : ""}</label>
            <select class="select" data-field="${f.key}">${colOpts(mapping[f.key])}</select></div>`).join("")}
        </div>
        <label class="check"><input type="checkbox" id="imp-create" checked> Cadastrar automaticamente transportadoras que ainda não existem</label>
        <label class="check" style="margin-top:6px;"><input type="checkbox" id="imp-drivers"> Importar dados dos motoristas (nome, documento e telefone)</label>
        <div class="section-title">Pré-visualização</div>
        <div class="card table-wrap" style="max-height:340px;" id="imp-preview"></div>
        <div id="imp-check"></div>
        <div class="form-error" id="imp-err" style="margin-top:12px;"></div>
        <div class="form-actions"><button class="btn btn-primary" id="imp-go">${icon("upload")} Importar</button></div>
        <div id="imp-result"></div>`;

      const currentMapping = () => {
        const mp = {};
        $$("[data-field]", stage).forEach(s => { if (s.value !== "") mp[s.dataset.field] = Number(s.value); });
        return mp;
      };
      function preview(){
        const mp = currentMapping();
        const withDrivers = $("#imp-drivers", stage) && $("#imp-drivers", stage).checked;
        const used = IMPORT_FIELDS.filter(f => mp[f.key] != null && (withDrivers || !DRIVER_FIELDS.includes(f.key)));
        const { rows } = buildImportRows(data.slice(0, dataStart + 15), dataStart, mp);
        $("#imp-preview", stage).innerHTML = used.length ? `<table class="tbl"><thead><tr><th>Linha</th>${used.map(f => `<th>${esc(f.label)}</th>`).join("")}</tr></thead>
          <tbody>${rows.map(r => `<tr><td class="muted">${r.linha}</td>${used.map(f => `<td>${esc(f.key === "data_prevista" ? fmtDate(r[f.key]).replace("—", "") : DATETIME_FIELDS.includes(f.key) ? (r[f.key] ? fmtDateTime(r[f.key]) : "") : r[f.key])}</td>`).join("")}</tr>`).join("")}</tbody></table>`
          : `<div class="empty">Escolha as colunas acima.</div>`;
      }
      // Antes de importar: quantas rotas são novas, quantas já existem (serão atualizadas pelo #)
      // e quais # aparecem repetidos no próprio arquivo
      let checkSeq = 0;
      async function checkExisting(){
        const box = $("#imp-check", stage);
        const mp = currentMapping();
        if (mp.codigo == null) { box.innerHTML = ""; return; }
        const seq = ++checkSeq;
        const codes = buildImportRows(data, dataStart, mp).rows.map(r => r.codigo).filter(Boolean);
        const count = new Map();
        codes.forEach(c => count.set(c, (count.get(c) || 0) + 1));
        const repeated = Array.from(count.entries()).filter(([, n]) => n > 1);
        const unique = Array.from(count.keys());
        box.innerHTML = `<div class="result-box result-warn">Conferindo quais rotas já existem...</div>`;
        let existing = 0;
        try {
          for (let i = 0; i < unique.length; i += 200) {
            const { data: found, error } = await sb.from("lg_routes").select("codigo").in("codigo", unique.slice(i, i + 200));
            if (error) throw error;
            existing += (found || []).length;
          }
        } catch (e) { if (seq === checkSeq) box.innerHTML = ""; return; }
        if (seq !== checkSeq) return;
        box.innerHTML = `<div class="result-box ${repeated.length ? "result-warn" : "result-ok"}">
          <b>${unique.length - existing}</b> rota(s) nova(s) e <b>${existing}</b> que já existe(m) e será(ão) <b>atualizada(s)</b> — o nº do agendamento (#) não se repete no sistema.
          ${repeated.length ? `<br><b>${repeated.length} nº repetido(s) dentro do arquivo</b> — vale a última linha de cada: ${repeated.slice(0, 15).map(([c, n]) => `${esc(c)} (${n}x)`).join(", ")}${repeated.length > 15 ? "..." : ""}` : ""}
        </div>`;
      }
      $$("[data-field]", stage).forEach(s => s.addEventListener("change", () => { if (s.dataset.field === "codigo") checkExisting(); }));
      checkExisting();

      $$("[data-field]", stage).forEach(s => s.addEventListener("change", preview));
      $("#imp-drivers", stage).addEventListener("change", preview);
      preview();

      $("#imp-go", stage).addEventListener("click", async () => {
        const mp = currentMapping();
        const errEl = $("#imp-err", stage);
        if (mp.codigo == null) return setFormError(errEl, "Indique a coluna do código da carga.");
        if (mp.transportadora_cnpj == null && mp.transportadora_nome == null) return setFormError(errEl, "Indique a coluna do CNPJ ou do nome da transportadora.");
        setFormError(errEl, "");
        const { rows, localWarnings, skipped } = buildImportRows(data, dataStart, mp);
        // Dados pessoais dos motoristas só vão para o banco se a opção estiver marcada
        if (!$("#imp-drivers", stage).checked) DRIVER_FIELDS.forEach(k => rows.forEach(r => { r[k] = ""; }));
        const btn = $("#imp-go", stage);
        btn.disabled = true;
        const agg = { total: 0, inserted: 0, updated: 0, errors: [], warnings: localWarnings.slice() };
        try {
          const CHUNK = 400;
          for (let i = 0; i < rows.length; i += CHUNK) {
            btn.textContent = `Importando ${Math.min(i + CHUNK, rows.length)} de ${rows.length}...`;
            const part = rows.length > CHUNK ? ` (parte ${i / CHUNK + 1})` : "";
            const { data: res, error } = await sb.rpc("lg_import_routes", {
              p_rows: rows.slice(i, i + CHUNK), p_file_name: file.name + part, p_create_carriers: $("#imp-create", stage).checked
            });
            if (error) throw error;
            agg.total += res.total; agg.inserted += res.inserted; agg.updated += res.updated;
            agg.errors.push(...res.errors); agg.warnings.push(...res.warnings);
          }
        } catch (e) {
          agg.fatal = errMsg(e);
        }
        btn.disabled = false;
        btn.innerHTML = `${icon("upload")} Importar novamente`;
        const li = (x) => `<li>Linha ${esc(x.linha)}${x.codigo ? " (" + esc(x.codigo) + ")" : ""}: ${esc(x.erro || x.aviso)}</li>`;
        $("#imp-result", stage).innerHTML = `
          ${agg.fatal ? `<div class="result-box result-err"><b>A importação foi interrompida:</b> ${esc(agg.fatal)}</div>` : ""}
          ${agg.total ? `<div class="result-box result-ok"><b>${agg.inserted}</b> rota(s) nova(s) e <b>${agg.updated}</b> atualizada(s), de ${agg.total} linha(s).${skipped ? ` ${skipped} linha(s) de total/resumo ignorada(s).` : ""}</div>` : ""}
          ${agg.errors.length ? `<div class="result-box result-err"><b>${agg.errors.length} linha(s) não importada(s):</b><ul>${agg.errors.map(li).join("")}</ul></div>` : ""}
          ${agg.warnings.length ? `<div class="result-box result-warn"><b>Avisos:</b><ul>${agg.warnings.map(li).join("")}</ul></div>` : ""}`;
        loadHistory();
        loadRefs().catch(() => {});
        checkExisting();
      });
    }
  }

  /* ============================================================
     TRANSPORTADORAS (contratante)
     ============================================================ */
  async function renderTransportadoras(content){
    content.innerHTML = `
      <div class="page-head">
        <div><h2>Transportadoras</h2><p>Empresas que fazem as entregas. Cada uma acompanha os próprios motoristas.</p></div>
        <button class="btn btn-primary btn-sm" id="tr-new">${icon("plus")} Nova transportadora</button>
      </div>
      <div class="card"><div class="table-wrap"><table class="tbl">
        <thead><tr><th>Nome</th><th>CNPJ</th><th class="hide-sm">Contato</th><th>Motoristas</th><th>Status</th><th></th></tr></thead>
        <tbody id="tr-body"></tbody>
      </table></div></div>`;

    function draw(){
      $("#tr-body").innerHTML = state.carriers.length ? state.carriers.map(c => {
        const n = drivers().filter(d => d.carrier_id === c.id).length;
        return `<tr>
          <td><b>${esc(c.nome)}</b></td>
          <td class="mono">${esc(fmtCnpj(c.cnpj) || "—")}</td>
          <td class="hide-sm">${esc([c.telefone, c.email].filter(Boolean).join(" · ") || "—")}</td>
          <td>${n}</td>
          <td>${c.ativo ? `<span class="badge st-entregue">Ativa</span>` : `<span class="badge badge-off">Inativa</span>`}</td>
          <td class="actions">
            <button class="btn btn-ghost btn-sm" data-edit="${c.id}">${icon("edit")}</button>
            <button class="btn btn-danger btn-sm" data-del="${c.id}">${icon("trash")}</button>
          </td></tr>`;
      }).join("") : `<tr><td colspan="6" class="empty">Nenhuma transportadora. Cadastre aqui ou deixe que a importação crie automaticamente.</td></tr>`;
      $$("[data-edit]").forEach(b => b.addEventListener("click", () => openCarrierForm(state.carriers.find(c => c.id === b.dataset.edit))));
      $$("[data-del]").forEach(b => b.addEventListener("click", () => deleteCarrier(state.carriers.find(c => c.id === b.dataset.del))));
    }
    $("#tr-new").addEventListener("click", () => openCarrierForm(null));

    async function deleteCarrier(c){
      if (!(await confirmDialog("Excluir transportadora?", `<b>${esc(c.nome)}</b> será excluída. Só é possível excluir transportadoras sem usuários e sem rotas — caso contrário, desative-a.`, "Excluir", true))) return;
      const { error } = await sb.from("lg_carriers").delete().eq("id", c.id);
      if (error) { toast(/foreign key|violates/i.test(error.message) ? "Esta transportadora tem usuários ou rotas. Desative-a em vez de excluir." : errMsg(error), true); return; }
      toast("Transportadora excluída.");
      await loadRefs(); draw();
    }

    function openCarrierForm(c){
      const m = openModal(`${modalHead(c ? "Editar transportadora" : "Nova transportadora")}
        <div class="form-error" id="cf-err"></div>
        <form id="cf-form" class="form-grid">
          <div class="fl full"><label>Nome *</label><input class="input" id="cf-nome" required value="${esc(c ? c.nome : "")}"></div>
          <div class="fl"><label>CNPJ</label><input class="input" id="cf-cnpj" inputmode="numeric" value="${esc(c ? fmtCnpj(c.cnpj) : "")}" placeholder="00.000.000/0000-00"></div>
          <div class="fl"><label>Telefone</label><input class="input" id="cf-tel" value="${esc(c ? c.telefone : "")}"></div>
          <div class="fl full"><label>E-mail</label><input class="input" type="email" id="cf-email" value="${esc(c ? c.email : "")}"></div>
          ${c ? `<label class="check full"><input type="checkbox" id="cf-ativo" ${c.ativo ? "checked" : ""}> Ativa</label>` : ""}
          <div class="form-actions full"><button type="button" class="btn btn-ghost" data-close>Cancelar</button><button class="btn btn-primary">Salvar</button></div>
        </form>`);
      $("#cf-form", m).addEventListener("submit", async (e) => {
        e.preventDefault();
        const cnpj = digits($("#cf-cnpj", m).value);
        if (cnpj && cnpj.length !== 14) return setFormError($("#cf-err", m), "CNPJ deve ter 14 dígitos.");
        const payload = { nome: $("#cf-nome", m).value.trim(), cnpj: cnpj || null, telefone: $("#cf-tel", m).value.trim(), email: $("#cf-email", m).value.trim() };
        if (c) payload.ativo = $("#cf-ativo", m).checked;
        const { error } = c ? await sb.from("lg_carriers").update(payload).eq("id", c.id) : await sb.from("lg_carriers").insert(payload);
        if (error) return setFormError($("#cf-err", m), /cnpj_key|duplicate/i.test(error.message) ? "Já existe uma transportadora com este CNPJ." : errMsg(error));
        closeModal(); toast("Transportadora salva.");
        await loadRefs(); draw();
      });
    }
    draw();
  }

  /* ============================================================
     USUÁRIOS / MOTORISTAS
     ============================================================ */
  async function callUsersFn(payload){
    const { data: { session } } = await sb.auth.getSession();
    let res;
    try {
      res = await fetch(USERS_FN, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + (session ? session.access_token : "") },
        body: JSON.stringify(payload)
      });
    } catch (e) { throw new Error("Sem conexão com o servidor."); }
    let body = {};
    try { body = await res.json(); } catch (_) {}
    if (!res.ok) throw new Error(body.error || (res.status === 404 ? "Função de cadastro não encontrada — o site precisa estar publicado no Netlify (veja o README)." : "Erro " + res.status));
    return body;
  }

  async function renderUsuarios(content){
    const contr = isContratante();
    content.innerHTML = `
      <div class="page-head">
        <div><h2>${contr ? "Usuários" : "Motoristas"}</h2>
          <p>${contr ? "Contratantes, usuários das transportadoras e motoristas." : "Motoristas da sua transportadora. Eles entram no app com o CPF (ou documento) e a senha que você definir."}</p></div>
        <button class="btn btn-primary btn-sm" id="us-new">${icon("plus")} ${contr ? "Novo usuário" : "Novo motorista"}</button>
      </div>
      ${contr ? `<div class="filters">
        <select class="select" id="us-role"><option value="">Todos os perfis</option>${Object.keys(ROLE_LABEL).map(r => `<option value="${r}">${ROLE_LABEL[r]}</option>`).join("")}</select>
        <select class="select" id="us-carrier"><option value="">Todas as transportadoras</option>${state.carriers.map(c => `<option value="${c.id}">${esc(c.nome)}</option>`).join("")}</select>
      </div>` : ""}
      <div id="us-pending"></div>
      <div class="card"><div class="table-wrap"><table class="tbl">
        <thead><tr><th>Nome</th>${contr ? "<th>Perfil</th><th>Transportadora</th>" : ""}<th>Login</th><th class="hide-sm">Telefone</th><th class="hide-sm">Placa</th><th>Última posição</th><th></th></tr></thead>
        <tbody id="us-body"></tbody>
      </table></div></div>`;

    let statusById = new Map();
    async function loadStatus(){
      const { data } = await sb.from("lg_driver_status").select("driver_id,recorded_at");
      statusById = new Map((data || []).map(s => [s.driver_id, s]));
    }
    function draw(){
      const rf = ($("#us-role") || {}).value, cf = ($("#us-carrier") || {}).value;
      const list = state.users.filter(u => (contr || u.role === "motorista" || u.id === state.me.id) && (!rf || u.role === rf) && (!cf || u.carrier_id === cf));
      const cols = contr ? 8 : 6;
      $("#us-body").innerHTML = list.length ? list.map(u => {
        const st = statusById.get(u.id);
        const login = u.role === "motorista" ? `${digits(u.cpf).length === 11 ? "CPF" : "Doc."} ${fmtDoc(u.cpf)}${isSyntheticEmail(u.email) ? "" : `<div class="muted small">${esc(u.email)}</div>`}` : esc(u.email);
        const canManage = u.id !== state.me.id && (contr || u.role === "motorista");
        return `<tr>
          <td><b>${esc(u.nome)}</b> ${u.ativo ? "" : `<span class="badge badge-off">Inativo</span>`}</td>
          ${contr ? `<td><span class="badge badge-role">${ROLE_LABEL[u.role]}</span></td><td>${u.carrier_id ? esc(carrierName(u.carrier_id)) : "—"}</td>` : ""}
          <td>${login}</td>
          <td class="hide-sm">${esc(u.telefone || "—")}</td>
          <td class="hide-sm mono">${esc(u.placa || "—")}</td>
          <td>${u.role === "motorista" ? `<span class="row" style="gap:6px;flex-wrap:nowrap;"><span class="avatar ${st ? freshness(st.recorded_at) : ""}" style="width:10px;height:10px;"></span>${esc(timeAgo(st && st.recorded_at))}</span>` : `<span class="muted">—</span>`}</td>
          <td class="actions">${canManage ? `<button class="btn btn-ghost btn-sm" data-edit="${u.id}" aria-label="Editar">${icon("edit")}</button><button class="btn btn-danger btn-sm" data-del="${u.id}" aria-label="Excluir">${icon("trash")}</button>` : ""}</td>
        </tr>`;
      }).join("") : `<tr><td colspan="${cols}" class="empty">Nenhum usuário encontrado.</td></tr>`;
      $$("[data-edit]").forEach(b => b.addEventListener("click", () => openUserForm(state.users.find(u => u.id === b.dataset.edit))));
      $$("[data-del]").forEach(b => b.addEventListener("click", () => deleteUser(state.users.find(u => u.id === b.dataset.del))));
    }
    // Motoristas que aparecem nas cargas importadas mas ainda não têm acesso ao app
    let pending = [];
    async function loadPending(){
      const { data } = await sb.from("lg_routes").select("motorista_nome,motorista_cpf,motorista_telefone,placa,carrier_id")
        .is("driver_id", null).in("status", ["pendente", "em_rota"]).not("motorista_cpf", "is", null).limit(2000);
      const known = new Set(drivers().map(d => d.cpf));
      const seen = new Map();
      (data || []).forEach(x => { if (x.motorista_cpf && !known.has(x.motorista_cpf) && !seen.has(x.motorista_cpf)) seen.set(x.motorista_cpf, x); });
      pending = Array.from(seen.values()).sort((a, b) => String(a.motorista_nome).localeCompare(String(b.motorista_nome)));
    }
    function drawPending(){
      const el = $("#us-pending");
      if (!el) return;
      const cf = ($("#us-carrier") || {}).value;
      const list = pending.filter(p => !cf || p.carrier_id === cf);
      el.innerHTML = list.length ? `<div class="card" style="margin-bottom:14px;">
        <div class="card-pad" style="padding-bottom:4px;">
          <div class="card-title" style="margin-bottom:4px;">Motoristas das cargas ainda sem acesso (${list.length})</div>
          <div class="muted small">Eles vieram no arquivo importado. Ao cadastrar, as cargas com o documento deles passam para eles automaticamente.</div>
        </div>
        <div class="table-wrap" style="max-height:260px;"><table class="tbl"><tbody>
          ${list.map(p => `<tr><td><b>${esc(p.motorista_nome || "—")}</b></td><td>${esc(fmtDoc(p.motorista_cpf))}</td>${contr ? `<td>${esc(carrierName(p.carrier_id))}</td>` : ""}<td class="hide-sm">${esc(p.motorista_telefone || "")}</td><td class="hide-sm mono">${esc(p.placa || "")}</td>
            <td class="actions"><button class="btn btn-primary btn-sm" data-pend="${esc(p.motorista_cpf)}">${icon("plus")} Cadastrar</button></td></tr>`).join("")}
        </tbody></table></div></div>` : "";
      $$("[data-pend]", el).forEach(b => b.addEventListener("click", () => {
        const p = pending.find(x => x.motorista_cpf === b.dataset.pend);
        openUserForm(null, { nome: p.motorista_nome, cpf: p.motorista_cpf, telefone: p.motorista_telefone, placa: p.placa, carrier_id: p.carrier_id });
      }));
    }
    const refresh = async () => { await loadRefs(); await loadPending(); draw(); drawPending(); };

    ["us-role", "us-carrier"].forEach(id => { const el = $("#" + id); if (el) el.addEventListener("change", () => { draw(); drawPending(); }); });
    $("#us-new").addEventListener("click", () => openUserForm(null));

    async function deleteUser(u){
      if (!(await confirmDialog("Excluir usuário?", `<b>${esc(u.nome)}</b> perderá o acesso. As rotas atribuídas a ele ficarão sem motorista; o histórico de posições será apagado. Se quiser só bloquear o acesso, edite e desmarque "Ativo".`, "Excluir", true))) return;
      try { await callUsersFn({ action: "delete", id: u.id }); toast("Usuário excluído."); await refresh(); }
      catch (e) { toast(errMsg(e), true); }
    }

    function openUserForm(u, pre){
      const editing = !!u;
      pre = pre || {};
      const role0 = u ? u.role : (contr ? "motorista" : "motorista");
      const m = openModal(`${modalHead(editing ? "Editar " + esc(u.nome) : (contr ? "Novo usuário" : "Novo motorista"))}
        <div class="form-error" id="uf-err"></div>
        <form id="uf-form" class="form-grid" autocomplete="off">
          <div class="fl full"><label>Nome *</label><input class="input" id="uf-nome" required value="${esc(u ? u.nome : (pre.nome || ""))}"></div>
          ${contr && !editing ? `<div class="fl"><label>Perfil *</label><select class="select" id="uf-role">
              ${Object.keys(ROLE_LABEL).map(r => `<option value="${r}" ${r === role0 ? "selected" : ""}>${ROLE_LABEL[r]}</option>`).join("")}</select></div>` : ""}
          ${contr ? `<div class="fl" data-show="carrier"><label>Transportadora *</label><select class="select" id="uf-carrier">
              <option value="">Selecione...</option>${state.carriers.filter(c => c.ativo || (u && u.carrier_id === c.id)).map(c => `<option value="${c.id}" ${(u ? u.carrier_id : pre.carrier_id) === c.id ? "selected" : ""}>${esc(c.nome)}</option>`).join("")}</select></div>` : ""}
          ${!editing ? `
            <div class="fl" data-show="driver"><label>CPF / documento * <span class="muted">(login do motorista)</span></label><input class="input" id="uf-cpf" inputmode="numeric" placeholder="000.000.000-00" value="${esc(fmtDoc(pre.cpf))}"></div>
            <div class="fl"><label>E-mail <span data-show="driver" class="muted">(opcional)</span></label><input class="input" type="email" id="uf-email" placeholder="nome@empresa.com"></div>` : ""}
          <div class="fl"><label>Telefone</label><input class="input" id="uf-tel" value="${esc(u ? u.telefone : (pre.telefone || ""))}"></div>
          <div class="fl" data-show="driver"><label>Placa padrão</label><input class="input" id="uf-placa" value="${esc(u ? u.placa : (pre.placa || ""))}" placeholder="ABC1D23"></div>
          <div class="fl ${editing ? "" : "full"}"><label>${editing ? "Nova senha <span class=\"muted\">(deixe em branco para manter)</span>" : "Senha inicial *"}</label><input class="input" type="text" id="uf-pass" minlength="6" ${editing ? "" : "required"} placeholder="mínimo 6 caracteres" autocomplete="new-password"></div>
          ${editing ? `<label class="check full"><input type="checkbox" id="uf-ativo" ${u.ativo ? "checked" : ""}> Ativo (desmarque para bloquear o acesso)</label>` : ""}
          <div class="form-actions full"><button type="button" class="btn btn-ghost" data-close>Cancelar</button><button class="btn btn-primary" id="uf-save">Salvar</button></div>
        </form>`);

      const roleNow = () => (u ? u.role : (($("#uf-role", m) || {}).value || "motorista"));
      const syncRole = () => {
        const r = roleNow();
        $$("[data-show=driver]", m).forEach(el => { el.hidden = r !== "motorista"; });
        $$("[data-show=carrier]", m).forEach(el => { el.hidden = r === "contratante"; });
      };
      const roleSel = $("#uf-role", m);
      if (roleSel) roleSel.addEventListener("change", syncRole);
      syncRole();

      $("#uf-form", m).addEventListener("submit", async (e) => {
        e.preventDefault();
        const errEl = $("#uf-err", m);
        setFormError(errEl, "");
        const btn = $("#uf-save", m);
        const role = roleNow();
        const carrierSel = $("#uf-carrier", m);
        const carrierId = role === "contratante" ? null : (contr ? (carrierSel ? carrierSel.value : null) : state.me.carrier_id);
        const pass = $("#uf-pass", m).value;
        if (role !== "contratante" && !carrierId) return setFormError(errEl, "Selecione a transportadora.");
        if (pass && pass.length < 6) return setFormError(errEl, "A senha precisa ter ao menos 6 caracteres.");
        btn.disabled = true; btn.textContent = "Salvando...";
        try {
          if (editing) {
            const upd = { nome: $("#uf-nome", m).value.trim(), telefone: $("#uf-tel", m).value.trim(), ativo: $("#uf-ativo", m).checked };
            if (role === "motorista") upd.placa = $("#uf-placa", m).value.trim().toUpperCase();
            if (contr && role !== "contratante") upd.carrier_id = carrierId;
            const { error } = await sb.from("lg_users").update(upd).eq("id", u.id);
            if (error) throw error;
            if (pass) await callUsersFn({ action: "password", id: u.id, password: pass });
          } else {
            const cpf = digits(($("#uf-cpf", m) || {}).value);
            const email = ($("#uf-email", m) || {}).value.trim();
            if (role === "motorista" && (cpf.length < 5 || cpf.length > 14)) throw new Error("Informe o CPF (11 dígitos) ou documento do motorista.");
            if (role !== "motorista" && !email) throw new Error("Informe o e-mail.");
            await callUsersFn({
              action: "create", nome: $("#uf-nome", m).value.trim(), role, carrier_id: carrierId,
              cpf, email, password: pass, telefone: $("#uf-tel", m).value.trim(), placa: (($("#uf-placa", m) || {}).value || "").trim()
            });
          }
          closeModal();
          toast(editing ? "Usuário atualizado." : (role === "motorista" ? "Motorista cadastrado. Ele entra com o CPF e a senha definida." : "Usuário cadastrado."));
          await refresh();
        } catch (err) {
          setFormError(errEl, errMsg(err));
          btn.disabled = false; btn.textContent = "Salvar";
        }
      });
    }

    await Promise.all([loadStatus(), loadPending()]);
    draw();
    drawPending();
    autoRefresh(async () => { if (!$("#modal-overlay").hidden) return; await Promise.all([loadRefs(), loadStatus()]); await loadPending(); draw(); drawPending(); }, 30 * 1000);
  }

  /* ============================================================
     RASTREADOR (motorista)
     ============================================================ */
  // Dentro do app Android (Capacitor) o GPS roda num serviço nativo e continua com a tela
  // bloqueada; no navegador usamos a geolocalização do próprio navegador.
  const nativeApp = () => {
    const c = window.Capacitor;
    return c && typeof c.isNativePlatform === "function" && c.isNativePlatform() && typeof c.nativeCallback === "function" ? c : null;
  };

  const tracker = {
    active: false,
    nativeWatchId: null,
    routeId: null,
    watchId: null,
    status: "idle",           // idle | waiting | on | denied | unavailable | insecure
    lastFix: null,            // { lat, lng, accuracy, ts }
    lastSent: null,           // { lat, lng, ts }
    lastSentAt: null,
    wakeLock: null,
    flushTimer: null,
    flushing: false,
    onChange: null,

    queueKey(){ return "lg_loc_queue_" + (state.me ? state.me.id : ""); },
    readQueue(){ try { return JSON.parse(localStorage.getItem(this.queueKey()) || "[]"); } catch (_) { return []; } },
    writeQueue(q){ try { localStorage.setItem(this.queueKey(), JSON.stringify(q.slice(-3000))); } catch (_) {} },
    pending(){ return this.readQueue().length; },
    emit(){ if (this.onChange) this.onChange(); },

    start(routeId){
      this.routeId = routeId;
      if (this.active) { this.emit(); return; }
      if (!nativeApp()) {
        if (!window.isSecureContext) { this.status = "insecure"; this.emit(); return; }
        if (!("geolocation" in navigator)) { this.status = "unavailable"; this.emit(); return; }
      }
      this.active = true;
      this.status = "waiting";
      const cap = nativeApp();
      if (cap) {
        // serviço em primeiro plano com notificação fixa: segue rastreando com a tela bloqueada
        this.nativeWatchId = cap.nativeCallback("BackgroundGeolocation", "addWatcher", {
          backgroundTitle: "Rastreamento ativo",
          backgroundMessage: "Sua localização está sendo enviada durante a rota.",
          requestPermissions: true,
          stale: false,
          distanceFilter: 25
        }, (loc, err) => {
          if (err) {
            this.status = err.code === "NOT_AUTHORIZED" ? "denied" : "waiting";
            if (err.code === "NOT_AUTHORIZED") this.stopWatch();
            this.emit();
            return;
          }
          if (!loc) return;
          this.onPosition({ coords: { latitude: loc.latitude, longitude: loc.longitude, accuracy: loc.accuracy, speed: loc.speed, heading: loc.bearing }, timestamp: loc.time || Date.now() });
        });
      } else this.watchId = navigator.geolocation.watchPosition(
        (p) => this.onPosition(p),
        (err) => {
          this.status = err.code === 1 ? "denied" : "waiting";
          if (err.code === 1) this.stopWatch();
          this.emit();
        },
        { enableHighAccuracy: true, maximumAge: 10000, timeout: 60000 }
      );
      this.requestWakeLock();
      this.flushTimer = setInterval(() => {
        // sinal de vida mesmo parado, caso o GPS não dispare eventos novos
        if (this.lastFix && Date.now() - (this.lastSentAt || 0) >= HEARTBEAT_MS) this.enqueue(this.lastFix, true);
        this.flush();
      }, 15000);
      this.emit();
    },
    stopWatch(){
      if (this.watchId != null) navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
      const cap = nativeApp();
      if (cap && this.nativeWatchId != null) cap.nativePromise("BackgroundGeolocation", "removeWatcher", { id: this.nativeWatchId }).catch(() => {});
      this.nativeWatchId = null;
    },
    openSettings(){
      const cap = nativeApp();
      if (cap) cap.nativePromise("BackgroundGeolocation", "openSettings", {}).catch(() => {});
    },
    stop(){
      this.stopWatch();
      clearInterval(this.flushTimer);
      this.flushTimer = null;
      this.releaseWakeLock();
      this.active = false;
      this.routeId = null;
      this.status = "idle";
      this.flush();
      this.emit();
    },
    onPosition(p){
      const fix = { lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy, speed: p.coords.speed, heading: p.coords.heading, ts: p.timestamp || Date.now() };
      this.lastFix = fix;
      this.status = "on";
      const ls = this.lastSent;
      const dt = ls ? fix.ts - ls.ts : Infinity;
      const moved = ls ? distanceM(ls, fix) : Infinity;
      if (!ls || (dt >= SEND_INTERVAL_MS && moved >= MIN_DISTANCE_M) || dt >= HEARTBEAT_MS) this.enqueue(fix);
      this.emit();
    },
    enqueue(fix, heartbeat){
      const num = (v) => (typeof v === "number" && isFinite(v) ? v : null);
      const ts = heartbeat ? Date.now() : fix.ts;
      const q = this.readQueue();
      q.push({
        driver_id: state.me.id,
        route_id: this.routeId,
        lat: fix.lat, lng: fix.lng,
        accuracy: num(fix.accuracy), speed: heartbeat ? 0 : num(fix.speed), heading: num(fix.heading),
        recorded_at: new Date(ts).toISOString()
      });
      this.writeQueue(q);
      this.lastSent = { lat: fix.lat, lng: fix.lng, ts: fix.ts };
      this.lastSentAt = Date.now();
      this.flush();
    },
    async flush(){
      if (this.flushing || !navigator.onLine) return;
      const q = this.readQueue();
      if (!q.length) return;
      this.flushing = true;
      const batch = q.slice(0, 200);
      try {
        const { error } = await this.insertBatch(batch);
        // erro de permissão (rota reatribuída etc.) não pode travar a fila: descarta o lote
        if (!error || error.code === "42501" || error.code === "23503") {
          this.writeQueue(this.readQueue().slice(batch.length));
        }
      } catch (_) { /* sem rede: tenta de novo depois */ }
      this.flushing = false;
      this.emit();
      if (this.readQueue().length && navigator.onLine) setTimeout(() => this.flush(), 1000);
    },
    // No app, envia pelo HTTP nativo: o Android limita requisições do WebView em segundo plano
    async insertBatch(batch){
      const cap = nativeApp();
      if (!cap) return sb.from("lg_locations").insert(batch);
      const { data: { session } } = await sb.auth.getSession();
      if (!session) return { error: { code: "no-session" } };
      const res = await cap.nativePromise("CapacitorHttp", "request", {
        url: SUPABASE_URL + "/rest/v1/lg_locations",
        method: "POST",
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: "Bearer " + session.access_token,
          "Content-Type": "application/json",
          Prefer: "return=minimal"
        },
        data: batch
      });
      if (res.status >= 200 && res.status < 300) return { error: null };
      const body = typeof res.data === "string" ? (() => { try { return JSON.parse(res.data); } catch (_) { return {}; } })() : (res.data || {});
      return { error: { code: body.code || String(res.status), message: body.message || "HTTP " + res.status } };
    },
    async requestWakeLock(){
      try {
        if ("wakeLock" in navigator && document.visibilityState === "visible" && !this.wakeLock) {
          this.wakeLock = await navigator.wakeLock.request("screen");
          this.wakeLock.addEventListener("release", () => { this.wakeLock = null; });
        }
      } catch (_) { this.wakeLock = null; }
    },
    releaseWakeLock(){ if (this.wakeLock) { this.wakeLock.release().catch(() => {}); this.wakeLock = null; } }
  };
  window.addEventListener("online", () => tracker.flush());
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && tracker.active) { tracker.requestWakeLock(); tracker.flush(); }
  });
  window.addEventListener("beforeunload", (e) => {
    if (tracker.active && !nativeApp()) { e.preventDefault(); e.returnValue = ""; }
  });

  /* ============================================================
     MOTORISTA
     ============================================================ */
  async function renderMotorista(content){
    let tab = "abertas";
    let routes = [];

    content.innerHTML = `
      <div class="driver-wrap">
        <div id="drv-banner"></div>
        <div class="tabs-mini">
          <button data-tab="abertas" class="active">Minhas rotas</button>
          <button data-tab="concluidas">Concluídas</button>
          <button class="grow" style="visibility:hidden;"></button>
          <button id="drv-refresh" aria-label="Atualizar">${icon("refresh")}</button>
        </div>
        <div id="drv-list"><div class="empty">Carregando...</div></div>
      </div>`;

    const activeRoute = () => routes.find(r => r.status === "em_rota");

    function drawBanner(){
      const el = $("#drv-banner");
      if (!el) return;
      const ar = activeRoute();
      const pend = tracker.pending();
      let cls = "", title = "", sub = "", btn = "";
      if (!ar) {
        title = "Nenhuma rota em andamento";
        sub = "Ao iniciar uma rota, sua localização passa a ser compartilhada com a transportadora e o contratante.";
      } else if (tracker.status === "on") {
        cls = "on";
        title = `Localização ativa · rota ${esc(ar.codigo)}`;
        sub = `Última posição ${tracker.lastFix ? esc(timeAgo(tracker.lastFix.ts)) : "—"}${tracker.lastFix && tracker.lastFix.accuracy ? ` (±${Math.round(tracker.lastFix.accuracy)} m)` : ""}`
          + (pend ? ` · ${pend} posição(ões) aguardando internet` : "")
          + (nativeApp() ? ". Pode bloquear a tela — o rastreamento continua (notificação “Rastreamento ativo”)." : ". Mantenha o app aberto durante a viagem.");
      } else if (tracker.status === "denied") {
        cls = "off";
        title = "Localização bloqueada";
        sub = nativeApp()
          ? "Permita a localização para o app (Configurações → Permissões → Localização) e toque em “Tentar novamente”."
          : "Permita o acesso à localização para este site nas configurações do navegador e toque em “Tentar novamente”.";
        btn = `${nativeApp() ? `<button class="btn btn-ghost btn-sm" id="drv-settings">Configurações</button> ` : ""}<button class="btn btn-primary btn-sm" id="drv-retry">Tentar novamente</button>`;
      } else if (tracker.status === "insecure") {
        cls = "off";
        title = "Endereço sem HTTPS";
        sub = "O navegador só libera o GPS em sites https://. Abra o app pelo endereço seguro do Netlify.";
      } else if (tracker.status === "unavailable") {
        cls = "off";
        title = "GPS indisponível";
        sub = "Este aparelho/navegador não oferece localização.";
      } else if (tracker.active) {
        cls = "warn";
        title = "Obtendo localização...";
        sub = "Verifique se o GPS do celular está ligado.";
      } else {
        cls = "warn";
        title = "Localização desligada";
        sub = "Toque para voltar a compartilhar sua localização.";
        btn = `<button class="btn btn-primary btn-sm" id="drv-retry">Ativar</button>`;
      }
      el.innerHTML = `<div class="track-banner ${cls}"><span class="pulse"></span><div class="grow"><div class="title">${title}</div><div class="sub">${sub}</div></div>${btn}</div>`;
      const retry = $("#drv-retry", el);
      if (retry) retry.addEventListener("click", () => { tracker.stop(); if (ar) tracker.start(ar.id); });
      const settings = $("#drv-settings", el);
      if (settings) settings.addEventListener("click", () => tracker.openSettings());
    }

    function drawList(){
      const list = tab === "abertas"
        ? routes.filter(r => r.status === "pendente" || r.status === "em_rota")
            .sort((a, b) => (b.status === "em_rota") - (a.status === "em_rota"))   // em andamento primeiro
        : routes.filter(r => r.status === "entregue" || r.status === "cancelada")
            .sort((a, b) => new Date(b.finished_at || 0) - new Date(a.finished_at || 0));
      const el = $("#drv-list");
      if (!list.length) {
        el.innerHTML = `<div class="card empty">${tab === "abertas" ? "Você não tem rotas abertas no momento." : "Nenhuma rota concluída ainda."}</div>`;
        return;
      }
      const hasActive = !!activeRoute();
      el.innerHTML = list.map(r => {
        const docs = r.lg_documents || [];
        const mapsUrl = r.dest_lat != null && r.dest_lng != null
          ? `https://www.google.com/maps/dir/?api=1&destination=${r.dest_lat},${r.dest_lng}`
          : (r.destino ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(r.destino)}` : "");
        let actions = "";
        if (r.status === "pendente") {
          actions = `<button class="btn btn-blue btn-lg" data-start="${r.id}" ${hasActive ? "disabled" : ""}>${icon("play")} Iniciar rota</button>
            ${hasActive ? `<div class="muted small" style="text-align:center;">Finalize a rota em andamento antes de iniciar outra.</div>` : ""}`;
        } else if (r.status === "em_rota") {
          actions = `
            ${mapsUrl ? `<a class="btn btn-ghost" href="${esc(mapsUrl)}" target="_blank" rel="noopener">${icon("nav")} Navegar até o destino</a>` : ""}
            <div class="btn-row">
              <button class="btn btn-ghost btn-lg" data-photo="${r.id}">${icon("camera")} Foto</button>
              <button class="btn btn-ghost btn-lg" data-file="${r.id}">${icon("file")} Arquivo</button>
            </div>
            <button class="btn btn-primary btn-lg" data-finish="${r.id}">${icon("check")} Finalizar entrega</button>
            ${docs.length ? "" : `<div class="muted small" style="text-align:center;">Para finalizar, envie a foto ou o PDF do documento de entrega (canhoto assinado).</div>`}`;
        }
        return `<div class="card route-card ${r.status === "em_rota" ? "active" : ""}">
          <div class="top"><div><div class="code">${esc(r.codigo)}</div><div class="muted small">${esc(r.cliente || "")}</div></div>${statusBadge(r.status)}</div>
          <div class="dest">${icon("pin")}<span>${esc(r.destino || "Destino não informado")}</span></div>
          <div class="info">
            <div>Terminal / origem<br><b>${esc(r.origem || "—")}</b></div>
            <div>Previsão<br><b>${fmtDate(r.data_prevista)}</b></div>
            <div>Nota fiscal<br><b>${esc(r.nota_fiscal || "—")}</b></div>
            <div>Placa<br><b>${esc(r.placa || "—")}</b></div>
            ${r.produto || r.peso != null ? `<div>Produto<br><b>${esc(r.produto || "—")}</b></div><div>Quantidade<br><b>${esc(fmtQtd(r))}</b></div>` : ""}
            ${r.periodo_inicio ? `<div style="grid-column:1/-1;">Janela<br><b>${esc(fmtJanela(r))}</b></div>` : ""}
            ${r.operacao ? `<div style="grid-column:1/-1;">Operação<br><b>${esc(r.operacao)}</b></div>` : ""}
            ${r.placas_carreta ? `<div style="grid-column:1/-1;">Carretas<br><b>${esc(r.placas_carreta)}</b></div>` : ""}
            ${r.observacao ? `<div style="grid-column:1/-1;">Observação<br><b>${esc(r.observacao)}</b></div>` : ""}
            ${r.finished_at ? `<div style="grid-column:1/-1;">${r.status === "entregue" ? "Entregue" : "Encerrada"} em<br><b>${fmtDateTime(r.finished_at)}</b></div>` : ""}
          </div>
          ${docs.length ? `<div class="doc-chips">${docs.map(d => `<span class="doc-chip">${icon("check")}${esc(d.file_name)}</span>`).join("")}</div>` : ""}
          ${actions ? `<div class="btns">${actions}</div>` : ""}
        </div>`;
      }).join("");

      const bind = (attr, fn) => $$(`[${attr}]`, el).forEach(b => b.addEventListener("click", async () => {
        b.disabled = true;
        try { await fn(routes.find(r => r.id === b.getAttribute(attr)), b); }
        catch (e) { toast(errMsg(e), true); }
        b.disabled = false;
      }));
      bind("data-start", async (r) => {
        const { error } = await sb.rpc("lg_start_route", { p_route: r.id });
        if (error) throw error;
        tracker.start(r.id);
        toast("Rota iniciada. Boa viagem!");
        await load();
      });
      const upload = async (r, capture) => {
        const files = await pickFiles(capture);
        if (!files.length) return;
        await uploadDocs(r.id, files, tracker.lastFix);
        toast(files.length > 1 ? "Documentos enviados." : "Documento enviado.");
        await load();
      };
      bind("data-photo", (r) => upload(r, true));
      bind("data-file", (r) => upload(r, false));
      bind("data-finish", async (r) => {
        if (!(r.lg_documents || []).length) {
          toast("Envie o documento de entrega antes de finalizar.", true);
          return;
        }
        if (!(await confirmDialog("Finalizar entrega?", `Confirma a entrega da carga <b>${esc(r.codigo)}</b>${r.cliente ? " para " + esc(r.cliente) : ""}?`, "Finalizar"))) return;
        if (tracker.lastFix) tracker.enqueue(tracker.lastFix, true);   // registra o ponto da entrega
        await tracker.flush();
        const { error } = await sb.rpc("lg_finish_route", { p_route: r.id });
        if (error) throw error;
        toast("Entrega finalizada!");
        await load();
      });
    }

    async function load(){
      const base = () => sb.from("lg_routes").select("*, lg_documents(id,file_name,created_at)").eq("driver_id", state.me.id);
      const [open, done] = await Promise.all([
        base().in("status", ["pendente", "em_rota"])
          .order("data_prevista", { ascending: true, nullsFirst: false }).order("created_at", { ascending: true }).limit(500),
        base().in("status", ["entregue", "cancelada"]).order("finished_at", { ascending: false }).limit(30)
      ]);
      if (open.error) throw open.error;
      if (done.error) throw done.error;
      routes = (open.data || []).concat(done.data || []);
      const ar = activeRoute();
      if (ar) { if (!tracker.active || tracker.routeId !== ar.id) tracker.start(ar.id); }
      else if (tracker.active) tracker.stop();
      drawBanner();
      drawList();
    }

    $$(".tabs-mini [data-tab]", content).forEach(b => b.addEventListener("click", () => {
      tab = b.dataset.tab;
      $$(".tabs-mini [data-tab]", content).forEach(x => x.classList.toggle("active", x === b));
      drawList();
    }));
    $("#drv-refresh").addEventListener("click", () => load().then(() => toast("Atualizado.")).catch(e => toast(errMsg(e), true)));

    tracker.onChange = drawBanner;
    teardown.push(() => { tracker.onChange = null; });

    await load();

    // novas rotas atribuídas aparecem sozinhas
    const reload = debounce(() => load().catch(() => {}), 800);
    const channel = sb.channel("lg-drv-" + Date.now())
      .on("postgres_changes", { event: "*", schema: "public", table: "lg_routes", filter: `driver_id=eq.${state.me.id}` }, reload)
      .subscribe();
    teardown.push(() => sb.removeChannel(channel));
    const timer = setInterval(drawBanner, 30000);
    teardown.push(() => clearInterval(timer));
    // novas rotas aparecem sozinhas (sem atrapalhar uma confirmação aberta)
    autoRefresh(async () => { if ($("#modal-overlay").hidden) await load(); }, 30 * 1000);
  }

  /* ============================================================
     BOOT
     ============================================================ */
  (async function boot(){
    const { data: { session } } = await sb.auth.getSession();
    if (session) enterApp();
    else $("#login-screen").hidden = false;
  })();
})();
