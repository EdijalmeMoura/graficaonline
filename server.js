/* ============================================================
   PrimePrint — Backend (API REST + arquivos estáticos)
   Banco: arquivo JSON em ./data/db.json (camada centralizada,
   fácil migrar para Postgres/MySQL depois).
   ============================================================ */
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const SECRET = process.env.JWT_SECRET || 'primeprint-dev-secret-change-me';

const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const UPLOAD_DIR = path.join(ROOT, 'uploads');
const PUBLIC_DIR = path.join(ROOT, 'public');

[DATA_DIR, UPLOAD_DIR].forEach(d => { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); });

app.use(cors());
app.use(express.json({ limit: '2mb' }));

/* ---------------- Upload de artes ---------------- */
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const safe = Date.now() + '-' + Math.round(Math.random() * 1e6) + path.extname(file.originalname || '');
    cb(null, safe);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 60 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = /\.(pdf|jpg|jpeg|png|webp|gif|svg|ai|psd|cdr|zip|rar|tif|tiff|eps)$/i.test(file.originalname || '');
    cb(ok ? null : new Error('Tipo de arquivo não permitido'), ok);
  }
});

/* ============================================================
   CAMADA DE DADOS
   ============================================================ */
let db = null;
function loadDB() {
  if (db) return db;
  if (fs.existsSync(DB_FILE)) {
    db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  } else {
    db = seed();
    saveDB();
  }
  return db;
}
function saveDB() { fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2)); }
const uid = (p = '') => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

/* ---------------- SEED ---------------- */
function seed() {
  const COLORS = [
    { id: '4x4', label: '4x4 (frente e verso colorido)', mod: 0 },
    { id: '4x0', label: '4x0 (só frente colorida)', mod: -0.12 },
    { id: '4x1', label: '4x1 (frente colorida, verso PB)', mod: -0.06 },
  ];
  const FINISH = [
    { id: 'sem', label: 'Sem acabamento', add: 0 },
    { id: 'lam-fosco', label: 'Laminação fosca', add: 29 },
    { id: 'lam-brilho', label: 'Laminação brilho', add: 29 },
    { id: 'verniz', label: 'Verniz localizado', add: 59 },
    { id: 'corte-especial', label: 'Corte especial', add: 49 },
  ];
  const DEADLINES = [
    { id: 'normal', label: 'Produção normal', days: 'até 5 dias úteis', mult: 1 },
    { id: 'express', label: 'Expressa', days: 'até 2 dias úteis', mult: 1.35 },
  ];
  const COUCHET = [
    { id: 'couche-90', label: 'Couché 90g', mod: 0 },
    { id: 'couche-115', label: 'Couché 115g', mod: 0.08 },
    { id: 'couche-150', label: 'Couché 150g', mod: 0.15 },
    { id: 'couche-250', label: 'Couché 250g', mod: 0.28 },
    { id: 'reciclato-240', label: 'Reciclato 240g', mod: 0.22 },
  ];
  const CARTAO_PAPER = [
    { id: 'supremo-250', label: 'Supremo 250g', mod: 0 },
    { id: 'couche-300', label: 'Couché 300g', mod: 0.1 },
    { id: 'reciclato-240', label: 'Reciclato 240g', mod: 0.15 },
  ];

  const categories = [
    { id: 'mais-vendidos', name: 'Mais Vendidos', icon: '🔥', desc: 'Os queridinhos da gráfica' },
    { id: 'cartoes', name: 'Cartões de Visita', icon: '💳', desc: 'Primeira impressão que fica' },
    { id: 'panfletos', name: 'Panfletos e Folders', icon: '📰', desc: 'Divulgação em alto volume' },
    { id: 'adesivos', name: 'Rótulos e Adesivos', icon: '🏷️', desc: 'Para produtos e delivery' },
    { id: 'banners', name: 'Banners e Faixas', icon: '🖼️', desc: 'Grande formato' },
    { id: 'papelaria', name: 'Papelaria', icon: '✉️', desc: 'Timbrados, envelopes e pastas' },
    { id: 'calendarios', name: 'Calendários', icon: '📅', desc: 'Mesa e parede' },
    { id: 'embalagens', name: 'Delivery e Embalagens', icon: '📦', desc: 'Caixas e sacolas' },
    { id: 'promocional', name: 'Promocional', icon: '🎁', desc: 'Ventarolas, tags e marcadores' },
    { id: 'eleicoes', name: 'Eleições 2026', icon: '🗳️', desc: 'Material de campanha' },
    { id: 'comunicacao', name: 'Comunicação Visual', icon: '🪧', desc: 'Perfurados, totens e mais' },
  ];

  const P = (id, name, category, icon, grad, tagline, desc, quantities, extra = {}) => ({
    id, name, category, icon, grad, tagline, desc, quantities,
    formats: [{ id: 'unico', label: extra.formatLabel || 'Formato padrão' }],
    papers: COUCHET, colors: COLORS, finishes: FINISH, deadlines: DEADLINES,
    rating: 4.6 + Math.random() * 0.4, sold: 500 + Math.floor(Math.random() * 15000),
    badge: null, active: true, createdAt: new Date().toISOString(),
    ...extra, quantities,
  });
  /* Conjuntos de opções espelhados na gráfica de referência */
  const OFFSET = [
    { id: 'offset-75', label: 'Offset 75g', mod: 0 },
    { id: 'offset-90', label: 'Offset 90g', mod: 0.2 },
    { id: 'offset-56', label: 'Offset 56g', mod: -0.05 },
  ];
  const LONA = [
    { id: 'lona-380', label: 'Lona Front 380g', mod: 0 },
    { id: 'lona-280', label: 'Lona Front 280g', mod: -0.08 },
  ];
  const C4X0 = [{ id: '4x0', label: '4x0 (só frente colorida)', mod: 0 }];
  const FIN_CARTAO = [
    { id: 'corte-reto', label: 'Corte reto (refile)', add: 0 },
    { id: 'lam-fosco', label: 'Laminação fosca', add: 15 },
    { id: 'lam-brilho', label: 'Laminação brilho', add: 15 },
    { id: 'verniz-total', label: 'Verniz total frente', add: 12 },
    { id: 'verniz', label: 'Verniz localizado', add: 19 },
    { id: 'cantos', label: 'Cantos arredondados', add: 25 },
  ];
  const FIN_SIMPLE = [
    { id: 'refile', label: 'Refile', add: 0 },
    { id: 'verniz-total', label: 'Verniz total', add: 15 },
    { id: 'lam-fosco', label: 'Laminação fosca', add: 25 },
    { id: 'lam-brilho', label: 'Laminação brilho', add: 25 },
  ];
  const FIN_LONA = [
    { id: 'madeirinhas', label: 'Madeirinhas e ponteiras', add: 0 },
    { id: 'ilhos', label: 'Ilhós', add: 3 },
    { id: 'bastao', label: 'Bastão e corda', add: 6 },
    { id: 'somente', label: 'Somente lona (sem acabamento)', add: -4 },
  ];
  const FIN_VINCO = [
    { id: 'corte-vinco', label: 'Corte e vinco', add: 0 },
    { id: 'vinco-verniz', label: 'Corte e vinco + verniz total', add: 19 },
    { id: 'vinco-lam', label: 'Corte e vinco + laminação fosca', add: 35 },
  ];

  const products = [
    P('cartao-visita', 'Cartão de Visita', 'cartoes', '💳', ['#0B1E3B', '#1E5AA8'],
      '9x5cm • couché 250g • 500un por R$ 58',
      'Cartão de visita 9x5cm em couché 250g ou 300g, com corte reto, laminação ou verniz localizado. O clássico da gráfica.',
      [{ qty: 250, price: 39 }, { qty: 500, price: 58 }, { qty: 1000, price: 89 }, { qty: 2500, price: 179 }, { qty: 5000, price: 329 }],
      { badge: 'Mais vendido', sold: 48210, rating: 4.9, papers: CARTAO_PAPER, finishes: FIN_CARTAO,
        colors: [{ id: '4x4', label: '4x4 (frente e verso)', mod: 0 }, { id: '4x1', label: '4x1 (verso PB)', mod: -0.08 }, { id: '4x0', label: '4x0 (só frente)', mod: -0.35 }],
        formats: [{ id: '9x5', label: '9x5cm (padrão)', mod: 0 }, { id: '8x5', label: '8x5cm (mini)', mod: -0.1 }] }),
    P('cartao-verniz', 'Cartão com Verniz Localizado', 'cartoes', '✨', ['#3B0B2E', '#A81E7A'],
      '9x5cm • couché 300g • laminação + verniz',
      'Cartão premium em couché 300g com laminação fosca frente e verso + verniz localizado. Sofisticação para marcas exigentes.',
      [{ qty: 250, price: 99 }, { qty: 500, price: 149 }, { qty: 1000, price: 229 }, { qty: 2500, price: 449 }],
      { badge: 'Premium', papers: CARTAO_PAPER, finishes: FIN_CARTAO,
        formats: [{ id: '9x5', label: '9x5cm (padrão)', mod: 0 }] }),
    P('panfleto-10x15', 'Panfletos', 'panfletos', '📰', ['#7A1E00', '#FF5A00'],
      '10x14cm • couché 90g • 1000un 4x0 por R$ 67',
      'Panfleto em couché brilho 90g, formatos 10x14cm ou 14x20cm, 4x0 ou 4x4 com refile. Ideal para distribuição em volume.',
      [{ qty: 500, price: 79 }, { qty: 1000, price: 110 }, { qty: 2500, price: 175 }, { qty: 5000, price: 269 }, { qty: 10000, price: 469 }, { qty: 25000, price: 999 }],
      { badge: 'Oferta', sold: 32100, finishes: FIN_SIMPLE,
        papers: [{ id: 'couche-90', label: 'Couché brilho 90g', mod: 0 }, { id: 'couche-115', label: 'Couché 115g', mod: 0.1 }, { id: 'couche-150', label: 'Couché 150g', mod: 0.2 }, { id: 'offset-75', label: 'Offset 75g', mod: -0.05 }],
        colors: [{ id: '4x4', label: '4x4 (frente e verso)', mod: 0 }, { id: '4x1', label: '4x1 (verso PB)', mod: -0.2 }, { id: '4x0', label: '4x0 (só frente)', mod: -0.39 }],
        formats: [{ id: '10x14', label: '10x14cm', mod: 0 }, { id: '14x20', label: '14x20cm', mod: 0.85 }] }),
    P('panfleto-a5', 'Panfleto A5 14x20', 'panfletos', '📄', ['#003B2E', '#00A86B'],
      '14x20cm • couché 90g • 1000un 4x4 por R$ 205',
      'Panfleto A5 14x20cm com área generosa para promoções e cardápios. Couché brilho com cores vivas.',
      [{ qty: 1000, price: 205 }, { qty: 2500, price: 329 }, { qty: 5000, price: 529 }, { qty: 10000, price: 949 }],
      { finishes: FIN_SIMPLE,
        colors: [{ id: '4x4', label: '4x4 (frente e verso)', mod: 0 }, { id: '4x0', label: '4x0 (só frente)', mod: -0.38 }],
        formats: [{ id: '14x20', label: '14x20cm', mod: 0 }] }),
    P('folder-a4', 'Folder A4 com 2 Dobras', 'panfletos', '📑', ['#1B2A6B', '#4D7CFE'],
      'A4 • couché 150g • dobra e vinco',
      'Folder institucional A4 com 2 dobras em couché 150g. Ideal para clínicas, escolas e empresas de serviços.',
      [{ qty: 500, price: 279 }, { qty: 1000, price: 429 }, { qty: 2500, price: 849 }, { qty: 5000, price: 1499 }],
      { formats: [{ id: 'a4', label: 'A4 com 2 dobras', mod: 0 }], finishes: FIN_VINCO }),
    P('adesivo-vinil', 'Adesivo Vinil', 'adesivos', '⭕', ['#5B0B0B', '#E63900'],
      'Vinil branco • recorte eletrônico • resistente',
      'Adesivo em vinil de alta aderência com recorte eletrônico, resistente a água e sol. Para vitrines, carros e embalagens.',
      [{ qty: 100, price: 59 }, { qty: 250, price: 109 }, { qty: 500, price: 179 }, { qty: 1000, price: 299 }],
      { formats: [{ id: '5x5', label: '5x5cm', mod: 0 }, { id: '7x7', label: '7x7cm', mod: 0.35 }, { id: '10x10', label: '10x10cm', mod: 0.7 }], colors: C4X0, finishes: [{ id: 'recorte', label: 'Recorte eletrônico', add: 0 }, { id: 'recorte-lam', label: 'Recorte + laminação', add: 25 }] }),
    P('rotulo-bopp', 'Rótulos BOPP', 'adesivos', '🏷️', ['#4A0B3B', '#C026D3'],
      'BOPP branco/transparente • à prova d\'água',
      'Rótulos em BOPP para cosméticos, alimentos e bebidas. Acabamento profissional à prova d\'água.',
      [{ qty: 500, price: 129 }, { qty: 1000, price: 199 }, { qty: 2500, price: 399 }, { qty: 5000, price: 729 }],
      { formats: [{ id: '4x4', label: '4x4cm', mod: 0 }, { id: '6x6', label: '6x6cm', mod: 0.4 }], badge: 'Para delivery', colors: C4X0 }),
    P('lacre-delivery', 'Lacre Adesivo p/ Delivery', 'adesivos', '🛵', ['#0B3B2E', '#00B3A6'],
      'Lacre de segurança • personalizado',
      'Lacre adesivo para delivery. Garante inviolabilidade e divulga sua marca a cada entrega.',
      [{ qty: 1000, price: 99 }, { qty: 2500, price: 179 }, { qty: 5000, price: 299 }, { qty: 10000, price: 549 }],
      { formats: [{ id: '4cm', label: '4cm redondo', mod: 0 }, { id: '5cm', label: '5cm redondo', mod: 0.25 }], colors: C4X0 }),
    P('banner-lona', 'Banner em Lona', 'banners', '🖼️', ['#2E0B3B', '#7C3AED'],
      'Lona front 380g • 70x120 por R$ 25',
      'Banner em lona front 380g 4x0 com madeirinhas e ponteiras, ilhós ou bastão. Impressão em alta resolução.',
      [{ qty: 1, price: 25 }, { qty: 2, price: 46 }, { qty: 5, price: 105 }, { qty: 10, price: 190 }],
      { papers: LONA, colors: C4X0, finishes: FIN_LONA,
        formats: [{ id: '40x60', label: '40x60cm', mod: -0.56 }, { id: '50x70', label: '50x70cm', mod: -0.52 }, { id: '70x120', label: '70x120cm', mod: 0 }, { id: '100x150', label: '100x150cm', mod: 0.9 }] }),
    P('faixa-lona', 'Faixa em Lona', 'banners', '🎏', ['#3B2E0B', '#D9A400'],
      'Lona front 380g • 120x60 por R$ 22',
      'Faixa promocional em lona front com ilhós ou madeirinhas. Ideal para inaugurações e promoções.',
      [{ qty: 1, price: 22 }, { qty: 2, price: 40 }, { qty: 5, price: 95 }],
      { papers: LONA, colors: C4X0, finishes: FIN_LONA,
        formats: [{ id: '120x60', label: '120x60cm', mod: 0 }, { id: '120x80', label: '120x80cm', mod: 0.27 }, { id: '300x95', label: '300x95cm', mod: 2.95 }] }),
    P('perfurado', 'Adesivo Perfurado', 'comunicacao', '🚗', ['#0B1E3B', '#00B3A6'],
      'Para vitrines e frotas • por m²',
      'Adesivo perfurado para vidros: divulga por fora sem bloquear a visão por dentro. Cobrança por m².',
      [{ qty: 1, price: 79 }, { qty: 2, price: 149 }, { qty: 5, price: 349 }],
      { colors: C4X0, formats: [{ id: 'm2', label: 'Por m² (sob medida)', mod: 0 }] }),
    P('cartaz', 'Cartaz', 'comunicacao', '🪧', ['#4A0B3B', '#E63900'],
      'A3 • couché 115g • ponto de venda',
      'Cartaz A3 em couché 115g 4x0 para ponto de venda, eventos e lançamentos.',
      [{ qty: 100, price: 89 }, { qty: 250, price: 159 }, { qty: 500, price: 259 }, { qty: 1000, price: 449 }],
      { finishes: FIN_SIMPLE, formats: [{ id: 'a3', label: 'A3 (30x42cm)', mod: 0 }, { id: 'a2', label: 'A2 (42x60cm)', mod: 0.8 }] }),
    P('rollup', 'Porta Banner Roll-Up + Banner', 'comunicacao', '🎪', ['#0B3B2E', '#4D7CFE'],
      '85x200cm • estrutura + banner • R$ 180',
      'Roll-up com estrutura de alumínio + banner impresso 85x200cm. Sofisticado, desmontável e fácil de transportar.',
      [{ qty: 1, price: 180 }, { qty: 2, price: 340 }, { qty: 5, price: 799 }],
      { badge: 'Novo', colors: C4X0, formats: [{ id: '85x200', label: '85x200cm', mod: 0 }] }),
    P('timbrado', 'Papel Timbrado A4', 'papelaria', '📝', ['#243447', '#5B7FA6'],
      'A4 • offset 90g • 4x0',
      'Papel timbrado A4 em offset 90g para propostas, contratos e documentos oficiais.',
      [{ qty: 500, price: 159 }, { qty: 1000, price: 249 }, { qty: 2500, price: 549 }],
      { formats: [{ id: 'a4', label: 'A4 (21x29.7cm)', mod: 0 }], papers: OFFSET, finishes: FIN_SIMPLE }),
    P('receituario', 'Receituário', 'papelaria', '⚕️', ['#0B3B2E', '#00B3A6'],
      '15x21cm • offset 75g • blocado a cada 50fls',
      'Receituário 15x21cm em offset 75g ou 90g, com blocagem a cada 50 folhas. Para clínicas e consultórios.',
      [{ qty: 500, price: 255 }, { qty: 1000, price: 449 }, { qty: 2500, price: 999 }],
      { badge: 'Novo', papers: OFFSET, finishes: [{ id: 'refile', label: 'Refile (folhas soltas)', add: 0 }, { id: 'blocagem', label: 'Blocagem a cada 50 folhas', add: 19 }],
        formats: [{ id: '15x21', label: '15x21cm', mod: 0 }] }),
    P('envelope-saco', 'Envelope Saco A4', 'papelaria', '✉️', ['#5B3B0B', '#C07A00'],
      'Offset 90g • corte, vinco e colagem',
      'Envelope saco personalizado em offset 90g com corte, vinco e colagem. Para documentos e contratos.',
      [{ qty: 250, price: 250 }, { qty: 500, price: 350 }, { qty: 1000, price: 620 }],
      { papers: OFFSET, finishes: [{ id: 'cvc', label: 'Corte e vinco + colagem', add: 0 }],
        formats: [{ id: 'a4', label: 'Para A4 (11.3x23cm fechado)', mod: 0 }, { id: 'carta', label: 'Carta (11.5x23cm fechado)', mod: 0.19 }] }),
    P('pasta-bolso', 'Pasta com Bolso', 'papelaria', '🗂️', ['#1B2A6B', '#00B3A6'],
      'Triplex 250g • laminação fosca • 22x31cm',
      'Pasta institucional em triplex 250g com laminação fosca, corte e vinco. Presença profissional.',
      [{ qty: 100, price: 329 }, { qty: 250, price: 549 }, { qty: 500, price: 899 }],
      { formats: [{ id: '22x31', label: '22x31cm fechada', mod: 0 }], finishes: FIN_VINCO, papers: [{ id: 'triplex-250', label: 'Triplex 250g', mod: 0 }, { id: 'supremo-300', label: 'Supremo 300g', mod: 0.1 }] }),
    P('calendario-mesa', 'Calendário de Mesa', 'calendarios', '📅', ['#7A1E00', '#FFB800'],
      'Couché 300g • corte, vinco e verniz • 500un R$ 210',
      'Calendário de mesa em couché 300g com corte, vinco e verniz total. O brinde que fica o ano todo na mesa.',
      [{ qty: 100, price: 139 }, { qty: 250, price: 179 }, { qty: 500, price: 210 }, { qty: 1000, price: 379 }],
      { colors: C4X0, finishes: FIN_VINCO, formats: [{ id: 'padrao', label: '9.8x25.9cm (padrão)', mod: 0 }, { id: 'mini', label: 'Mini', mod: -0.2 }] }),
    P('calendario-parede', 'Calendário de Parede', 'calendarios', '🗓️', ['#003B2E', '#4D7CFE'],
      'Comercial • espiral + furo',
      'Calendário de parede comercial com espiral e foto de destaque. Alta visibilidade para sua marca.',
      [{ qty: 100, price: 449 }, { qty: 250, price: 999 }, { qty: 500, price: 1799 }], { formats: [{ id: 'a3', label: 'A3 com espiral', mod: 0 }] }),
    P('caixa-hamburguer', 'Caixa p/ Hambúrguer', 'embalagens', '🍔', ['#7A1E00', '#E63900'],
      'Delivery • duplex • resistente à gordura',
      'Caixa para hambúrguer personalizada em papel duplex, resistente à gordura. Delivery profissional.',
      [{ qty: 500, price: 479 }, { qty: 1000, price: 849 }, { qty: 2500, price: 1899 }], { formats: [{ id: 'padrao', label: 'Padrão p/ hambúrguer', mod: 0 }] }),
    P('papel-bandeja', 'Papel de Bandeja', 'embalagens', '🍟', ['#5B3B0B', '#FFB800'],
      'Offset 56g • 34x24cm • 500un R$ 320',
      'Papel de bandeja em offset 56g 4x0 para lanchonetes e fast-food. Sua marca em cada bandeja.',
      [{ qty: 500, price: 360 }, { qty: 1000, price: 620 }, { qty: 2500, price: 1360 }],
      { papers: OFFSET, finishes: FIN_SIMPLE, formats: [{ id: '34x24', label: '34.4x23.9cm', mod: 0 }] }),
    P('santinho', 'Santinho Eleitoral 7x10', 'eleicoes', '🗳️', ['#0B3B1E', '#16A34A'],
      '7x10cm • couché 90g • alta tiragem',
      'Santinho de campanha 7x10cm com número, foto e propostas. Produção rápida em alta tiragem para eleições 2026.',
      [{ qty: 5000, price: 219 }, { qty: 10000, price: 369 }, { qty: 25000, price: 799 }, { qty: 50000, price: 1399 }, { qty: 100000, price: 2599 }],
      { formats: [{ id: '7x10', label: '7x10cm', mod: 0 }], badge: 'Eleições 2026', finishes: FIN_SIMPLE }),
    P('ventarola', 'Ventarola (Leque)', 'promocional', '🪭', ['#3B0B2E', '#FF5A00'],
      'Supremo 300g • cabo madeira',
      'Ventarolas personalizadas para eventos e ações promocionais. Divulgação que refresca.',
      [{ qty: 250, price: 379 }, { qty: 500, price: 649 }, { qty: 1000, price: 1149 }], { formats: [{ id: 'padrao', label: 'Padrão c/ cabo madeira', mod: 0 }] }),
    P('tag-personalizada', 'TAG Personalizada', 'promocional', '🔖', ['#1B1B2B', '#7C3AED'],
      'Com furo + cordão • 500un por R$ 69',
      'Tags personalizadas com furo e cordão para roupas, calçados, brindes e artesanato.',
      [{ qty: 500, price: 69 }, { qty: 1000, price: 99 }, { qty: 2500, price: 199 }, { qty: 5000, price: 349 }],
      { formats: [{ id: '5x9', label: '5x9cm c/ furo', mod: 0 }], finishes: [{ id: 'furo', label: 'Furo + cordão', add: 0 }, { id: 'furo-lam', label: 'Furo + laminação', add: 19 }] }),
    P('marcador-pagina', 'Marcador de Página', 'promocional', '📚', ['#1B2A6B', '#C026D3'],
      '5x21cm • couché 250g • verniz total',
      'Marcador de página 5x21cm em couché 250g com verniz. Ideal para editoras, escolas e brindes.',
      [{ qty: 500, price: 129 }, { qty: 1000, price: 199 }, { qty: 2500, price: 399 }],
      { finishes: FIN_SIMPLE, formats: [{ id: '5x21', label: '5x21cm', mod: 0 }] }),
    P('adesivo-carro-digital', 'Adesivo de Carro - Digital', 'adesivos', '🚗', ['#5B0B0B', '#7C3AED'],
      'A3 • vinil alta aderência • a partir de R$ 32',
      'Adesivo para carro em vinil com impressão digital de alta definição. Ideal para publicidade móvel e frotas.',
      [{ qty: 1, price: 32 }, { qty: 5, price: 68 }, { qty: 10, price: 119 }, { qty: 25, price: 279 }, { qty: 50, price: 549 }, { qty: 100, price: 999 }],
      { colors: C4X0, finishes: [{ id: 'sem', label: 'Sem acabamento', add: 0 }, { id: 'lam', label: 'Laminação protetora', add: 15 }],
        formats: [{ id: '20x30', label: '20x30cm', mod: -0.3 }, { id: 'a3', label: 'A3 (29.7x42cm)', mod: 0 }, { id: '50x70', label: '50x70cm', mod: 0.8 }] }),
    P('adesivo-carro-flexo', 'Adesivo de Carro - Flexo', 'adesivos', '🚙', ['#0B3B2E', '#7C3AED'],
      'Flexografia • alto volume • menor custo/un',
      'Adesivo para carro em flexografia, o menor custo por unidade em altas tiragens. Para campanhas e frotas.',
      [{ qty: 250, price: 449 }, { qty: 500, price: 749 }, { qty: 1000, price: 1299 }, { qty: 2500, price: 2799 }],
      { colors: C4X0, formats: [{ id: '20x10', label: '20x10cm', mod: 0 }, { id: '30x15', label: '30x15cm', mod: 0.5 }] }),
    P('caixa-sushi', 'Caixa de Sushi', 'embalagens', '🍱', ['#7A1E00', '#0B1E3B'],
      'Duplex • personalizada • p/ combinados',
      'Caixa para sushi e combinados em papel duplex com sua marca. Apresentação impecável no delivery.',
      [{ qty: 500, price: 549 }, { qty: 1000, price: 949 }, { qty: 2500, price: 2149 }],
      { formats: [{ id: 'padrao', label: 'Padrão p/ combinado', mod: 0 }] }),
    P('caixa-panetone', 'Caixa para Panetone', 'embalagens', '🍞', ['#3B0B2E', '#D9A400'],
      'Duplex • 750g e 1kg • edição Natal',
      'Caixa para panetone em duplex, perfeita para confeitarias e presentes corporativos de fim de ano.',
      [{ qty: 250, price: 449 }, { qty: 500, price: 749 }, { qty: 1000, price: 1349 }],
      { badge: 'Natal 🎄', formats: [{ id: '750g', label: 'Para 750g', mod: 0 }, { id: '1kg', label: 'Para 1kg', mod: 0.15 }] }),
    P('caixa-batata', 'Caixas de Batata', 'embalagens', '🍟', ['#7A1E00', '#FFB800'],
      'Duplex • resistente à gordura • delivery',
      'Caixinhas para batata frita personalizadas, resistentes à gordura. Seu fast-food com marca própria.',
      [{ qty: 500, price: 399 }, { qty: 1000, price: 699 }, { qty: 2500, price: 1599 }],
      { formats: [{ id: 'p', label: 'Pequena', mod: 0 }, { id: 'g', label: 'Grande', mod: 0.25 }] }),
    P('sacola-kraft', 'Sacola Kraft', 'embalagens', '🛍️', ['#5B3B0B', '#A8712A'],
      'Kraft • alça torcida • P, M e G',
      'Sacola de papel kraft com alça torcida e sua logo. Embalagem sustentável que divulga sua marca.',
      [{ qty: 250, price: 549 }, { qty: 500, price: 949 }, { qty: 1000, price: 1699 }],
      { papers: [{ id: 'kraft', label: 'Kraft 160g', mod: 0 }], finishes: [{ id: 'alca', label: 'Alça torcida', add: 0 }],
        formats: [{ id: 'p', label: 'P (18x24cm)', mod: 0 }, { id: 'm', label: 'M (24x32cm)', mod: 0.3 }, { id: 'g', label: 'G (32x42cm)', mod: 0.6 }] }),
    P('sacos-delivery', 'Sacos para Delivery', 'embalagens', '🥡', ['#5B3B0B', '#00B3A6'],
      'Kraft monolúcido • 1kg, 2kg e 5kg',
      'Sacos de papel kraft para delivery de alimentos, farmácias e lojas. Práticos e personalizados.',
      [{ qty: 500, price: 449 }, { qty: 1000, price: 799 }, { qty: 2500, price: 1799 }],
      { papers: [{ id: 'kraft-mono', label: 'Kraft monolúcido', mod: 0 }], colors: C4X0,
        formats: [{ id: '1kg', label: '1kg', mod: 0 }, { id: '2kg', label: '2kg', mod: 0.2 }, { id: '5kg', label: '5kg', mod: 0.45 }] }),
    P('capa-carne', 'Capa de Carnê', 'papelaria', '📕', ['#1B2A6B', '#E63900'],
      'Couché 250g • com vinco • 10x21cm',
      'Capa de carnê em couché 250g com vinco, para crediários, mensalidades e financiamentos.',
      [{ qty: 250, price: 199 }, { qty: 500, price: 329 }, { qty: 1000, price: 549 }],
      { finishes: FIN_VINCO, formats: [{ id: '10x21', label: '10x21cm', mod: 0 }] }),
    P('postal', 'Postal', 'papelaria', '💌', ['#4A0B3B', '#4D7CFE'],
      '10x15cm • couché 250g • frente e verso',
      'Cartão postal 10x15cm em couché 250g para convites, agradecimentos e campanhas criativas.',
      [{ qty: 500, price: 149 }, { qty: 1000, price: 229 }, { qty: 2500, price: 449 }],
      { finishes: FIN_SIMPLE, formats: [{ id: '10x15', label: '10x15cm', mod: 0 }] }),
    P('solapa', 'Solapa', 'papelaria', '📌', ['#243447', '#C026D3'],
      'Couché 250g • furo europeu • p/ blister',
      'Solapa em couché 250g com furo europeu para expor produtos em gôndolas e displays.',
      [{ qty: 500, price: 139 }, { qty: 1000, price: 219 }, { qty: 2500, price: 449 }],
      { finishes: [{ id: 'furo', label: 'Furo europeu', add: 0 }, { id: 'furo-lam', label: 'Furo + laminação', add: 19 }],
        formats: [{ id: 'padrao', label: 'Padrão c/ furo', mod: 0 }] }),
    P('ima-geladeira', 'Ímã de Geladeira', 'promocional', '🧲', ['#0B1E3B', '#E63900'],
      'Manta magnética • 4x5cm • 100un R$ 49',
      'Ímã de geladeira em cartão 250g com laminação sobre manta magnética. Divulgação que gruda na rotina.',
      [{ qty: 100, price: 49 }, { qty: 250, price: 99 }, { qty: 500, price: 179 }, { qty: 1000, price: 299 }],
      { colors: C4X0, papers: [{ id: 'cartao-ima', label: 'Cartão 250g + manta magnética', mod: 0 }],
        finishes: [{ id: 'corte-reto', label: 'Corte reto', add: 0 }, { id: 'cantos', label: 'Cantos arredondados', add: 15 }],
        formats: [{ id: '4x5', label: '4x5cm', mod: 0 }, { id: '8x5', label: '8x5cm', mod: 0.6 }] }),
    P('nao-perturbe', 'Não Perturbe de Porta', 'promocional', '🚪', ['#3B2E0B', '#7C3AED'],
      'Supremo • corte especial + furo • hotéis',
      'Aviso de porta "Não perturbe" com corte especial e furo para maçaneta. Para hotéis e pousadas.',
      [{ qty: 250, price: 229 }, { qty: 500, price: 379 }, { qty: 1000, price: 649 }],
      { papers: CARTAO_PAPER, finishes: [{ id: 'corte-furo', label: 'Corte especial + furo', add: 0 }, { id: 'corte-lam', label: 'Corte + laminação', add: 19 }],
        formats: [{ id: 'padrao', label: 'Padrão p/ maçaneta', mod: 0 }] }),
    P('pragao', 'Pragão', 'promocional', '📣', ['#7A1E00', '#16A34A'],
      '30x42cm • couché 90g • grande impacto',
      'Pragão 30x42cm em couché 90g: o panfletão para ações de rua, blitz e eventos de grande público.',
      [{ qty: 1000, price: 249 }, { qty: 2500, price: 449 }, { qty: 5000, price: 799 }, { qty: 10000, price: 1399 }],
      { papers: [{ id: 'couche-90', label: 'Couché brilho 90g', mod: 0 }, { id: 'couche-115', label: 'Couché 115g', mod: 0.1 }],
        finishes: FIN_SIMPLE, formats: [{ id: '30x42', label: '30x42cm', mod: 0 }] }),
    P('praguinha-digital', 'Praguinha - Digital', 'promocional', '🎯', ['#0B3B2E', '#FFB800'],
      '7x10cm • impressão digital • pequenas tiragens',
      'Praguinha 7x10cm em impressão digital: ideal para testes, eventos pequenos e reposição rápida.',
      [{ qty: 100, price: 49 }, { qty: 250, price: 89 }, { qty: 500, price: 139 }, { qty: 1000, price: 229 }],
      { finishes: FIN_SIMPLE, formats: [{ id: '7x10', label: '7x10cm', mod: 0 }] }),
    P('tabela-copa', 'Tabela da Copa 2026', 'promocional', '⚽', ['#0B3B1E', '#FFB800'],
      'A3 • jogos + calendário • brinde campeão',
      'Tabela da Copa do Mundo 2026 em A3 com jogos e chaveamento. O brinde promocional do ano.',
      [{ qty: 100, price: 99 }, { qty: 250, price: 189 }, { qty: 500, price: 329 }, { qty: 1000, price: 549 }],
      { badge: 'Copa 2026 🏆', finishes: FIN_SIMPLE, formats: [{ id: 'a3', label: 'A3', mod: 0 }] }),
    P('totem', 'Totem Display', 'comunicacao', '📢', ['#2E0B3B', '#00B3A6'],
      '180cm • papelãodisplay • ponto de venda',
      'Totem display de 180cm para ponto de venda, lançamentos e eventos. Montagem fácil e grande presença.',
      [{ qty: 1, price: 299 }, { qty: 3, price: 799 }, { qty: 10, price: 2499 }],
      { colors: C4X0, papers: [{ id: 'papelao', label: 'Papelão display', mod: 0 }],
        finishes: [{ id: 'cvc', label: 'Corte, vinco e colagem', add: 0 }], formats: [{ id: '180', label: '180cm', mod: 0 }] }),
    P('tapete-lava-jato', 'Tapete Lava Jato', 'comunicacao', '🚙', ['#0B1E3B', '#64748B'],
      '60x40cm • personalizado • p/ carros',
      'Tapete personalizado 60x40cm para lava-jatos e estética automotiva. Brinde útil que roda com o cliente.',
      [{ qty: 10, price: 349 }, { qty: 25, price: 749 }, { qty: 50, price: 1299 }],
      { colors: C4X0, papers: [{ id: 'borracha', label: 'Borracha + tecido', mod: 0 }],
        finishes: [{ id: 'costura', label: 'Costura na borda', add: 0 }], formats: [{ id: '60x40', label: '60x40cm', mod: 0 }] }),
  ];

  const users = [
    { id: 'u-admin', name: 'Administrador', email: 'admin@primeprint.com.br', pass: bcrypt.hashSync('admin123', 8), phone: '(81) 3000-0000', cpf: '000.000.000-00', role: 'admin', addresses: [], favorites: [], active: true, createdAt: new Date().toISOString() },
    { id: 'u-demo', name: 'João Silva (demo)', email: 'cliente@demo.com', pass: bcrypt.hashSync('demo123', 8), phone: '(81) 99999-0000', cpf: '123.456.789-00', role: 'customer', addresses: [{ id: 'a1', label: 'Casa', street: 'Rua das Flores, 123', district: 'Centro', city: 'Paulista', state: 'PE', zip: '53400-000', main: true }], favorites: ['cartao-visita', 'panfleto-10x15'], active: true, createdAt: new Date().toISOString() },
  ];

  const now = Date.now(), D = 864e5;
  const orders = [
    { id: 'o-1001', code: 'PP-2026-1001', userId: 'u-demo', items: [{ productId: 'cartao-visita', name: 'Cartão de Visita', icon: '💳', config: '9x5cm • Supremo 250g • 4x4 • Laminação fosca • Normal', qty: 1000, unit: 0.12, total: 118.9 }], subtotal: 118.9, discount: 11.89, coupon: 'BEMVINDO10', shipping: 19.9, total: 126.91, payment: { method: 'pix', status: 'paid' }, address: { label: 'Casa', street: 'Rua das Flores, 123', city: 'Paulista', state: 'PE', zip: '53400-000' }, shippingType: 'PAC', status: 'em_producao', tracking: 'BR123456789BR', art: { file: null, originalName: 'cartao-frente-verso.pdf', status: 'approved', feedback: '' }, timeline: [{ status: 'aguardando_arte', at: new Date(now - 5 * D).toISOString() }, { status: 'em_analise', at: new Date(now - 4 * D).toISOString() }, { status: 'aprovado', at: new Date(now - 3 * D).toISOString() }, { status: 'em_producao', at: new Date(now - 1 * D).toISOString() }], createdAt: new Date(now - 5 * D).toISOString() },
    { id: 'o-1002', code: 'PP-2026-1002', userId: 'u-demo', items: [{ productId: 'panfleto-10x15', name: 'Panfleto 10x15', icon: '📰', config: '10x15cm • Couché 90g • 4x4 • Sem acabamento • Normal', qty: 5000, unit: 0.04, total: 199 }, { productId: 'lacre-delivery', name: 'Lacre Adesivo p/ Delivery', icon: '🛵', config: 'Padrão • 4x4 • Normal', qty: 1000, unit: 0.12, total: 119.9 }], subtotal: 318.9, discount: 0, coupon: null, shipping: 0, total: 318.9, payment: { method: 'card', status: 'paid' }, address: { label: 'Casa', street: 'Rua das Flores, 123', city: 'Paulista', state: 'PE', zip: '53400-000' }, shippingType: 'SEDEX', status: 'entregue', tracking: 'BR987654321BR', art: { file: null, originalName: 'panfleto-promo.pdf', status: 'approved', feedback: '' }, timeline: [{ status: 'aguardando_arte', at: new Date(now - 20 * D).toISOString() }, { status: 'em_analise', at: new Date(now - 19 * D).toISOString() }, { status: 'aprovado', at: new Date(now - 18 * D).toISOString() }, { status: 'em_producao', at: new Date(now - 15 * D).toISOString() }, { status: 'enviado', at: new Date(now - 12 * D).toISOString() }, { status: 'entregue', at: new Date(now - 9 * D).toISOString() }], createdAt: new Date(now - 20 * D).toISOString() },
    { id: 'o-1003', code: 'PP-2026-1003', userId: 'u-demo', items: [{ productId: 'banner-lona', name: 'Banner em Lona 440g', icon: '🖼️', config: '100x150cm • Lona 440g • Expressa', qty: 2, unit: 114.65, total: 229.3 }], subtotal: 229.3, discount: 0, coupon: null, shipping: 24.9, total: 254.2, payment: { method: 'boleto', status: 'pending' }, address: { label: 'Casa', street: 'Rua das Flores, 123', city: 'Paulista', state: 'PE', zip: '53400-000' }, shippingType: 'PAC', status: 'aguardando_arte', tracking: '', art: { file: null, originalName: '', status: 'pending', feedback: '' }, timeline: [{ status: 'aguardando_arte', at: new Date(now - 1 * D).toISOString() }], createdAt: new Date(now - 1 * D).toISOString() },
  ];

  const coupons = [
    { id: 'c1', code: 'BEMVINDO10', type: 'percent', value: 10, min: 100, maxUses: 500, used: 37, expires: '2026-12-31', active: true, desc: '10% OFF na primeira compra acima de R$ 100' },
    { id: 'c2', code: 'PRINT15', type: 'percent', value: 15, min: 300, maxUses: 200, used: 12, expires: '2026-12-31', active: true, desc: '15% OFF em compras acima de R$ 300' },
    { id: 'c3', code: 'FRETEGRATIS', type: 'freeship', value: 0, min: 299, maxUses: 1000, used: 210, expires: '2026-12-31', active: true, desc: 'Frete grátis acima de R$ 299' },
  ];

  const banners = [
    { id: 'b1', title: 'Panfletos a partir de R$ 48', subtitle: '10x14cm • 4x0 ou 4x4 • envio p/ todo Brasil', cta: 'Ver ofertas', link: '/produto.html?id=panfleto-10x15', grad: ['#7A1E00', '#FF5A00'], icon: '📰', img: '/img/products/panfleto.jpg', active: true },
    { id: 'b2', title: '10% OFF na 1ª compra', subtitle: 'Use o cupom BEMVINDO10 • válido p/ pedidos acima de R$ 100', cta: 'Quero desconto', link: '/produtos.html', grad: ['#0B1E3B', '#1E5AA8'], icon: '🎟️', img: '/img/products/cartao-visita.jpg', active: true },
    { id: 'b3', title: 'Eleições 2026', subtitle: 'Santinhos a partir de R$ 249 o milheiro • produção expressa', cta: 'Material de campanha', link: '/produto.html?id=santinho', grad: ['#0B3B1E', '#16A34A'], icon: '🗳️', img: '/img/products/santinho.jpg', active: true },
  ];

  /* Fotos dos produtos (as demais usam gradiente + ícone) */
  const IMGS = {
    'cartao-visita': '/img/products/cartao-visita.jpg', 'cartao-verniz': '/img/products/cartao-visita.jpg',
    'panfleto-10x15': '/img/products/panfleto.jpg', 'panfleto-a5': '/img/products/panfleto.jpg',
    'folder-a4': '/img/products/folder-a4.jpg', 'pasta-bolso': '/img/products/folder-a4.jpg',
    'adesivo-vinil': '/img/products/adesivo-vinil.jpg', 'lacre-delivery': '/img/products/adesivo-vinil.jpg', 'perfurado': '/img/products/adesivo-vinil.jpg',
    'rotulo-bopp': '/img/products/rotulo-bopp.jpg',
    'timbrado': '/img/products/timbrado.jpg',
    'envelope-saco': '/img/products/envelope.jpg',
    'banner-lona': '/img/products/banner-lona.jpg', 'faixa-lona': '/img/products/banner-lona.jpg',
    'calendario-mesa': '/img/products/calendario-mesa.jpg', 'calendario-parede': '/img/products/calendario-mesa.jpg',
    'caixa-hamburguer': '/img/products/caixa-hamburguer.jpg',
    'santinho': '/img/products/santinho.jpg', 'ventarola': '/img/products/santinho.jpg',
    'tag-personalizada': '/img/products/tag.jpg',
    'receituario': '/img/products/timbrado.jpg', 'cartaz': '/img/products/banner-lona.jpg',
    'rollup': '/img/products/banner-lona.jpg',
    'adesivo-carro-digital': '/img/products/adesivo-vinil.jpg', 'adesivo-carro-flexo': '/img/products/adesivo-vinil.jpg',
    'caixa-sushi': '/img/products/caixa-hamburguer.jpg', 'caixa-panetone': '/img/products/caixa-hamburguer.jpg',
    'caixa-batata': '/img/products/caixa-hamburguer.jpg', 'capa-carne': '/img/products/folder-a4.jpg',
    'postal': '/img/products/panfleto.jpg', 'totem': '/img/products/banner-lona.jpg',
  };
  products.forEach(p => p.img = IMGS[p.id] || null);

  const config = {
    storeName: 'PrimePrint', phone: '(81) 3011-3399', whatsapp: '5581999990000',
    email: 'vendas@primeprint.com.br', hours: 'Seg a Sex, 9h às 18h',
    freeShipFrom: 299, shipPAC: 19.9, shipSEDEX: 29.9, pixDiscount: 5, installmentMax: 6,
  };

  return { seq: { order: 1004 }, categories, products, users, orders, coupons, banners, messages: [], config };
}

/* ---------------- Auth helpers ---------------- */
function sign(user) { return jwt.sign({ id: user.id, role: user.role }, SECRET, { expiresIn: '7d' }); }
function auth(req, res, next) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Não autenticado' });
  try {
    const payload = jwt.verify(token, SECRET);
    const user = loadDB().users.find(u => u.id === payload.id && u.active !== false);
    if (!user) return res.status(401).json({ error: 'Usuário inválido' });
    req.user = user; next();
  } catch { return res.status(401).json({ error: 'Sessão expirada' }); }
}
function admin(req, res, next) {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Acesso restrito' });
  next();
}
const pubUser = u => ({ id: u.id, name: u.name, email: u.email, phone: u.phone, cpf: u.cpf, role: u.role, addresses: u.addresses || [], favorites: u.favorites || [], createdAt: u.createdAt });

/* ---------------- Precificação ---------------- */
function calcPrice(product, sel = {}) {
  const q = product.quantities.find(x => String(x.qty) === String(sel.qty)) || product.quantities[0];
  const format = (product.formats || []).find(x => x.id === sel.format);
  const paper = (product.papers || []).find(x => x.id === sel.paper);
  const finish = (product.finishes || []).find(x => x.id === sel.finish);
  const color = (product.colors || []).find(x => x.id === sel.color);
  const deadline = (product.deadlines || []).find(x => x.id === sel.deadline);
  let total = q.price;
  if (format) total *= (1 + (format.mod || 0));
  if (paper) total *= (1 + (paper.mod || 0));
  if (color) total *= (1 + (color.mod || 0));
  if (finish) total += (finish.add || 0);
  if (deadline) total *= (deadline.mult || 1);
  total = Math.round(total * 100) / 100;
  return { qty: q.qty, base: q.price, total, unit: Math.round((total / q.qty) * 10000) / 10000 };
}

/* ============================================================
   ROTAS — PÚBLICO
   ============================================================ */
app.get('/api/health', (req, res) => res.json({ ok: true, time: new Date().toISOString() }));
app.get('/api/config', (req, res) => res.json(loadDB().config));
app.get('/api/categories', (req, res) => {
  const db = loadDB();
  const withCount = db.categories.map(c => ({ ...c, count: db.products.filter(p => p.category === c.id && p.active !== false).length }));
  res.json(withCount);
});
app.get('/api/banners', (req, res) => res.json(loadDB().banners.filter(b => b.active)));
app.get('/api/products', (req, res) => {
  const { q = '', category = '', sort = 'sold' } = req.query;
  let list = loadDB().products.filter(p => p.active !== false);
  if (category && category !== 'mais-vendidos' && category !== 'todos') list = list.filter(p => p.category === category);
  if (q) { const s = q.toLowerCase(); list = list.filter(p => (p.name + ' ' + p.tagline + ' ' + p.desc).toLowerCase().includes(s)); }
  const minPrice = p => Math.min(...p.quantities.map(x => x.price));
  if (sort === 'price-asc') list.sort((a, b) => minPrice(a) - minPrice(b));
  else if (sort === 'price-desc') list.sort((a, b) => minPrice(b) - minPrice(a));
  else if (sort === 'rating') list.sort((a, b) => b.rating - a.rating);
  else list.sort((a, b) => b.sold - a.sold);
  res.json(list.map(p => ({ ...p, minPrice: minPrice(p) })));
});
app.get('/api/products/:id', (req, res) => {
  const p = loadDB().products.find(x => x.id === req.params.id);
  if (!p) return res.status(404).json({ error: 'Produto não encontrado' });
  res.json({ ...p, minPrice: Math.min(...p.quantities.map(x => x.price)) });
});
app.post('/api/products/:id/price', (req, res) => {
  const p = loadDB().products.find(x => x.id === req.params.id);
  if (!p) return res.status(404).json({ error: 'Produto não encontrado' });
  res.json(calcPrice(p, req.body));
});
app.get('/api/coupons/public', (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  res.json(loadDB().coupons.filter(c => c.active && (!c.expires || c.expires >= today) && c.used < c.maxUses).map(c => ({ code: c.code, desc: c.desc, min: c.min, type: c.type, value: c.value, expires: c.expires })));
});
app.post('/api/coupons/validate', (req, res) => {
  const { code, subtotal = 0 } = req.body;
  const c = loadDB().coupons.find(x => x.code === String(code || '').toUpperCase().trim() && x.active);
  if (!c) return res.status(400).json({ error: 'Cupom inválido' });
  if (c.expires && new Date(c.expires) < new Date()) return res.status(400).json({ error: 'Cupom expirado' });
  if (c.used >= c.maxUses) return res.status(400).json({ error: 'Cupom esgotado' });
  if (subtotal < c.min) return res.status(400).json({ error: `Pedido mínimo de R$ ${c.min.toFixed(2)}` });
  let discount = 0, freeship = false;
  if (c.type === 'percent') discount = Math.round(subtotal * c.value) / 100;
  if (c.type === 'fixed') discount = c.value;
  if (c.type === 'freeship') freeship = true;
  res.json({ code: c.code, desc: c.desc, discount, freeship });
});
app.post('/api/contact', (req, res) => {
  const { name, email, subject, message } = req.body;
  if (!name || !email || !message) return res.status(400).json({ error: 'Preencha nome, e-mail e mensagem' });
  loadDB().messages.push({ id: uid('m-'), name, email, subject: subject || '', message, at: new Date().toISOString(), read: false });
  saveDB();
  res.json({ ok: true });
});
app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado' });
  res.json({ url: '/uploads/' + req.file.filename, name: req.file.originalname, size: req.file.size });
});

/* ============================================================
   ROTAS — AUTH / CONTA
   ============================================================ */
app.post('/api/auth/register', (req, res) => {
  const { name, email, pass, phone = '', cpf = '' } = req.body;
  if (!name || !email || !pass) return res.status(400).json({ error: 'Preencha nome, e-mail e senha' });
  if (pass.length < 6) return res.status(400).json({ error: 'A senha deve ter ao menos 6 caracteres' });
  const db = loadDB();
  if (db.users.some(u => u.email.toLowerCase() === email.toLowerCase())) return res.status(400).json({ error: 'E-mail já cadastrado' });
  const user = { id: uid('u-'), name, email, pass: bcrypt.hashSync(pass, 8), phone, cpf, role: 'customer', addresses: [], favorites: [], active: true, createdAt: new Date().toISOString() };
  db.users.push(user); saveDB();
  res.json({ token: sign(user), user: pubUser(user) });
});
app.post('/api/auth/login', (req, res) => {
  const { email, pass } = req.body;
  const user = loadDB().users.find(u => u.email.toLowerCase() === String(email || '').toLowerCase());
  if (!user || !bcrypt.compareSync(pass || '', user.pass)) return res.status(400).json({ error: 'E-mail ou senha incorretos' });
  if (user.active === false) return res.status(403).json({ error: 'Conta desativada. Fale com o suporte.' });
  res.json({ token: sign(user), user: pubUser(user) });
});
app.get('/api/auth/me', auth, (req, res) => res.json(pubUser(req.user)));
app.put('/api/auth/me', auth, (req, res) => {
  const { name, phone, cpf } = req.body;
  if (name) req.user.name = name;
  if (phone !== undefined) req.user.phone = phone;
  if (cpf !== undefined) req.user.cpf = cpf;
  saveDB(); res.json(pubUser(req.user));
});
app.post('/api/auth/password', auth, (req, res) => {
  const { current, next } = req.body;
  if (!bcrypt.compareSync(current || '', req.user.pass)) return res.status(400).json({ error: 'Senha atual incorreta' });
  if (!next || next.length < 6) return res.status(400).json({ error: 'Nova senha deve ter ao menos 6 caracteres' });
  req.user.pass = bcrypt.hashSync(next, 8); saveDB();
  res.json({ ok: true });
});
app.post('/api/favorites/:id', auth, (req, res) => {
  req.user.favorites = req.user.favorites || [];
  const i = req.user.favorites.indexOf(req.params.id);
  if (i >= 0) req.user.favorites.splice(i, 1); else req.user.favorites.push(req.params.id);
  saveDB(); res.json({ favorites: req.user.favorites });
});

/* Endereços */
app.get('/api/addresses', auth, (req, res) => res.json(req.user.addresses || []));
app.post('/api/addresses', auth, (req, res) => {
  const a = { id: uid('a-'), main: !(req.user.addresses || []).length, ...req.body };
  req.user.addresses = req.user.addresses || [];
  if (a.main) req.user.addresses.forEach(x => x.main = false);
  req.user.addresses.push(a); saveDB(); res.json(a);
});
app.put('/api/addresses/:id', auth, (req, res) => {
  const a = (req.user.addresses || []).find(x => x.id === req.params.id);
  if (!a) return res.status(404).json({ error: 'Endereço não encontrado' });
  Object.assign(a, req.body);
  if (a.main) req.user.addresses.forEach(x => { if (x.id !== a.id) x.main = false; });
  saveDB(); res.json(a);
});
app.delete('/api/addresses/:id', auth, (req, res) => {
  req.user.addresses = (req.user.addresses || []).filter(x => x.id !== req.params.id);
  saveDB(); res.json({ ok: true });
});

/* Pedidos do cliente */
app.get('/api/orders', auth, (req, res) => {
  const db = loadDB();
  let list = db.orders.filter(o => req.user.role === 'admin' || o.userId === req.user.id);
  const { status = '', q = '' } = req.query;
  if (status) list = list.filter(o => o.status === status);
  if (q) { const s = q.toLowerCase(); list = list.filter(o => (o.code + ' ' + o.items.map(i => i.name).join(' ')).toLowerCase().includes(s)); }
  list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  if (req.user.role === 'admin') {
    list = list.map(o => ({ ...o, customer: (() => { const u = db.users.find(x => x.id === o.userId); return u ? { name: u.name, email: u.email, phone: u.phone } : null; })() }));
  }
  res.json(list);
});
app.get('/api/orders/:id', auth, (req, res) => {
  const o = loadDB().orders.find(x => x.id === req.params.id);
  if (!o) return res.status(404).json({ error: 'Pedido não encontrado' });
  if (req.user.role !== 'admin' && o.userId !== req.user.id) return res.status(403).json({ error: 'Sem acesso' });
  res.json(o);
});
app.post('/api/orders', auth, (req, res) => {
  const db = loadDB();
  const { items = [], address, shippingType = 'PAC', paymentMethod = 'pix', coupon = null, art = null } = req.body;
  if (!items.length) return res.status(400).json({ error: 'Carrinho vazio' });
  if (!address || !address.street) return res.status(400).json({ error: 'Informe o endereço de entrega' });
  // Recalcula preços no servidor (segurança)
  let subtotal = 0, normItems = [];
  try {
    normItems = items.map(it => {
      const p = db.products.find(x => x.id === it.productId);
      if (!p) throw new Error('Produto inválido: ' + it.productId);
      const calc = calcPrice(p, it.sel || {});
      const cfg = it.configLabel || p.name;
      subtotal += calc.total;
      p.sold += 1;
      return { productId: p.id, name: p.name, icon: p.icon, img: p.img || null, config: cfg, qty: calc.qty, unit: calc.unit, total: calc.total };
    });
  } catch (e) { return res.status(400).json({ error: e.message }); }
  subtotal = Math.round(subtotal * 100) / 100;
  let discount = 0, freeship = false, couponCode = null;
  if (coupon) {
    const c = db.coupons.find(x => x.code === String(coupon).toUpperCase().trim() && x.active);
    if (c && subtotal >= c.min && c.used < c.maxUses) {
      couponCode = c.code; c.used += 1;
      if (c.type === 'percent') discount = Math.round(subtotal * c.value) / 100;
      if (c.type === 'fixed') discount = c.value;
      if (c.type === 'freeship') freeship = true;
    }
  }
  let shipping = shippingType === 'SEDEX' ? db.config.shipSEDEX : db.config.shipPAC;
  if (freeship || (subtotal - discount) >= db.config.freeShipFrom) shipping = 0;
  if (paymentMethod === 'pix') discount += Math.round((subtotal - discount) * db.config.pixDiscount) / 100;
  discount = Math.round(discount * 100) / 100;
  const total = Math.round((subtotal - discount + shipping) * 100) / 100;
  const n = db.seq.order++;
  const order = {
    id: uid('o-'), code: `PP-2026-${n}`, userId: req.user.id, items: normItems,
    subtotal, discount, coupon: couponCode, shipping, total,
    payment: { method: paymentMethod, status: paymentMethod === 'boleto' ? 'pending' : 'paid' },
    address, shippingType, status: art && art.url ? 'em_analise' : 'aguardando_arte', tracking: '',
    art: art && art.url ? { file: art.url, originalName: art.name || '', status: 'in_review', feedback: '' } : { file: null, originalName: '', status: 'pending', feedback: '' },
    timeline: [{ status: art && art.url ? 'em_analise' : 'aguardando_arte', at: new Date().toISOString() }],
    createdAt: new Date().toISOString(),
  };
  if (art && art.url) order.timeline.unshift({ status: 'aguardando_arte', at: new Date().toISOString() });
  db.orders.push(order); saveDB();
  res.json(order);
});
app.put('/api/orders/:id/art', auth, (req, res) => {
  const o = loadDB().orders.find(x => x.id === req.params.id);
  if (!o) return res.status(404).json({ error: 'Pedido não encontrado' });
  if (req.user.role !== 'admin' && o.userId !== req.user.id) return res.status(403).json({ error: 'Sem acesso' });
  const { url, name } = req.body;
  if (!url) return res.status(400).json({ error: 'Envie o arquivo' });
  o.art = { file: url, originalName: name || '', status: 'in_review', feedback: '' };
  if (['aguardando_arte'].includes(o.status)) { o.status = 'em_analise'; o.timeline.push({ status: 'em_analise', at: new Date().toISOString() }); }
  saveDB(); res.json(o);
});

/* ============================================================
   ROTAS — ADMIN
   ============================================================ */
app.get('/api/admin/stats', auth, admin, (req, res) => {
  const db = loadDB();
  const valid = db.orders.filter(o => o.status !== 'cancelado');
  const revenue = valid.reduce((s, o) => s + o.total, 0);
  const days = [...Array(14)].map((_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (13 - i));
    const key = d.toISOString().slice(0, 10);
    const dayOrders = valid.filter(o => o.createdAt.slice(0, 10) === key);
    return { day: key, label: d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }), revenue: Math.round(dayOrders.reduce((s, o) => s + o.total, 0) * 100) / 100, orders: dayOrders.length };
  });
  const byStatus = {};
  db.orders.forEach(o => byStatus[o.status] = (byStatus[o.status] || 0) + 1);
  const prodMap = {};
  valid.forEach(o => o.items.forEach(it => {
    prodMap[it.productId] = prodMap[it.productId] || { id: it.productId, name: it.name, icon: it.icon, img: it.img || null, qty: 0, revenue: 0 };
    prodMap[it.productId].qty += it.qty; prodMap[it.productId].revenue += it.total;
  }));
  const topProducts = Object.values(prodMap).sort((a, b) => b.revenue - a.revenue).slice(0, 6);
  res.json({
    revenue: Math.round(revenue * 100) / 100,
    orders: db.orders.length,
    ticket: db.orders.length ? Math.round((revenue / valid.length || 0) * 100) / 100 : 0,
    customers: db.users.filter(u => u.role === 'customer').length,
    pendingArts: db.orders.filter(o => ['aguardando_arte', 'em_analise'].includes(o.status)).length,
    unreadMsg: db.messages.filter(m => !m.read).length,
    series: days, byStatus, topProducts,
    recent: [...db.orders].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 6),
  });
});
app.put('/api/orders/:id/status', auth, admin, (req, res) => {
  const o = loadDB().orders.find(x => x.id === req.params.id);
  if (!o) return res.status(404).json({ error: 'Pedido não encontrado' });
  const { status, note = '', tracking = '' } = req.body;
  o.status = status;
  if (tracking !== undefined) o.tracking = tracking;
  o.timeline.push({ status, at: new Date().toISOString(), note });
  saveDB(); res.json(o);
});
app.put('/api/orders/:id/art-review', auth, admin, (req, res) => {
  const o = loadDB().orders.find(x => x.id === req.params.id);
  if (!o) return res.status(404).json({ error: 'Pedido não encontrado' });
  const { approved, feedback = '' } = req.body;
  o.art.status = approved ? 'approved' : 'rejected';
  o.art.feedback = feedback;
  o.status = approved ? 'aprovado' : 'aguardando_arte';
  o.timeline.push({ status: o.status, at: new Date().toISOString(), note: feedback });
  saveDB(); res.json(o);
});
app.get('/api/admin/customers', auth, admin, (req, res) => {
  const db = loadDB();
  res.json(db.users.filter(u => u.role === 'customer').map(u => {
    const orders = db.orders.filter(o => o.userId === u.id && o.status !== 'cancelado');
    return { ...pubUser(u), orders: orders.length, spent: Math.round(orders.reduce((s, o) => s + o.total, 0) * 100) / 100, active: u.active !== false };
  }));
});
app.put('/api/admin/customers/:id', auth, admin, (req, res) => {
  const u = loadDB().users.find(x => x.id === req.params.id);
  if (!u) return res.status(404).json({ error: 'Cliente não encontrado' });
  if (req.body.active !== undefined) u.active = !!req.body.active;
  saveDB(); res.json({ ok: true });
});
app.get('/api/admin/banners', auth, admin, (req, res) => res.json(loadDB().banners));
app.put('/api/orders/:id/pay', auth, admin, (req, res) => {
  const o = loadDB().orders.find(x => x.id === req.params.id);
  if (!o) return res.status(404).json({ error: 'Pedido não encontrado' });
  o.payment.status = req.body.status === 'paid' ? 'paid' : 'pending';
  o.timeline.push({ status: o.status, at: new Date().toISOString(), note: 'Pagamento: ' + o.payment.status });
  saveDB(); res.json(o);
});
/* Produtos / categorias / cupons / banners / config (admin) */
app.post('/api/products', auth, admin, (req, res) => {
  const db = loadDB();
  const p = { id: uid('p-'), rating: 5, sold: 0, active: true, createdAt: new Date().toISOString(), ...req.body };
  if (!p.name || !p.category || !p.quantities) return res.status(400).json({ error: 'Dados incompletos' });
  db.products.push(p); saveDB(); res.json(p);
});
app.put('/api/products/:id', auth, admin, (req, res) => {
  const p = loadDB().products.find(x => x.id === req.params.id);
  if (!p) return res.status(404).json({ error: 'Produto não encontrado' });
  Object.assign(p, req.body); saveDB(); res.json(p);
});
app.delete('/api/products/:id', auth, admin, (req, res) => {
  const db = loadDB();
  db.products = db.products.filter(x => x.id !== req.params.id);
  saveDB(); res.json({ ok: true });
});
app.post('/api/categories', auth, admin, (req, res) => {
  const db = loadDB();
  const c = { id: uid('c-'), ...req.body };
  db.categories.push(c); saveDB(); res.json(c);
});
app.put('/api/categories/:id', auth, admin, (req, res) => {
  const c = loadDB().categories.find(x => x.id === req.params.id);
  if (!c) return res.status(404).json({ error: 'Categoria não encontrada' });
  Object.assign(c, req.body); saveDB(); res.json(c);
});
app.delete('/api/categories/:id', auth, admin, (req, res) => {
  const db = loadDB();
  db.categories = db.categories.filter(x => x.id !== req.params.id);
  saveDB(); res.json({ ok: true });
});
app.get('/api/coupons', auth, admin, (req, res) => res.json(loadDB().coupons));
app.post('/api/coupons', auth, admin, (req, res) => {
  const db = loadDB();
  const c = { id: uid('c-'), used: 0, ...req.body, code: String(req.body.code || '').toUpperCase().trim() };
  db.coupons.push(c); saveDB(); res.json(c);
});
app.put('/api/coupons/:id', auth, admin, (req, res) => {
  const c = loadDB().coupons.find(x => x.id === req.params.id);
  if (!c) return res.status(404).json({ error: 'Cupom não encontrado' });
  Object.assign(c, req.body); saveDB(); res.json(c);
});
app.delete('/api/coupons/:id', auth, admin, (req, res) => {
  const db = loadDB();
  db.coupons = db.coupons.filter(x => x.id !== req.params.id);
  saveDB(); res.json({ ok: true });
});
app.put('/api/banners', auth, admin, (req, res) => {
  loadDB().banners = req.body.banners || [];
  saveDB(); res.json({ ok: true });
});
app.put('/api/config', auth, admin, (req, res) => {
  Object.assign(loadDB().config, req.body); saveDB(); res.json(loadDB().config);
});
app.get('/api/admin/messages', auth, admin, (req, res) => res.json(loadDB().messages));
app.put('/api/admin/messages/:id', auth, admin, (req, res) => {
  const m = loadDB().messages.find(x => x.id === req.params.id);
  if (m) m.read = true; saveDB(); res.json({ ok: true });
});


/* ============================================================
   PAGAMENTO REAL — Mercado Pago (Checkout Pro)
   Configure MP_ACCESS_TOKEN no .env ou nas variáveis da hospedagem.
   Sem token, o checkout segue em modo simulação.
   ============================================================ */
app.get('/api/pay/status', (req, res) => res.json({ mercadopago: !!process.env.MP_ACCESS_TOKEN }));
app.post('/api/pay/mp-preference', auth, async (req, res) => {
  if (!process.env.MP_ACCESS_TOKEN) return res.status(400).json({ error: 'not-configured' });
  const o = loadDB().orders.find(x => x.id === req.body.orderId && x.userId === req.user.id);
  if (!o) return res.status(404).json({ error: 'Pedido não encontrado' });
  try {
    const base = (process.env.PUBLIC_URL || '').replace(/\/$/, '');
    const items = o.items.map(i => ({ title: `${i.name} (${Number(i.qty).toLocaleString('pt-BR')} un)`.slice(0, 120), quantity: 1, unit_price: Number(i.total.toFixed(2)), currency_id: 'BRL' }));
    if (o.shipping) items.push({ title: `Frete (${o.shippingType})`, quantity: 1, unit_price: Number(o.shipping.toFixed(2)), currency_id: 'BRL' });
    if (o.discount) items.push({ title: 'Desconto', quantity: 1, unit_price: -Number(o.discount.toFixed(2)), currency_id: 'BRL' });
    const r = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + process.env.MP_ACCESS_TOKEN },
      body: JSON.stringify({
        items, payer: { name: req.user.name, email: req.user.email }, external_reference: o.id,
        back_urls: base ? { success: base + '/conta.html#/pedidos', failure: base + '/checkout.html', pending: base + '/conta.html#/pedidos' } : undefined,
        auto_return: base ? 'approved' : undefined,
        notification_url: base ? base + '/api/pay/mp-webhook' : undefined,
      }),
    });
    const data = await r.json();
    if (!r.ok) return res.status(400).json({ error: data.message || 'Falha no Mercado Pago' });
    o.mpPreference = data.id; saveDB();
    res.json({ init_point: data.init_point || data.sandbox_init_point });
  } catch (e) { res.status(500).json({ error: 'Erro ao conectar no Mercado Pago' }); }
});
app.post('/api/pay/mp-webhook', async (req, res) => {
  try {
    const topic = req.query.topic || (req.body && req.body.type);
    const id = (req.body && req.body.data && req.body.data.id) || req.query.id;
    if ((topic === 'payment' || topic === 'merchant_order') && id && process.env.MP_ACCESS_TOKEN) {
      const r = await fetch(`https://api.mercadopago.com/v1/payments/${id}`, { headers: { Authorization: 'Bearer ' + process.env.MP_ACCESS_TOKEN } });
      const pay = await r.json().catch(() => ({}));
      if (pay.status === 'approved' && pay.external_reference) {
        const o = loadDB().orders.find(x => x.id === pay.external_reference);
        if (o && o.payment.status !== 'paid') {
          o.payment.status = 'paid'; o.payment.mpId = String(pay.id || id);
          o.timeline.push({ status: o.status, at: new Date().toISOString(), note: 'Pagamento aprovado (Mercado Pago)' });
          saveDB();
        }
      }
    }
  } catch (e) { console.error('webhook MP:', e.message); }
  res.sendStatus(200);
});

/* ---------------- Estáticos ---------------- */
app.use('/uploads', express.static(UPLOAD_DIR));
app.use(express.static(PUBLIC_DIR, {
  setHeaders: (res, p) => { if (String(p).endsWith('.html')) res.setHeader('Cache-Control', 'no-store'); },
}));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  const f = path.join(PUBLIC_DIR, req.path === '/' ? 'index.html' : req.path);
  if (fs.existsSync(f) && fs.statSync(f).isFile()) return res.sendFile(f);
  return res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

loadDB();
app.listen(PORT, '0.0.0.0', () => console.log(`🖨️  PrimePrint rodando em http://localhost:${PORT}`));
