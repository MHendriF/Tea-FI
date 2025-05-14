import { Worker, isMainThread, parentPort, workerData } from 'worker_threads';
import { ethers } from 'ethers';
import fetch from 'node-fetch';
import cfonts from 'cfonts';
import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Mendapatkan __filename dan __dirname di modul ES
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '.env') });

// Helper function for delay
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Worker function to handle each wallet
async function processWallet(
  privateKey,
  rpcUrl,
  API_URL,
  wpolAbi,
  wpolAddress,
  twpolAddress,
  amountToSwap
) {
  try {
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
      return;
    }

    const wpolContract = new ethers.Contract(wpolAddress, wpolAbi, wallet);

    // Approve transaction for swapping WPOL to tPOL
    console.log('Approving WPOL for swap...');
    const approveTx = await wpolContract.approve(twpolAddress, amountToSwap);
    console.log('✅ Approval TX sent! Hash:', approveTx.hash);
    await approveTx.wait();

    // Swap WPOL to tPOL
    console.log('Swapping WPOL to tPOL...');
    const swapTx = await wpolContract.transfer(twpolAddress, amountToSwap);
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
    } else {
      const result = await response.json();
      console.log('✅ API Response:', result);
    }
  } catch (error) {
    console.error(`❌ Error:`, error.message);
  }
}

if (isMainThread) {
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

      // Read wallets from file
      const walletsFilePath = path.join(__dirname, 'wallets.txt');
      const wallets = fs
        .readFileSync(walletsFilePath, 'utf8')
        .split('\n')
        .filter(Boolean);

      if (wallets.length === 0) {
        throw new Error('No wallets found in the wallets.txt file.');
      }

      console.log(`Loaded ${wallets.length} wallets.`);

      // Load environment variables
      const rpcUrl = process.env.RPC_URL;
      const API_URL = process.env.API_URL;

      if (!rpcUrl || !API_URL) {
        throw new Error('RPC_URL or API_URL is missing in the .env file.');
      }

      const wpolAbi = [
        'function approve(address spender, uint256 amount) public returns (bool)',
        'function transfer(address to, uint256 value) public returns (bool)',
      ];
      const wpolAddress = '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270';
      const twpolAddress = '0x1Cd0cd01c8C902AdAb3430ae04b9ea32CB309CF1';
      const amountToSwap = ethers.parseEther('0.00015');

      // Create a worker for each wallet
      wallets.forEach((privateKey) => {
        const worker = new Worker(__filename, {
          workerData: {
            privateKey,
            rpcUrl,
            API_URL,
            wpolAbi,
            wpolAddress,
            twpolAddress,
            amountToSwap,
          },
        });

        worker.on('message', (message) => {
          console.log(`Worker message: ${message}`);
        });

        worker.on('error', (error) => {
          console.error(`Worker error: ${error.message}`);
        });

        worker.on('exit', (code) => {
          if (code !== 0) {
            console.error(`Worker stopped with exit code ${code}`);
          }
        });
      });
    } catch (error) {
      console.error('Error:', error.reason || error.message);
    }
  }

  main();
} else {
  // This code runs in the worker thread
  const {
    privateKey,
    rpcUrl,
    API_URL,
    wpolAbi,
    wpolAddress,
    twpolAddress,
    amountToSwap,
  } = workerData;
  processWallet(
    privateKey,
    rpcUrl,
    API_URL,
    wpolAbi,
    wpolAddress,
    twpolAddress,
    amountToSwap
  ).then(() => {
    parentPort.postMessage('Wallet processing completed');
  });
}
