# 🖨️ PrimePrint — Gráfica Online

Loja completa de gráfica: catálogo com 42 produtos e configurador de preço,
dashboard do cliente (pedidos, artes, endereços, cupons) e painel admin
(produtos, pedidos/kanban, banners, cupons, clientes, relatórios).

## ▶️ Rodar local

```bash
npm install
node server.js
# http://localhost:3000
```

Logins de demonstração (criados no seed):

| Perfil  | E-mail                   | Senha    |
|---------|--------------------------|----------|
| Admin   | admin@primeprint.com.br  | admin123 |
| Cliente | demo@primeprint.com.br   | demo123  |

## ☁️ Publicar com link permanente (Render — grátis)

1. Suba este repo para o GitHub.
2. Crie conta em https://render.com (grátis, sem cartão).
3. **New → Web Service →** conecte o repositório.
4. O Render detecta o `render.yaml` sozinho — é só confirmar e dar **Deploy**.
5. Pronto: você ganha um link permanente tipo `https://primeprint.onrender.com`.

> **Nota (plano grátis):** o banco é um arquivo JSON e os uploads ficam no
> disco temporário — os dados reiniciam a cada novo deploy, e o site "dorme"
> após ~15 min sem acesso (acorda em ~1 min). Para produção real, use um
> banco externo (ex: Render Postgres) + disco persistente.

## 🐳 Rodar com Docker

```bash
# descompacte o zip, entre na pasta e suba:
docker compose up --build -d
# http://localhost:3000
```

Os dados (banco + uploads) ficam em volumes Docker e sobrevivem a
reinicializações. Para trocar o segredo JWT: `JWT_SECRET=meusegredo docker compose up -d`.

## 🛠️ Stack

Node.js + Express (sem build), dados em JSON, upload com Multer, auth JWT.
