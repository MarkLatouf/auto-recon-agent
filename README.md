# AI Reconciliation Agent (Financial Base & Proof of Concept)

A multi-tiered, AI-powered reconciliation engine designed to automate the matching of Bank Statements against General Ledger entries. By combining deterministic financial rules with Google Gemini's semantic analysis, this tool drastically reduces manual reconciliation time and catches edge cases that traditional exact-match systems miss.

### 🧬 A Foundation for Any Niche

While this repository is configured out-of-the-box for Accounting (matching financial transactions, dates, and monetary amounts), its underlying architecture is built as a flexible **Proof of Concept (PoC)**. 

The reconciliation engine can be quickly adapted to solve matching problems in entirely different industries. By swapping the CSV column mappings and updating the AI prompt constraints, this base can be transformed into:
* **Manufacturing & Operations:** Reconciling machine maintenance logs against production yield data (e.g., matching repair costs to subsequent shift output).
* **Supply Chain:** Matching vendor shipping manifests against warehouse receiving logs.
* **Human Resources:** Reconciling employee roster databases against third-party payroll provider outputs.
* **Healthcare:** Pairing patient treatment logs with insurance billing codes.

### ✨ Core Features

* **Tier 1 (Exact Match):** Instantly pairs records with identical identifiers, dates, and amounts.
* **Tier 2 (Fuzzy / Range Match):** Pairs records based on acceptable date offsets (e.g., clearing delays) and minor monetary variances.
* **Tier 3 (AI Semantic Match):** Uses Gemini AI to evaluate unmatched, complex edge cases by reading human-written descriptions, reference notes, and contextual clues.
* **AI Reasoning Generation:** Explains *why* two seemingly unrelated lines are a match in plain English.
* **Executive Export:** One-click export to CSV or PDF for final sign-off.

### 🛠️ Tech Stack

* **Language:** TypeScript
* **Frontend:** Next.js (React), Tailwind CSS
* **Backend:** Next.js API Routes (Serverless)
* **Hosting:** Vercel
* **Database & Auth:** Supabase (PostgreSQL)
* **AI Processing:** Google Gemini API (`gemini-1.5-flash` / `gemini-2.5-flash`)
* **Data Parsing:** PapaParse (Client-side CSV processing)

### 🚀 Getting Started (Live Demo)

You can test the live proof of concept directly in your browser without any installation:

1. **Visit the Live App:** auto-recon-agent-j4fa4qdy3-mark-latouf.vercel.app
2. **Authenticate:** Sign up or log in using the email authentication. 
3. **Upload Data:** Upload your sample Bank Statement and General Ledger CSV files (or the operational equivalents for your niche).
4. **Run the Audit:** Click **Auto-Match** to run the multi-tiered pipeline and watch the AI reconcile complex edge cases in real-time.
5. **Export:** Click **Export Match to CSV** to generate a CSV.

### 🚀 Getting Started (Live Demo)

You can test the live proof of concept directly in your browser without any installation:

1. **Visit the Live App:** auto-recon-agent-j4fa4qdy3-mark-latouf.vercel.app
2. **Authenticate:** Sign up or log in using email authentication. 
3. **Upload Data:** Upload your sample Bank Statement and General Ledger CSV files (or operational equivalents).
4. **Run the Audit:** Click **Auto-Match** to run the multi-tiered pipeline and watch the AI reconcile complex edge cases in real-time.
5. **Export:** Click **Export Executive PDF** to generate a presentation-ready summary.

### 💻 Local Developer Setup

If you want to run this project locally to customize the data schema or AI matching logic, follow these steps:

1. **Clone the repository:**
   git clone https://github.com/MarkLatouf/recon-agent-base.git
   cd recon-agent-base

2. **Install dependencies:**
   npm install

3. **Configure Environment Variables:**
   Create a .env.local file in the root directory and add:
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   GEMINI_API_KEY=your_google_gemini_api_key

4. **Run the development server:**
   npm run dev

### 📁 Sample Data & Required Columns

For the engine to successfully auto-match, your uploaded CSV files must contain specific headers. 

You can find ready-to-use example files in the `samples` folder of this repository. If you are creating your own data, ensure your columns match the following structure:

**Bank Statement CSV**
* Date
* Description
* Amount
* Reference (Optional)

**General Ledger CSV**
* Date
* Description
* Amount
* Reference (Optional)

*(Note: If you are adapting this proof of concept for a different niche, you will need to update the CSV parsing logic in the frontend components and the matching engine payload to reflect your new column names).*
