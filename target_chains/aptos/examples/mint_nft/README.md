# Example Full-Stack App: 1$ Mint

The example contract is deployed at : `0x19f8503273cdb5aa93ffe4539277684615242127aa2e65ef91424136a316c9c7`

The goal of this contract is managing an NFT mint where the mint is paid in native currency but the cost of one NFT is always 1$.
This example is intended to be run on Aptos testnet because it depends on Pyth and Wormhole existing onchain.

### Important files :

- `./sources/minting.move` has the smart contract logic (the code that will run onchain)
- `./app/src/App.tsx` has the React application. The core logic of how the frontend will interact with the wallet and the blockchain.
  Both combined contain the key pieces of code needed to make an Aptos fullstack app using Pyth!

### How to deploy the smart contract :

- Use `aptos init` with rest_url : `https://testnet.aptoslabs.com/` and faucet `https://faucet.testnet.aptoslabs.com` to generate a new keypair.
- Use a faucet to airdrop testnet APT to your newly created account by calling `aptos account fund-with-faucet --account default`. If this doesn't work, I have had success importing my private key from `.aptos/config.yaml` into Petra and clicking the airdrop button. Otherwise send APT from another account.
- Get your account address from `.aptos/config.yaml` and replace `mint_nft="0x19f8503273cdb5aa93ffe4539277684615242127aa2e65ef91424136a316c9c7"` by `mint_nft="<ADDRESS>"` in `Move.toml`
- `aptos move compile`
- `aptos move publish`

### How to run the webapp :

- In `app/src/App.tsx` replace `const MINT_NFT_MODULE = "0x19f8503273cdb5aa93ffe4539277684615242127aa2e65ef91424136a316c9c7"` by `const MINT_NFT_MODULE = "<ADDRESS>"` the address of your module from above.
- `npm install`
- `npm run start`
- Go to `http://localhost:3000/` in your browser and use Petra wallet to transact with the app.
