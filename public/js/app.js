/* ============ PrimePrint — núcleo (API, auth, carrinho, layout) ============ */
const API = '';
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const BRL = v => (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtDate = iso => iso ? new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';
const fmtDT = iso => iso ? new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';

/* Fontes premium + favicon (injetados: funciona em todas as páginas) */
(function () {
  const l1 = document.createElement('link'); l1.rel = 'preconnect'; l1.href = 'https://fonts.googleapis.com';
  const l2 = document.createElement('link'); l2.rel = 'preconnect'; l2.href = 'https://fonts.gstatic.com'; l2.crossOrigin = '';
  const l3 = document.createElement('link'); l3.rel = 'stylesheet';
  l3.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Poppins:wght@600;700;800;900&display=swap';
  document.head.append(l1, l2, l3);
  const fav = document.createElement('link'); fav.rel = 'icon';
  fav.href = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 44 44"><rect width="44" height="44" rx="12" fill="#FF4D00"/><path d="M13 32V12h11a7 7 0 0 1 0 14h-6v6z" fill="#fff"/><circle cx="31" cy="30" r="4.5" fill="#0A1633"/></svg>');
  document.head.append(fav);
})();
const LOGO_SVG = '<svg class="mark" viewBox="0 0 44 44"><defs><linearGradient id="ppg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FF4D00"/><stop offset="1" stop-color="#FF8A00"/></linearGradient></defs><rect width="44" height="44" rx="12" fill="url(#ppg)"/><path d="M13 32V12h11a7 7 0 0 1 0 14h-6v6z" fill="#fff"/><circle cx="31" cy="30" r="4.5" fill="#0A1633"/></svg>';
const thumbHTML = (p, size) => p.img
  ? `<img src="${p.img}" alt="${esc(p.name)}" loading="lazy" onerror="this.outerHTML='${p.icon || '🖨'}'">`
  : (p.icon || '🖨');

const STATUS = {
  aguardando_arte: 'Aguardando arte', em_analise: 'Em análise', aprovado: 'Arte aprovada', aguardando_aprovacao: 'Aguard. aprovação',
  em_producao: 'Em produção', pronto_envio: 'Pronto p/ envio', enviado: 'Enviado',
  entregue: 'Entregue', cancelado: 'Cancelado'
};
const FLOW = ['aguardando_arte', 'em_analise', 'aprovado', 'aguardando_aprovacao', 'em_producao', 'pronto_envio', 'enviado', 'entregue'];

/* ---------- API ---------- */
const Auth = {
  get token() { return localStorage.getItem('pp_token'); },
  get user() { try { return JSON.parse(localStorage.getItem('pp_user')); } catch { return null; } },
  set(session) {
    if (!session) { localStorage.removeItem('pp_token'); localStorage.removeItem('pp_user'); }
    else { localStorage.setItem('pp_token', session.token); localStorage.setItem('pp_user', JSON.stringify(session.user)); }
  },
  logout() { this.set(null); location.href = '/index.html'; }
};
async function api(path, opts = {}) {
  const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
  if (Auth.token) headers.Authorization = 'Bearer ' + Auth.token;
  const res = await fetch(API + path, { ...opts, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Erro inesperado');
  return data;
}

/* ---------- Carrinho ---------- */
const Cart = {
  get items() { try { return JSON.parse(localStorage.getItem('pp_cart')) || []; } catch { return []; } },
  set(items) { localStorage.setItem('pp_cart', JSON.stringify(items)); updateCartBadge(); renderMiniCart(); },
  add(item) { const it = this.items; it.push({ key: Date.now() + '' + Math.floor(Math.random() * 999), ...item }); this.set(it); },
  remove(key) { this.set(this.items.filter(i => i.key !== key)); },
  clear() { this.set([]); },
  subtotal() { return this.items.reduce((s, i) => s + (i.total || 0), 0); },
  count() { return this.items.length; }
};
function updateCartBadge() { $$('.cart-count').forEach(e => { e.textContent = Cart.count(); e.style.display = Cart.count() ? 'grid' : 'none'; }); }

/* ---------- Toast / Modal ---------- */
function toast(msg, type = '') {
  let box = $('#toasts');
  if (!box) { box = document.createElement('div'); box.id = 'toasts'; document.body.appendChild(box); }
  const t = document.createElement('div');
  t.className = 'toast ' + type; t.textContent = msg;
  box.appendChild(t); setTimeout(() => t.remove(), 3400);
}
function openModal(html) {
  let m = $('#modal');
  if (!m) { m = document.createElement('div'); m.id = 'modal'; m.className = 'modal'; m.innerHTML = '<div class="overlay on" onclick="closeModal()"></div><div class="mbox"><div class="mb" id="modal-body"></div></div>'; document.body.appendChild(m); }
  $('#modal-body').innerHTML = html; m.classList.add('on');
}
function closeModal() { $('#modal')?.classList.remove('on'); }

/* ---------- Layout da loja ---------- */
let CATS = [], CONFIG = {};
async function loadGlobals() {
  try { [CATS, CONFIG] = await Promise.all([api('/api/categories'), api('/api/config')]); }
  catch { CATS = []; CONFIG = { storeName: 'PrimePrint', phone: '(81) 99636-5068', email: 'vendas@primeprint.com.br', hours: 'Seg a Sex, 9h às 18h', whatsapp: '5581996365068' }; }
}
function renderHeader() {
  const u = Auth.user;
  const el = $('#site-header');
  if (!el) return;
  el.innerHTML = `
  <div class="topbar"><div class="wrap">
    <span>🖨️ Gráfica online • <b>envio para todo o Brasil</b></span>
    <span>📞 ${esc(CONFIG.phone || '')} &nbsp;•&nbsp; ✉️ ${esc(CONFIG.email || '')} &nbsp;•&nbsp; 🕘 ${esc(CONFIG.hours || '')}</span>
  </div></div>
  <div class="hd-main"><div class="wrap">
    <a class="logo" href="/index.html">${LOGO_SVG}<span>${esc(CONFIG.storeName || 'PrimePrint')}<small>GRÁFICA ONLINE</small></span></a>
    <form class="search" onsubmit="event.preventDefault();location.href='/produtos.html?q='+encodeURIComponent(this.q.value)">
      <input name="q" placeholder="Busque por cartões, panfletos, banners..." value="${esc(new URLSearchParams(location.search).get('q') || '')}">
      <button>🔍</button>
    </form>
    <div class="hd-actions">
      ${u ? `<a class="hd-link" href="${u.role === 'admin' ? '/admin.html' : '/conta.html'}"><span class="ic">👤</span><span class="tx"><small>Olá,</small>${esc(u.name.split(' ')[0])}</span></a>`
        : `<a class="hd-link" href="/login.html"><span class="ic">👤</span><span class="tx"><small>Bem-vindo,</small>Entre ou cadastre-se</span></a>`}
      <a class="hd-link" href="${u ? (u.role === 'admin' ? '/admin.html#/pedidos' : '/conta.html#/pedidos') : '/login.html'}"><span class="ic">📦</span><span class="tx"><small>Seus</small>Pedidos</span></a>
      <a class="hd-link" href="#" onclick="event.preventDefault();openCart()"><span class="ic">🛒</span><span class="tx"><small>Seu</small>Carrinho</span><span class="cart-count">0</span></a>
    </div>
  </div></div>
  <nav class="cats"><div class="wrap">
    <a href="/produtos.html">📂 Todas as categorias</a>
    ${CATS.slice(0, 9).map(c => `<a href="/produtos.html?cat=${c.id}">${c.icon} ${esc(c.name)}</a>`).join('')}
    <a class="hl" href="/pagina.html?p=gabaritos">📐 Gabaritos</a>
  </div></nav>
`;
  updateCartBadge();
}
function renderFooter() {
  const el = $('#site-footer');
  if (!el) return;
  el.innerHTML = `
  <div class="paybar"><div class="wrap">
    <div class="pm">💳 FORMAS DE PAGAMENTO <span class="chips"><span>Pix</span><span>Visa</span><span>Master</span><span>Elo</span><span>Boleto</span></span></div>
    <div class="pm">🔒 COMPRA SEGURA <span class="chips"><span>SSL</span><span>LGPD</span></span></div>
  </div></div>
  <footer class="site"><div class="wrap foot-grid">
    <div class="foot-brand">
      <a class="logo" href="/index.html" style="color:#fff">${LOGO_SVG}<span>${esc(CONFIG.storeName || 'PrimePrint')}<small>GRÁFICA ONLINE</small></span></a>
      <p>Sua gráfica online com preço baixo, qualidade alta e entrega para todo o Brasil. Do cartão ao banner, tudo em um só lugar.</p>
      <p>📞 ${esc(CONFIG.phone || '')}<br>✉️ ${esc(CONFIG.email || '')}<br>🕘 ${esc(CONFIG.hours || '')}</p>
      <div class="social"><a href="#">📷</a><a href="#">👍</a><a href="#">🎵</a><a href="#">▶️</a></div>
    </div>
    <div><h4>${(CONFIG.storeName || 'PrimePrint').toUpperCase()}</h4>
      <a href="/index.html">Início</a><a href="/produtos.html">Produtos</a>
      <a href="/conta.html">Sua conta</a><a href="/conta.html#/pedidos">Meus pedidos</a>
      <a href="/pagina.html?p=gabaritos">Gabaritos</a><a href="/pagina.html?p=criacao-e-envio">Criação e envio</a></div>
    <div><h4>INSTITUCIONAL</h4>
      <a href="/pagina.html?p=duvidas">Dúvidas frequentes</a><a href="/pagina.html?p=quem-somos">Quem somos</a>
      <a href="/pagina.html?p=contato">Fale conosco</a><a href="/pagina.html?p=como-funciona">Como funciona</a></div>
    <div><h4>POLÍTICAS</h4>
      <a href="/pagina.html?p=politicas">Privacidade</a><a href="/pagina.html?p=politicas">Qualidade</a>
      <a href="/pagina.html?p=politicas">Entrega</a><a href="/pagina.html?p=politicas">Trocas e devoluções</a></div>
  </div>
  <div class="copy">© 2026 ${esc(CONFIG.storeName || 'PrimePrint')} • CNPJ 00.000.000/0001-00 • Todos os direitos reservados • Feito com 🧡 no Brasil</div>
  </footer>
  <a class="wpp" href="https://wa.me/${CONFIG.whatsapp || '5581996365068'}?text=Olá! Quero um orçamento 🖨️" target="_blank" title="Falar no WhatsApp"><svg viewBox="0 0 24 24" width="30" height="30" fill="#fff"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.889-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg></a>`;
}
function renderMiniCart() {
  const box = $('#mini-items');
  if (!box) return;
  const items = Cart.items;
  box.innerHTML = items.length ? items.map(i => `
    <div class="mini"><div class="t" style="background:linear-gradient(135deg,${i.grad?.[0] || '#0B1E3B'},${i.grad?.[1] || '#1E5AA8'})">${thumbHTML(i)}</div>
      <div><b>${esc(i.name)}</b><span>${esc(i.configLabel || '')}</span><span><b>${BRL(i.total)}</b></span></div>
      <button class="rm" onclick="Cart.remove('${i.key}')">🗑️</button>
    </div>`).join('')
    : `<div class="empty"><div class="e">🛒</div><p>Seu carrinho está vazio.<br>Que tal começar pelos <a href="/produtos.html" style="color:var(--primary);font-weight:700">mais vendidos</a>?</p></div>`;
  const f = $('#mini-foot');
  if (f) f.innerHTML = items.length ? `
    <div class="totals"><div class="tt"><span>Subtotal</span><b>${BRL(Cart.subtotal())}</b></div></div>
    ${freeShipBar(Cart.subtotal())}
    <div style="display:flex;gap:8px;margin-top:12px"><a class="btn ghost block" href="/carrinho.html">Ver carrinho</a><a class="btn block" href="/checkout.html">Finalizar</a></div>` : '';
}
function ensureCartDrawer() {
  if ($('#cart-drawer')) return;
  document.body.insertAdjacentHTML('beforeend', `
  <div class="overlay" id="overlay" onclick="closeCart()"></div>
  <aside class="drawer" id="cart-drawer">
    <div class="dh"><b>🛒 Meu carrinho</b><button class="btn sm ghost" onclick="closeCart()">✕</button></div>
    <div class="di" id="mini-items"></div>
    <div class="df" id="mini-foot"></div>
  </aside>`);
  renderMiniCart();
}
function openCart() { ensureCartDrawer(); $('#cart-drawer').classList.add('on'); $('#overlay').classList.add('on'); renderMiniCart(); }
function closeCart() { $('#cart-drawer')?.classList.remove('on'); $('#overlay')?.classList.remove('on'); }

const offerPct = p => { const pct = Number(p?.offerPct) || 0; if (pct <= 0) return 0; if (p.offerEnds && p.offerEnds < new Date().toISOString().slice(0, 10)) return 0; return Math.min(90, pct); };
function freeShipBar(sub) {
  const goal = CONFIG.freeShipFrom || 299;
  if (sub >= goal) return `<p style="margin:8px 0;font-weight:700;color:var(--ok)">🚚 Você ganhou FRETE GRÁTIS! 🎉</p>`;
  const pct = Math.min(100, Math.round(sub / goal * 100));
  return `<div style="margin:8px 0"><small class="mut">Faltam <b>${BRL(goal - sub)}</b> para o frete grátis 🚚</small><div style="height:8px;background:var(--bg);border:1px solid var(--line);border-radius:99px;margin-top:4px"><div style="height:100%;width:${pct}%;background:linear-gradient(90deg,var(--primary),var(--navy));border-radius:99px"></div></div></div>`;
}
function productCard(p) {
  const fav = (Auth.user?.favorites || []).includes(p.id) ? '❤️' : '🤍';
  const _op = offerPct(p);
  const _base = p.minPrice ?? Math.min(...p.quantities.map(q => q.price));
  return `<div class="prod">
    ${_op ? `<span class="badge sale" style="position:absolute;top:10px;left:10px;z-index:2">−${_op}% 🔥</span>` : (p.badge ? `<span class="badge sale" style="position:absolute;top:10px;left:10px;z-index:2">${esc(p.badge)}</span>` : '')}
    <button class="fav" onclick="toggleFav(event,'${p.id}')" title="Favoritar">${fav}</button>
    <a href="/produto.html?id=${p.id}"><div class="thumb" style="background:linear-gradient(135deg,${p.grad?.[0] || '#0B1E3B'},${p.grad?.[1] || '#1E5AA8'})">${thumbHTML(p)}</div>
    <div class="body"><b>${esc(p.name)}</b><span class="tag">${esc(p.tagline || '')}</span>
    <span class="stars">★ ${Number(p.rating || 5).toFixed(1)} <span class="mut">(${(p.sold || 0).toLocaleString('pt-BR')})</span></span>
    <div class="price"><small>a partir de</small>${_op ? `<small class="mut"><s>${BRL(_base)}</s></small>` : ''}<b><i>${BRL(_op ? Math.round(_base * (1 - _op / 100) * 100) / 100 : _base)}</i></b></div>
    </div></a></div>`;
}
async function toggleFav(e, id) {
  e.preventDefault(); e.stopPropagation();
  if (!Auth.user) { toast('Entre ou cadastre-se para favoritar', 'err'); location.href = '/login.html'; return; }
  const { favorites } = await api(`/api/favorites/${id}`, { method: 'POST' });
  Auth.set({ token: Auth.token, user: { ...Auth.user, favorites } });
  e.target.textContent = favorites.includes(id) ? '❤️' : '🤍';
  toast(favorites.includes(id) ? 'Adicionado aos favoritos ❤️' : 'Removido dos favoritos', 'ok');
}
async function uploadFile(file) {
  const fd = new FormData(); fd.append('file', file);
  const res = await fetch('/api/upload', { method: 'POST', body: fd });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Falha no upload');
  return data;
}
