# Solana program for receiving price updates from Pythnet

Recieving a price update from Pythnet involves two steps :

- First, verifying the VAA. That is verifying the wormhole signatures for the accumulator root. This happens in the Wormhole receiver contract.
- Second, verifying the price update by providing an inclusion proof that get checked against the verified accumulator root. This happens in the Pyth receiver contract.

The Pyth receiver program :

- verifies that the VAA has been verified by the wormhole program (through the owner of the account, the anchor discriminator and the field `verified_signatures`).
- checks that the VAA was emitted by the right data source
- checks the inclusion proof is valid
- posts the price update to a `PriceUpdateV1` account

# Devnet deployment

The program is currently deployed on Devnet with addresses:

- `HDwcJBJXjL9FpJ7UBsYBtaDjsBUhuLCUYoz3zr8SWWaQ` for the Wormhole receiver
- `rec5EKMGg6MxZYaMdyBfgwp4d5rB9T1VQH5pJv5LtFJ` for the Pyth receiver

# Cli

The `cli` folder contains some useful client code to interact with both the Wormhole receiver and the Pyth receiver.

To run the full flow of receiving a price update.

```
cargo run --package pyth-solana-receiver-cli -- --url https://api.devnet.solana.com --keypair ~/.config/solana/id.json --wormhole HDwcJBJXjL9FpJ7UBsYBtaDjsBUhuLCUYoz3zr8SWWaQ post-price-update -p "UE5BVQEAAAADuAEAAAADDQAT3NODCejQsYRR/NaTpZ235FMHJVG96nyvOt6eOuGrLwSYzT/FjHPqd6+Z99kLetgE4rqsUgkRMRTkDSn3x/jPAAL592MR+nJwkciOpwc9NhM+1rbPcjhHAjkV/1GSDiVE1CQ6XtcDvPehFinDsWIFQrlI4OJoIlR5Hyn5V8pGm+hkAAPxiNHI8zVqi/Clf+QJDqYDa2JuD1pXqCYOJ52HfBx+Km0uR7i7nM08Zei8R0OlxGMnlpocF8LbDf08206hV3ZNAAQZdzq9idT1GvL0q8MYj7EI6MjQN3ZMQuB6AhWoSOIdLzCgxHPxbyh2/Iqb3rbbM2mmCsO+au1A5CllRwNKhN0IAAaUuBJfvZfGZyeSYuouMV6dmCL5SncGtHYXBZSCr80l+VV9vPjInRRMBY1RB4gsIulB6CAT5cWiS/mtMGYu11VuAAqOCbhhgenTsllWwAusRSg0mP+I0l3tTn5dIWDOs7uuoGm85LK3eyH0W+WfUHuTPCVMKmDhcrXWNd+Te/+JRdWfAQsc8z8mfDzu9qLAwRSNa/DhsFf6eSraWADD36tFDqhhsA6fjyODcodp3DNF1iPJtJI/rvW2uJDvJk72Uim6dg9XAAx4yEtS1jH0xT/347qvkFGT1lRcejJoOWYKwfm0MRHXCUyYMcGcaA+1gASHObBecmhwAZf9DwOo9qsE2QNwjvtSAQ357d5tvnQpRnptN17kQPA2Q2ivTaksuuOl/jGNPtePYkNLj5opS2TmIckzPY4uoZzPj78xsCCo1PmrmzaQF2FkAA5u2NXzHsrPzGfMAfvO4xFJv8uyJWPYyi5Bm7NGBC192CCb+qGSCGiAYTENUkYIW88yNE7YY40gW74/5TW9+6I6AA+S12krvatDCfNbHEQUcCefYQr+B8Npp0kvhgMep7NNsUAqAPobvN/XzmGxuyMfC3fAUTRHIEl2+298RhWKKG/ZABH7I/kYMSqmmerLumAcAN3P0QegRDoV+1Z0qr60JLoBWkIsiLKasrnw6+qL9QCrktZvhRfIzERofUSBcEV7NgSDABK6L21bVRMMWOwsxjByTtVtyo2z5XRhA1O6D6rx5viLb2+DENjuiuvIUSGiAZkQaO7Pb85+4LPXQBS+B/d6i9uHAWV54nEAAAAAABrhAfrtrFhR4yubI7X5QRqMK6xKrj7U3XuBHdGnLqSqcQAAAAAB3AIyAUFVV1YAAAAAAAbjJq8AACcQIP3vda2HWizAf1IoCksTokyS7JsBAFUAyWRY05P+net6fWOgrEHiiYpnp3UNvRZmcyeeBsho3woAAAAAAFBgLAAAAAAAAAnq////+AAAAABleeJxAAAAAGV54nEAAAAAAFCSxQAAAAAAAAxHCio2OvtY/Adeg7Q3kLQS3FIlVZlvi0LK1B/BStDEKIYfEaoffyjm0T7OvpvkVAzl3dTA0E3dRQzTlGPQDG5ZZVjWqQ3C312i+dcQ8+L9wAZ+U+KRaLe1cb5j6U6uNyDJdvf8kQU04/r5LYZCmd4oo7JsAeXpmvFZ7eFtjE8U8aljRddEiHhqaPeg0/9CV5uG/AkNjTMLv/e3FOWbIQb3xwRpVKO0/LtrtmYtR+Vc4qIk7myAIf+dJtQfbqVyAwNzpNPR1exc/vEZ"
```
