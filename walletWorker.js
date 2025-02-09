import { parentPort, workerData } from 'worker_threads';
import { ethers } from 'ethers';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config();

// Helper function for delay
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function processWallet(privateKey) {
  try {
    const rpcUrl = process.env.RPC_URL;
    const API_URL = process.env.API_URL;

    if (!rpcUrl || !API_URL) {
      throw new Error('RPC_URL or API_URL is missing in the .env file.');
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(privateKey, provider);

    console.log(chalk.blue(`Processing wallet: ${wallet.address}`));

    // Check balance
    const amountToSwap = ethers.parseEther('0.00015');
    const balance = await provider.getBalance(wallet.address);
    console.log(
      chalk.yellow(
        `Wallet Balance (in MATIC): ${ethers.formatUnits(balance, 'ether')}`
      )
    );

    if (balance < amountToSwap) {
      throw new Error('Insufficient MATIC balance for the transaction.');
    }

    // Contract details
    const wpolAbi = [
      'function approve(address spender, uint256 amount) public returns (bool)',
      'function transfer(address to, uint256 value) public returns (bool)',
    ];
    const wpolAddress = '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270';
    const twpolAddress = '0x1Cd0cd01c8C902AdAb3430ae04b9ea32CB309CF1';

    const wpolContract = new ethers.Contract(wpolAddress, wpolAbi, wallet);

    // Approve and swap tokens
    console.log(chalk.blue('Approving WPOL for swap...'));
    const approveTx = await wpolContract.approve(twpolAddress, amountToSwap);
    console.log(chalk.green(`✅ Approval TX sent! Hash: ${approveTx.hash}`));
    await approveTx.wait();

    console.log(chalk.blue('Swapping WPOL to tPOL...'));
    const swapTx = await wpolContract.transfer(twpolAddress, amountToSwap);
    console.log(chalk.green(`✅ Swap TX sent! Hash: ${swapTx.hash}`));
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

    // Send API request
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
      throw new Error(`API Error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    console.log(chalk.green('✅ API Response:', result));

    parentPort.postMessage(
      `Completed processing for wallet: ${wallet.address}`
    );
  } catch (error) {
    console.error(chalk.red(`❌ Error processing wallet:`, error.message));
    parentPort.postMessage(`Error processing wallet: ${error.message}`);
  }
}

// Start processing the wallet
processWallet(workerData.privateKey);
