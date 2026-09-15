/* ============ PrimePrint — Painel administrativo ============ */
document.addEventListener('DOMContentLoaded', async () => {
  await loadGlobals();
  if (!Auth.user) { location.href = '/login.html?next=/admin.html'; return; }
  try { const me = await api('/api/auth/me'); Auth.set({ token: Auth.token, user: me }); } catch { Auth.logout(); return; }
  if (Auth.user.role !== 'admin') { location.href = '/conta.html'; return; }
  window.addEventListener('hashchange', route);
  route();
});
let STATS = null, ORDERS = [], PRODUCTS = [];
const stTag = s => `<span class="st st-${s}">${STATUS[s] || s}</span>`;

function renderSide(active, badges = {}) {
  $('#side').innerHTML = `
    <a class="logo" href="/index.html" style="color:#fff">${LOGO_SVG}<span>${esc(CONFIG.storeName || 'PrimePrint')}<small>ADMIN</small></span></a><button class="side-x" onclick="document.querySelector('.side').classList.remove('on')">✕</button>
    <div class="who"><div class="av">🛠️</div><div><b>${esc(Auth.user.name)}</b><span>Administrador</span></div></div>
    <nav>
      <a href="#/dashboard" class="${active === 'dashboard' ? 'on' : ''}">📊 Dashboard</a>
      <a href="#/pedidos" class="${active === 'pedidos' ? 'on' : ''}">🧾 Pedidos ${badges.orders ? `<span class="n">${badges.orders}</span>` : ''}</a>
      <a href="#/producao" class="${active === 'producao' ? 'on' : ''}">🏭 Produção</a>
      <a href="#/produtos" class="${active === 'produtos' ? 'on' : ''}">🖨️ Produtos</a>
      <a href="#/categorias" class="${active === 'categorias' ? 'on' : ''}">🗂️ Categorias</a>
      <a href="#/avaliacoes" class="${active === 'avaliacoes' ? 'on' : ''}">⭐ Avaliações</a>
      <a href="#/clientes" class="${active === 'clientes' ? 'on' : ''}">👥 Clientes</a>
      <a href="#/cupons" class="${active === 'cupons' ? 'on' : ''}">🎟️ Cupons</a>
      <a href="#/pagamentos" class="${active === 'pagamentos' ? 'on' : ''}">💳 Pagamentos</a>
      <a href="#/banners" class="${active === 'banners' ? 'on' : ''}">🖼️ Banners</a>
      <a href="#/gabaritos" class="${active === 'gabaritos' ? 'on' : ''}">📐 Gabaritos</a>
      <a href="#/relatorios" class="${active === 'relatorios' ? 'on' : ''}">📈 Relatórios</a>
      <a href="#/bi" class="${active === 'bi' ? 'on' : ''}">📊 BI Gerencial</a>
      <a href="#/mensagens" class="${active === 'mensagens' ? 'on' : ''}">✉️ Mensagens ${badges.msg ? `<span class="n">${badges.msg}</span>` : ''}</a>
      <a href="#/config" class="${active === 'config' ? 'on' : ''}">⚙️ Configurações</a>
      <a href="#" onclick="event.preventDefault();Auth.logout()">🚪 Sair</a>
    </nav><a class="back" href="/index.html">← Ver loja</a>`;
}
async function route() {
  const h = location.hash || '#/dashboard';
  const path = (h.split('#/')[1] || 'dashboard');
  document.querySelector('.side')?.classList.remove('on');
  $('#view').innerHTML = '<p class="mut">Carregando... ⏳</p>';
  try {
    STATS = await api('/api/admin/stats');
    ORDERS = await api('/api/orders');
    renderSide(path.split('?')[0], { orders: STATS.pendingArts, msg: STATS.unreadMsg });
    if (path.startsWith('pedido?')) return viewOrderDetail(new URLSearchParams(path.split('?')[1]).get('id'));
    if (path === 'pedidos') return viewOrders();
    if (path === 'producao') return viewKanban();
    if (path === 'produtos') return viewProducts();
    if (path === 'categorias') return viewCategories();
    if (path === 'avaliacoes') return viewReviews();
    if (path === 'clientes') return viewCustomers();
    if (path === 'cupons') return viewCoupons();
    if (path === 'pagamentos') return viewPayments();
    if (path === 'banners') return viewBanners();
    if (path === 'gabaritos') return viewTemplates();
    if (path === 'relatorios') return viewReports();
    if (path === 'bi') return viewBI();
    if (path === 'mensagens') return viewMessages();
    if (path === 'config') return viewConfig();
    return viewDashboard();
  } catch (e) { $('#view').innerHTML = `<div class="empty"><div class="e">😕</div><p>${esc(e.message)}</p></div>`; }
}

/* ---------- DASHBOARD ---------- */
function viewDashboard() {
  const max = Math.max(...STATS.series.map(s => s.revenue), 1);
  $('#view').innerHTML = `
    <div class="main-hd"><div><h1>📊 Dashboard</h1><p>Visão geral da sua gráfica • ${new Date().toLocaleDateString('pt-BR')}</p></div>
      <button class="btn" style="margin-left:auto" onclick="location.hash='#/pedidos'">🧾 Ver pedidos</button></div>
    <div class="kpis">
      <div class="kpi"><div class="ki">💰</div><span>Faturamento total</span><b>${BRL(STATS.revenue)}</b><small>${STATS.orders} pedidos</small></div>
      <div class="kpi c2"><div class="ki">🧾</div><span>Ticket médio</span><b>${BRL(STATS.ticket)}</b><small>por pedido</small></div>
      <div class="kpi c3"><div class="ki">👥</div><span>Clientes</span><b>${STATS.customers}</b><small>cadastrados</small></div>
      <div class="kpi c4"><div class="ki">🎨</div><span>Artes pendentes</span><b>${STATS.pendingArts}</b><small>precisam de atenção</small></div>
    </div>
    ${STATS.pendingArts ? `<div class="panel" style="border-left:4px solid var(--warn)"><b>⚠️ ${STATS.pendingArts} pedido(s) aguardando arte/análise.</b> <a class="link-more" href="#/pedidos">Resolver agora →</a></div>` : ''}
    <div class="grid2">
      <div class="panel"><h3>📈 Vendas — últimos 14 dias</h3><div class="chartwrap"><div class="chart">
        ${STATS.series.map(s => `<div class="bar" style="height:${Math.max(4, s.revenue / max * 100)}%" title="${s.label}: ${BRL(s.revenue)} (${s.orders} ped.)"><i>${s.label.slice(0, 5)}</i></div>`).join('')}
      </div></div></div>
      <div class="panel"><h3>🏆 Top produtos</h3>
        ${STATS.topProducts.map((p, i) => `<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--line)"><b>${i + 1}º</b><span class="t-ic" style="background:var(--navy);margin:0">${thumbHTML(p)}</span><div><b>${esc(p.name)}</b><br><span class="small mut">${p.qty.toLocaleString('pt-BR')} un vendidas</span></div><b style="margin-left:auto">${BRL(p.revenue)}</b></div>`).join('') || '<p class="mut">Sem vendas ainda.</p>'}</div>
    </div>
    <div class="panel"><h3>🕘 Pedidos recentes</h3><div style="overflow:auto"><table class="tbl"><tr><th>Pedido</th><th>Cliente</th><th>Total</th><th>Status</th><th></th></tr>
      ${STATS.recent.map(o => `<tr><td><b>${o.code}</b><br><span class="small mut">${fmtDT(o.createdAt)}</span></td><td>${esc(o.items.map(i => i.name).join(', '))}</td><td><b>${BRL(o.total)}</b></td><td>${stTag(o.status)}</td><td><a class="btn sm navy" href="#/pedido?id=${o.id}">Abrir</a></td></tr>`).join('')}</table></div></div>`;
}

/* ---------- PEDIDOS ---------- */
let F = { status: '', q: '' };
function viewOrders() {
  $('#view').innerHTML = `
    <div class="main-hd"><div><h1>🧾 Pedidos</h1><p>${ORDERS.length} pedido(s) • gerencie status, artes e rastreio</p></div></div>
    <div class="toolbar2">
      <select class="inp" onchange="F.status=this.value;listOrders()" id="f-status"><option value="">Todos os status</option>${Object.entries(STATUS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select>
      <input class="inp" placeholder="🔍 Buscar por código ou produto..." oninput="F.q=this.value;listOrders()" style="flex:1;min-width:200px">
    </div><div class="panel" id="orders-box"></div>`;
  listOrders();
}
function listOrders() {
  let list = ORDERS;
  if (F.status) list = list.filter(o => o.status === F.status);
  if (F.q) { const s = F.q.toLowerCase(); list = list.filter(o => (o.code + ' ' + o.items.map(i => i.name).join(' ') + ' ' + (o.customer?.name || '') + ' ' + (o.customer?.email || '')).toLowerCase().includes(s)); }
  $('#orders-box').innerHTML = list.length ? `<div style="overflow:auto"><table class="tbl"><tr><th>Pedido</th><th>Cliente</th><th>Itens</th><th>Total</th><th>Arte</th><th>Status</th><th></th></tr>
    ${list.map(o => `<tr><td><b>${o.code}</b><br><span class="small mut">${fmtDT(o.createdAt)}</span></td>
    <td>${esc(o.customer?.name || '—')}<br><span class="small mut">${esc(o.customer?.email || '')}</span></td>
    <td>${o.items.map(i => `${i.icon} ${esc(i.name)}`).join('<br>')}</td><td><b>${BRL(o.total)}</b><br><span class="small mut">${o.payment.method}${o.payment.gateway ? ' • ' + o.payment.gateway : ''}</span><br>${o.payment.status === 'paid' ? '<span class="badge ok">pago</span>' : '<span class="small">pendente ⏳</span>'}${o.payment.notified && o.payment.status !== 'paid' ? ' <span class="small">🔔 avisou</span>' : ''}</td>
    <td>${o.art?.file ? `📎 <span class="st st-${o.art.status}">${o.art.status}</span>` : '<span class="mut">—</span>'}</td>
    <td>${stTag(o.status)}</td><td><a class="btn sm navy" href="#/pedido?id=${o.id}">Gerenciar</a></td></tr>`).join('')}</table></div>`
    : `<div class="empty"><div class="e">📭</div><p>Nenhum pedido encontrado.</p></div>`;
}
function viewOrderDetail(id) {
  const o = ORDERS.find(x => x.id === id);
  if (!o) { location.hash = '#/pedidos'; return; }
  const nexts = FLOW.filter(s => s !== o.status);
  $('#view').innerHTML = `
    <div class="main-hd"><a class="btn sm ghost" href="#/pedidos">← Voltar</a><div><h1>${o.code}</h1><p>${esc(o.customer?.name || '')} • ${esc(o.customer?.email || '')} • ${stTag(o.status)}</p></div></div>
    <div class="grid2">
      <div class="panel"><h3>🔄 Alterar status</h3>
        <div style="display:flex;gap:8px;flex-wrap:wrap"><select class="inp" id="nstatus" style="flex:1">${nexts.map(s => `<option value="${s}">${STATUS[s]}</option>`).join('')}</select>
        <button class="btn" onclick="setStatus('${o.id}')">Atualizar</button></div>
        <div style="margin-top:10px"><label class="lbl">🚚 Código de rastreio</label><div style="display:flex;gap:8px"><input class="inp" id="ntrack" value="${esc(o.tracking || '')}" placeholder="BR...BR"><button class="btn navy sm" onclick="setStatus('${o.id}',true)">Salvar</button></div></div>
        <div style="margin-top:10px"><label class="lbl">📝 Observação interna</label><input class="inp" id="nnote" placeholder="Ex: cliente avisado no WhatsApp"></div>
        <h3 style="margin-top:18px">🧾 Itens • ${BRL(o.total)}</h3>
        ${o.items.map(i => `<div class="mini"><div class="t" style="background:var(--navy)">${thumbHTML(i)}</div><div><b>${esc(i.name)}</b><span>${esc(i.config)}</span></div><b style="margin-left:auto">${BRL(i.total)}</b></div>`).join('')}
        <p class="small mut">Subtotal ${BRL(o.subtotal)} • Desconto ${BRL(o.discount)} ${o.coupon ? '(' + o.coupon + ')' : ''} • Frete ${BRL(o.shipping)} (${o.shippingType}) • Pagto: ${o.payment.method} (<b>${o.payment.status}</b>)${o.payment.notified && o.payment.status !== 'paid' ? ' 🔔 <b>cliente avisou que pagou</b>' : ''}${o.payment.brand ? ' • ' + esc(o.payment.brand) + (o.payment.installments > 1 ? ' em ' + o.payment.installments + 'x' : '') : ''}${o.payment.linkUrl ? ` <a class="link-more small" target="_blank" href="${o.payment.linkUrl}">abrir checkout</a>` : ''} <button class="btn sm ${o.payment.status === 'paid' ? 'ok' : 'navy'}" onclick="togglePay('${o.id}','${o.payment.status === 'paid' ? 'pending' : 'paid'}')">${o.payment.status === 'paid' ? '✓ Pago' : 'Marcar como pago'}</button></p>
        <p class="small">📍 ${esc(o.address?.street || '')} — ${esc(o.address?.city || '')}/${esc(o.address?.state || '')} • CEP ${esc(o.address?.zip || '')}</p>
        <button class="btn sm ghost" onclick="toast('Etiqueta enviada para impressão! 🖨️','ok')">🖨️ Imprimir etiqueta</button> <button class="btn sm navy" onclick="printSlip('${o.id}')">🧾 Ficha de produção</button></div>
      <div>
        <div class="panel"><h3>🎨 Análise de arte</h3>
          ${o.art?.file ? `<p>📎 <a class="link-more" href="${o.art.file}" target="_blank">${esc(o.art.originalName || 'abrir arquivo')}</a> <span class="st st-${o.art.status}">${o.art.status}</span></p>
          <label class="lbl">Feedback (se reprovar)</label><input class="inp" id="art-fb" placeholder="Ex: faltou sangria, texto cortado...">
          <div style="display:flex;gap:8px;margin-top:10px"><button class="btn ok" onclick="reviewArt('${o.id}',true)">✅ Aprovar</button><button class="btn danger" onclick="reviewArt('${o.id}',false)">❌ Reprovar</button></div>`
          : `<p class="mut">Cliente ainda não enviou a arte. <button class="btn sm navy" onclick="toast('Lembrete enviado por WhatsApp! 💬','ok')">💬 Cobrar no WhatsApp</button></p>`}</div>
        <div class="panel"><h3>📍 Linha do tempo</h3><div class="tl">${o.timeline.map(t => `<div class="ev done"><b>${STATUS[t.status] || t.status}</b><span>${fmtDT(t.at)}${t.note ? ' — ' + esc(t.note) : ''}</span></div>`).join('')}</div></div>
      </div>
    </div>`;
}
async function setStatus(id, onlyTrack) {
  const status = $('#nstatus')?.value || ORDERS.find(o => o.id === id).status;
  await api(`/api/orders/${id}/status`, { method: 'PUT', body: JSON.stringify({ status: onlyTrack ? ORDERS.find(o => o.id === id).status : status, tracking: $('#ntrack').value, note: $('#nnote')?.value || '' }) });
  toast('Pedido atualizado! ✅', 'ok'); ORDERS = await api('/api/orders'); viewOrderDetail(id);
}
async function reviewArt(id, approved) {
  const feedback = $('#art-fb')?.value || '';
  if (!approved && !feedback) { toast('Informe o motivo da reprovação', 'err'); return; }
  await api(`/api/orders/${id}/art-review`, { method: 'PUT', body: JSON.stringify({ approved, feedback }) });
  toast(approved ? 'Arte aprovada! ✅' : 'Arte reprovada, cliente avisado ❌', 'ok');
  ORDERS = await api('/api/orders'); viewOrderDetail(id);
}

/* ---------- PRODUÇÃO (kanban) ---------- */
async function togglePay(id, to) {
  await api(`/api/orders/${id}/pay`, { method: 'PUT', body: JSON.stringify({ status: to }) });
  toast('Pagamento atualizado! 💳', 'ok'); ORDERS = await api('/api/orders'); viewOrderDetail(id);
}
function printSlip(id) {
  const o = ORDERS.find(x => x.id === id);
  const w = window.open('', '_blank', 'width=820,height=900');
  w.document.write(`<html><head><title>Ficha ${o.code}</title><style>body{font-family:Arial,sans-serif;padding:28px;color:#111}h1{font-size:22px;border-bottom:3px solid #111;padding-bottom:8px}table{width:100%;border-collapse:collapse;margin:12px 0}td,th{border:1px solid #666;padding:8px;font-size:13px;text-align:left}.hd{background:#eee}button{margin:16px 0;padding:12px 28px;font-size:15px;font-weight:700;cursor:pointer}@media print{button{display:none}}</style></head><body>
  <h1>🧾 FICHA DE PRODUÇÃO — ${o.code}</h1>
  <p><b>Cliente:</b> ${esc(o.customer?.name || '')} • ${esc(o.customer?.phone || '')} • ${esc(o.customer?.email || '')}<br><b>Data:</b> ${fmtDT(o.createdAt)} • <b>Status:</b> ${STATUS[o.status]} • <b>Envio:</b> ${o.shippingType}${o.tracking ? ' • <b>Rastreio:</b> ' + esc(o.tracking) : ''}</p>
  <table><tr class="hd"><th>Item</th><th>Configuração</th><th>Qtd</th></tr>${o.items.map(i => `<tr><td><b>${esc(i.name)}</b></td><td>${esc(i.config)}</td><td>${i.qty.toLocaleString('pt-BR')} un</td></tr>`).join('')}</table>
  <p><b>Arte:</b> ${o.art?.file ? esc(o.art.originalName || 'enviada') + ' (' + o.art.status + ')' : '⚠️ PENDENTE'}<br><b>Pagamento:</b> ${o.payment.method} (${o.payment.status}) • <b>Total:</b> ${BRL(o.total)}</p>
  <p><b>Entrega:</b> ${esc(o.address?.street || '')} — ${esc(o.address?.city || '')}/${esc(o.address?.state || '')} CEP ${esc(o.address?.zip || '')}</p>
  <p>Conferência: ________________________________________ &nbsp;&nbsp; Data: ____/____/____</p>
  <button onclick="window.print()">🖨️ Imprimir ficha</button></body></html>`);
  w.document.close();
}
function viewKanban() {
  const cols = ['em_analise', 'aprovado', 'em_producao', 'pronto_envio', 'enviado'];
  $('#view').innerHTML = `<div class="main-hd"><div><h1>🏭 Produção</h1><p>Arraste mentalmente: troque o status pelo seletor do cartão</p></div></div>
  <div class="kanban">${cols.map(c => { const list = ORDERS.filter(o => o.status === c); return `
    <div class="kcol"><h4>${STATUS[c]} <span>${list.length}</span></h4>
    ${list.map(o => `<div class="kcard" onclick="location.hash='#/pedido?id=${o.id}'"><b>${o.code}</b><span class="mut">${o.items.map(i => i.icon + ' ' + esc(i.name)).join('<br>')}</span><br><span class="small mut">${esc(o.customer?.name || '')}</span>
      <select onclick="event.stopPropagation()" onchange="kanbanMove('${o.id}',this.value)">${FLOW.map(s => `<option value="${s}" ${s === o.status ? 'selected' : ''}>→ ${STATUS[s]}</option>`).join('')}</select></div>`).join('') || '<p class="small mut">Vazio</p>'}</div>`; }).join('')}</div>`;
}
async function kanbanMove(id, status) { await api(`/api/orders/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) }); toast('Movido para ' + STATUS[status], 'ok'); ORDERS = await api('/api/orders'); viewKanban(); }

/* ---------- PRODUTOS ---------- */
async function viewProducts() {
  PRODUCTS = await api('/api/products?sort=sold');
  const all = await api('/api/products'); // todos
  $('#view').innerHTML = `<div class="main-hd"><div><h1>🖨️ Produtos</h1><p>${PRODUCTS.length} produto(s) no catálogo</p></div>
    <button class="btn" style="margin-left:auto" onclick="editProduct()">＋ Novo produto</button></div>
  <div class="panel"><input class="inp" placeholder="🔍 Buscar produto..." oninput="filterProds(this.value)" style="max-width:300px;margin-bottom:10px"><div style="overflow:auto"><table class="tbl" id="prods-table"><tr><th>Produto</th><th>Categoria</th><th>A partir de</th><th>Vendidos</th><th>Status</th><th></th></tr>
  ${PRODUCTS.map(p => `<tr><td><span class="t-ic" style="background:linear-gradient(135deg,${p.grad[0]},${p.grad[1]})">${thumbHTML(p)}</span><b>${esc(p.name)}</b>${p.badge ? ` <span class="badge sale">${esc(p.badge)}</span>` : ''}<br><span class="small mut">${esc(p.tagline || '')}</span></td>
    <td>${esc(CATS.find(c => c.id === p.category)?.name || p.category)}</td><td><b>${BRL(Math.min(...p.quantities.map(q => q.price)))}</b></td><td>${(p.sold || 0).toLocaleString('pt-BR')}</td>
    <td>${p.active !== false ? '<span class="badge ok">Ativo</span>' : '<span class="badge mut">Inativo</span>'}</td>
    <td style="white-space:nowrap"><button class="btn sm ghost" title="Duplicar" onclick="dupProduct('${p.id}')">📋</button> <button class="btn sm ghost" onclick="editProduct('${p.id}')">✏️</button> <button class="btn sm ghost" onclick="toggleProduct('${p.id}',${p.active === false})">${p.active === false ? '✅' : '⏸️'}</button> <button class="btn sm danger" onclick="delProduct('${p.id}')">🗑️</button></td></tr>`).join('')}</table></div></div>`;
}
function filterProds(q) {
  q = q.toLowerCase();
  document.querySelectorAll('#prods-table tr').forEach((tr, i) => {
    if (i === 0) return;
    tr.style.display = tr.textContent.toLowerCase().includes(q) ? '' : 'none';
  });
}
function editProduct(id) {
  const p = PRODUCTS.find(x => x.id === id) || { name: '', category: CATS[1]?.id || '', icon: '🖨️', grad: ['#0B1E3B', '#1E5AA8'], tagline: '', desc: '', badge: '', quantities: [{ qty: 100, price: 49.9 }, { qty: 500, price: 99.9 }] };
  if (!id && PRODUCTS[0]) { p.formats = PRODUCTS[0].formats; p.papers = PRODUCTS[0].papers; p.colors = PRODUCTS[0].colors; p.finishes = PRODUCTS[0].finishes; }
  openModal(`<div class="mh"><h3 style="margin:0">${id ? '✏️ Editar' : '＋ Novo'} produto</h3><button class="btn sm ghost" onclick="closeModal()">✕</button></div>
  <div class="mb"><form onsubmit="saveProduct(event,'${id || ''}')">
    <div class="row2"><div><label class="lbl">Nome</label><input class="inp" name="name" value="${esc(p.name)}" required></div>
    <div><label class="lbl">Categoria</label><select class="inp" name="category">${CATS.map(c => `<option value="${c.id}" ${c.id === p.category ? 'selected' : ''}>${c.icon} ${esc(c.name)}</option>`).join('')}</select></div></div>
    <div class="row2" style="margin-top:8px"><div><label class="lbl">Ícone (emoji)</label><input class="inp" name="icon" value="${esc(p.icon || '🖨️')}"></div>
    <div><label class="lbl">Selo (opcional)</label><input class="inp" name="badge" value="${esc(p.badge || '')}" placeholder="Ex: Oferta, Novo"></div></div><div class="row2" style="margin-top:8px"><div><label class="lbl">🎨 Cor fundo 1</label><input type="color" class="inp" name="grad0" value="${esc(p.grad?.[0] || '#0B1E3B')}" style="height:44px;padding:4px;cursor:pointer"></div><div><label class="lbl">🎨 Cor fundo 2</label><input type="color" class="inp" name="grad1" value="${esc(p.grad?.[1] || '#FF4D00')}" style="height:44px;padding:4px;cursor:pointer"></div></div><div style="margin-top:10px"><label style="font-weight:700;font-size:14px"><input type="checkbox" name="active" ${p.active !== false ? 'checked' : ''} style="width:18px;height:18px;vertical-align:-3px"> Produto ativo (visível na loja)</label></div><details style="margin-top:10px;background:var(--bg);border-radius:10px;padding:10px 12px"><summary style="cursor:pointer;font-weight:700">⚙️ Variações avançadas (tamanhos, papéis, cores, acabamentos)</summary><p class="small mut">Formato JSON • "mod" multiplica o preço (0.1 = +10%) • "add" soma R$ • Deixe como está se não souber.</p><label class="lbl">Tamanhos (formats)</label><textarea class="inp mono" name="formats" rows="3" style="font-size:11.5px">${esc(JSON.stringify(p.formats || [], null, 1))}</textarea><label class="lbl" style="margin-top:6px">Papéis (papers)</label><textarea class="inp mono" name="papers" rows="3" style="font-size:11.5px">${esc(JSON.stringify(p.papers || [], null, 1))}</textarea><label class="lbl" style="margin-top:6px">Cores (colors)</label><textarea class="inp mono" name="colors" rows="3" style="font-size:11.5px">${esc(JSON.stringify(p.colors || [], null, 1))}</textarea><label class="lbl" style="margin-top:6px">Acabamentos (finishes)</label><textarea class="inp mono" name="finishes" rows="3" style="font-size:11.5px">${esc(JSON.stringify(p.finishes || [], null, 1))}</textarea></details>
    <div style="margin-top:8px"><label class="lbl">Chamada curta</label><input class="inp" name="tagline" value="${esc(p.tagline || '')}"></div>
    <div style="margin-top:8px"><label class="lbl">Descrição</label><textarea class="inp" name="desc" rows="2">${esc(p.desc || '')}</textarea></div>
    <div style="margin-top:8px"><label class="lbl">Tabela de quantidades (qty:preço, separados por vírgula)</label><input class="inp mono" name="quantities" value="${p.quantities.map(q => q.qty + ':' + q.price).join(', ')}"></div><div style="margin-top:8px;max-width:280px"><label class="lbl">💰 Custo (% do preço) — p/ lucro</label><input class="inp" name="costPct" type="number" min="0" max="95" value="${p.costPct ?? 45}"></div><div style="margin-top:8px"><label class="lbl">📷 Foto do produto</label><div id="ep-imgprev">${p.img ? `<img src="${p.img}" style="width:100%;max-height:160px;object-fit:cover;border-radius:10px;margin-bottom:8px">` : ''}</div><div class="row2"><div><label class="filebox" style="display:block;padding:12px">📤 <b>Enviar foto</b><input type="file" hidden accept="image/*" onchange="epUpload(this)"></label></div><div><input class="inp" name="img" value="${esc(p.img || '')}" placeholder="ou cole a URL da imagem"></div></div></div>
    <button class="btn block" style="margin-top:12px">Salvar produto ✅</button></form></div>`);
}
async function saveProduct(e, id) {
  e.preventDefault(); const f = e.target;
  const quantities = f.quantities.value.split(',').map(s => { const [qty, price] = s.split(':').map(Number); return { qty, price }; }).filter(q => q.qty > 0 && q.price > 0);
  if (!quantities.length) { toast('Tabela de quantidades inválida', 'err'); return; }
  const body = { name: f.name.value, category: f.category.value, icon: f.icon.value, badge: f.badge.value, tagline: f.tagline.value, desc: f.desc.value, quantities };
  const imgVal = (f.img.value || '').trim();
  if (imgVal) body.img = imgVal;
  body.grad = [f.grad0.value, f.grad1.value];
  body.active = f.active.checked;
  body.costPct = Math.min(95, Math.max(0, Number(f.costPct.value) || 0));
  const adv = {};
  for (const k of ['formats', 'papers', 'colors', 'finishes']) {
    const raw = (f[k].value || '').trim();
    if (!raw) continue;
    try { adv[k] = JSON.parse(raw); if (!Array.isArray(adv[k]) || !adv[k].length) throw 0; }
    catch { toast('JSON inválido em "' + k + '" — confira colchetes e aspas', 'err'); return; }
  }
  Object.assign(body, adv);
  if (id) await api(`/api/products/${id}`, { method: 'PUT', body: JSON.stringify(body) });
  else {
    const base = PRODUCTS[0];
    await api('/api/products', { method: 'POST', body: JSON.stringify({ ...body, formats: adv.formats || base.formats, papers: adv.papers || base.papers, colors: adv.colors || base.colors, finishes: adv.finishes || base.finishes, deadlines: base.deadlines }) });
  }
  closeModal(); toast('Produto salvo! ✅', 'ok'); viewProducts();
}
async function epUpload(input) {
  const f = input.files[0]; if (!f) return;
  toast('Enviando foto... \u23F3');
  try {
    const up = await uploadFile(f);
    document.querySelector('input[name=img]').value = up.url;
    const prev = document.querySelector('#ep-imgprev');
    if (prev) prev.innerHTML = `<img src="${up.url}" style="width:100%;max-height:160px;object-fit:cover;border-radius:10px;margin-bottom:8px">`;
    toast('Foto enviada! \uD83D\uDCF7', 'ok');
  } catch (e) { toast(e.message, 'err'); }
  input.value = '';
}
async function dupProduct(id) {
  const p = PRODUCTS.find(x => x.id === id);
  const c = { ...p }; delete c.id; delete c.sold; delete c.rating; delete c.createdAt;
  c.name = p.name + ' (cópia)'; c.active = false;
  await api('/api/products', { method: 'POST', body: JSON.stringify(c) });
  toast('Produto duplicado como inativo! 📋', 'ok'); viewProducts();
}
async function toggleProduct(id, active) { await api(`/api/products/${id}`, { method: 'PUT', body: JSON.stringify({ active }) }); viewProducts(); }
async function delProduct(id) { if (!confirm('Excluir este produto?')) return; await api(`/api/products/${id}`, { method: 'DELETE' }); toast('Excluído 🗑️', 'ok'); viewProducts(); }

/* ---------- CATEGORIAS ---------- */
function viewCategories() {
  $('#view').innerHTML = `<div class="main-hd"><div><h1>🗂️ Categorias</h1></div><button class="btn" style="margin-left:auto" onclick="editCat()">＋ Nova</button></div>
  <div class="panel"><div style="overflow:auto"><table class="tbl"><tr><th>Categoria</th><th>Produtos</th><th></th></tr>
  ${CATS.map(c => `<tr><td><span style="font-size:22px">${c.icon}</span> <b>${esc(c.name)}</b><br><span class="small mut">${esc(c.desc || '')}</span></td><td>${c.count ?? '—'}</td>
  <td style="white-space:nowrap"><button class="btn sm ghost" onclick="editCat('${c.id}')">✏️</button> <button class="btn sm danger" onclick="delCat('${c.id}')">🗑️</button></td></tr>`).join('')}</table></div></div>`;
}
function editCat(id) {
  const c = CATS.find(x => x.id === id) || { name: '', icon: '📁', desc: '' };
  openModal(`<div class="mh"><h3 style="margin:0">${id ? '✏️ Editar' : '＋ Nova'} categoria</h3><button class="btn sm ghost" onclick="closeModal()">✕</button></div>
  <div class="mb"><form onsubmit="saveCat(event,'${id || ''}')"><label class="lbl">Nome</label><input class="inp" name="name" value="${esc(c.name)}" required>
  <div class="row2" style="margin-top:8px"><div><label class="lbl">Ícone (emoji)</label><input class="inp" name="icon" value="${esc(c.icon)}"></div><div><label class="lbl">Descrição</label><input class="inp" name="desc" value="${esc(c.desc || '')}"></div></div>
  <button class="btn block" style="margin-top:12px">Salvar ✅</button></form></div>`);
}
async function saveCat(e, id) {
  e.preventDefault(); const f = e.target;
  const body = { name: f.name.value, icon: f.icon.value, desc: f.desc.value };
  if (id) await api(`/api/categories/${id}`, { method: 'PUT', body: JSON.stringify(body) });
  else await api('/api/categories', { method: 'POST', body: JSON.stringify(body) });
  CATS = await api('/api/categories'); closeModal(); viewCategories();
}
async function delCat(id) { if (!confirm('Excluir categoria? (produtos ficam sem categoria)')) return; await api(`/api/categories/${id}`, { method: 'DELETE' }); CATS = await api('/api/categories'); viewCategories(); }

/* ---------- CLIENTES ---------- */
async function viewCustomers() {
  const list = await api('/api/admin/customers');
  $('#view').innerHTML = `<div class="main-hd"><div><h1>👥 Clientes</h1><p>${list.length} cadastrado(s)</p></div></div>
  <div class="panel"><div style="overflow:auto"><table class="tbl"><tr><th>Cliente</th><th>Contato</th><th>Pedidos</th><th>Total gasto</th><th>Status</th><th></th></tr>
  ${list.map(u => `<tr><td><b>${esc(u.name)}</b><br><span class="small mut">desde ${fmtDate(u.createdAt)}</span></td><td>${esc(u.email)}<br><span class="small mut">${esc(u.phone || '')}</span></td>
  <td>${u.orders}</td><td><b>${BRL(u.spent)}</b></td><td>${u.active ? '<span class="badge ok">Ativo</span>' : '<span class="badge mut">Bloqueado</span>'}</td>
  <td><button class="btn sm ${u.active ? 'danger' : 'ok'}" onclick="toggleCustomer('${u.id}',${!u.active})">${u.active ? 'Bloquear' : 'Ativar'}</button></td></tr>`).join('')}</table></div></div>`;
}
async function toggleCustomer(id, active) { await api(`/api/admin/customers/${id}`, { method: 'PUT', body: JSON.stringify({ active }) }); viewCustomers(); }

/* ---------- CUPONS ---------- */
async function viewCoupons() {
  const list = await api('/api/coupons');
  $('#view').innerHTML = `<div class="main-hd"><div><h1>🎟️ Cupons</h1></div><button class="btn" style="margin-left:auto" onclick="editCoupon()">＋ Novo cupom</button></div>
  <div class="panel"><div style="overflow:auto"><table class="tbl"><tr><th>Código</th><th>Benefício</th><th>Mínimo</th><th>Uso</th><th>Validade</th><th>Status</th><th></th></tr>
  ${list.map(c => `<tr><td><b class="mono">${c.code}</b><br><span class="small mut">${esc(c.desc || '')}</span></td>
  <td>${c.type === 'percent' ? c.value + '% OFF' : c.type === 'fixed' ? BRL(c.value) + ' OFF' : '🚚 Frete grátis'}</td><td>${BRL(c.min)}</td><td>${c.used}/${c.maxUses}</td><td>${c.expires || '—'}</td>
  <td>${c.active ? '<span class="badge ok">Ativo</span>' : '<span class="badge mut">Inativo</span>'}</td>
  <td style="white-space:nowrap"><button class="btn sm ghost" onclick='editCoupon(${JSON.stringify(c.id)})'>✏️</button> <button class="btn sm danger" onclick="delCoupon('${c.id}')">🗑️</button></td></tr>`).join('')}</table></div></div>`;
  window._coupons = list;
}
function editCoupon(id) {
  const c = (window._coupons || []).find(x => x.id === id) || { code: '', type: 'percent', value: 10, min: 100, maxUses: 100, expires: '2026-12-31', active: true, desc: '' };
  openModal(`<div class="mh"><h3 style="margin:0">${id ? '✏️ Editar' : '＋ Novo'} cupom</h3><button class="btn sm ghost" onclick="closeModal()">✕</button></div>
  <div class="mb"><form onsubmit="saveCoupon(event,'${id || ''}')">
  <div class="row2"><div><label class="lbl">Código</label><input class="inp mono" name="code" value="${c.code}" required style="text-transform:uppercase"></div>
  <div><label class="lbl">Tipo</label><select class="inp" name="type"><option value="percent" ${c.type === 'percent' ? 'selected' : ''}>% Desconto</option><option value="fixed" ${c.type === 'fixed' ? 'selected' : ''}>R$ Desconto</option><option value="freeship" ${c.type === 'freeship' ? 'selected' : ''}>Frete grátis</option></select></div></div>
  <div class="row2" style="margin-top:8px"><div><label class="lbl">Valor</label><input class="inp" name="value" type="number" step="0.01" value="${c.value}"></div><div><label class="lbl">Pedido mínimo (R$)</label><input class="inp" name="min" type="number" step="0.01" value="${c.min}"></div></div>
  <div class="row2" style="margin-top:8px"><div><label class="lbl">Usos máximos</label><input class="inp" name="maxUses" type="number" value="${c.maxUses}"></div><div><label class="lbl">Validade</label><input class="inp" name="expires" type="date" value="${c.expires || ''}"></div></div>
  <div style="margin-top:8px"><label class="lbl">Descrição</label><input class="inp" name="desc" value="${esc(c.desc || '')}"></div>
  <button class="btn block" style="margin-top:12px">Salvar cupom ✅</button></form></div>`);
}
async function saveCoupon(e, id) {
  e.preventDefault(); const f = e.target;
  const body = { code: f.code.value.toUpperCase(), type: f.type.value, value: Number(f.value.value), min: Number(f.min.value), maxUses: Number(f.maxUses.value), expires: f.expires.value, desc: f.desc.value, active: true };
  if (id) await api(`/api/coupons/${id}`, { method: 'PUT', body: JSON.stringify(body) });
  else await api('/api/coupons', { method: 'POST', body: JSON.stringify(body) });
  closeModal(); toast('Cupom salvo! 🎟️', 'ok'); viewCoupons();
}
async function delCoupon(id) { if (!confirm('Excluir cupom?')) return; await api(`/api/coupons/${id}`, { method: 'DELETE' }); viewCoupons(); }

/* ---------- BANNERS ---------- */
let BANNERS = [];
async function viewBanners() {
  BANNERS = await api('/api/admin/banners');
  $('#view').innerHTML = `
    <div class="main-hd"><div><h1>🖼️ Banners</h1><p>Slides da página inicial • edite e salve tudo</p></div>
      <div style="margin-left:auto;display:flex;gap:8px"><button class="btn ghost" onclick="addBanner()">＋ Novo</button><button class="btn" onclick="saveBanners()">💾 Salvar tudo</button></div></div>
    <div style="display:flex;flex-direction:column;gap:14px">${BANNERS.map((b, i) => `
      <div class="panel" style="margin:0;${b.active === false ? 'opacity:.6' : ''}">
        <div style="display:grid;grid-template-columns:120px 1fr;gap:14px" class="banedit">
          <div style="border-radius:12px;min-height:120px;background:linear-gradient(135deg,${b.grad[0]},${b.grad[1]});display:grid;place-items:center;font-size:44px;overflow:hidden">${b.img ? `<img src="${b.img}" style="width:100%;height:100%;object-fit:cover">` : esc(b.icon || '')}</div>
          <div>
            <div class="row2"><div><label class="lbl">Título</label><input class="inp" value="${esc(b.title)}" oninput="bannerSet(${i},'title',this.value)"></div>
            <div><label class="lbl">Subtítulo</label><input class="inp" value="${esc(b.subtitle)}" oninput="bannerSet(${i},'subtitle',this.value)"></div></div>
            <div class="row2" style="margin-top:8px"><div><label class="lbl">Texto do botão</label><input class="inp" value="${esc(b.cta)}" oninput="bannerSet(${i},'cta',this.value)"></div>
            <div><label class="lbl">Link</label><input class="inp" value="${esc(b.link)}" oninput="bannerSet(${i},'link',this.value)"></div></div>
            <div class="row2" style="margin-top:8px"><div><label class="lbl">Ícone (emoji)</label><input class="inp" value="${esc(b.icon || '')}" oninput="bannerSet(${i},'icon',this.value)"></div>
            <div><label class="lbl">Foto (URL)</label><input class="inp" value="${esc(b.img || '')}" placeholder="/img/products/....jpg" oninput="bannerSet(${i},'img',this.value)"></div></div>
            <div style="display:flex;gap:12px;margin-top:10px;align-items:center;flex-wrap:wrap">
              <label class="small">🎨 <input type="color" value="${b.grad[0]}" oninput="bannerGrad(${i},0,this.value)"> cor 1</label>
              <label class="small"><input type="color" value="${b.grad[1]}" oninput="bannerGrad(${i},1,this.value)"> cor 2</label>
              <label class="small"><input type="checkbox" ${b.active !== false ? 'checked' : ''} onchange="bannerSet(${i},'active',this.checked)"> ativo</label>
              <button class="btn sm danger" style="margin-left:auto" onclick="delBanner(${i})">🗑️ Excluir</button>
            </div>
          </div>
        </div>
      </div>`).join('')}</div>`;
}
function bannerSet(i, f, v) { BANNERS[i][f] = v; }
function bannerGrad(i, k, v) { BANNERS[i].grad[k] = v; }
function addBanner() { BANNERS.push({ id: 'b-' + Date.now(), title: 'Novo banner', subtitle: '', cta: 'Ver ofertas', link: '/produtos.html', grad: ['#0B1E3B', '#1E5AA8'], icon: '🖨️', img: '', active: true }); viewBanners(); }
function delBanner(i) { if (confirm('Excluir este banner?')) { BANNERS.splice(i, 1); viewBanners(); } }
async function saveBanners() { await api('/api/banners', { method: 'PUT', body: JSON.stringify({ banners: BANNERS }) }); toast('Banners salvos! 🖼️', 'ok'); }

/* ---------- RELATÓRIOS ---------- */
/* ---------- Avaliações ---------- */
async function viewReviews() {
  PRODUCTS = await api('/api/products');
  const all = [];
  PRODUCTS.forEach(p => (p.reviews || []).forEach(r => all.push({ p, r })));
  all.sort((x, y) => new Date(y.r.at) - new Date(x.r.at));
  $('#view').innerHTML = `
    <div class="main-hd"><div><h1>⭐ Avaliações</h1><p>${all.length} avaliação(ões) • lixeira = moderar</p></div></div>
    <div class="panel">${all.length ? `<div style="overflow:auto"><table class="tbl"><tr><th>Produto</th><th>Cliente</th><th>Estrelas</th><th>Comentário</th><th></th></tr>
    ${all.map(({ p, r }) => `<tr><td><b>${esc(p.name)}</b><br><span class="small mut">${fmtDate(r.at)}</span></td><td>${esc(r.userName)}${r.verified ? '<br><span class="badge ok">verificada</span>' : ''}</td><td>${'★'.repeat(r.stars)}${'☆'.repeat(5 - r.stars)}</td><td>${esc(r.text)}</td><td><button class="btn sm danger" onclick="delReview('${p.id}','${r.id}')">🗑️</button></td></tr>`).join('')}</table></div>`
    : '<div class="empty"><div class="e">⭐</div><p>Nenhuma avaliação ainda.</p></div>'}</div>`;
}
async function delReview(pid, rid) {
  if (!confirm('Excluir esta avaliação?')) return;
  await api(`/api/products/${pid}/reviews/${rid}`, { method: 'DELETE' });
  toast('Avaliação excluída', 'ok'); viewReviews();
}
let REP_DAYS = 30;
async function viewReports() {
  if (!PRODUCTS.length) { try { PRODUCTS = await api('/api/products'); } catch { } }
  const cutoff = REP_DAYS ? Date.now() - REP_DAYS * 864e5 : 0;
  const valid = ORDERS.filter(o => o.status !== 'cancelado' && (!cutoff || new Date(o.createdAt).getTime() >= cutoff));
  const pmap = {}; PRODUCTS.forEach(p => pmap[p.id] = p.costPct ?? 45);
  let repRev = 0, repProfit = 0;
  const tmap = {};
  valid.forEach(o => {
    const dr = o.subtotal ? (o.discount || 0) / o.subtotal : 0;
    (o.items || []).forEach(i => {
      const net = i.total * (1 - dr); repRev += net;
      const pf = net * (1 - (pmap[i.productId] ?? 45) / 100); repProfit += pf;
      const t = tmap[i.productId] = tmap[i.productId] || { name: i.name, qty: 0, rev: 0, profit: 0 };
      t.qty += i.qty; t.rev += net; t.profit += pf;
    });
  });
  const topProd = Object.values(tmap).sort((x, y) => y.profit - x.profit).slice(0, 10);
  const repMargin = repRev ? Math.round(repProfit / repRev * 100) : 0;
  const byPay = {};
  valid.forEach(o => byPay[o.payment.method] = (byPay[o.payment.method] || 0) + o.total);
  $('#view').innerHTML = `<div class="main-hd"><div><h1>📈 Relatórios</h1><p>Desempenho • período: ${[7, 30, 90].map(d => `<button class="btn sm ${REP_DAYS === d ? 'navy' : 'ghost'}" onclick="REP_DAYS=${d};viewReports()">${d}d</button>`).join(' ')} <button class="btn sm ${!REP_DAYS ? 'navy' : 'ghost'}" onclick="REP_DAYS=0;viewReports()">tudo</button></p></div>
    <button class="btn navy" style="margin-left:auto" onclick="exportCSV()">⬇️ Exportar CSV</button></div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin-bottom:14px">
    <div class="panel" style="margin:0;text-align:center"><div style="font-size:26px">💰</div><div class="small mut">Faturamento</div><h2 style="margin:4px 0">${BRL(Math.round(repRev * 100) / 100)}</h2></div>
    <div class="panel" style="margin:0;text-align:center"><div style="font-size:26px">📊</div><div class="small mut">Lucro estimado</div><h2 style="margin:4px 0;color:var(--ok)">${BRL(Math.round(repProfit * 100) / 100)}</h2><small class="mut">margem ${repMargin}%</small></div>
    <div class="panel" style="margin:0;text-align:center"><div style="font-size:26px">🧾</div><div class="small mut">Ticket médio</div><h2 style="margin:4px 0">${valid.length ? BRL(repRev / valid.length) : '—'}</h2><small class="mut">${valid.length} pedidos</small></div>
    <div class="panel" style="margin:0;text-align:center"><div style="font-size:26px">🎁</div><div class="small mut">Pontos resgatados</div><h2 style="margin:4px 0">${valid.reduce((s, o) => s + (o.pointsUsed || 0), 0).toLocaleString('pt-BR')}</h2></div>
  </div>
<div class="grid2">
    <div class="panel"><h3>💳 Faturamento por pagamento</h3>
      ${Object.entries(byPay).map(([k, v]) => `<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--line)"><span>${k === 'pix' ? '⚡ Pix' : k === 'card' ? '💳 Cartão' : '🧾 Boleto'}</span><b>${BRL(v)}</b></div>`).join('') || '<p class="mut">—</p>'}</div>
    <div class="panel"><h3>📦 Pedidos por status</h3>
      ${Object.entries(STATS.byStatus).map(([k, v]) => `<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--line)"><span>${stTag(k)}</span><b>${v}</b></div>`).join('')}</div>
  </div>
  <div class="panel"><h3>🧾 Todos os pedidos</h3><div style="overflow:auto;max-height:400px"><table class="tbl"><tr><th>Código</th><th>Data</th><th>Cliente</th><th>Total</th><th>Status</th></tr>
  ${ORDERS.map(o => `<tr><td><b>${o.code}</b></td><td>${fmtDate(o.createdAt)}</td><td>${esc(o.customer?.name || '')}</td><td>${BRL(o.total)}</td><td>${stTag(o.status)}</td></tr>`).join('')}</table></div></div>
  <div class="panel"><h3>🏆 Lucro por produto (top 10)</h3><div style="overflow:auto"><table class="tbl"><tr><th>Produto</th><th>Qtd</th><th>Faturamento</th><th>Lucro est.</th></tr>${topProd.map(t => `<tr><td><b>${esc(t.name)}</b></td><td>${t.qty.toLocaleString('pt-BR')} un</td><td>${BRL(Math.round(t.rev * 100) / 100)}</td><td><b style="color:var(--ok)">${BRL(Math.round(t.profit * 100) / 100)}</b></td></tr>`).join('') || '<tr><td colspan="4" class="mut">—</td></tr>'}</table></div></div>`;
}
function exportCSV() {
  const rows = [['codigo', 'data', 'cliente', 'email', 'total', 'status', 'pagamento']];
  ORDERS.forEach(o => rows.push([o.code, o.createdAt.slice(0, 10), o.customer?.name || '', o.customer?.email || '', o.total.toFixed(2), o.status, o.payment.method]));
  const blob = new Blob([rows.map(r => r.map(c => `"${c}"`).join(';')).join('\n')], { type: 'text/csv' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'pedidos.csv'; a.click();
  toast('CSV exportado! 📥', 'ok');
}

/* ---------- BI Gerencial ---------- */
let BI_DAYS = 30;
function biDonut(segs) {
  const tot = segs.reduce((s, x) => s + x.v, 0) || 1;
  let a0 = -90; const R = 54, C = 2 * Math.PI * R;
  const arcs = segs.map(s => {
    const frac = s.v / tot;
    const pic = `<circle cx="70" cy="70" r="${R}" fill="none" stroke="${s.c}" stroke-width="22" stroke-dasharray="${(frac * C).toFixed(1)} ${(C - frac * C).toFixed(1)}" transform="rotate(${a0.toFixed(1)} 70 70)"/>`;
    a0 += frac * 360; return pic;
  }).join('');
  return `<div style="display:flex;gap:16px;align-items:center;flex-wrap:wrap"><svg width="140" height="140" viewBox="0 0 140 140">${arcs}<text x="70" y="68" text-anchor="middle" font-size="15" font-weight="800" fill="#0B1E3B">${BRL(Math.round(tot))}</text><text x="70" y="86" text-anchor="middle" font-size="10" fill="#64748B">total</text></svg><div>${segs.map(s => `<div style="font-size:13px;margin:5px 0"><span style="display:inline-block;width:12px;height:12px;border-radius:4px;background:${s.c};margin-right:6px"></span>${esc(s.label)} <b>${BRL(Math.round(s.v))}</b> <span class="mut">(${Math.round(s.v / tot * 100)}%)</span></div>`).join('')}</div></div>`;
}
function biArea(pts) {
  const W = 600, H = 165, P = 10;
  const max = Math.max(...pts.map(p => p.v), 1);
  const X = i => P + i * (W - 2 * P) / Math.max(pts.length - 1, 1);
  const Y = v => H - P - 14 - (v / max) * (H - 40);
  const line = pts.map((p, i) => `${X(i).toFixed(1)},${Y(p.v).toFixed(1)}`).join(' ');
  const gid = 'bi' + Math.floor(Math.random() * 1e6);
  return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;display:block"><defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FF4D00" stop-opacity=".45"/><stop offset="1" stop-color="#FF4D00" stop-opacity=".03"/></linearGradient></defs><polygon points="${P},${H - P - 14} ${line} ${W - P},${H - P - 14}" fill="url(#${gid})"/><polyline points="${line}" fill="none" stroke="#FF4D00" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>${pts.map((p, i) => i % 5 === 0 || i === pts.length - 1 ? `<text x="${X(i)}" y="${H - 2}" font-size="10" fill="#64748B" text-anchor="middle">${p.label}</text>` : '').join('')}</svg>`;
}
function biDelta(cur, prev) {
  if (!prev) return '<small class="mut">—</small>';
  const d = Math.round((cur - prev) / prev * 100);
  if (d === 0) return '<small class="mut">= estável</small>';
  return d > 0 ? `<small style="color:var(--ok)">▲ +${d}%</small>` : `<small style="color:var(--danger)">▼ ${d}%</small>`;
}
async function viewBI() {
  if (!PRODUCTS.length) { try { PRODUCTS = await api('/api/products'); } catch { } }
  const span = BI_DAYS ? BI_DAYS * 864e5 : 0;
  const cutoff = span ? Date.now() - span : 0;
  const inPer = o => !cutoff || new Date(o.createdAt).getTime() >= cutoff;
  const valid = ORDERS.filter(o => o.status !== 'cancelado' && inPer(o));
  const prev = span ? ORDERS.filter(o => o.status !== 'cancelado' && new Date(o.createdAt).getTime() >= cutoff - span && new Date(o.createdAt).getTime() < cutoff) : [];
  const rev = valid.reduce((s, o) => s + o.total, 0);
  const prevRev = prev.reduce((s, o) => s + o.total, 0);
  const open = ORDERS.filter(o => !['entregue', 'cancelado'].includes(o.status));
  const sent = ORDERS.filter(o => (o.timeline || []).some(t => t.status === 'enviado'));
  const avgShip = sent.length ? sent.reduce((s, o) => { const ev = o.timeline.find(t => t.status === 'enviado'); return s + (new Date(ev.at) - new Date(o.createdAt)) / 864e5; }, 0) / sent.length : 0;
  const allRev = []; PRODUCTS.forEach(p => (p.reviews || []).forEach(r => allRev.push(r.stars)));
  const sat = allRev.length ? allRev.reduce((a, b) => a + b, 0) / allRev.length : 0;
  const entry = ORDERS.filter(o => o.status !== 'cancelado').length || 1;
  const funnel = [...FLOW, 'cancelado'].map(st => { const l = ORDERS.filter(o => o.status === st); return { st, n: l.length, v: l.reduce((s, o) => s + o.total, 0) }; });
  const fmax = Math.max(...funnel.map(f => f.n), 1);
  const dAgo = d => Date.now() - d * 864e5;
  const artStuck = ORDERS.filter(o => o.status === 'aguardando_arte' && new Date(o.createdAt).getTime() < dAgo(3));
  const noTrack = ORDERS.filter(o => o.status === 'enviado' && !o.tracking);
  const payPend = ORDERS.filter(o => o.payment?.status !== 'paid' && o.status !== 'cancelado');
  const payPendV = payPend.reduce((s, o) => s + o.total, 0);
  const rejArt = ORDERS.filter(o => o.art?.status === 'rejected');
  const byPay = {};
  valid.forEach(o => byPay[o.payment?.method || 'pix'] = (byPay[o.payment?.method || 'pix'] || 0) + o.total);
  const payColors = { pix: '#16A34A', card: '#2563EB', boleto: '#D97706' };
  const payNames = { pix: 'Pix', card: 'Cartão', boleto: 'Boleto' };
  const days = [];
  for (let i = 29; i >= 0; i--) { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - i); days.push({ t: d.getTime(), label: d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }), v: 0 }); }
  ORDERS.filter(o => o.status !== 'cancelado').forEach(o => { const t = new Date(o.createdAt); t.setHours(0, 0, 0, 0); const dd = days.find(x => x.t === t.getTime()); if (dd) dd.v += o.total; });
  const cmap = {};
  valid.forEach(o => { const k = o.customer?.name || '—'; const c = cmap[k] = cmap[k] || { name: k, n: 0, v: 0 }; c.n++; c.v += o.total; });
  const topCli = Object.values(cmap).sort((a, b) => b.v - a.v).slice(0, 5);
  const goal = CONFIG.monthlyGoal || 30000;
  const mStart = new Date(); mStart.setDate(1); mStart.setHours(0, 0, 0, 0);
  const mRev = ORDERS.filter(o => o.status !== 'cancelado' && new Date(o.createdAt) >= mStart).reduce((s, o) => s + o.total, 0);
  const gPct = Math.min(100, Math.round(mRev / goal * 100));
  const alertRow = (icon, txt, list) => `<div style="display:flex;justify-content:space-between;gap:8px;padding:9px 0;border-bottom:1px solid var(--line);flex-wrap:wrap"><span>${icon} ${txt}</span><b>${list.length ? list.map(o => o.code).slice(0, 4).join(', ') + (list.length > 4 ? ` +${list.length - 4}` : '') : '<span style="color:var(--ok)">tudo certo ✅</span>'}</b></div>`;
  const kpi = (icon, label, val, sub) => `<div class="panel" style="margin:0;text-align:center"><div style="font-size:24px">${icon}</div><div class="small mut">${label}</div><h2 style="margin:4px 0">${val}</h2>${sub || ''}</div>`;
  $('#view').innerHTML = `
    <div class="main-hd"><div><h1>📊 BI Gerencial</h1><p>Período: ${[7, 30, 90].map(d => `<button class="btn sm ${BI_DAYS === d ? 'navy' : 'ghost'}" onclick="BI_DAYS=${d};viewBI()">${d}d</button>`).join(' ')} <button class="btn sm ${!BI_DAYS ? 'navy' : 'ghost'}" onclick="BI_DAYS=0;viewBI()">tudo</button> <span class="small mut">• atualizado às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span></p></div>
    <button class="btn navy" style="margin-left:auto" onclick="window.print()">🖨️ Imprimir</button></div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-bottom:14px">
      ${kpi('💰', 'Faturamento', BRL(Math.round(rev * 100) / 100), `<small class="mut">${valid.length} pedidos</small><br>${biDelta(rev, prevRev)}`)}
      ${kpi('🏭', 'Pedidos ativos', open.length, `<small class="mut">em andamento</small><br>${biDelta(valid.length, prev.length)}`)}
      ${kpi('🧾', 'Ticket médio', valid.length ? BRL(rev / valid.length) : '—', '')}
      ${kpi('🚚', 'Tempo até envio', sent.length ? avgShip.toFixed(1) + ' dias' : '—', '')}
      ${kpi('⭐', 'Satisfação', allRev.length ? sat.toFixed(1) : '—', `<small class="mut">${allRev.length} avaliações</small>`)}
      ${kpi('💳', 'A receber', BRL(Math.round(payPendV * 100) / 100), `<small class="mut">${payPend.length} pedido(s)</small>`)}
    </div>
    <div class="grid2">
      <div class="panel"><h3>🔄 Funil de processos</h3>
        ${funnel.map(f => `<div style="margin:7px 0"><div style="display:flex;justify-content:space-between;font-size:13px;flex-wrap:wrap;gap:6px"><span>${stTag(f.st)} <span class="mut">${Math.round(f.n / entry * 100)}%</span></span><b>${f.n} • ${BRL(Math.round(f.v * 100) / 100)}</b></div><div style="height:8px;background:var(--bg);border-radius:99px;margin-top:3px"><div style="height:100%;width:${Math.round(f.n / fmax * 100)}%;background:${f.st === 'cancelado' ? 'var(--danger)' : 'linear-gradient(90deg,var(--primary),var(--navy))'};border-radius:99px"></div></div></div>`).join('')}
      </div>
      <div class="panel"><h3>💳 Faturamento por pagamento</h3>${biDonut(Object.entries(byPay).map(([k, v]) => ({ v, c: payColors[k] || '#64748B', label: payNames[k] || k })))}</div>
    </div>
    <div class="grid2" style="margin-top:16px">
      <div class="panel"><h3>📈 Receita — 30 dias</h3>${biArea(days)}</div>
      <div class="panel"><h3>🚨 Alertas de gestão</h3>
        ${alertRow('🎨', `Aguard. arte há +3 dias (${artStuck.length})`, artStuck)}
        ${alertRow('📦', `Enviado sem rastreio (${noTrack.length})`, noTrack)}
        ${alertRow('💳', `Pagamento pendente (${payPend.length})`, payPend)}
        ${alertRow('❌', `Arte reprovada (${rejArt.length})`, rejArt)}
      </div>
    </div>
    <div class="grid2" style="margin-top:16px">
      <div class="panel"><h3>🎯 Meta do mês — ${BRL(goal)}</h3>
        <div style="height:22px;background:var(--bg);border-radius:99px;overflow:hidden"><div style="height:100%;width:${gPct}%;background:linear-gradient(90deg,#16A34A,#4ADE80);border-radius:99px;transition:.5s"></div></div>
        <p style="margin:8px 0 0"><b>${gPct}%</b> • ${BRL(Math.round(mRev * 100) / 100)} de ${BRL(goal)} ${mRev >= goal ? '🏆 <b>Meta batida!</b>' : `• faltam <b>${BRL(Math.round((goal - mRev) * 100) / 100)}</b>`}</p>
        <p class="small mut">Ajuste a meta em <a class="link-more" href="#/config">⚙️ Configurações</a></p>
      </div>
      <div class="panel"><h3>👑 Top clientes</h3>${topCli.length ? `<div style="overflow:auto"><table class="tbl"><tr><th>Cliente</th><th>Pedidos</th><th>Total</th></tr>${topCli.map(t => `<tr><td><b>${esc(t.name)}</b></td><td>${t.n}</td><td><b>${BRL(Math.round(t.v * 100) / 100)}</b></td></tr>`).join('')}</table></div>` : '<p class="mut">—</p>'}</div>
    </div>`;
}

/* ---------- Gabaritos ---------- */
let TPLS = [];
async function viewTemplates() {
  TPLS = await api('/api/templates');
  $('#view').innerHTML = `
    <div class="main-hd"><div><h1>📐 Gabaritos</h1><p>Arquivos para download na página de gabaritos • sem link = botão WhatsApp</p></div>
      <div style="margin-left:auto;display:flex;gap:8px"><button class="btn ghost" onclick="addTpl()">＋ Novo</button><button class="btn" onclick="saveTpls()">💾 Salvar tudo</button></div></div>
    <div style="display:flex;flex-direction:column;gap:12px">${TPLS.map((t, i) => `
      <div class="panel" style="margin:0">
        <div class="row2"><div><label class="lbl">Produto</label><input class="inp" value="${esc(t.product)}" oninput="tplSet(${i},'product',this.value)"></div>
        <div><label class="lbl">Formato</label><input class="inp" value="${esc(t.format)}" oninput="tplSet(${i},'format',this.value)" placeholder="Ex: 9x5cm + sangria"></div></div>
        <div style="margin-top:8px"><label class="lbl">Descrição (opcional)</label><input class="inp" value="${esc(t.desc || '')}" oninput="tplSet(${i},'desc',this.value)"></div>
        <div style="margin-top:8px"><label class="lbl">Link do arquivo (ou suba abaixo)</label><input class="inp mono" value="${esc(t.file || '')}" oninput="tplSet(${i},'file',this.value)" placeholder="https://... ou /uploads/arquivo.pdf"></div>
        <div style="display:flex;gap:8px;margin-top:10px;align-items:center;flex-wrap:wrap">
          <input type="file" id="tfile-${i}" hidden onchange="tplUpload(${i},this)">
          <button class="btn sm navy" onclick="document.querySelector('#tfile-${i}').click()">📤 Subir arquivo</button>
          ${t.file ? `<a class="btn sm ghost" href="${t.file}" target="_blank">Testar link</a>` : '<span class="small mut">sem arquivo: mostra WhatsApp</span>'}
          <button class="btn sm danger" style="margin-left:auto" onclick="delTpl(${i})">Excluir</button>
        </div>
      </div>`).join('') || '<div class="panel"><p class="mut">Nenhum gabarito. Clique em Novo.</p></div>'}</div>`;
}
function tplSet(i, f, v) { TPLS[i][f] = v; }
function addTpl() { TPLS.push({ product: '', format: '', file: '', desc: '' }); viewTemplates(); }
function delTpl(i) { if (confirm('Excluir este gabarito?')) { TPLS.splice(i, 1); viewTemplates(); } }
async function tplUpload(i, input) {
  const f = input.files[0]; if (!f) return;
  toast('Subindo arquivo...');
  try { const up = await uploadFile(f); TPLS[i].file = up.url; toast('Arquivo pronto! Agora salve tudo', 'ok'); viewTemplates(); }
  catch (e) { toast(e.message, 'err'); }
}
async function saveTpls() {
  if (TPLS.some(t => !t.product.trim())) { toast('Todo gabarito precisa do nome do produto', 'err'); return; }
  await api('/api/templates', { method: 'PUT', body: JSON.stringify({ templates: TPLS }) });
  toast('Gabaritos salvos!', 'ok');
}

/* ---------- MENSAGENS ---------- */
/* ---------- Mensagens ---------- */
let MSGS = [];
async function viewMessages() {
  MSGS = await api('/api/admin/messages');
  MSGS.sort((a, b) => new Date(b.at) - new Date(a.at));
  const badge = m => m.replied ? '<span class="badge ok">respondida</span>' : m.read ? '<span class="badge">lida</span>' : '<span class="badge sale">nova</span>';
  $('#view').innerHTML = `
    <div class="main-hd"><div><h1>Mensagens</h1><p>Fale conosco do site • clique para ler e responder</p></div></div>
    <div class="panel">${MSGS.length ? MSGS.map(m => `
      <div onclick="openMsg('${m.id}')" style="border-bottom:1px solid var(--line);padding:12px 6px;cursor:pointer;${m.read ? 'opacity:.7' : ''}">
        <b>${esc(m.name)}</b> <span class="small mut">${esc(m.email)}${m.whatsapp ? ' • ' + esc(m.whatsapp) : ''} • ${fmtDT(m.at)}</span> ${badge(m)}<br>
        <b class="small">${esc(m.subject || '(sem assunto)')}</b><br>
        <span class="small mut">${esc(m.message.slice(0, 120))}${m.message.length > 120 ? '...' : ''}</span>
      </div>`).join('') : `<div class="empty"><div class="e">📭</div><p>Nenhuma mensagem.</p></div>`}</div>`;
}
async function readMsg(id) { await api(`/api/admin/messages/${id}`, { method: 'PUT', body: JSON.stringify({ read: true }) }); viewMessages(); }
function msgWa(m) {
  let d = String(m.whatsapp || '').replace(/[^0-9]/g, '');
  if (d.length >= 10 && d.length <= 11) d = '55' + d;
  return d.length >= 12 ? d : '';
}
function openMsg(id) {
  const m = MSGS.find(x => x.id === id);
  if (!m) return;
  const wa = msgWa(m);
  openModal(`<div class="mh"><h3 style="margin:0">Mensagem</h3><button class="btn sm ghost" onclick="closeModal()">✕</button></div>
  <div class="mb">
    <p><b>${esc(m.name)}</b><br><span class="small mut">${esc(m.email)}${m.whatsapp ? ' • ' + esc(m.whatsapp) : ''} • ${fmtDT(m.at)}</span></p>
    <p><b>${esc(m.subject || '(sem assunto)')}</b></p>
    <div style="background:var(--bg);border-radius:10px;padding:12px;margin-bottom:12px;white-space:pre-wrap">${esc(m.message)}</div>
    ${m.replied && m.reply ? `<p class="small"><b>Sua última resposta:</b></p><div style="background:#F0FDF4;border-radius:10px;padding:12px;margin-bottom:12px;white-space:pre-wrap">${esc(m.reply)}</div>` : ''}
    <label class="lbl">Sua resposta</label>
    <textarea class="inp" id="msg-reply" rows="4" placeholder="Olá! Obrigado pelo contato...">${esc(m.reply || '')}</textarea>
    <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap">
      <button class="btn sm navy" onclick="saveReply('${m.id}')">Salvar resposta</button>
      ${wa ? `<button class="btn sm" style="background:#25D366;color:#fff;border:0" onclick="sendWaReply('${m.id}')">Enviar no WhatsApp</button>` : '<span class="small mut">cliente sem WhatsApp</span>'}
      <button class="btn sm ghost" onclick="mailReply('${m.id}')">Por e-mail</button>
      <button class="btn sm ghost" onclick="copyReply()">Copiar</button>
    </div>
  </div>`);
  if (!m.read) api(`/api/admin/messages/${m.id}`, { method: 'PUT', body: JSON.stringify({ read: true }) }).then(() => { m.read = true; });
}
async function saveReply(id) {
  const txt = document.querySelector('#msg-reply').value.trim();
  if (!txt) { toast('Escreva a resposta', 'err'); return; }
  await api(`/api/admin/messages/${id}`, { method: 'PUT', body: JSON.stringify({ reply: txt, replied: true, read: true }) });
  closeModal(); toast('Resposta salva!', 'ok'); viewMessages();
}
async function sendWaReply(id) {
  const m = MSGS.find(x => x.id === id);
  const txt = document.querySelector('#msg-reply').value.trim();
  if (!txt) { toast('Escreva a resposta primeiro', 'err'); return; }
  await api(`/api/admin/messages/${id}`, { method: 'PUT', body: JSON.stringify({ reply: txt, replied: true, read: true }) });
  window.open('https://wa.me/' + msgWa(m) + '?text=' + encodeURIComponent(txt), '_blank');
  closeModal(); viewMessages();
}
function mailReply(id) {
  const m = MSGS.find(x => x.id === id);
  const txt = document.querySelector('#msg-reply').value.trim();
  location.href = 'mailto:' + m.email + '?subject=' + encodeURIComponent('Re: ' + (m.subject || 'Contato PrimePrint')) + '&body=' + encodeURIComponent(txt);
}
function copyReply() {
  navigator.clipboard?.writeText(document.querySelector('#msg-reply').value);
  toast('Resposta copiada!', 'ok');
}

/* ---------- CONFIG ---------- */
/* ---------- Pagamentos ---------- */
async function viewPayments() {
  let mp = { mercadopago: false, hasToken: false };
  try { mp = await api('/api/pay/status'); } catch { }
  const c = CONFIG;
  const on = v => v !== false ? 'checked' : '';
  const sw = 'display:flex;gap:10px;align-items:center;padding:12px;border:1.5px solid var(--line);border-radius:10px;margin-bottom:8px;cursor:pointer;background:#fff';
  $('#view').innerHTML = `
    <div class="main-hd"><div><h1>💳 Pagamentos</h1><p>Quais formas aparecem no checkout ${mp.mercadopago ? '<span class="badge ok">MP ATIVO</span>' : ''}${mp.stone?.active ? ' <span class="badge ok">STONE ATIVA</span>' : ''}${mp.infinitepay?.active ? ' <span class="badge ok">INFINITEPAY ATIVA</span>' : ''}${!mp.mercadopago && !mp.stone?.active && !mp.infinitepay?.active ? ' <span class="small mut">• modo simulação</span>' : ''}</p></div></div>
    <form onsubmit="savePayments(event)">
    <div class="panel"><h3>💰 Métodos no checkout</h3>
      <label style="${sw}"><input type="checkbox" name="payPix" ${on(c.payPix)} style="width:20px;height:20px"> <b>⚡ Pix</b> <span class="mut small">aprovação imediata + desconto %</span></label>
      <label style="${sw}"><input type="checkbox" name="payCard" ${on(c.payCard)} style="width:20px;height:20px"> <b>💳 Cartão de crédito</b> <span class="mut small">parcelado sem juros</span></label>
      <label style="${sw}"><input type="checkbox" name="payBoleto" ${on(c.payBoleto)} style="width:20px;height:20px"> <b>🧾 Boleto</b> <span class="mut small">compensa em 1-2 dias</span></label>
      <label style="${sw}"><input type="checkbox" name="payInfinite" ${on(c.payInfinite)} style="width:20px;height:20px"> <b>♾️ InfinitePay</b> <span class="mut small">Pix ou cartão no checkout seguro</span></label>
    </div>
    <div class="grid2">
      <div class="panel"><h3>⚡ Pix manual</h3>
        <label class="lbl">Chave Pix</label><input class="inp" name="pixKey" value="${esc(c.pixKey || '')}" placeholder="e-mail, CPF, telefone ou aleatória">
        <div style="margin-top:8px"><label class="lbl">Nome do recebedor</label><input class="inp" name="pixName" value="${esc(c.pixName || '')}" placeholder="Como aparece no comprovante"></div>
        <div style="margin-top:8px;max-width:200px"><label class="lbl">Desconto no Pix (%)</label><input class="inp" name="pixDiscount" type="number" step="0.5" value="${c.pixDiscount ?? 5}"></div>
      </div>
      <div class="panel"><h3>💳 Cartão e parcelas</h3>
        <div style="max-width:200px"><label class="lbl">Parcelas sem juros (máx)</label><input class="inp" name="installmentMax" type="number" value="${c.installmentMax ?? 6}"></div>
        <p class="small mut" style="margin-top:8px">Na simulação o cartão é "aprovado" na hora. Com Mercado Pago ativo, o cliente paga no ambiente seguro do MP.</p>
      </div>
    </div>
    <div class="panel"><h3>🔷 Mercado Pago <span class="small mut">(recebimento real)</span></h3>
      <label style="font-weight:700"><input type="checkbox" name="mpEnabled" ${c.mpEnabled ? 'checked' : ''} style="width:18px;height:18px;vertical-align:-3px"> Ativar Mercado Pago</label>
      <div style="margin-top:8px;max-width:520px"><label class="lbl">Access Token (produção ou teste)</label><input class="inp mono" name="mpToken" type="password" value="" placeholder="${mp.hasToken ? '•••••• token salvo (digite para trocar)' : 'APP_USR-...'}"></div>
      <p class="small mut">Pegue em <b>mercadopago.com.br → Suas integrações → Credenciais</b>. Comece com o token de TESTE. Status: ${mp.mercadopago ? '<b style="color:var(--ok)">conectado ✅</b>' : '<b>desconectado</b> (checkout em simulação)'}.</p>
    </div>
    <div class="panel"><h3>🟢 Stone <span class="small mut">(recebimento real)</span></h3>
      <label style="font-weight:700"><input type="checkbox" name="stoneEnabled" ${c.stoneEnabled ? 'checked' : ''} style="width:18px;height:18px;vertical-align:-3px"> Ativar Stone</label>
      <div style="margin-top:8px;max-width:520px"><label class="lbl">Secret Key (Pagar.me)</label><input class="inp mono" name="stoneToken" type="password" value="" placeholder="${mp.stone?.hasToken ? '•••••• salva (digite para trocar)' : 'sk_test_... ou sk_live_...'}"></div>
      <p class="small mut">No painel <b>Pagar.me → Configurações → Chaves de API</b>, copie a <b>Secret Key</b>. Comece pela de TESTE (sk_test_...). Com ela ativa, o cartão é cobrado de verdade no checkout. Status: ${mp.stone?.active ? '<b style="color:var(--ok)">conectado ✅</b>' : '<b>desconectado</b> (cartão em simulação)'}.</p>
    </div>
    <div class="panel"><h3>♾️ InfinitePay <span class="small mut">(recebimento real)</span></h3>
      <label style="font-weight:700"><input type="checkbox" name="infpayEnabled" ${c.infpayEnabled ? 'checked' : ''} style="width:18px;height:18px;vertical-align:-3px"> Ativar InfinitePay</label>
      <div style="margin-top:8px;max-width:640px"><div class="grid2"><div><label class="lbl">Sua InfiniteTag (sem o $)</label><input class="inp mono" name="infpayHandle" value="${esc(c.infpayHandle || '')}" placeholder="Ex: primeprint"></div><div><label class="lbl">URL pública da loja</label><input class="inp mono" name="publicUrl" value="${esc(c.publicUrl || '')}" placeholder="https://sualoja.com.br"></div></div></div>
      <p class="small mut">1️⃣ No app InfinitePay: <b>Vendas → Checkout → Configurações → Habilitar Checkout Integrado</b> (ative Pix e cartão). 2️⃣ Cole sua InfiniteTag aqui (fica no canto superior do app, sem o $). 3️⃣ Preencha a URL da loja p/ confirmação automática. Status: ${mp.infinitepay?.active ? '<b style="color:var(--ok)">conectado ✅</b>' : '<b>desconectado</b>'}.</p>
    </div>
    <button class="btn big">Salvar pagamentos ✅</button></form>`;
}
async function savePayments(e) {
  e.preventDefault(); const f = e.target;
  const body = { payPix: f.payPix.checked, payCard: f.payCard.checked, payBoleto: f.payBoleto.checked, payInfinite: f.payInfinite.checked, pixKey: f.pixKey.value.trim(), pixName: f.pixName.value.trim(), pixDiscount: Number(f.pixDiscount.value) || 0, installmentMax: Number(f.installmentMax.value) || 1, mpEnabled: f.mpEnabled.checked, stoneEnabled: f.stoneEnabled.checked, infpayEnabled: f.infpayEnabled.checked, infpayHandle: f.infpayHandle.value.replace(/^\$/, '').trim(), publicUrl: f.publicUrl.value.trim().replace(/\/$/, '') };
  if (f.mpToken.value.trim()) body.mpToken = f.mpToken.value.trim();
  if (f.stoneToken.value.trim()) body.stoneToken = f.stoneToken.value.trim();
  if (!body.payPix && !body.payCard && !body.payBoleto && !body.payInfinite) { toast('Ative ao menos 1 método!', 'err'); return; }
  CONFIG = await api('/api/config', { method: 'PUT', body: JSON.stringify(body) });
  toast('Pagamentos salvos! 💳', 'ok'); viewPayments();
}

async function viewConfig() {
  const c = CONFIG;
  let me = { meActive: false, hasToken: false };
  try { me = await api('/api/admin/shipping'); } catch { }
  $('#view').innerHTML = `<div class="main-hd"><div><h1>⚙️ Configurações</h1><p>Dados da loja e frete • pagamento em <a class="link-more" href="#/pagamentos">💳 Pagamentos</a></p></div></div>
  <div class="panel"><form onsubmit="saveConfig(event)" style="max-width:640px">
    <div class="row2"><div><label class="lbl">Nome da loja</label><input class="inp" name="storeName" value="${esc(c.storeName)}"></div><div><label class="lbl">Telefone</label><input class="inp" name="phone" value="${esc(c.phone)}"></div></div>
    <div class="row2" style="margin-top:8px"><div><label class="lbl">E-mail</label><input class="inp" name="email" value="${esc(c.email)}"></div><div><label class="lbl">WhatsApp (só números)</label><input class="inp" name="whatsapp" value="${esc(c.whatsapp)}"></div></div>
    <div style="margin-top:8px"><label class="lbl">Horário de atendimento</label><input class="inp" name="hours" value="${esc(c.hours)}"></div>
    <div class="row2" style="margin-top:8px"><div><label class="lbl">Frete PAC (R$)</label><input class="inp" name="shipPAC" type="number" step="0.01" value="${c.shipPAC}"></div><div><label class="lbl">Frete SEDEX (R$)</label><input class="inp" name="shipSEDEX" type="number" step="0.01" value="${c.shipSEDEX}"></div></div>
    <div style="margin-top:8px;max-width:300px"><label class="lbl">Frete grátis acima de (R$)</label><input class="inp" name="freeShipFrom" type="number" step="0.01" value="${c.freeShipFrom}"></div><div style="margin-top:8px;max-width:300px"><label class="lbl">🎯 Meta mensal (R$) — p/ BI</label><input class="inp" name="monthlyGoal" type="number" step="0.01" value="${c.monthlyGoal ?? 30000}"></div>
    
    <h3 style="margin-top:16px">📮 Frete real (Melhor Envio)</h3>
    <p class="small mut">Status: ${me.meActive ? '<b style="color:var(--ok)">cotação ao vivo ✅</b>' : '<b>tabela manual</b>'} • <a class="link-more" href="https://www.melhorenvio.com.br" target="_blank">criar conta grátis →</a></p>
    <div class="row2"><div><label class="lbl">CEP de origem</label><input class="inp" name="shipOriginZip" value="${esc(c.shipOriginZip || '')}" placeholder="00000-000"></div><div><label class="lbl">Peso padrão (kg)</label><input class="inp" name="pkgWeight" type="number" step="0.1" value="${c.pkgWeight ?? 1}"></div></div>
    <div class="row2" style="margin-top:8px"><div><label class="lbl">Largura (cm)</label><input class="inp" name="pkgWidth" type="number" value="${c.pkgWidth ?? 20}"></div><div><label class="lbl">Altura (cm)</label><input class="inp" name="pkgHeight" type="number" value="${c.pkgHeight ?? 10}"></div></div>
    <div class="row2" style="margin-top:8px"><div><label class="lbl">Comprimento (cm)</label><input class="inp" name="pkgLength" type="number" value="${c.pkgLength ?? 30}"></div><div><label class="lbl">Token Melhor Envio</label><input class="inp mono" name="meToken" type="password" value="" placeholder="${me.hasToken ? '•••••• salvo (digite para trocar)' : 'Cole o token'}"></div></div>
    <div style="margin-top:8px"><label style="font-weight:700"><input type="checkbox" name="meEnabled" ${c.meEnabled ? 'checked' : ''} style="width:18px;height:18px;vertical-align:-3px"> Ativar cotação ao vivo</label></div>
    <button class="btn" style="margin-top:12px">Salvar configurações ✅</button></form></div>`;
}
async function saveConfig(e) {
  e.preventDefault(); const f = e.target;
  CONFIG = await api('/api/config', { method: 'PUT', body: JSON.stringify({ storeName: f.storeName.value, phone: f.phone.value, email: f.email.value, whatsapp: f.whatsapp.value, hours: f.hours.value, shipPAC: Number(f.shipPAC.value), shipSEDEX: Number(f.shipSEDEX.value), freeShipFrom: Number(f.freeShipFrom.value), shipOriginZip: f.shipOriginZip.value.trim(), pkgWeight: Number(f.pkgWeight.value) || 1, pkgWidth: Number(f.pkgWidth.value) || 20, pkgHeight: Number(f.pkgHeight.value) || 10, pkgLength: Number(f.pkgLength.value) || 30, meEnabled: f.meEnabled.checked, monthlyGoal: Number(f.monthlyGoal.value) || 0 }) });
  if (f.meToken.value.trim()) CONFIG = await api('/api/config', { method: 'PUT', body: JSON.stringify({ meToken: f.meToken.value.trim() }) });
  toast('Configurações salvas! ⚙️', 'ok');
}
