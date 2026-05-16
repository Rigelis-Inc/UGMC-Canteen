# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.

## SMS Delivery Bridge

Delivered meal orders now call the SMS bridge from the Vite dev server. The bridge sends the message immediately, so you only need to mark an order as `DELIVERED`.

1. Keep the SMS values in `.env.local`.
2. For the NALO public API, set `SMS_PROVIDER_URL`, `SMS_PROVIDER_USERNAME`, `SMS_PROVIDER_PASSWORD` or `SMS_PROVIDER_KEY`, and `SMS_SENDER_ID`.
3. If you want local dev to skip the Vite bridge, set `VITE_SMS_DELIVERY_ENDPOINT` to the deployed Cloud Function URL.
4. Run `npm run dev` as usual.
5. When an order becomes `DELIVERED`, the app posts to the SMS endpoint and the request is forwarded to the provider.

The patient support number in the SMS body still comes from the meal settings page.

## Firebase SMS Deploy

The Firebase Hosting rewrite for `/api/sms/delivered` is ready in `firebase.json`, and the Cloud Function lives in `functions/`.

Before deploying the SMS path live, make sure:

1. The Cloud Functions API is enabled for the Firebase project.
2. `SMS_PROVIDER_KEY` is set as a Firebase secret, or set `SMS_PROVIDER_PASSWORD` if you are using a separate password variable.
3. `SMS_PROVIDER_USERNAME` is set as a Firebase secret.
4. `SMS_PROVIDER_URL` points to the public NALO endpoint. If it is omitted, the function now defaults to `https://sms.nalosolutions.com/smsbackend/clientapi/Resl_Nalo/send-message/`.

If you want, I can take the next deploy step once the Cloud Functions API is enabled and the provider URL is reachable from Firebase.
