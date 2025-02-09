import { ethers } from 'ethers';
import fetch from 'node-fetch';
import cfonts from 'cfonts';
import chalk from 'chalk';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Helper function for delay
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  try {
    cfonts.say('NT Exhaust', {
      font: 'block',
      align: 'center',
      colors: ['cyan', 'magenta'],
      background: 'black',
      letterSpacing: 1,
      lineHeight: 1,
      space: true,
      maxLength: '0',
    });
    console.log(
      chalk.green(
        '=== Telegram Channel : END AIRDROP ( https://t.me/endingdrop ) ==='
      )
    );

    const rpcUrl = process.env.RPC_URL;
    const API_URL = process.env.API_URL;
    const PRIVATE_KEYS = process.env.PRIVATE_KEYS?.split(',').filter(Boolean);

    if (!rpcUrl || !API_URL || !PRIVATE_KEYS || PRIVATE_KEYS.length === 0) {
      throw new Error(
        'RPC_URL, API_URL, or PRIVATE_KEYS is missing in the .env file.'
      );
    }

    console.log(`Loaded ${PRIVATE_KEYS.length} wallets.`);

    const wpolAbi = [
      'function approve(address spender, uint256 amount) public returns (bool)',
      'function transfer(address to, uint256 value) public returns (bool)',
    ];
    const wpolAddress = '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270';
    const twpolAddress = '0x1Cd0cd01c8C902AdAb3430ae04b9ea32CB309CF1';
    const amountToSwap = ethers.parseEther('0.00015');
    const loops = 100000;

    let walletIndex = 0;

    for (let i = 1; i <= loops; i++) {
      console.log(`\n🔁 Loop ${i} of ${loops}`);

      // Rotate wallets
      const privateKey = PRIVATE_KEYS[walletIndex];
      walletIndex = (walletIndex + 1) % PRIVATE_KEYS.length;

      const provider = new ethers.JsonRpcProvider(rpcUrl);
      const wallet = new ethers.Wallet(privateKey, provider);

      console.log('Using Wallet Address:', wallet.address);

      // Check balance
      const balance = await provider.getBalance(wallet.address);
      console.log(
        'Wallet Balance (in MATIC):',
        ethers.formatUnits(balance, 'ether')
      );

      if (balance < amountToSwap) {
        console.error(
          'Insufficient MATIC balance for the transaction. Skipping...'
        );
        continue;
      }

      const wpolContract = new ethers.Contract(wpolAddress, wpolAbi, wallet);

      let retry = true;
      while (retry) {
        try {
          // Approve transaction for swapping WPOL to tPOL
          console.log('Approving WPOL for swap...');
          const approveTx = await wpolContract.approve(
            twpolAddress,
            amountToSwap
          );
          console.log('✅ Approval TX sent! Hash:', approveTx.hash);
          await approveTx.wait();

          // Swap WPOL to tPOL
          console.log('Swapping WPOL to tPOL...');
          const swapTx = await wpolContract.transfer(
            twpolAddress,
            amountToSwap
          );
          console.log('✅ Swap TX sent! Hash:', swapTx.hash);
          await swapTx.wait();

          // Prepare API payload
          const payload = {
            blockchainId: 137,
            type: 2,
            walletAddress: wallet.address,
            hash: swapTx.hash,
            fromTokenAddress: wpolAddress,
            toTokenAddress: twpolAddress,
            fromTokenSymbol: 'WPOL',
            toTokenSymbol: 'tPOL',
            fromAmount: amountToSwap.toString(),
            toAmount: amountToSwap.toString(),
            gasFeeTokenAddress: '0x0000000000000000000000000000000000000000',
            gasFeeTokenSymbol: 'POL',
            gasFeeAmount: '8055000012888000',
          };

          // Send API request without proxy
          const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
              Accept: 'application/json, text/plain, */*',
              'Content-Type': 'application/json',
              'User-Agent': 'Mozilla/5.0',
              Origin: 'https://app.tea-fi.com',
              Referer: 'https://app.tea-fi.com/',
            },
            body: JSON.stringify(payload),
          });

          if (!response.ok) {
            const errorText = await response.text();
            console.error(`❌ API Error: ${response.status} - ${errorText}`);
            retry = false;
          } else {
            const result = await response.json();
            console.log('✅ API Response:', result);
            retry = false;
          }
        } catch (error) {
          console.error(`❌ Error:`, error.message);
          if (error.message.includes('Too many requests')) {
            console.log('⏳ Rate limit hit. Retrying in 1 minute...');
            await delay(60000);
          } else {
            retry = false;
          }
        }
      }

      console.log('🕐 Waiting 5 second before next transaction...');
      await delay(5000);
    }
  } catch (error) {
    console.error('Error:', error.reason || error.message);
  }
}

main();
