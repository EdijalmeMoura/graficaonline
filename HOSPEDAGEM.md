# 🌐 Como hospedar sua gráfica (link fixo, grátis p/ começar)

## Opção 1 — Render (recomendado, grátis) ⭐

1. Crie uma conta em **https://render.com** e conecte seu GitHub.
2. Suba este projeto para um repositório no GitHub (`grafica-prime`).
3. No Render: **New + → Web Service →** selecione o repositório.
4. Configurações:
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Instance:** Free
5. Em **Environment**, adicione:
   - `JWT_SECRET` = uma frase secreta longa qualquer
   - `PUBLIC_URL` = a URL que o Render te der (ex: `https://sua-grafica.onrender.com`)
   - `MP_ACCESS_TOKEN` = seu token do Mercado Pago (quando for vender de verdade)
6. **Deploy!** Seu link fixo estará no ar em ~2 minutos. ✅

> ⚠️ No plano grátis, o banco `data/db.json` **zera a cada novo deploy**. Para produção séria, use o **Persistent Disk** do Render (plano pago, ~US$6/mês) apontando para `/opt/render/project/src/data` — ou migre para Postgres (a camada `loadDB/saveDB` centraliza isso).

## Opção 2 — Railway (grátis p/ testar)

1. Conta em **https://railway.app** → **New Project → Deploy from GitHub**.
2. Selecione o repositório. O Railway detecta o Node sozinho.
3. Em **Variables**, adicione as mesmas variáveis acima.
4. Em **Settings → Networking**, gere o domínio público. ✅

## Opção 3 — VPS / Hospedagem com Node (HostGator, DigitalOcean...)

```bash
# No servidor:
git clone SEU-REPOSITORIO && cd grafica-prime
npm install --production
JWT_SECRET=sua-frase PORT=3000 node server.js
# Recomendado: usar PM2 (npm i -g pm2 && pm2 start server.js)
```

Aponte o domínio (ex: `www.suagrafica.com.br`) para o servidor via proxy reverso (Nginx/Apache) na porta 3000.

## 🔒 Checklist antes de vender de verdade

- [ ] Trocar `JWT_SECRET` por algo único e secreto
- [ ] Configurar `MP_ACCESS_TOKEN` do Mercado Pago ([ver PAGAMENTOS.md](PAGAMENTOS.md))
- [ ] Cadastrar nome/telefone/WhatsApp reais em **Admin → Configurações**
- [ ] Revisar preços, prazos e valor do frete
- [ ] (Opcional) Apontar domínio próprio + HTTPS (Render/Railway dão HTTPS grátis)
