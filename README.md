# Veikon ERP

An in-house ERP (Enterprise Resource Planning) system built for a Brazilian small-to-mid-size engineering company. Designed to replace manual spreadsheet workflows with a centralized system for easier tracking and a holistic overview of business operations.

## Tech Stack

- **Frontend:** HTML, CSS, JavaScript (Vanilla)
- **Backend:** Node.js + Express.js
- **Database:** SQLite (better-sqlite3)
- **PDF Generation:** wkhtmltopdf
- **Rich Text Editor:** Quill.js
- **Process Manager:** PM2

## Modules

- **Gestão de Fornecedores** — Supplier registration, search, and management

Screenshot of the Supplier consultation screen:
<img width="1874" height="445" alt="image" src="https://github.com/user-attachments/assets/f1196e5f-ab58-42bd-bf44-07ea56369b8e" />

- **Cotações** — Quotation management with rich text editor, revision control, automatic population of requester information fields, status workflow, and PDF generation

Screenshot of the quotation form:
<img width="946" height="473" alt="image" src="https://github.com/user-attachments/assets/51408f02-2aba-4c19-827f-e10bca5ca509" />

Screenshot of the Quotation consultation screen:
<img width="1851" height="549" alt="image" src="https://github.com/user-attachments/assets/1d940a3a-863b-4772-a1ae-388e23b9220a" />

- **Pedidos de Compra** — Purchase order management with item tracking, order cloning for repeat orders, automatic population of supplier and requester information fields, invoice linking, and PDF generation

Screenshot of the PO form:
<img width="970" height="582" alt="image" src="https://github.com/user-attachments/assets/c8c2c0f6-9435-417b-94b6-c4b2eab6212c" />

Screenshot of the PO consultation screen:
<img width="1852" height="517" alt="image" src="https://github.com/user-attachments/assets/d27c5e24-474d-4e83-9f97-20861dced7d3" />

## Features

- Multi-currency support (BRL, USD, EUR)
- Status workflow with full accountability logging
- Quotation revision history with read-only previous versions
- Professional PDF generation with repeating header and footer
- Due date tracking with color-coded urgency indicators
- Date range filtering and real-time search on all list pages
- Auto-start on boot via PM2

## Prerequisites

- Node.js v20+
- wkhtmltopdf 0.12.6
- npm

## Installation

1. Clone the repository:
```bash
git clone https://github.com/your-username/your-repo-name.git
cd your-repo-name
```

2. Install dependencies:
```bash
npm install
```

3. Configure the server IP in frontend JS files — replace `localhost` with your server IP if deploying to a network server.

4. Install wkhtmltopdf from https://wkhtmltopdf.org/downloads.html

5. Start the server:
```bash
npm run dev
```

6. Access the system at `http://localhost:3000`

## Production Deployment

To run the server as a background service that auto-starts on boot:

```bash
npm install -g pm2
npm install -g pm2-windows-startup
pm2 start backend/server.js --name "veikon-erp"
npx pm2-windows-startup install
pm2 save
```

## Project Structure
<img width="429" height="267" alt="image" src="https://github.com/user-attachments/assets/13dc1380-6472-4c50-8fd3-5ab680b2292d" />

## License
Private — All rights reserved.

