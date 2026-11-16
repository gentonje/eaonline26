# M-Pesa Daraja sandbox setup

East Africa Online will use Safaricom Daraja's sandbox until checkout, payment callbacks,
and reconciliation have passed the test plan. Sandbox credentials must never be used in
production, and production credentials must never be copied into preview environments.

## 1. Create a Daraja developer app

1. Open https://developer.safaricom.co.ke/ and sign up or log in.
2. Create a new application in the sandbox environment.
3. Enable the M-Pesa Express / Lipa Na M-Pesa Online API for the application.
4. Copy the application's Consumer Key and Consumer Secret from its dashboard.
5. Open the API's sandbox test credentials and note the Business Short Code and Passkey
   shown for the sandbox. Use the values shown by Safaricom for your app/API.

Do not send credentials in chat, commit them to Git, or put them in any Expo
EXPO_PUBLIC_* variable. They are server-side secrets.

## 2. Server-side environment variables

Configure these only on the server environment used by the checkout API:

| Variable | Sandbox value |
| --- | --- |
| MPESA_ENVIRONMENT | sandbox |
| MPESA_CONSUMER_KEY | Consumer Key from your Daraja app |
| MPESA_CONSUMER_SECRET | Consumer Secret from your Daraja app |
| MPESA_SHORTCODE | Sandbox Business Short Code shown by Safaricom |
| MPESA_PASSKEY | Sandbox Lipa Na M-Pesa Passkey shown by Safaricom |
| MPESA_CALLBACK_URL | Public HTTPS URL for the payment callback endpoint |

The sandbox API base URL is https://sandbox.safaricom.co.ke. Production uses a
different base URL and separate credentials; the application must fail closed rather
than silently switch environments or simulate a successful payment.

## 3. Callback requirements

The callback URL must be publicly reachable over HTTPS. Safaricom sends the result to
this endpoint after the customer approves or cancels the STK request. The callback
handler must match the CheckoutRequestID to a pending payment, process a payment only
once, validate the amount and phone where callback data provides them, and mark the
order paid only after a successful Daraja result. A browser redirect or the initial
STK request response is not proof of payment.

## 4. Sandbox test checklist

- OAuth token generation succeeds using the sandbox host.
- STK Push request is accepted and returns a CheckoutRequestID.
- Successful callback marks exactly one payment and its order as paid.
- Cancelled/failed callback leaves the order unpaid.
- Duplicate callback does not duplicate any payment, wallet credit, or order update.
- Unknown CheckoutRequestID is acknowledged safely and does not change any order.
- A pending payment remains pending until a verified callback or reconciliation result.
- No sandbox payment moves real money.

## 5. Deployment boundary

The frontend must never receive Daraja secrets. The payment initiation and callback
routes must run in a server-side environment with secure environment variables and
Supabase service-role access. The current Vercel configuration exports the Expo web
frontend as static files; before enabling M-Pesa from the deployed preview, the payment
API must be deployed as a server-side function or a separately hosted API and the
frontend's same-origin API routing must point to it.
