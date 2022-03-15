# Deploy

First build the contracts


``` sh
bash build.sh
```

Then, for example, to deploy `token_bridge.wasm`, run in the `tools` directory

``` sh
npm ci
node deploy-pyth-bridge.js --network mainnet --artifact ../artifacts/token_bridge.wasm --mnemonic "..."
```

which will print something along the lines of

``` sh
Storing WASM: ../artifacts/pyth_bridge.wasm (367689 bytes)
Deploy fee:  88446uluna
Code ID:  2435
```

# New contract
If it is the first deployment and you want to instantiate a bew contract pass `--instantiate` argument to the above command. 

# Migrate
If you want to upgrade an existing contract pass `--migrate --contract terra123456xyzqwe..` arguments to the above command.