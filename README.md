# MedRescue System

MedRescue System is a local, full stack medicine inventory and expiry risk demo for two roles: Admin and Hospital Staff. The included hospitals, users, stock, demand, and transfer records are seeded **DEMO DATA**. Rescue recommendations and delivery estimates are calculated from those records; they are not verified real world activity.

## Requirements

- Python 3.11 or newer
- Node.js 20 or newer and npm

## Start the backend

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
alembic upgrade head
python -m app.seed
uvicorn app.main:app --reload
```

The API runs at `http://localhost:8000`; interactive documentation is at `http://localhost:8000/api/docs`. SQLite is the default database. Set `DATABASE_URL` in `backend/.env` to use another SQLAlchemy supported database.

## Start the frontend

In another terminal:

```powershell
cd frontend
npm install
npm run dev
```

Open the URL printed by Vite (normally `http://localhost:5173`). Set `VITE_API_URL=http://localhost:8000` in `frontend/.env.local` only if the frontend is not using the Vite development proxy.

## Demo logins

- Admin: `admin@medrescue.com` / `Admin123!`
- Hospital Staff: `staff@medrescue.com` / `Staff123!`

The seed command is idempotent and can be rerun to ensure the demo accounts and sample records exist. It does not reset edited records.

## Configuration

Copy `backend/.env.example` to `backend/.env` and set a unique `SECRET_KEY` before deploying beyond a local demo. Delivery cost defaults, maximum rescue radius, shelf life threshold, and OSRM routing URL are configurable there. If OSRM is unreachable, the backend labels its fallback distance as straight line and does not claim to have retrieved a road route.

## Core behavior

- The backend enforces Admin and Hospital Staff roles and scopes staff data to the assigned facility.
- Expiry levels are calculated against the current date. Expired or blocked stock is excluded from rescue eligibility.
- FEFO recommendations prioritize the earliest eligible expiry.
- Transfers move through approval, dispatch, receipt, and cancellation endpoints. Only receipt-confirmed quantities count as rescued.
- Reports and dashboards use database records. The assistant is rule based and reports when requested information is unavailable.
- Quantity forecasts use recorded demand dates, bed capacity, Indian season buckets, and current unexpired stock. Forecasts require at least 8 records across 6 months and 180 days; sparse history returns no quantity. Forecast support is a data-coverage label, not an accuracy guarantee.
- Optional assistant explanations can use OpenAI or Claude. The LLM explains database facts, while the numbers remain computed by the backend. Add `OPENAI_API_KEY` and/or `ANTHROPIC_API_KEY` to `backend/.env`; choose the provider in the assistant UI. Keys stay on the server.
- Newly entered hospitals are inactive until an administrator checks the PM-JAY directory and records a manual confirmation. The public project has no direct NHA/PM-JAY verification API integration; the verification label identifies this manual check and does not claim an automated government response.

Quantity history can be entered from the staff batch page under **Record demand history**. Enter observed demand and its actual date; do not use forecast values as historical observations.

## Medicine checkout and admin wallet

Only a signed-in, active Hospital Staff account that an administrator has assigned to an active facility can open `/shop` and pay for medicine. The catalog and purchasable stock are restricted to that staff member's assigned hospital; buyer identity and delivery facility are taken from the authenticated account. Admins create/manage staff access and can manage wallet withdrawals. Staff can pay for in-stock medicines with Razorpay Checkout or a manual UPI transfer.

For Razorpay, create an account, use test keys during development, and set these backend environment values in `backend/.env`:

```env
RAZORPAY_KEY_ID=rzp_test_...
RAZORPAY_KEY_SECRET=...
RAZORPAY_WEBHOOK_SECRET=...
```

Enable automatic payment capture in Razorpay, then register `POST https://<your-public-api>/api/shop/webhook` for the `payment.captured` event. The backend verifies Razorpay's checkout signature and captured payment before decrementing batch stock or crediting the wallet.

For manual UPI, open **Payments & Wallet** as an admin and save the receiving UPI ID under **Buyer payment collection**. The authorized staff buyer creates an order, opens their UPI app using the generated payment link (or enters the UPI ID and payment note manually), pays the exact amount, then submits the UTR shown by their app. An admin must check the real bank/UPI transaction and select **Verify & credit** before the order enters the wallet. Unpaid checkout reservations expire after 30 minutes; submitted UPI references stay pending until reviewed. This manual flow records a verified ledger entry but does not automatically confirm transfers or initiate refunds.

An administrator can open **Payments & Wallet** to see captured orders and submitted UPI references, set the platform charge percentage, save UPI/bank payout details, and request a withdrawal. The fee is deducted from the requested gross amount. This screen records the payout request; the admin sends the net amount through their bank/UPI provider and marks the request paid with its transfer reference. Buyer payments settle to the merchant account configured with Razorpay or the saved UPI ID; the app's balance is a verified payment and withdrawal ledger, not a bank account or automatic RazorpayX payout integration.

## Hospital staff account registration

The login page links to **Request a hospital staff account**. Applicants select an active hospital, choose an email as their login ID, set a strong password, and submit a masked government photo ID plus hospital appointment/authorization proof. Applications stay pending; applicants cannot sign in until an administrator opens both files, confirms both checks, and approves the request in **Staff Accounts**. Approval creates the active hospital staff account. Rejected applications require a reason.

Verification is a manual administrator review; the project does not connect to a government personal identity database. Uploaded documents are encrypted on the backend while pending and deleted after approval or rejection. For Aadhaar, applicants must upload a masked copy. Keep `SECRET_KEY` private and stable while pending requests exist so their encrypted files can be opened for review.
