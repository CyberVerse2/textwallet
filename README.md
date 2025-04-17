# Textwallet

![text wallet](<Screen Shot 2025-04-14 at 1.50.20 AM.png>)
TextWallet is a modular network of interoperable DeFi agents designed to bring the full functionality of EVM-compatible crypto wallets (and more) to a text-based interface. Interact with DeFi protocols, manage assets, conduct research, and get portfolio insights, all through text commands.

## Features

- **Text-Based Wallet Operations:** Perform standard EVM wallet actions (send, receive) via text.
- **DeFi Interaction:**
  - Stake tokens.
  - Add liquidity to protocols.
- **Portfolio Management:** Get an overview and insights into your wallet's portfolio.
- **Token Research:** Conduct research on specific tokens.
- **Modular & Interoperable:** Built as a network of agents for extensibility.

## Tech Stack

- **Framework:** [Next.js](https://nextjs.org/) 15.2.4
- **Library:** [React](https://reactjs.org/) 19

## Getting Started

Follow these instructions to set up and run the project locally.

### Prerequisites

- Node.js (Check `.nvmrc` or `package.json` engines field if specified, otherwise use a recent LTS version)
- npm or yarn or pnpm

### Installation

1. Clone the repository:

   ```bash
   git clone <your-repository-url>
   cd textwallet
   ```

2. Install dependencies:

   ```bash
   npm install
   # or
   yarn install
   # or
   pnpm install
   ```

   **Note:** If you encounter peer dependency conflicts, particularly related to `date-fns` and `react-day-picker`, you might need to use the `--legacy-peer-deps` flag:

   ```bash
   npm install --legacy-peer-deps
   # or
   yarn install --legacy-peer-deps
   # or
   pnpm install --legacy-peer-deps
   ```

### Running the Development Server

Start the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Known Issues

- There was a known dependency conflict between `date-fns` v4.1.0 and `react-day-picker` v8.10.1 (which requires `date-fns` v2 or v3). Installing dependencies using the `--legacy-peer-deps` flag is the current workaround.

## Contributing

Contributions are welcome! Please follow the standard fork and pull request workflow.
