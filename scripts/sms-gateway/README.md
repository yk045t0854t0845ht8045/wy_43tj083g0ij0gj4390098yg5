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
```

## 3) Run gateway

```bash
node termux-gateway.js
```

Health check:

```bash
curl http://127.0.0.1:8787/health
```

## 4) Backend .env (your Next app)

```env
SMS_PROVIDER=selfhost,console
SMS_WEBHOOK_URL=http://<IP_DO_CELULAR_NA_REDE>:8787/send
SMS_WEBHOOK_TOKEN=<mesmo_token_do_termux>
SMS_WEBHOOK_SIGNING_SECRET=<mesmo_secret_do_termux>
SMS_OWN_NUMBER=+5511937250986
SMS_WEBHOOK_MAX_RETRIES=3
SMS_WEBHOOK_RETRY_BASE_MS=400
SMS_TIMEOUT_MS=15000
SMS_DRY_RUN=0
SMS_DEV_CONSOLE_FALLBACK=1
SMS_INTERNAL_API_KEY=<chave_forte_para_endpoints-internos>
```

## Notes

- Keep the phone unlocked and with battery optimization disabled for Termux.
- Grant SMS permission to Termux and Termux:API.
- If your backend runs in cloud, it must reach the phone URL (public tunnel or VPN).
