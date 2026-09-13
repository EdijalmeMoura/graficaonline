# 🖨️ PrimePrint — Gráfica Online

Loja de gráfica online estilo **Imprima por Menos**, com **dashboard do cliente** e **painel administrativo** completos.

## ✨ O que foi construído

### 🛍️ Loja (pública)
- Home com banner rotativo, categorias, mais vendidos, benefícios, como funciona, depoimentos, FAQ
- Catálogo com **busca, filtros por categoria e ordenação**
- Página de produto com **configurador e calculadora de preço** (formato, papel, cor, acabamento, quantidade, prazo)
- Carrinho lateral + página de carrinho + **checkout completo** (endereço, frete, cupom, Pix/cartão/boleto simulados)
- Upload de arte no pedido
- Páginas institucionais: Quem somos, Gabaritos, Criação e envio, Dúvidas, Fale conosco, Políticas
- Login / Cadastro de clientes

### 👤 Dashboard do Cliente (`/conta.html`)
- Visão geral (pedidos ativos, concluídos, economia, ticket)
- Meus pedidos com **timeline de status**, reenvio de arte, repetir pedido, rastreio
- Meus arquivos/artes, endereços, meus dados, favoritos, cupons

### 🛠️ Painel do Administrador (`/admin.html`)
- Dashboard com **KPIs, gráfico de vendas, top produtos, alertas**
- Pedidos (filtros, detalhe, troca de status, aprovar/reprovar arte, rastreio)
- Produção em **kanban**
- Produtos e categorias (CRUD completo)
- Clientes, cupons, banners, relatórios (exportar CSV) e configurações da loja

## 🚀 Como rodar

```bash
cd grafica-prime
npm install
npm start
```

Acesse: **http://localhost:3000**

> O banco de dados é um arquivo JSON (`data/db.json`) criado automaticamente com dados de demonstração.
> Para resetar, apague `data/db.json` e reinicie o servidor.

## 🔑 Acessos de demonstração

| Perfil | E-mail | Senha |
|---|---|---|
| Administrador | `admin@primeprint.com.br` | `admin123` |
| Cliente demo | `cliente@demo.com` | `demo123` |

## 🧱 Estrutura do projeto

```
grafica-prime/
├── server.js          # Backend: API REST + servidor de arquivos
├── package.json
├── data/db.json       # Banco (gerado automaticamente + seed)
├── uploads/           # Artes enviadas pelos clientes
└── public/            # Frontend (HTML + CSS + JS, sem build)
    ├── index.html     # Home
    ├── produtos.html  # Catálogo
    ├── produto.html   # Configurador do produto
    ├── carrinho.html  # Carrinho
    ├── checkout.html  # Finalizar compra
    ├── login.html     # Entrar / Cadastrar
    ├── conta.html     # Dashboard do cliente
    ├── admin.html     # Painel do admin
    ├── pagina.html    # Páginas institucionais (?p=quem-somos etc.)
    ├── css/
    │   ├── style.css  # Design system + loja
    │   └── dash.css   # Dashboards (cliente + admin)
    └── js/
        ├── app.js     # Núcleo: API, auth, carrinho, layout, utils
        ├── shop.js    # Lógica da loja (home, catálogo, produto, checkout)
        ├── conta.js   # Dashboard do cliente
        └── admin.js   # Painel administrativo
```

## 🌐 Como hospedar depois

- **VPS / HostGator / cPanel com Node:** envie a pasta, rode `npm install --production` e `npm start` (use PM2). Aponte o domínio para a porta 3000 via proxy reverso.
- **Render / Railway / Easypanel:** crie um serviço Node apontando para este repositório, comando de start `npm start`.
- **Banco real:** a camada `loadDB/saveDB` no `server.js` centraliza o acesso a dados — troque por Postgres/MySQL quando crescer.
- **Pagamento real:** integre Mercado Pago / Stripe / PagSeguro no endpoint `POST /api/orders` e no checkout.

## 📦 Próximos passos sugeridos
1. Trocar os ícones dos produtos por fotos reais (`image` no cadastro de produto).
2. Integrar gateway de pagamento e cálculo de frete dos Correios/Melhor Envio.
3. E-mail transacional (confirmação de pedido, arte aprovada).
