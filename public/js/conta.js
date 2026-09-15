/* ============ PrimePrint — Dashboard do cliente ============ */
document.addEventListener('DOMContentLoaded', async () => {
  await loadGlobals();
  if (!Auth.user) { location.href = '/login.html?next=/conta.html'; return; }
  if (Auth.user.role === 'admin') { location.href = '/admin.html'; return; }
  try { const me = await api('/api/auth/me'); Auth.set({ token: Auth.token, user: me }); } catch { Auth.logout(); return; }
  renderSide();
  window.addEventListener('hashchange', route);
  route();
});
let ORDERS = [];
function renderSide(active = '') {
  const u = Auth.user;
  const pend = ORDERS.filter(o => !['entregue', 'cancelado'].includes(o.status)).length;
  $('#side').innerHTML = `
    <a class="logo" href="/index.html" style="color:#fff">${LOGO_SVG}<span>${esc(CONFIG.storeName || 'PrimePrint')}<small>MINHA CONTA</small></span></a><button class="side-x" onclick="document.querySelector('.side').classList.remove('on')">✕</button>
    <div class="who"><div class="av">${esc(u.name[0].toUpperCase())}</div><div><b>${esc(u.name.split(' ').slice(0, 2).join(' '))}</b><span>${esc(u.email)}</span></div></div>
    <nav>
      <a href="#/inicio" class="${active === 'inicio' ? 'on' : ''}">📊 Visão geral</a>
      <a href="#/pedidos" class="${active === 'pedidos' ? 'on' : ''}">📦 Meus pedidos ${pend ? `<span class="n">${pend}</span>` : ''}</a>
      <a href="#/arquivos" class="${active === 'arquivos' ? 'on' : ''}">🎨 Minhas artes</a>
      <a href="#/enderecos" class="${active === 'enderecos' ? 'on' : ''}">📍 Endereços</a>
      <a href="#/favoritos" class="${active === 'favoritos' ? 'on' : ''}">❤️ Favoritos</a>
      <a href="#/cupons" class="${active === 'cupons' ? 'on' : ''}">🎟️ Cupons</a>
      <a href="#/dados" class="${active === 'dados' ? 'on' : ''}">👤 Meus dados</a>
      <a href="#" onclick="event.preventDefault();Auth.logout()">🚪 Sair</a>
    </nav><a class="back" href="/index.html">← Voltar à loja</a>`;
}
async function route() {
  const h = location.hash || '#/inicio';
  const [_, path] = h.split('#/');
  document.querySelector('.side')?.classList.remove('on');
  try {
    ORDERS = await api('/api/orders');
    renderSide(path?.split('?')[0]);
    if (path?.startsWith('pedido')) return viewOrderDetail(new URLSearchParams(path.split('?')[1]).get('id'));
    if (path === 'pedidos') return viewOrders();
    if (path === 'arquivos') return viewFiles();
    if (path === 'enderecos') return viewAddresses();
    if (path === 'favoritos') return viewFavs();
    if (path === 'cupons') return viewCoupons();
    if (path === 'dados') return viewProfile();
    return viewHome();
  } catch (e) { $('#view').innerHTML = `<div class="empty"><div class="e">😕</div><p>${esc(e.message)}</p></div>`; }
}
const stTag = s => `<span class="st st-${s}">${STATUS[s] || s}</span>`;
const ST_ICONS = { aguardando_arte: '🎨', em_analise: '🔍', aprovado: '✅', em_producao: '🖨️', enviado: '🚚', entregue: '📦', cancelado: '❌' };
function shipETA(o) {
  if (/retirada/i.test(o.shippingType || '')) return 'retire na loja quando pronto 🏪';
  if (!['enviado', 'entregue'].includes(o.status)) return 'após o envio';
  const ev = [...o.timeline].reverse().find(t => t.status === 'enviado');
  if (!ev) return 'em breve';
  const n = /sedex/i.test(o.shippingType || '') ? 4 : /pac/i.test(o.shippingType || '') ? 8 : 5;
  return fmtDate(new Date(new Date(ev.at).getTime() + n * 864e5).toISOString());
}
function timeline(o) {
  const idx = FLOW.indexOf(o.status);
  return `<div class="tl">${o.timeline.map(t => {
    const i = FLOW.indexOf(t.status);
    const cls = o.status === 'cancelado' ? '' : (i < idx || (o.status === t.status) ? (t.status === o.status ? 'now' : 'done') : '');
    return `<div class="ev ${cls}"><b>${ST_ICONS[t.status] || '•'} ${STATUS[t.status] || t.status}</b><span>${fmtDT(t.at)}${t.note ? ' — ' + esc(t.note) : ''}</span></div>`;
  }).join('')}</div>`;
}

function spendChart() {
  const months = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) { const d = new Date(now.getFullYear(), now.getMonth() - i, 1); months.push({ k: d.getFullYear() + '-' + d.getMonth(), label: d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', ''), total: 0 }); }
  ORDERS.filter(o => o.status !== 'cancelado').forEach(o => { const d = new Date(o.createdAt); const m = months.find(m => m.k === d.getFullYear() + '-' + d.getMonth()); if (m) m.total += o.total; });
  const max = Math.max(...months.map(m => m.total), 1);
  return `<div class="panel"><h3>📊 Seus gastos — últimos 6 meses</h3><div style="display:flex;align-items:flex-end;gap:10px;height:160px;padding-top:6px">${months.map(m => `<div style="flex:1;text-align:center"><div style="font-size:11px;font-weight:700;min-height:16px">${m.total ? BRL(m.total) : ''}</div><div style="height:${Math.max(5, Math.round(m.total / max * 105))}px;background:linear-gradient(180deg,var(--primary),var(--navy));border-radius:6px 6px 0 0"></div><div class="small mut">${m.label}</div></div>`).join('')}</div></div>`;
}
/* ---------- Visão geral ---------- */
function viewHome() {
  const u = Auth.user;
  const active = ORDERS.filter(o => !['entregue', 'cancelado'].includes(o.status));
  const done = ORDERS.filter(o => o.status === 'entregue');
  const saved = Math.round(ORDERS.reduce((s, o) => s + (o.discount || 0), 0) * 100) / 100;
  const spent = ORDERS.filter(o => o.status !== 'cancelado').reduce((s, o) => s + o.total, 0);
  $('#view').innerHTML = `
    <div class="main-hd"><div><h1>Olá, ${esc(u.name.split(' ')[0])}! 👋</h1><p>Aqui você acompanha pedidos, artes e dados. 🎁 Saldo: <b>${u.points || 0} pontos</b> <span class="small mut">(10 pts = R$ 1 no checkout)</span></p></div>
      <a class="btn" style="margin-left:auto" href="/produtos.html">🛍️ Fazer novo pedido</a></div>
    <div class="kpis">
      <div class="kpi"><div class="ki">📦</div><span>Pedidos ativos</span><b>${active.length}</b><small>em andamento</small></div>
      <div class="kpi c2"><div class="ki">✅</div><span>Concluídos</span><b>${done.length}</b><small>entregues com sucesso</small></div>
      <div class="kpi c3"><div class="ki">💰</div><span>Você economizou</span><b>${BRL(saved)}</b><small>em cupons e Pix</small></div>
      <div class="kpi c4"><div class="ki">🎨</div><span>Artes pendentes</span><b>${ORDERS.filter(o => o.status === 'aguardando_arte').length}</b><small>aguardando envio</small></div>
    </div>
    ${ORDERS.filter(o => o.status === 'aguardando_arte').length ? `<div class="panel" style="border-left:4px solid var(--warn)"><b>⚠️ Você tem pedido(s) aguardando arte!</b> <span class="mut">Envie para não atrasar a produção.</span> <a class="link-more" href="#/pedidos">Enviar agora →</a></div>` : ''}
    ${spendChart()}
    <div class="panel"><h3>🕘 Últimos pedidos</h3>
      ${ORDERS.length ? `<div style="overflow:auto"><table class="tbl"><tr><th>Pedido</th><th>Data</th><th>Itens</th><th>Total</th><th>Previsão</th><th>Status</th><th></th></tr>
      ${ORDERS.slice(0, 5).map(o => `<tr><td><b>${o.code}</b></td><td>${fmtDate(o.createdAt)}</td><td>${o.items.map(i => i.icon + ' ' + esc(i.name)).join('<br>')}</td><td><b>${BRL(o.total)}</b></td><td>${o.status === 'entregue' ? '✅' : o.status === 'enviado' ? shipETA(o) : '—'}</td><td>${stTag(o.status)}</td><td><a class="btn sm ghost" href="#/pedido?id=${o.id}">Ver</a></td></tr>`).join('')}</table></div>`
      : `<div class="empty"><div class="e">📦</div><p>Você ainda não fez pedidos.<br><a class="btn" href="/produtos.html">Começar agora</a></p></div>`}</div>`;
}

/* ---------- Pedidos ---------- */
function viewOrders() {
  $('#view').innerHTML = `
    <div class="main-hd"><div><h1>📦 Meus pedidos</h1><p>${ORDERS.length} pedido(s) • ${BRL(ORDERS.filter(o => o.status !== 'cancelado').reduce((s, o) => s + o.total, 0))} em compras • clique para detalhes</p></div></div>
    <div class="tabs"><button data-f="" class="on" onclick="filterOrders('',this)">Todos</button><button data-f="aguardando_arte" onclick="filterOrders('aguardando_arte',this)">Aguard. arte</button><button data-f="em_producao" onclick="filterOrders('em_producao',this)">Em produção</button><button data-f="enviado" onclick="filterOrders('enviado',this)">Enviados</button><button data-f="entregue" onclick="filterOrders('entregue',this)">Entregues</button></div>
    <input class="inp" id="order-q" placeholder="Buscar por codigo ou produto..." oninput="filterOrders(curTab())" style="max-width:320px;margin-bottom:10px"><div class="panel" id="orders-box"></div>`;
  filterOrders('');
}
function curTab() { return document.querySelector('.tabs button.on')?.dataset.f || ''; }
function filterOrders(s) {
  $$('.tabs button').forEach(b => b.classList.toggle('on', b.textContent.toLowerCase().includes(s ? STATUS[s].split(' ')[0].toLowerCase() : 'todos')));
  const q = ($('#order-q')?.value || '').toLowerCase();
  const list = (s ? ORDERS.filter(o => o.status === s) : ORDERS).filter(o => !q || (o.code + ' ' + o.items.map(i => i.name).join(' ')).toLowerCase().includes(q));
  $('#orders-box').innerHTML = list.length ? `<div style="overflow:auto"><table class="tbl"><tr><th>Pedido</th><th>Data</th><th>Itens</th><th>Pagamento</th><th>Total</th><th>Status</th><th></th></tr>
    ${list.map(o => `<tr><td><b>${o.code}</b>${o.tracking ? `<br><span class="small mono">${esc(o.tracking)}</span>` : ''}</td><td>${fmtDate(o.createdAt)}</td>
    <td>${o.items.map(i => `${i.icon} ${esc(i.name)} <span class="mut">(${i.qty.toLocaleString('pt-BR')} un)</span>`).join('<br>')}</td>
    <td>${o.payment.method === 'pix' ? '⚡ Pix' : o.payment.method === 'card' ? '💳 Cartão' : o.payment.method === 'infinitepay' ? '♾️ InfinitePay' : '🧾 Boleto'} <span class="st st-${o.payment.status}">${o.payment.status === 'paid' ? 'pago' : 'pendente'}</span></td>
    <td><b>${BRL(o.total)}</b></td><td>${stTag(o.status)}</td><td><a class="btn sm navy" href="#/pedido?id=${o.id}">Detalhes</a></td></tr>`).join('')}</table></div>`
    : `<div class="empty"><div class="e">📭</div><p>Nenhum pedido neste filtro.</p></div>`;
}
function viewOrderDetail(id) {
  const o = ORDERS.find(x => x.id === id);
  if (!o) { location.hash = '#/pedidos'; return; }
  $('#view').innerHTML = `
    <div class="main-hd"><a class="btn sm ghost" href="#/pedidos">← Voltar</a><div><h1>Pedido ${o.code}</h1><p>Feito em ${fmtDT(o.createdAt)} • ${stTag(o.status)}</p></div>
      <button class="btn navy" style="margin-left:auto" onclick='reorder(${JSON.stringify(o.id)})'>🔁 Repetir pedido</button></div>
    <div class="grid2">
      <div class="panel"><h3>📍 Acompanhamento</h3>${timeline(o)}
        ${trackBlock(o)}
        <p>📅 <b>Previsão de entrega:</b> ${shipETA(o)}</p>
        <h3 style="margin-top:16px">🧾 Itens</h3>${o.items.map(i => `<div class="mini"><div class="t" style="background:var(--navy)">${thumbHTML(i)}</div><div><b>${esc(i.name)}</b><span>${esc(i.config)}</span><span>${i.qty.toLocaleString('pt-BR')} un × ${BRL(i.unit)}</span>${o.status === 'entregue' ? ` <a class="link-more small" href="/produto.html?id=${i.productId}">⭐ Avaliar</a>` : ''}</div><b style="margin-left:auto">${BRL(i.total)}</b></div>`).join('')}
        <div class="totals" style="margin-top:10px"><div class="tt"><span>Subtotal</span><span>${BRL(o.subtotal)}</span></div>
        ${o.discount ? `<div class="tt"><span>Desconto ${o.coupon ? '(' + o.coupon + ')' : ''}</span><b style="color:var(--ok)">−${BRL(o.discount)}</b></div>` : ''}
        ${o.pointsDiscount ? `<div class="tt"><span>Pontos usados (${o.pointsUsed})</span><b style="color:var(--ok)">−${BRL(o.pointsDiscount)}</b></div>` : ''}
        ${o.status === 'entregue' ? `<div class="tt"><span>🎁 Pontos ganhos</span><b>+${Math.max(0, Math.floor((o.subtotal || 0) - (o.discount || 0)))}</b></div>` : ''}
        <div class="tt"><span>Frete (${o.shippingType})</span><span>${o.shipping ? BRL(o.shipping) : 'GRÁTIS 🎉'}</span></div>
        <div class="tt gt"><span>Total</span><span>${BRL(o.total)}</span></div></div></div>
      <div>
        <div class="panel"><h3>🎨 Arte do pedido</h3>
          ${proofBlock(o)}
          ${o.art?.file ? `<p>📎 <a class="link-more" href="${o.art.file}" target="_blank">${esc(o.art.originalName || 'ver arquivo')}</a></p><p>Status: <span class="st st-${o.art.status}">${{ pending: 'pendente', in_review: 'em análise', approved: 'aprovada ✅', rejected: 'reprovada ❌' }[o.art.status]}</span></p>${o.art.feedback ? `<p class="small">💬 <b>Feedback:</b> ${esc(o.art.feedback)}</p>` : ''}` : `<p class="mut">Nenhuma arte enviada ainda.</p>`}
          ${['aguardando_arte'].includes(o.status) || o.art?.status === 'rejected' ? `<label class="filebox" style="display:block;margin-top:10px">📤 <b>${o.art?.status === 'rejected' ? 'Reenviar arte corrigida' : 'Enviar arte agora'}</b><br><span class="small mut">PDF, JPG, PNG, AI, PSD, CDR — até 60MB</span><input type="file" hidden onchange="sendArt('${o.id}',this)"></label><div id="art-ok"></div>` : `<p class="small mut">✅ Arte recebida. Nossa equipe analisa antes de imprimir.</p>`}
        </div>
        <div class="panel"><h3>🚚 Entrega e pagamento</h3>
          <p class="small">📍 ${esc(o.address?.street || '')} • ${esc(o.address?.city || '')}/${esc(o.address?.state || '')} • CEP ${esc(o.address?.zip || '')}<br>🚚 ${o.shippingType} • 💳 ${o.payment.method === 'pix' ? 'Pix' : o.payment.method === 'card' ? 'Cartão' : o.payment.method === 'infinitepay' ? 'InfinitePay' : 'Boleto'} (${o.payment.status === 'paid' ? 'pago ✅' : 'aguardando pagamento ⏳'})</p>
          ${payActions(o)}
          <button class="btn sm ghost" onclick="toast('Nota fiscal enviada para seu e-mail! 🧾','ok')">🧾 2ª via da NF</button> <button class="btn sm navy" onclick="printReceipt('${o.id}')">Comprovante</button></div>
      </div>
    </div>`;
}
function payActions(o) {
  if (o.payment.status === 'paid' || o.status === 'cancelado') return '';
  if (o.payment.method === 'infinitepay') return `<div style="background:#FFF7ED;border:1.5px solid #F59E0B;border-radius:10px;padding:12px;margin:10px 0">♾️ <b>Pagamento pendente</b> — Pix ou cartão no checkout seguro.<br><br><button class="btn sm" onclick="payNow('${o.id}')">Pagar agora →</button> <button class="btn sm navy" onclick="checkPaid('${o.code}')">Já paguei, verificar 🔄</button></div>`;
  if (o.payment.method === 'pix' && CONFIG.pixKey) return `<div style="background:#FFF7ED;border:1.5px solid #F59E0B;border-radius:10px;padding:12px;margin:10px 0">⚡ <b>Aguardando Pix de ${BRL(o.total)}</b><br><span class="small mut">Chave (${esc(CONFIG.pixName || 'PrimePrint')}):</span> <span class="mono small" id="ct-pixkey">${esc(CONFIG.pixKey)}</span> <button class="btn sm navy" onclick="navigator.clipboard?.writeText(document.querySelector('#ct-pixkey').textContent);toast('Chave copiada!','ok')">Copiar</button><br><br>${o.payment.notified ? '<span class="small">✅ Você já avisou — estamos confirmando!</span>' : `<button class="btn sm ok" onclick="notifyPaidCt('${o.id}')">Já paguei ✅</button>`}</div>`;
  return '';
}
async function payNow(id) {
  try { toast('Gerando link de pagamento... ♾️'); const r = await api(`/api/orders/${id}/pay-link`, { method: 'POST' }); location.href = r.paymentUrl; }
  catch (e) { toast(e.message, 'err'); }
}
async function checkPaid(code) {
  try {
    toast('Verificando pagamento... 🔄');
    const r = await api(`/api/orders/code/${code}/payment-check`);
    ORDERS = await api('/api/orders');
    const o = ORDERS.find(x => x.code === code);
    if (o) viewOrderDetail(o.id);
    toast(r.paid ? 'Pagamento confirmado! 🎉' : 'Ainda não identificamos — aguarde um pouco e tente de novo', r.paid ? 'ok' : 'err');
  } catch (e) { toast(e.message, 'err'); }
}
async function notifyPaidCt(id) {
  try { await api(`/api/orders/${id}/notify-payment`, { method: 'POST' }); toast('Valeu! Vamos confirmar 🙏', 'ok'); ORDERS = await api('/api/orders'); viewOrderDetail(id); }
  catch (e) { toast(e.message, 'err'); }
}
function proofBlock(o) {
  if (!o.art?.proofFile) return '';
  if (o.art.approval === 'pending') return `<div style="background:#FFF7ED;border:1.5px solid #F59E0B;border-radius:10px;padding:12px;margin-bottom:10px">📤 <b>Sua prova está pronta!</b> Confira com atenção:<br><br>📎 <a class="link-more" href="${o.art.proofFile}" target="_blank"><b>${esc(o.art.proofName || 'abrir prova')}</b></a><br><br><button class="btn ok sm" onclick="approveProof('${o.id}',true)">Aprovar ✅</button><div style="margin-top:10px"><textarea class="inp" id="proof-note" rows="2" placeholder="Precisa de ajuste? Descreva aqui..."></textarea><br><button class="btn sm danger" style="margin-top:6px" onclick="approveProof('${o.id}',false)">Pedir ajuste ✏️</button></div></div>`;
  if (o.art.approval === 'approved') return `<p class="small">📤 Prova <b>aprovada por você</b> ✅ (<a class="link-more" href="${o.art.proofFile}" target="_blank">ver</a>)</p>`;
  return `<p class="small">📤 Você pediu ajuste na prova ⏳ — estamos corrigindo! (<a class="link-more" href="${o.art.proofFile}" target="_blank">ver</a>)</p>`;
}
async function approveProof(id, ok) {
  const note = document.querySelector('#proof-note')?.value.trim() || '';
  if (!ok && !note) { toast('Descreva o ajuste necessário ✏️', 'err'); return; }
  if (ok && !confirm('Aprovar a prova e liberar a produção?')) return;
  try { await api(`/api/orders/${id}/approve-art`, { method: 'PUT', body: JSON.stringify({ approved: ok, note }) }); toast(ok ? 'Prova aprovada! Indo pra produção 🚀' : 'Ajuste solicitado! ✏️', 'ok'); ORDERS = await api('/api/orders'); viewOrderDetail(id); }
  catch (e) { toast(e.message, 'err'); }
}
function trackBlock(o) {
  if (!o.tracking) return '';
  const isCorreios = /^[A-Z]{2}\d{9}BR$/i.test(o.tracking);
  const via = o.me?.company ? ` <span class="small mut">via ${esc(o.me.company)}</span>` : '';
  const last = o.me?.lastEvent ? `<br><span class="small">📍 ${esc(o.me.lastEvent)}</span>` : '';
  return `<p>🚚 <b>Rastreio:</b> <span class="mono">${esc(o.tracking)}</span>${via}${last}<br>${isCorreios ? `<a class="btn sm navy" target="_blank" href="https://www2.correios.com.br/sistemas/rastreamento/resultado.cfm?objetos=${o.tracking}">Rastrear nos Correios →</a> ` : ''}<button class="btn sm ghost" onclick="navigator.clipboard?.writeText('${o.tracking}');toast('Código copiado!','ok')">Copiar</button></p>`;
}
function printReceipt(id) {
  const o = ORDERS.find(x => x.id === id);
  const w = window.open('', '_blank', 'width=760,height=900');
  w.document.write(`<html><head><title>Comprovante ${o.code}</title><style>body{font-family:Arial,sans-serif;padding:32px;max-width:640px;margin:auto;color:#111}h1{font-size:20px;text-align:center}table{width:100%;border-collapse:collapse;margin:14px 0}td,th{border:1px solid #999;padding:8px;font-size:13px;text-align:left}.c{text-align:center;color:#555;font-size:12px}button{display:block;margin:20px auto;padding:12px 30px;font-size:15px;font-weight:700;cursor:pointer}@media print{button{display:none}}</style></head><body>
  <h1>COMPROVANTE DE PEDIDO — ${o.code}</h1><p class="c">${fmtDT(o.createdAt)}</p>
  <table><tr><th>Item</th><th>Configuração</th><th>Qtd</th><th>Total</th></tr>${o.items.map(i => `<tr><td><b>${esc(i.name)}</b></td><td>${esc(i.config)}</td><td>${i.qty.toLocaleString('pt-BR')} un</td><td>${BRL(i.total)}</td></tr>`).join('')}</table>
  <p>Subtotal: ${BRL(o.subtotal)}${o.discount ? `<br>Desconto${o.coupon ? ' (' + o.coupon + ')' : ''}: −${BRL(o.discount)}` : ''}<br>Frete (${o.shippingType}): ${o.shipping ? BRL(o.shipping) : 'GRATIS'}<br><b>TOTAL: ${BRL(o.total)}</b><br>Pagamento: ${o.payment.method} (${o.payment.status})</p>
  <p class="c">Entrega: ${esc(o.address?.street || '')} — ${esc(o.address?.city || '')}/${esc(o.address?.state || '')} CEP ${esc(o.address?.zip || '')}</p>
  <p class="c">Obrigado pela preferencia!</p>
  <button onclick="window.print()">Imprimir</button></body></html>`);
  w.document.close();
}
async function sendArt(orderId, input) {
  const f = input.files[0]; if (!f) return;
  toast('Enviando... ⏳');
  try {
    const up = await uploadFile(f);
    await api(`/api/orders/${orderId}/art`, { method: 'PUT', body: JSON.stringify({ url: up.url, name: up.name }) });
    toast('Arte enviada! Nossa equipe vai analisar 🎨', 'ok');
    ORDERS = await api('/api/orders'); viewOrderDetail(orderId);
  } catch (e) { toast(e.message, 'err'); }
}
async function reorder(id) {
  const o = ORDERS.find(x => x.id === id);
  for (const it of o.items) {
    try {
      const p = await api(`/api/products/${it.productId}`);
      Cart.add({ productId: p.id, name: p.name, icon: p.icon, img: p.img || null, grad: p.grad, sel: { qty: String(it.qty) }, configLabel: it.config, qty: it.qty, unit: it.unit, total: it.total });
    } catch { toast(`"${it.name}" não está mais disponível`, 'err'); }
  }
  toast('Itens adicionados ao carrinho! 🛒', 'ok');
  location.href = '/carrinho.html';
}

/* ---------- Artes ---------- */
function viewFiles() {
  const arts = ORDERS.filter(o => o.art?.file || o.status === 'aguardando_arte');
  $('#view').innerHTML = `<div class="main-hd"><div><h1>🎨 Minhas artes</h1><p>Arquivos enviados e pendências • <a class="link-more" href="/pagina.html?p=gabaritos">📐 Baixar gabaritos</a></p></div></div>
  <div class="panel">${arts.length ? `<div style="overflow:auto"><table class="tbl"><tr><th>Pedido</th><th>Arquivo</th><th>Status</th><th></th></tr>
    ${arts.map(o => `<tr><td><b>${o.code}</b><br><span class="small mut">${o.items.map(i => esc(i.name)).join(', ')}</span></td>
    <td>${o.art?.file ? `📎 ${esc(o.art.originalName || 'arquivo')}` : '<span class="mut">— pendente —</span>'}</td>
    <td><span class="st st-${o.art?.status || 'pending'}">${{ pending: 'pendente', in_review: 'em análise', approved: 'aprovada ✅', rejected: 'reprovada ❌' }[o.art?.status || 'pending']}</span>${o.art?.feedback ? `<br><span class="small">💬 ${esc(o.art.feedback)}</span>` : ''}</td>
    <td><a class="btn sm navy" href="#/pedido?id=${o.id}">${o.art?.file ? 'Ver' : 'Enviar arte'}</a></td></tr>`).join('')}</table></div>`
    : `<div class="empty"><div class="e">🎨</div><p>Nenhuma arte por aqui ainda.</p></div>`}</div>`;
}

/* ---------- Endereços ---------- */
function viewAddresses() {
  const addrs = Auth.user.addresses || [];
  $('#view').innerHTML = `<div class="main-hd"><div><h1>📍 Endereços</h1><p>Locais de entrega dos seus pedidos</p></div></div>
  <div class="panel"><div class="addr-grid">${addrs.map(a => `<div class="addr ${a.main ? 'main' : ''}"><b>${esc(a.label || '')}</b> ${a.main ? '<span class="badge ok">Principal</span>' : ''}<br><span class="small mut">${esc(a.street)}<br>${esc(a.district || '')} — ${esc(a.city)}/${esc(a.state)}<br>CEP ${esc(a.zip)}</span>
    <div style="margin-top:8px;display:flex;gap:6px">${!a.main ? `<button class="btn sm ghost" onclick="addrMain('${a.id}')">Tornar principal</button>` : ''}<button class="btn sm ghost" onclick="addrDel('${a.id}')">🗑️</button></div></div>`).join('') || '<p class="mut">Nenhum endereço.</p>'}</div></div>
  <div class="panel"><h3>＋ Novo endereço</h3><form onsubmit="addrAdd(event)"><div class="row2"><div><label class="lbl">Rótulo</label><input class="inp" name="label" required placeholder="Casa, Loja..."></div><div><label class="lbl">CEP</label><input class="inp" name="zip" required></div></div>
    <div style="margin-top:8px"><label class="lbl">Rua + número</label><input class="inp" name="street" required></div>
    <div class="row2" style="margin-top:8px"><div><label class="lbl">Bairro</label><input class="inp" name="district"></div><div><label class="lbl">Cidade</label><input class="inp" name="city" required></div></div>
    <div style="margin-top:8px;max-width:120px"><label class="lbl">UF</label><input class="inp" name="state" maxlength="2" required></div>
    <button class="btn" style="margin-top:10px">Salvar</button></form></div>`;
}
async function addrAdd(e) {
  e.preventDefault(); const f = e.target;
  await api('/api/addresses', { method: 'POST', body: JSON.stringify({ label: f.label.value, zip: f.zip.value, street: f.street.value, district: f.district.value, city: f.city.value, state: f.state.value }) });
  const me = await api('/api/auth/me'); Auth.set({ token: Auth.token, user: me });
  toast('Endereço salvo! 📍', 'ok'); viewAddresses();
}
async function addrMain(id) { await api(`/api/addresses/${id}`, { method: 'PUT', body: JSON.stringify({ main: true }) }); const me = await api('/api/auth/me'); Auth.set({ token: Auth.token, user: me }); viewAddresses(); }
async function addrDel(id) { if (!confirm('Excluir endereço?')) return; await api(`/api/addresses/${id}`, { method: 'DELETE' }); const me = await api('/api/auth/me'); Auth.set({ token: Auth.token, user: me }); viewAddresses(); }

/* ---------- Favoritos / cupons / perfil ---------- */
async function viewFavs() {
  const favs = Auth.user.favorites || [];
  let list = [];
  if (favs.length) { const all = await api('/api/products'); list = all.filter(p => favs.includes(p.id)); }
  $('#view').innerHTML = `<div class="main-hd"><div><h1>❤️ Favoritos</h1><p>${list.length} produto(s) salvos</p></div></div>
  ${list.length ? `<div class="prod-grid">${list.map(productCard).join('')}</div>` : `<div class="panel"><div class="empty"><div class="e">🤍</div><p>Toque no 🤍 dos produtos para salvar aqui.<br><br><a class="btn" href="/produtos.html">Explorar produtos</a></p></div></div>`}`;
}
async function viewCoupons() {
  const used = new Set(ORDERS.map(o => o.coupon).filter(Boolean));
  let list = [];
  try { list = await api('/api/coupons/public'); } catch { }
  $('#view').innerHTML = `<div class="main-hd"><div><h1>🎟️ Meus cupons</h1><p>Clique para copiar e use no checkout</p></div></div>
  ${list.length ? `<div class="grid2">${list.map(c => `
    <div class="panel" style="border:2px ${used.has(c.code) ? 'solid var(--ok)' : 'dashed var(--primary)'};text-align:center;${used.has(c.code) ? 'opacity:.8' : ''}">
      <div style="font-size:34px">${c.type === 'freeship' ? '🚚' : c.type === 'fixed' ? '💵' : '🎟️'}</div>
      <h2 class="mono">${c.code}</h2><p class="mut">${esc(c.desc)}</p>
      <p class="small mut">Mínimo: ${BRL(c.min)}${c.expires ? ' • até ' + c.expires.split('-').reverse().join('/') : ''}</p>
      ${used.has(c.code) ? '<span class="badge ok">✅ Você já usou</span>' : `<button class="btn sm navy" onclick="navigator.clipboard?.writeText('${c.code}');toast('Cupom ${c.code} copiado! 🎟️','ok')">Copiar código</button>`}
    </div>`).join('')}</div>`
  : `<div class="panel"><div class="empty"><div class="e">🎟️</div><p>Nenhum cupom disponível no momento.</p></div></div>`}`;
}
function viewProfile() {
  const u = Auth.user;
  $('#view').innerHTML = `<div class="main-hd"><div><h1>👤 Meus dados</h1><p>Mantenha seu cadastro atualizado</p></div></div>
  <div class="grid2"><div class="panel"><h3>Cadastro</h3><form onsubmit="saveProfile(event)">
    <label class="lbl">Nome</label><input class="inp" name="name" value="${esc(u.name)}">
    <div style="margin-top:8px"><label class="lbl">E-mail</label><input class="inp" value="${esc(u.email)}" disabled></div>
    <div class="row2" style="margin-top:8px"><div><label class="lbl">Telefone</label><input class="inp" name="phone" value="${esc(u.phone || '')}"></div><div><label class="lbl">CPF/CNPJ</label><input class="inp" name="cpf" value="${esc(u.cpf || '')}"></div></div>
    <button class="btn" style="margin-top:10px">Salvar alterações</button></form></div>
  <div class="panel"><h3>🔐 Trocar senha</h3><form onsubmit="savePass(event)">
    <label class="lbl">Senha atual</label><input class="inp" name="current" type="password" required>
    <div style="margin-top:8px"><label class="lbl">Nova senha</label><input class="inp" name="next" type="password" required minlength="6"></div>
    <button class="btn navy" style="margin-top:10px">Trocar senha</button></form></div></div>
  <div class="panel"><h3>📊 Seu resumo</h3><p>🎂 Cliente desde <b>${fmtDate(u.createdAt)}</b><br>📦 <b>${ORDERS.length}</b> pedidos • ✅ <b>${ORDERS.filter(o => o.status === 'entregue').length}</b> entregues<br>💰 Total em compras: <b>${BRL(ORDERS.filter(o => o.status !== 'cancelado').reduce((s, o) => s + o.total, 0))}</b> • 🎟️ Economizado: <b>${BRL(Math.round(ORDERS.reduce((s, o) => s + (o.discount || 0) + (o.pointsDiscount || 0), 0) * 100) / 100)}</b><br>🎁 Saldo: <b>${u.points || 0} pontos</b></p></div>`;
}
async function saveProfile(e) { e.preventDefault(); const f = e.target; const u = await api('/api/auth/me', { method: 'PUT', body: JSON.stringify({ name: f.name.value, phone: f.phone.value, cpf: f.cpf.value }) }); Auth.set({ token: Auth.token, user: u }); toast('Dados atualizados! ✅', 'ok'); renderSide('dados'); }
async function savePass(e) { e.preventDefault(); const f = e.target; await api('/api/auth/password', { method: 'POST', body: JSON.stringify({ current: f.current.value, next: f.next.value }) }); toast('Senha trocada! 🔐', 'ok'); f.reset(); }
