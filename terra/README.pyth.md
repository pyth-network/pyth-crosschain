# Intro

Deploying a contract in terra consists of two steps:
1. Uploading the code. This will give you a code id.
2. Creating a new contract which has an address with a code id as it's program.

If it is an existing contract and you want to upgrade you need to upload the code and then in an upgrade 
command change the contract code id to the new code id. 

This script does all of the above commands. 

# Deploy

First build the contracts:

``` sh
bash build.sh
```

This command will builds and savesall the contracts in the `artifact` directory.

Then, for example, to deploy `pyth_bridge.wasm`, run in the `tools` directory:

``` sh
npm ci
node deploy-pyth-bridge.js --network testnet --artifact ../artifacts/pyth_bridge.wasm --mnemonic "..."
```

which will print something along the lines of

``` sh
Storing WASM: ../artifacts/pyth_bridge.wasm (367689 bytes)
Deploy fee:  88446uluna
Code ID:  2435
```

If you do not pass any arguments to the script it will only upload the code and gives the code id. If you want to create a 
new contract or upgrade an existing contract you should pass more arguments that are described below.

# New contract
If you want instantiate a new contract after your deployment pass `--instantiate` argument to the above command.
It will upload the code and with the resulting code id instantiates a new pyth contract.

# Migrate
If you want to upgrade an existing contract pass `--migrate --contract terra123456xyzqwe..` arguments to the above command.
It will upload the code and with the resulting code id migrates the existing contract to the new one.

You might encounter Gateway timeout in response but it's good to double check with terra finder as sometimes transactions succeed 
despite being timed out.