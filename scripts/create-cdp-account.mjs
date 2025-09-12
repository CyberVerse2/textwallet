import { CdpClient } from '@coinbase/cdp-sdk';

async function main() {
  try {
    if (process.env.CDP_SERVER_EVM_ADDRESS) {
      console.log(JSON.stringify({ address: process.env.CDP_SERVER_EVM_ADDRESS, fromEnv: true }));
      return;
    }
    const cdp = new CdpClient();
    const account = await cdp.evm.createAccount();
    console.log(JSON.stringify({ address: account.address, created: true }));
  } catch (e) {
    console.error('CDP create account error:', e?.message || e);
    process.exit(1);
  }
}

main();
