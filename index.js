import { Worker } from 'worker_threads';
import fs from 'fs';
import chalk from 'chalk';

// Helper function to create a worker for each wallet
function runWalletWorker(privateKey) {
  return new Promise((resolve, reject) => {
    const worker = new Worker('./walletWorker.js', {
      workerData: { privateKey },
    });

    worker.on('message', (message) => {
      console.log(
        chalk.green(`✅ Wallet ${privateKey.slice(0, 6)}...: ${message}`)
      );
      resolve();
    });

    worker.on('error', (error) => {
      console.error(
        chalk.red(
          `❌ Error in wallet ${privateKey.slice(0, 6)}...:`,
          error.message
        )
      );
      reject(error);
    });

    worker.on('exit', (code) => {
      if (code !== 0) {
        console.error(
          chalk.red(
            `❌ Worker for wallet ${privateKey.slice(
              0,
              6
            )}... exited with code ${code}`
          )
        );
        reject(new Error(`Worker exited with code ${code}`));
      }
    });
  });
}

async function main() {
  try {
    // Read wallets from file
    const wallets = fs
      .readFileSync('wallets.txt', 'utf8')
      .split('\n')
      .filter(Boolean);

    if (wallets.length === 0) {
      throw new Error('No wallets found in the wallets.txt file.');
    }

    console.log(chalk.cyan(`Loaded ${wallets.length} wallets.`));

    // Run all wallets in parallel using workers
    const workerPromises = wallets.map((privateKey) =>
      runWalletWorker(privateKey)
    );

    await Promise.all(workerPromises); // Wait for all workers to finish

    console.log(chalk.green('✅ All wallet tasks completed.'));
  } catch (error) {
    console.error(chalk.red('❌ Fatal Error:', error.message));
  }
}

main();
