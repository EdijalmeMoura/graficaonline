# 💳 Pagamento real com Mercado Pago

O site já vem com a integração pronta. Sem configurar nada, o checkout usa o **modo simulação** (ideal para testar). Para cobrar de verdade:

## Passo 1 — Criar conta e pegar o token

1. Crie sua conta em **https://www.mercadopago.com.br** (é grátis).
2. Ative suas **credenciais de produção**: Painel Dev → Credenciais → **Access Token** (começa com `APP_USR-...`).
3. Para testar sem dinheiro real, use as credenciais de **TESTE** primeiro.

## Passo 2 — Configurar no servidor

Crie um arquivo `.env` na raiz do projeto (ou adicione nas variáveis da hospedagem):

```bash
MP_ACCESS_TOKEN=APP_USR-seu-token-aqui
PUBLIC_URL=https://sua-grafica.onrender.com
JWT_SECRET=uma-frase-secreta-longa
```

Reinicie o servidor. Pronto! 🎉

## Como funciona

- No checkout, se o `MP_ACCESS_TOKEN` estiver configurado, o cliente é redirecionado automaticamente para o **Checkout Pro do Mercado Pago** (Pix, cartão em até 12x, boleto).
- Após pagar, ele volta para a área de pedidos.
- O **webhook** (`/api/pay/mp-webhook`) marca o pedido como **pago** automaticamente quando o MP confirma. Para o webhook funcionar, configure a URL de notificação no painel do MP apontando para `https://SEU-DOMINIO/api/pay/mp-webhook`.
- Sem token configurado, o site continua no modo simulação (nada quebra).

## Taxas (referência)

O Mercado Pago cobra ~4,99% no Pix e ~5,31% no crédito à vista (consulte a tabela atual). Considere isso na sua margem! 💰
