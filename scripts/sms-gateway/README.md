# SMS Gateway (Own Number, No Paid API)

This gateway lets you send SMS using your own SIM number on Android via Termux.
No Twilio, no paid API, no external account required.

## 1) Install on Android

- Install `Termux` (F-Droid recommended)
- Install `Termux:API`
- In Termux:

```bash
npm update -y
npm install -y nodejs termux-api
```

## 2) Configure env on phone (Termux)

```bash
export SMS_GATEWAY_PORT=8787
export SMS_WEBHOOK_TOKEN="<same token used in backend .env>"
export SMS_WEBHOOK_SIGNING_SECRET="<same secret used in backend .env>"
export SMS_OWN_NUMBER="+5511937250986"
export SMS_GATEWAY_SEND_TIMEOUT_MS=12000
export SMS_GATEWAY_ALLOW_SELF_SEND=0
```

## 3) Run gateway

```bash
node termux-gateway.js
```

Health check:

```bash
curl http://127.0.0.1:8787/health
```

Important:
- Opening `http://IP:8787/send` in browser is `GET` and will not send SMS.
- SMS send endpoint is `POST /send` only.

Quick send test (same LAN, from your backend machine):

```bash
curl -X POST "http://<IP_DO_CELULAR_NA_REDE>:8787/send" \
  -H "Authorization: Bearer <SMS_WEBHOOK_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"to":"+5511999999999","code":"1234567","message":"Wyzer - Seu codigo de verificacao: 1234567"}'
```

Diagnostics (requires bearer token):

```bash
curl -H "Authorization: Bearer $SMS_WEBHOOK_TOKEN" http://127.0.0.1:8787/diag
```

## 4) Backend .env (your Next app)

```env
SMS_PROVIDER=selfhost,console
SMS_WEBHOOK_URL=http://<IP_DO_CELULAR_NA_REDE>:8787/send
SMS_WEBHOOK_TOKEN=<mesmo_token_do_termux>
SMS_WEBHOOK_SIGNING_SECRET=<mesmo_secret_do_termux>
SMS_OWN_NUMBER=+5511937250986
SMS_WEBHOOK_MAX_RETRIES=2
SMS_WEBHOOK_RETRY_BASE_MS=350
SMS_TIMEOUT_MS=12000
SMS_AUTH_TIMEOUT_MS=5000
SMS_AUTH_WEBHOOK_MAX_RETRIES=1
SMS_AUTH_WEBHOOK_RETRY_BASE_MS=250
SMS_DRY_RUN=0
SMS_DEV_CONSOLE_FALLBACK=0
SMS_AUTH_ALLOW_CONSOLE_FALLBACK=0
SMS_EXPOSE_PROVIDER_ERRORS=1
SMS_BLOCK_SELF_SEND=0
SMS_INTERNAL_API_KEY=<chave_forte_para_endpoints-internos>
```

## Notes

- Keep the phone unlocked and with battery optimization disabled for Termux.
- Grant SMS permission to Termux and Termux:API.
- Validate local send directly in Termux: `termux-sms-send -n +55DDDNUMERO "teste"`.
- Sending SMS to the same number as the gateway SIM can fail depending on carrier. By default this is blocked.
- If your app backend is deployed in cloud, it cannot reach private LAN IP (`192.168.x.x`). Use VPN/tunnel/public endpoint.
- If your backend runs in cloud, it must reach the phone URL (public tunnel or VPN).
