# We need somewhere to store the current set of approved signers. 
Store it in a datum. Lock this datum in a UTXO along with an NFT we own.
Transaction authors must look up this UTXO using the NFT, and reference it in the transaction along with the pyth price (+ proof).

Transaction validators that want to validate the price can use the set of signers in this datum along with a library we provide to validate the price.

However, looking up the UTxO holding an NFT is not easy. We may need to communicate to users when we make changes.

Alternately, we don't need to use a single NFT. We can mint a new NFT every time we want to make a change, and then spend/burn the old one. This allows for some overlap for migration time.

We would publicize changes, but in theory blockchain users could recreate the current set of valid tokens.


# Key rotation
1. We spend the UTXO containing the set of approved signers, and output a new UTXO with the new set of signers, and move the NFT into this UTXO.


# Can we put the validation logic on-chain?
- Use 'withdraw 0 trick' to forward validation logic to our script.
- Our script would need to inspect the transaction to confirm
    - The appropriate token (with the approved signer datum) is present on the referenced inputs list
    - We are getting paid
This means the redeemer of the staking validator would include the name of the signer token (NFT) [?], as well as the price to validate
The staking validator would find the approved signers in the referenced inputs and use that to validate the price
