import createCLI from 'yargs';
import { hideBin } from 'yargs/helpers';

async function setupCLI() {
  const yargs = createCLI(hideBin(process.argv));
  const {} =
}

setupCLI();