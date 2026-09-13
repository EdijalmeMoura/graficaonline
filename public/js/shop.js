/* ============ PrimePrint — lógica da loja ============ */
document.addEventListener('DOMContentLoaded', initShop);
let ALL_PRODUCTS = [];

async function initShop() {
  await loadGlobals();
  renderHeader(); renderFooter(); ensureCartDrawer();
  const page = document.body.dataset.page;
  try {
    if (page === 'home') await pageHome();
    if (page === 'catalog') await pageCatalog();
    if (page === 'product') await pageProduct();
    if (page === 'cart') pageCart();
    if (page === 'checkout') await pageCheckout();
    if (page === 'auth') pageAuth();
    if (page === 'doc') pageDoc();
  } catch (e) { console.error(e); toast(e.message, 'err'); }
}

/* ---------- HOME ---------- */
async function pageHome() {
  const [banners, products] = await Promise.all([api('/api/banners'), api('/api/products')]);
  ALL_PRODUCTS = products;
  // hero
  const hero = $('#hero');
  const brows = ['OFERTA DA SEMANA', 'SÓ PARA NOVOS CLIENTES', 'ELEIÇÕES 2026'];
  hero.innerHTML = banners.map((b, i) => `
    <div class="slide ${i === 0 ? 'on' : ''}" style="background:linear-gradient(115deg,${b.grad[0]} 30%,${b.grad[1]})">
      <div style="position:relative;z-index:1"><span class="eyebrow">${brows[i] || 'PRIMEPRINT'}</span><h1>${esc(b.title)}</h1><p>${esc(b.subtitle)}</p><a class="btn" href="${b.link}">${esc(b.cta)} →</a></div>
      <div class="shot">${b.img ? `<img src="${b.img}" alt="${esc(b.title)}">` : `<div class="emoji">${b.icon}</div>`}</div>
    </div>`).join('') + `<div class="dots">${banners.map((_, i) => `<button class="${i === 0 ? 'on' : ''}" onclick="goSlide(${i})"></button>`).join('')}</div>`;
  window._slide = 0; window._nslides = banners.length;
  setInterval(() => goSlide((window._slide + 1) % window._nslides), 5000);
  // categorias
  $('#home-cats').innerHTML = CATS.map(c => `<a class="cat-card" href="/produtos.html?cat=${c.id}"><div class="tile">${c.icon}</div><b>${esc(c.name)}</b><span>${c.count || ''} produtos</span></a>`).join('');
  // mais vendidos
  $('#home-prods').innerHTML = products.slice(0, 8).map(productCard).join('');
  // calculadora
  const sel = $('#calc-prod');
  sel.innerHTML = products.map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join('');
  const updCalcQty = () => {
    const p = products.find(x => x.id === sel.value);
    $('#calc-qty').innerHTML = p.quantities.map(q => `<option value="${q.qty}">${q.qty.toLocaleString('pt-BR')} un — ${BRL(q.price)}</option>`).join('');
    updCalc();
  };
  window.updCalc = async () => {
    const p = products.find(x => x.id === sel.value);
    const qty = $('#calc-qty').value;
    const curPaper = $('#calc-paper').value;
    const papers = (p.papers || [{ id: 'x', label: 'Padrão' }]);
    $('#calc-paper').innerHTML = papers.map(x => `<option value="${x.id}">${esc(x.label)}</option>`).join('');
    if (papers.some(x => x.id === curPaper)) $('#calc-paper').value = curPaper;
    const paper = $('#calc-paper').value;
    const calc = await api(`/api/products/${p.id}/price`, { method: 'POST', body: JSON.stringify({ qty, paper, finish: (p.finishes || [])[0]?.id, color: (p.colors || [])[0]?.id, deadline: 'normal' }) });
    $('#calc-res').innerHTML = `<div><small class="mut">Total estimado</small><br><b>${BRL(calc.total)}</b> <span class="mut small">(${BRL(calc.unit)}/un)</span></div><a class="btn" href="/produto.html?id=${p.id}">Personalizar →</a>`;
  };
  sel.onchange = updCalcQty; $('#calc-qty').onchange = updCalc; $('#calc-paper').onchange = updCalc;
  updCalcQty();
}
function goSlide(i) {
  window._slide = i;
  $$('#hero .slide').forEach((s, k) => s.classList.toggle('on', k === i));
  $$('#hero .dots button').forEach((d, k) => d.classList.toggle('on', k === i));
}

/* ---------- CATÁLOGO ---------- */
async function pageCatalog() {
  const qs = new URLSearchParams(location.search);
  const q = qs.get('q') || '', cat = qs.get('cat') || 'todos';
  const sort = $('#sort');
  async function load() {
    const list = await api(`/api/products?q=${encodeURIComponent(q)}&category=${cat}&sort=${sort.value}`);
    $('#count').textContent = `${list.length} produto(s)`;
    $('#grid').innerHTML = list.length ? list.map(productCard).join('') : `<div class="empty"><div class="e">🔍</div><p>Nenhum produto encontrado.<br><a href="/produtos.html" class="link-more">Ver tudo</a></p></div>`;
  }
  $('#filters').innerHTML = `<a href="/produtos.html" class="${cat === 'todos' ? 'on' : ''}">Todos <span>→</span></a>` +
    CATS.map(c => `<a href="/produtos.html?cat=${c.id}" class="${cat === c.id ? 'on' : ''}">${c.icon} ${esc(c.name)} <span>${c.count ?? ''}</span></a>`).join('');
  if (q) $('#crumb').innerHTML = `Início › <b>Busca: "${esc(q)}"</b>`;
  else if (cat !== 'todos') $('#crumb').innerHTML = `Início › <b>${esc(CATS.find(c => c.id === cat)?.name || '')}</b>`;
  sort.onchange = load; load();
}

/* ---------- PRODUTO / CONFIGURADOR (preço ao vivo, estilo referência) ---------- */
let PD = null, PDSEL = {}, PD_CALC = null;
/* Mesmo cálculo do servidor, no navegador: resposta instantânea a cada clique */
function clientPrice(sel) {
  const q = PD.quantities.find(x => String(x.qty) === String(sel.qty)) || PD.quantities[0];
  const pick = (arr, id) => (arr || []).find(x => String(x.id) === String(id));
  let total = q.price;
  const format = pick(PD.formats, sel.format); if (format) total *= (1 + (format.mod || 0));
  const paper = pick(PD.papers, sel.paper); if (paper) total *= (1 + (paper.mod || 0));
  const color = pick(PD.colors, sel.color); if (color) total *= (1 + (color.mod || 0));
  const finish = pick(PD.finishes, sel.finish); if (finish) total += (finish.add || 0);
  const deadline = pick(PD.deadlines, sel.deadline); if (deadline) total *= (deadline.mult || 1);
  total = Math.round(total * 100) / 100;
  return { qty: q.qty, base: q.price, total, unit: Math.round((total / q.qty) * 10000) / 10000 };
}
const modHint = m => m > 0 ? ` <small class="mut">+${Math.round(m * 100)}%</small>` : m < 0 ? ` <small style="color:var(--ok);font-weight:700">−${Math.round(-m * 100)}%</small>` : '';
function cfgSteps() {
  return [
    { key: 'paper', num: '01', title: 'Papel / material', opts: PD.papers || [], label: o => esc(o.label) + modHint(o.mod || 0) },
    { key: 'format', num: '02', title: 'Tamanho', opts: PD.formats || [], label: o => esc(o.label) + modHint(o.mod || 0) },
    { key: 'color', num: '03', title: 'Cores', opts: PD.colors || [], label: o => esc(o.label) + modHint(o.mod || 0) },
    { key: 'finish', num: '04', title: 'Acabamento', opts: PD.finishes || [], label: o => esc(o.label) + (o.add > 0 ? ` <small class="mut">+${BRL(o.add)}</small>` : o.add < 0 ? ` <small style="color:var(--ok);font-weight:700">−${BRL(-o.add)}</small>` : '') },
    { key: 'qty', num: '05', title: 'Quantidade', opts: PD.quantities || [], qty: true },
    { key: 'deadline', num: '06', title: 'Prazo de produção', opts: PD.deadlines || [], label: o => `${esc(o.label)} <small class="mut">(${esc(o.days)})</small>` + (((o.mult || 1) > 1) ? ` <small class="mut">+${Math.round(((o.mult || 1) - 1) * 100)}%</small>` : '') },
  ];
}
async function pageProduct() {
  const id = new URLSearchParams(location.search).get('id');
  PD = await api(`/api/products/${id}`);
  document.title = PD.name + ' — PrimePrint';
  $('#crumb').innerHTML = `Início › ${esc(CATS.find(c => c.id === PD.category)?.name || 'Produtos')} › <b>${esc(PD.name)}</b>`;
  PDSEL = { format: PD.formats[0]?.id, paper: PD.papers[0]?.id, color: PD.colors[0]?.id, finish: PD.finishes[0]?.id, qty: String((PD.quantities[0]?.qty === 1 ? PD.quantities[0] : PD.quantities[1] ?? PD.quantities[0]).qty), deadline: PD.deadlines?.[0]?.id };
  $('#pd-media').innerHTML = `
    <div class="big" style="background:linear-gradient(135deg,${PD.grad[0]},${PD.grad[1]})">${thumbHTML(PD)}${PD.badge ? `<span class="badge sale" style="position:absolute;top:14px;left:14px">${esc(PD.badge)}</span>` : ''}</div>
    <div class="info"><h1 style="font-size:24px;margin:0">${esc(PD.name)}</h1>
      <div class="rate">★ ${Number(PD.rating).toFixed(1)} • ${(PD.sold || 0).toLocaleString('pt-BR')} vendidos</div>
      <p class="mut">${esc(PD.desc)}</p>
      <div class="spec"><span>🚚 Envio p/ todo Brasil</span><span>🛡️ Prova digital grátis</span><span>⚡ Expressa disponível</span></div>
      <div class="small mut">📐 <a class="link-more" href="/pagina.html?p=gabaritos">Baixar gabarito deste produto</a></div><div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap"><a class="btn sm ghost" target="_blank" href="https://wa.me/?text=${encodeURIComponent(PD.name + ' na PrimePrint \uD83D\uDDA8\uFE0F: ' + location.href)}">\uD83D\uDCF7 Compartilhar</a><button class="btn sm ghost" onclick="navigator.clipboard?.writeText(location.href);toast('Link copiado! \uD83D\uDD17','ok')">\uD83D\uDD17 Copiar link</button></div>
    </div>`;
  $('#pd-cfg').innerHTML = `
    <div id="pd-steps"></div>
    <div class="price-box"><div class="v"><div><span>Total</span><br><b id="pd-total">…</b><br><span id="pd-unit"></span></div><div style="text-align:right"><span>📦 Frete</span><br><b id="pd-ship" style="font-size:18px">…</b></div></div>
      <div class="pix">⚡ <b>${CONFIG.pixDiscount || 5}% OFF no Pix</b> → <b id="pd-pix"></b></div></div>
    <div class="row2"><div><label class="lbl">📮 CEP de entrega</label><input class="inp" id="pd-cep" placeholder="00000-000" maxlength="9"></div>
    <div><label class="lbl">🚚 Opção</label><select class="inp" id="pd-shiptype"><option value="PAC">PAC — ${BRL(CONFIG.shipPAC ?? 19.9)}</option><option value="SEDEX">SEDEX — ${BRL(CONFIG.shipSEDEX ?? 29.9)}</option><option value="Retirada">🏪 Retirada na loja — GRÁTIS</option></select></div></div>
    <div style="display:flex;gap:8px;margin-top:14px"><button class="btn big block" onclick="pdAdd(true)">🛒 Adicionar ao carrinho</button></div>
    <div style="display:flex;gap:8px;margin-top:8px"><button class="btn navy block" onclick="pdAdd(false)">⚡ Comprar agora</button></div>
    <p class="small mut" style="margin-top:10px">🔒 Compra segura • Você envia a arte no checkout ou depois, na sua conta.</p>`;
  window.pdSet = (g, v) => { PDSEL[g] = String(v); renderCfg(); };
  $('#pd-cep').oninput = e => { const d = e.target.value.replace(/\D/g, '').slice(0, 8); e.target.value = d.replace(/(\d{5})(\d)/, '$1-$2'); if (d.length === 8) pdQuote(d); };
  $('#pd-shiptype').onchange = pdNumbers;
  renderCfg();
  loadRelated();
  loadReviews();
}
function renderCfg() {
  $('#pd-steps').innerHTML = cfgSteps().map(s => {
    const hd = `<span class="lbl"><span><b style="color:var(--primary)">⏺ ${s.num}.</b> ${s.title}</span></span>`;
    if (s.qty) {
      const pills = s.opts.map(o => {
        const t = clientPrice({ ...PDSEL, qty: String(o.qty) });
        return `<button class="pill ${String(PDSEL.qty) === String(o.qty) ? 'on' : ''}" onclick="pdSet('qty','${o.qty}')"><b>${o.qty.toLocaleString('pt-BR')} un</b><br><span style="color:var(--primary-d);font-weight:800">${BRL(t.total)}</span> <small class="mut">${BRL(t.unit)}/un</small></button>`;
      }).join('');
      return `<div class="opt">${hd}<div class="pills qty-pills">${pills}</div></div>`;
    }
    if (s.opts.length <= 1) {
      const o = s.opts[0];
      return `<div class="opt">${hd}<div class="pills"><button class="pill on" disabled>${o ? s.label(o) : '—'}</button></div></div>`;
    }
    const pills = s.opts.map(o => `<button class="pill ${String(PDSEL[s.key]) === String(o.id) ? 'on' : ''}" onclick="pdSet('${s.key}','${o.id}')">${s.label(o)}</button>`).join('');
    return `<div class="opt">${hd}<div class="pills">${pills}</div></div>`;
  }).join('');
  pdNumbers();
}
async function loadReviews() {
  let list = [];
  try { list = await api(`/api/products/${PD.id}/reviews`); } catch { }
  document.querySelector('#pd-reviews-sec')?.remove();
  const sec = document.createElement('section');
  sec.className = 'block'; sec.id = 'pd-reviews-sec';
  const avg = list.length ? list.reduce((s, r) => s + r.stars, 0) / list.length : 0;
  sec.innerHTML = `<div class="sec-hd"><div><span class="kick">Opinião de quem comprou</span><h2>Avaliações${list.length ? ` (${avg.toFixed(1)} • ${list.length})` : ''}</h2></div></div>
  <div class="card">${list.length ? list.map(r => `<div style="border-bottom:1px solid var(--line);padding:10px 0"><b>${esc(r.userName)}</b> ${'★'.repeat(r.stars)}${'☆'.repeat(5 - r.stars)} ${r.verified ? '<span class="badge ok">compra verificada</span>' : ''}<br><span>${esc(r.text)}</span><br><small class="mut">${fmtDate(r.at)}</small></div>`).join('') : '<p class="mut">Ainda não há avaliações. Seja o primeiro! 🙂</p>'}
  ${Auth.user ? `<div style="margin-top:12px"><h3>Sua avaliação</h3><div id="rv-stars" style="font-size:28px;cursor:pointer">${[1, 2, 3, 4, 5].map(i => `<span data-s="${i}" onclick="rvPick(${i})">☆</span>`).join('')}</div><textarea class="inp" id="rv-text" rows="2" placeholder="O que achou do produto?" style="margin-top:8px"></textarea><br><button class="btn" style="margin-top:8px" onclick="rvSend()">Enviar avaliação</button></div>`
  : '<p style="margin-top:12px"><a class="link-more" href="/login.html">Entre</a> para avaliar este produto.</p>'}</div>`;
  document.querySelector('.pd').after(sec);
}
let RV_STARS = 5;
function rvPick(n) { RV_STARS = n; document.querySelectorAll('#rv-stars span').forEach(sp => sp.textContent = Number(sp.dataset.s) <= n ? '★' : '☆'); }
async function rvSend() {
  const text = document.querySelector('#rv-text').value.trim();
  if (!text) { toast('Escreva um comentário', 'err'); return; }
  try { await api(`/api/products/${PD.id}/reviews`, { method: 'POST', body: JSON.stringify({ stars: RV_STARS, text }) }); toast('Avaliação enviada! ⭐', 'ok'); loadReviews(); }
  catch (e) { toast(e.message, 'err'); }
}
async function loadRelated() {
  try {
    const list = (await api(`/api/products?category=${PD.category}`)).filter(p => p.id !== PD.id).slice(0, 4);
    if (!list.length) return;
    const sec = document.createElement('section');
    sec.className = 'block';
    sec.innerHTML = `<div class="sec-hd"><div><span class="kick">Continue explorando</span><h2>\uD83D\uDCA1 Quem viu, também levou</h2></div><a class="link-more" href="/produtos.html?cat=${PD.category}">Ver categoria →</a></div><div class="prod-grid">${list.map(productCard).join('')}</div>`;
    document.querySelector('.pd').after(sec);
  } catch {}
}
async function pdQuote(d) {
  const toZip = (d || document.querySelector('#pd-cep').value || '').replace(/\D/g, '');
  if (toZip.length !== 8 || !PD_CALC) return;
  try {
    const q = await api('/api/shipping/quote', { method: 'POST', body: JSON.stringify({ toZip, subtotal: PD_CALC.total }) });
    window._pdQuotes = {};
    document.querySelector('#pd-shiptype').innerHTML = q.options.map(o => { window._pdQuotes[o.id] = o.price; return `<option value="${o.id}">${esc(o.label)}${o.eta ? ' (' + o.eta + ')' : ''}</option>`; }).join('');
    pdNumbers();
    if (q.live) toast('Frete atualizado! 📮', 'ok');
  } catch { }
}
function pdNumbers() {
  PD_CALC = clientPrice(PDSEL);
  $('#pd-total').textContent = BRL(PD_CALC.total);
  $('#pd-unit').textContent = `${BRL(PD_CALC.unit)} por unidade • ${PD_CALC.qty.toLocaleString('pt-BR')} un`;
  $('#pd-pix').textContent = BRL(PD_CALC.total * (1 - (CONFIG.pixDiscount || 5) / 100));
  const pdv = document.querySelector('#pd-shiptype')?.value;
  const ship = (pdv === 'Retirada' || PD_CALC.total >= (CONFIG.freeShipFrom || 299)) ? 0 : (window._pdQuotes?.[pdv] ?? (pdv === 'SEDEX' ? CONFIG.shipSEDEX : CONFIG.shipPAC));
  $('#pd-ship').textContent = ship === 0 ? 'GRÁTIS 🎉' : BRL(ship);
}
function pdLabel() {
  const f = n => { const g = { format: PD.formats, paper: PD.papers, color: PD.colors, finish: PD.finishes, deadline: PD.deadlines }[n]; return g?.find(x => String(x.id) === String(PDSEL[n]))?.label || ''; };
  return [f('paper'), f('format'), f('color'), f('finish'), f('deadline')].filter(Boolean).join(' • ');
}
async function pdAdd(goCart) {
  try { PD_CALC = await api(`/api/products/${PD.id}/price`, { method: 'POST', body: JSON.stringify(PDSEL) }); }
  catch { PD_CALC = clientPrice(PDSEL); }
  Cart.add({ productId: PD.id, name: PD.name, icon: PD.icon, img: PD.img || null, grad: PD.grad, sel: { ...PDSEL }, configLabel: `${PD_CALC.qty.toLocaleString('pt-BR')} un • ` + pdLabel(), qty: PD_CALC.qty, unit: PD_CALC.unit, total: PD_CALC.total });
  toast('Adicionado ao carrinho! 🛒', 'ok');
  if (goCart) openCart(); else location.href = '/checkout.html';
}

/* ---------- CARRINHO ---------- */
function pageCart() {
  const box = $('#cart-items');
  const items = Cart.items;
  if (!items.length) { box.innerHTML = `<div class="empty"><div class="e">🛒</div><h3>Carrinho vazio</h3><p>Explore os <a class="link-more" href="/produtos.html">mais vendidos</a> e volte aqui 😉</p></div>`; $('#cart-side').innerHTML = ''; return; }
  box.innerHTML = items.map(i => `
    <div class="citem"><div class="t" style="background:linear-gradient(135deg,${i.grad?.[0] || '#0B1E3B'},${i.grad?.[1] || '#1E5AA8'})">${thumbHTML(i)}</div>
      <div><b>${esc(i.name)}</b><div class="cf">${esc(i.configLabel || '')}</div>
        <div style="margin-top:6px;display:flex;gap:8px"><button class="btn sm ghost" onclick="Cart.remove('${i.key}');pageCart()">🗑️ Remover</button></div></div>
      <div class="pr"><b>${BRL(i.total)}</b><div class="cf">${BRL(i.unit)}/un</div></div>
    </div>`).join('');
  const sub = Cart.subtotal(), free = sub >= (CONFIG.freeShipFrom || 299);
  $('#cart-side').innerHTML = `
    <div class="card"><h3>Resumo</h3><div class="totals">
      <div class="tt"><span>Subtotal</span><b>${BRL(sub)}</b></div>
      <div class="tt"><span>Frete</span>${free ? '<span class="free">GRÁTIS 🎉</span>' : `<span>a partir de ${BRL(CONFIG.shipPAC ?? 19.9)}</span>`}</div>
      ${!free ? `<small class="mut">Faltam <b>${BRL((CONFIG.freeShipFrom || 299) - sub)}</b> para o frete grátis 🚚</small>` : ''}
      <div class="tt gt"><span>Total</span><span>${BRL(sub)}</span></div></div>
      <a class="btn big block" style="margin-top:14px" href="/checkout.html">Finalizar compra →</a>
      <a class="btn ghost block" style="margin-top:8px" href="/produtos.html">Continuar comprando</a></div>
    <div class="card"><h3>🎟️ Tem cupom?</h3><p class="small mut">Você aplica o cupom na próxima etapa, no checkout.</p><p class="small">💡 Teste: <b class="mono">BEMVINDO10</b></p></div>`;
}

/* ---------- CHECKOUT ---------- */
let CK = { coupon: null, shipType: 'PAC', pay: 'pix', addressId: null, art: null, pointsUsed: 0 };
async function pageCheckout() {
  if (!Cart.items.length) { location.href = '/carrinho.html'; return; }
  if (!Auth.user) { toast('Entre ou crie sua conta para finalizar 🙂'); location.href = '/login.html?next=/checkout.html'; return; }
  const me = await api('/api/auth/me');
  Auth.set({ token: Auth.token, user: me });
  renderCkAddresses(me.addresses || []);
  renderCkPay();
  renderCkShip(); ckQuote();
  $('#ck-items').innerHTML = Cart.items.map(i => `<div class="mini"><div class="t" style="background:linear-gradient(135deg,${i.grad?.[0] || '#0B1E3B'},${i.grad?.[1] || '#1E5AA8'})">${thumbHTML(i)}</div><div><b>${esc(i.name)}</b><span>${esc(i.configLabel || '')}</span></div><b style="margin-left:auto">${BRL(i.total)}</b></div>`).join('');
  ckTotals();
}
function renderCkAddresses(addrs) {
  CK.addressId = (addrs.find(a => a.main) || addrs[0])?.id || null;
  $('#ck-addr').innerHTML = addrs.length ? addrs.map(a => `
    <label style="display:flex;gap:10px;border:1.5px solid var(--line);border-radius:10px;padding:12px;margin-bottom:8px;cursor:pointer;${a.id === CK.addressId ? 'border-color:var(--primary);background:#FFF7F2' : ''}">
      <input type="radio" name="addr" ${a.id === CK.addressId ? 'checked' : ''} onchange="CK.addressId='${a.id}';renderCkAddresses(window._addrs);ckQuote()">
      <span><b>${esc(a.label || 'Endereço')}</b><br><span class="small mut">${esc(a.street)} — ${esc(a.district || '')} • ${esc(a.city)}/${esc(a.state)} • CEP ${esc(a.zip)}</span></span>
    </label>`).join('')
    : `<p class="mut">Nenhum endereço ainda. Cadastre abaixo 👇</p>`;
  window._addrs = addrs;
}
async function ckAddAddress(e) {
  e.preventDefault();
  const f = e.target;
  const a = await api('/api/addresses', { method: 'POST', body: JSON.stringify({ label: f.label.value, zip: f.zip.value, street: f.street.value, district: f.district.value, city: f.city.value, state: f.state.value, main: true }) });
  const me = await api('/api/auth/me'); Auth.set({ token: Auth.token, user: me });
  renderCkAddresses(me.addresses); toast('Endereço salvo! 📍', 'ok'); f.reset();
}
async function ckApplyCoupon() {
  const code = $('#ck-coupon').value.trim();
  if (!code) return;
  try {
    const c = await api('/api/coupons/validate', { method: 'POST', body: JSON.stringify({ code, subtotal: Cart.subtotal() }) });
    CK.coupon = c; toast(`Cupom ${c.code} aplicado! 🎟️`, 'ok'); ckTotals();
  } catch (e) { toast(e.message, 'err'); }
}
function renderCkPay() {
  const defs = [['pix', 'payPix', 'Pix', '<small>' + (CONFIG.pixDiscount || 5) + '% OFF'], ['card', 'payCard', 'Cartão', '<small>até ' + (CONFIG.installmentMax || 6) + 'x'], ['boleto', 'payBoleto', 'Boleto', '<small>1-2 dias']];
  const icons = { pix: '⚡', card: '💳', boleto: '🧾' };
  const avail = defs.filter(d => CONFIG[d[1]] !== false);
  if (!avail.length) avail.push(defs[0]);
  if (!avail.find(d => d[0] === CK.pay)) CK.pay = avail[0][0];
  const box = document.querySelector('#ck-paym');
  if (box) box.innerHTML = avail.map(d => `<button data-pay="${d[0]}" class="${CK.pay === d[0] ? 'on' : ''}" onclick="ckSetPay('${d[0]}')">${icons[d[0]]} ${d[2]}${d[3]}</small></button>`).join('');
}
function ckSetShip(v) {
  CK.shipType = v;
  const opt = (CK._shipOpts || []).find(o => String(o.id) === String(v));
  CK.shipLabel = opt ? opt.label : v;
  document.querySelectorAll('#ck-ship-pills .pill').forEach(b => b.classList.toggle('on', b.dataset.id === String(v)));
  const pk = v === 'Retirada';
  const ac = document.querySelector('#ck-addr-card'); if (ac) ac.style.display = pk ? 'none' : '';
  const pi = document.querySelector('#ck-pickup'); if (pi) pi.style.display = pk ? '' : 'none';
  ckTotals();
}
function renderCkShip() {
  const box = document.querySelector('#ck-ship-pills');
  if (!box) return;
  const opts = CK._shipOpts?.length ? CK._shipOpts : [
    { id: 'PAC', label: `PAC — ${BRL(CONFIG.shipPAC ?? 19.9)}`, price: CONFIG.shipPAC ?? 19.9, eta: '5-8 dias' },
    { id: 'SEDEX', label: `SEDEX — ${BRL(CONFIG.shipSEDEX ?? 29.9)}`, price: CONFIG.shipSEDEX ?? 29.9, eta: '2-4 dias' },
    { id: 'Retirada', label: '🏪 Retirada na loja — GRÁTIS', price: 0, eta: '' },
  ];
  CK._quotes = {};
  opts.forEach(o => CK._quotes[o.id] = o.price);
  if (!opts.find(o => String(o.id) === String(CK.shipType))) CK.shipType = opts[0].id;
  const cur = opts.find(o => String(o.id) === String(CK.shipType));
  CK.shipLabel = cur ? cur.label : CK.shipType;
  box.innerHTML = opts.map(o => `<button class="pill ${String(CK.shipType) === String(o.id) ? 'on' : ''}" data-id="${o.id}" onclick="ckSetShip('${o.id}')">${esc(o.label)}${o.eta ? ` <small>(${o.eta})</small>` : ''}</button>`).join('');
}
async function ckQuote() {
  const addr = (window._addrs || []).find(a => a.id === CK.addressId);
  const toZip = (addr?.zip || '').replace(/\D/g, '');
  if (toZip.length !== 8) return;
  try {
    const q = await api('/api/shipping/quote', { method: 'POST', body: JSON.stringify({ toZip, subtotal: Cart.subtotal() }) });
    CK._shipOpts = q.options;
    renderCkShip(); ckTotals();
  } catch { }
}
function ckSetPay(v) { CK.pay = v; $$('.paym button').forEach(b => b.classList.toggle('on', b.dataset.pay === v)); ckTotals(); }
async function ckArt(input) {
  const f = input.files[0]; if (!f) return;
  const btn = document.querySelector('#ck-art-btn');
  if (btn) { btn.disabled = true; btn.innerHTML = 'Enviando...'; }
  toast('Enviando arte... aguarde');
  try {
    CK.art = await uploadFile(f);
    document.querySelector('#ck-art-ok').innerHTML = `✅ <b>${esc(f.name)}</b> anexado ao pedido!`;
    if (btn) { btn.disabled = false; btn.innerHTML = 'Trocar arte'; }
    toast('Arte anexada! Pode finalizar 🎨', 'ok');
  } catch (err) {
    toast(err.message, 'err');
    if (btn) { btn.disabled = false; btn.innerHTML = '📤 Enviar arte'; }
  }
}
function ckTotals() {
  const sub = Cart.subtotal();
  let desc = CK.coupon?.discount || 0, free = !!CK.coupon?.freeship;
  let ship = CK.shipType === 'Retirada' ? 0 : (CK._quotes && CK._quotes[CK.shipType] != null ? CK._quotes[CK.shipType] : (CK.shipType === 'SEDEX' ? (CONFIG.shipSEDEX ?? 29.9) : (CONFIG.shipPAC ?? 19.9)));
  if (free || (sub - desc) >= (CONFIG.freeShipFrom || 299)) ship = 0;
  let pixOff = 0;
  if (CK.pay === 'pix') pixOff = Math.round((sub - desc) * (CONFIG.pixDiscount || 5)) / 100;
  const ptsBalance = Auth.user?.points || 0;
  const ptsMax = Math.min(ptsBalance, Math.floor(Math.max(0, sub - desc - pixOff) * 10));
  if (CK.pointsUsed > ptsMax) CK.pointsUsed = ptsMax;
  const ptsOff = Math.round(CK.pointsUsed / 10 * 100) / 100;
  const total = Math.max(0, sub - desc - pixOff - ptsOff + ship);
  CK._calc = { sub, desc: desc + pixOff + ptsOff, ship, total };
  $('#ck-totals').innerHTML = `<div class="totals">
    <div class="tt"><span>Subtotal</span><b>${BRL(sub)}</b></div>
    ${desc || pixOff ? `<div class="tt"><span>Descontos</span><b style="color:var(--ok)">−${BRL(desc + pixOff)}</b></div>` : ''}
    ${ptsBalance > 0 ? `<div class="tt"><span>🎁 Pontos (saldo ${ptsBalance})</span><span><input class="inp mono" id="ck-pts" type="number" min="0" max="${ptsMax}" value="${CK.pointsUsed}" style="width:80px;display:inline-block;padding:6px"> <button class="btn sm navy" onclick="ckApplyPoints()">OK</button></span></div>${ptsOff ? `<div class="tt"><span>Desconto pontos</span><b style="color:var(--ok)">−${BRL(ptsOff)}</b></div>` : ''}<small class="mut">10 pontos = R$ 1 • máx ${ptsMax} neste pedido</small>` : ''}
    <div class="tt"><span>Frete (${esc(CK.shipLabel || CK.shipType)})</span>${ship === 0 ? '<span class="free">GRÁTIS 🎉</span>' : `<b>${BRL(ship)}</b>`}</div>
    <div class="tt gt"><span>Total</span><span>${BRL(total)}</span></div>
    ${CK.pay === 'card' ? `<small class="mut">em até ${CONFIG.installmentMax || 6}x de ${BRL(total / (CONFIG.installmentMax || 6))} sem juros</small>` : ''}</div>`;
}
function ckApplyPoints() {
  CK.pointsUsed = Math.max(0, Math.floor(Number(document.querySelector('#ck-pts')?.value) || 0));
  ckTotals();
  toast(CK.pointsUsed ? CK.pointsUsed + ' pontos aplicados! 🎁' : 'Pontos removidos', 'ok');
}
async function ckFinish() {
  const pickup = CK.shipType === 'Retirada';
  if (!pickup && !CK.addressId) { toast('Cadastre/selecione o endereço de entrega', 'err'); return; }
  const addr = pickup ? { label: 'Retirada na loja', street: 'Retirada na loja', district: '', city: '', state: '', zip: '' } : window._addrs.find(a => a.id === CK.addressId);
  const btn = $('#ck-btn'); btn.disabled = true; btn.textContent = 'Processando pagamento... ⏳';
  try {
    const order = await api('/api/orders', {
      method: 'POST',
      body: JSON.stringify({
        items: Cart.items.map(i => ({ productId: i.productId, sel: i.sel, configLabel: i.configLabel })),
        address: addr, shippingType: CK.shipType, shippingLabel: CK.shipLabel || CK.shipType, paymentMethod: CK.pay, pointsUsed: CK.pointsUsed || 0,
        coupon: CK.coupon?.code || null, art: CK.art ? { url: CK.art.url, name: CK.art.name } : null,
      })
    });
    Cart.clear();
    try {
      const ps = await api('/api/pay/status');
      if (ps.mercadopago && CK.pay !== 'boleto') {
        const pref = await api('/api/pay/mp-preference', { method: 'POST', body: JSON.stringify({ orderId: order.id }) });
        toast('Redirecionando para o pagamento seguro... \uD83D\uDCB3');
        location.href = pref.init_point;
        return;
      }
    } catch (e) { console.warn('MP indisponível, usando simulação:', e.message); }
    if (CK.pay === 'pix') openModal(`<div style="text-align:center;padding:10px"><h2>⚡ Pague no Pix</h2><p>Pedido <b>${order.code}</b> criado! Total: <b>${BRL(order.total)}</b></p>
      <div style="font-size:90px">📱</div><p class="mono" style="background:var(--bg);padding:10px;border-radius:8px;font-size:12px">${CONFIG.pixKey ? esc(CONFIG.pixKey) : '00020126580014BR.GOV.BCB.PIX...' + order.code}</p>
      <p class="small mut">${CONFIG.pixKey ? 'Após pagar, acompanhe aqui — confirmamos rapidinho 😉' : '(Demonstração — pagamento aprovado automaticamente ✅)'}</p>
      <a class="btn big block" href="/conta.html#/pedidos">Acompanhar meu pedido →</a></div>`);
    else if (CK.pay === 'boleto') openModal(`<div style="text-align:center;padding:10px"><h2>🧾 Boleto gerado</h2><p>Pedido <b>${order.code}</b> • Total: <b>${BRL(order.total)}</b></p><div style="font-size:70px;letter-spacing:2px">||||| |||| |||</div><p class="mono small">34191.79001 01043.510047 91020.150008 9 999900000${String(Math.round(order.total * 100)).padStart(8, '0')}</p><a class="btn big block" href="/conta.html#/pedidos">Acompanhar meu pedido →</a></div>`);
    else { toast('Pagamento aprovado! 🎉', 'ok'); location.href = '/conta.html#/pedidos'; }
  } catch (e) { toast(e.message, 'err'); btn.disabled = false; btn.textContent = 'Confirmar pedido ✅'; }
}

/* ---------- AUTH ---------- */
function pageAuth() {
  const next = new URLSearchParams(location.search).get('next') || '';
  window._next = next;
  window.authTab = t => {
    $$('.auth .tabs button').forEach((b, i) => b.classList.toggle('on', (t === 'login') === (i === 0)));
    $('#f-login').style.display = t === 'login' ? '' : 'none';
    $('#f-cad').style.display = t === 'cad' ? '' : 'none';
  };
}
async function doLogin(e) {
  e.preventDefault();
  const f = e.target;
  try {
    const s = await api('/api/auth/login', { method: 'POST', body: JSON.stringify({ email: f.email.value, pass: f.pass.value }) });
    Auth.set(s); toast(`Bem-vindo, ${s.user.name.split(' ')[0]}! 👋`, 'ok');
    location.href = window._next || (s.user.role === 'admin' ? '/admin.html' : '/conta.html');
  } catch (err) { toast(err.message, 'err'); }
}
async function doRegister(e) {
  e.preventDefault();
  const f = e.target;
  try {
    const s = await api('/api/auth/register', { method: 'POST', body: JSON.stringify({ name: f.name.value, email: f.email.value, pass: f.pass.value, phone: f.phone.value, cpf: f.cpf.value }) });
    Auth.set(s); toast('Conta criada! Você ganhou o cupom BEMVINDO10 🎉', 'ok');
    location.href = window._next || '/conta.html';
  } catch (err) { toast(err.message, 'err'); }
}

/* ---------- PÁGINAS INSTITUCIONAIS ---------- */
function pageDoc() {
  const p = new URLSearchParams(location.search).get('p') || 'quem-somos';
  const T = {
    'quem-somos': `<h1>Quem somos 💙</h1><img src="/img/hero-print.jpg" alt="Nosso parque gráfico" style="width:100%;border-radius:14px;margin:6px 0 10px;box-shadow:var(--sh)"><p>A <b>${esc(CONFIG.storeName || 'PrimePrint')}</b> nasceu com um propósito simples: <b>impressão profissional com preço justo e sem complicação</b>. Atendemos de autônomos a grandes empresas em todo o Brasil.</p><h2>Nossos números</h2><table><tr><th>Ano de fundação</th><td>2018</td></tr><tr><th>Pedidos entregues</th><td>+120 mil</td></tr><tr><th>Cidades atendidas</th><td>+2.400</td></tr><tr><th>Avaliação média</th><td>4,9 ★</td></tr></table><h2>Por que a gente?</h2><ul><li>✅ Parque gráfico próprio com controle de qualidade</li><li>✅ Prova digital gratuita antes de imprimir</li><li>✅ Reimpressão garantida em caso de defeito</li><li>✅ Suporte humano de verdade, no WhatsApp</li></ul>`,
    'como-funciona': `<h1>Como funciona 🛒</h1><p>Comprar na nossa gráfica é moleza:</p><ol><li><b>Escolha o produto</b> e configure formato, papel, quantidade e prazo — o preço atualiza na hora.</li><li><b>Finalize o pedido</b> com Pix, cartão ou boleto.</li><li><b>Envie sua arte</b> no checkout ou depois, na sua conta. Não tem arte? Nosso time cria pra você.</li><li><b>Acompanhe tudo</b> pela timeline do pedido: análise → produção → envio → entrega. 🚚</li></ol><h2>Prazos</h2><p>Produção normal em até 5 dias úteis + prazo do frete. Precisou pra ontem? Ative a <b>produção expressa</b> no configurador. ⚡</p>`,
    'gabaritos': `<h1>Gabaritos 📐</h1><p>Baixe o gabarito do seu produto e monte a arte no tamanho certo, com sangria e margem de segurança. Formatos PDF e AI.</p><div class="gab-grid" id="gab-grid"></div><h2>Dicas rápidas</h2><ul><li>Use modo de cor <b>CMYK</b> e resolução <b>300 DPI</b>.</li><li>Converta textos em curvas.</li><li>Respeite 3mm de sangria em cada lado.</li></ul>`,
    'criacao-e-envio': `<h1>Criação e envio de arquivos 🎨</h1><h2>Formatos aceitos</h2><p>PDF, JPG, PNG, AI, PSD, CDR, TIFF e EPS — até 60MB por arquivo.</p><h2>Não tem arte?</h2><p>Nosso estúdio cria sua arte a partir de <b>R$ 49</b>. Chame no WhatsApp <b>${esc(CONFIG.phone || '')}</b> 💬</p><h2>Checklist antes de enviar</h2><ul><li>✅ CMYK + 300 DPI</li><li>✅ Textos em curvas</li><li>✅ Sangria de 3mm</li><li>✅ Confira telefone, endereço e preços!</li></ul>`,
    'duvidas': `<h1>Dúvidas frequentes ❓</h1><div class="faq"><details open><summary>Qual o prazo de entrega?</summary><div class="a">Produção de até 5 dias úteis (normal) ou 2 dias (expressa) + prazo do frete escolhido no checkout.</div></details><details><summary>Posso enviar a arte depois?</summary><div class="a">Sim! Você envia no checkout ou quando quiser, na área “Meus pedidos”.</div></details><details><summary>Vocês conferem minha arte?</summary><div class="a">Sim, toda arte passa por análise gratuita. Se algo estiver errado, avisamos antes de imprimir.</div></details><details><summary>Quais as formas de pagamento?</summary><div class="a">Pix (com ${CONFIG.pixDiscount || 5}% OFF), cartão em até ${CONFIG.installmentMax || 6}x e boleto.</div></details><details><summary>E se chegar com defeito?</summary><div class="a">Reimprimimos ou devolvemos seu dinheiro. Simples assim. 🛡️</div></details></div>`,
    'contato': `<h1>Fale conosco 💬</h1><p>📞 <b>${esc(CONFIG.phone || '')}</b> • ✉️ <b>${esc(CONFIG.email || '')}</b><br>🕘 ${esc(CONFIG.hours || '')}</p><form onsubmit="sendContact(event)"><div class="row2"><div><label class="lbl">Nome</label><input class="inp" name="name" required></div><div><label class="lbl">E-mail</label><input class="inp" name="email" type="email" required></div></div><div style="margin-top:10px"><label class="lbl">Assunto</label><input class="inp" name="subject"></div><div style="margin-top:10px"><label class="lbl">Mensagem</label><textarea class="inp" name="message" rows="5" required></textarea></div><button class="btn" style="margin-top:12px">Enviar mensagem ✉️</button></form>`,
    'politicas': `<h1>Nossas políticas 📜</h1><h2>Privacidade (LGPD)</h2><p>Seus dados são usados apenas para processar pedidos e melhorar sua experiência. Nunca vendemos informações. Você pode pedir exclusão quando quiser.</p><h2>Qualidade</h2><p>Todo pedido passa por prova digital e controle de qualidade. Defeito de impressão = reimpressão ou reembolso.</p><h2>Entrega</h2><p>Enviamos via PAC/SEDEX para todo o Brasil ou retire grátis na loja. Frete grátis em compras acima de <b>${BRL(CONFIG.freeShipFrom || 299)}</b>. Atrasos da transportadora geram acompanhamento dedicado.</p><h2>Trocas e devoluções</h2><p>Produtos personalizados seguem arte aprovada. Erro nosso? Reimpressão imediata. Erro na arte enviada pelo cliente? Reimprimimos com 30% de desconto. 🤝</p>`,
  };
  $('#doc').innerHTML = T[p] || T['quem-somos'];
  if (p === 'gabaritos') api('/api/products').then(list => {
    $('#gab-grid').innerHTML = list.map(x => `<div class="gab"><b>${x.icon} ${esc(x.name)}</b><div class="small mut">${esc(x.formats?.[0]?.label || '')} • PDF + AI</div><button class="btn sm ghost" onclick="toast('Gabarito baixado! 📐','ok')">⬇️ Baixar</button></div>`).join('');
  });
}
async function sendContact(e) {
  e.preventDefault();
  const f = e.target;
  await api('/api/contact', { method: 'POST', body: JSON.stringify({ name: f.name.value, email: f.email.value, subject: f.subject.value, message: f.message.value }) });
  toast('Mensagem enviada! Retornamos em breve ✉️', 'ok'); f.reset();
}
