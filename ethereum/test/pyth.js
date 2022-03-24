const jsonfile = require('jsonfile');
const elliptic = require('elliptic');
const BigNumber = require('bignumber.js');

const PythSDK = artifacts.require("PythSDK");

const { deployProxy, upgradeProxy } = require('@openzeppelin/truffle-upgrades');
const {expectRevert} = require('@openzeppelin/test-helpers');

const Wormhole = artifacts.require("Wormhole");

const PythUpgradable = artifacts.require("PythUpgradable");
const MockPythUpgrade = artifacts.require("MockPythUpgrade");

const testSigner1PK = "cfb12303a19cde580bb4dd771639b0d26bc68353645571a8cff516ab2ee113a0";
const testSigner2PK = "892330666a850761e7370376430bb8c2aa1494072d3bfeaed0c4fa3d5a9135fe";

contract("Pyth", function () {
    const testSigner1 = web3.eth.accounts.privateKeyToAccount(testSigner1PK);
    const testSigner2 = web3.eth.accounts.privateKeyToAccount(testSigner2PK);
    const testChainId = "2";
    const testGovernanceChainId = "3";
    const testGovernanceContract = "0x0000000000000000000000000000000000000000000000000000000000000004";
    const testPyth2WormholeChainId = "1";
    const testPyth2WormholeEmitter = "0x71f8dcb863d176e2c420ad6610cf687359612b6fb392e0642b0ca6b1f186aa3b";
    const notOwnerError = "Ownable: caller is not the owner -- Reason given: Ownable: caller is not the owner.";

    beforeEach(async function () {
        this.pythProxy = await deployProxy(
            PythUpgradable,
            [
                testChainId,
                (await Wormhole.deployed()).address,
                testPyth2WormholeChainId,
                testPyth2WormholeEmitter,
            ]
        );
    });

    it("should be initialized with the correct signers and values", async function(){
        // chain id
        const chainId = await this.pythProxy.chainId();
        assert.equal(chainId, testChainId);

        // pyth2wormhole
        const pyth2wormChain = await this.pythProxy.pyth2WormholeChainId();
        assert.equal(pyth2wormChain, testPyth2WormholeChainId);
        const pyth2wormEmitter = await this.pythProxy.pyth2WormholeEmitter();
        assert.equal(pyth2wormEmitter, testPyth2WormholeEmitter);
    })

    it("should allow upgrades from the owner", async function(){
        // Check that the owner is the default account Truffle 
        // has configured for the network. upgradeProxy will send
        // transactions from the default account.
        const accounts = await web3.eth.getAccounts();
        const defaultAccount = accounts[0];
        const owner = await this.pythProxy.owner();
        assert.equal(owner, defaultAccount);

        // Try and upgrade the proxy
        const newImplementation = await upgradeProxy(
            this.pythProxy.address, MockPythUpgrade);

        // Check that the new upgrade is successful
        assert.equal(await newImplementation.isUpgradeActive(), true);
        assert.equal(this.pythProxy.address, newImplementation.address);
    })

    it("should allow ownership transfer", async function(){
        // Check that the owner is the default account Truffle 
        // has configured for the network.
        const accounts = await web3.eth.getAccounts();
        const defaultAccount = accounts[0];
        assert.equal(await this.pythProxy.owner(), defaultAccount);

        // Check that another account can't transfer the ownership
        await expectRevert(this.pythProxy.transferOwnership(accounts[1], {from: accounts[1]}), notOwnerError);

        // Transfer the ownership to another account
        await this.pythProxy.transferOwnership(accounts[2], {from: defaultAccount});
        assert.equal(await this.pythProxy.owner(), accounts[2]);

        // Check that the original account can't transfer the ownership back to itself
        await expectRevert(this.pythProxy.transferOwnership(defaultAccount, {from: defaultAccount}), notOwnerError);

        // Check that the new owner can transfer the ownership back to the original account
        await this.pythProxy.transferOwnership(defaultAccount, {from: accounts[2]});
        assert.equal(await this.pythProxy.owner(), defaultAccount);
    })

    it("should not allow upgrades from the another account", async function(){
        // This test is slightly convoluted as, due to a limitation of Truffle,
        // we cannot specify which account upgradeProxy send transactions from:
        // it will always use the default account.
        //
        // Therefore, we transfer the ownership to another account first, 
        // and then attempt an upgrade using the default account.

        // Check that the owner is the default account Truffle 
        // has configured for the network.
        const accounts = await web3.eth.getAccounts();
        const defaultAccount = accounts[0];
        assert.equal(await this.pythProxy.owner(), defaultAccount);

        // Transfer the ownership to another account
        const newOwnerAccount = accounts[1];
        await this.pythProxy.transferOwnership(newOwnerAccount, {from: defaultAccount});
        assert.equal(await this.pythProxy.owner(), newOwnerAccount);

        // Try and upgrade using the default account, which will fail
        // because we are no longer the owner.
        await expectRevert(upgradeProxy(this.pythProxy.address, MockPythUpgrade), notOwnerError);
    })

    const rawBatchPriceAttestation = "0x"+"503257480002020004009650325748000201c0e11df4c58a4e53f2bc059ba57a7c8f30ddada70b5bdc3753f90b824b64dd73c1902e05cdf03bc089a943d921f87ccd0e3e1b774b5660d037b9f428c0d3305e01000000000000071dfffffffb00000000000005f70000000132959bbd00000000c8bfed5f00000000000000030000000041c7b65b00000000c8bfed5f0000000000000003010000000000TTTTTTTT503257480002017090c4ecf0309718d04c5a162c08aa4b78f533f688fa2f3ccd7be74c2a253a54fd4caca566fc44a9d6585420959d13897877c606477b3f0e7f247295b7275620010000000000000440fffffffb00000000000005fb000000015cfe8c9d00000000e3dbaa7f00000000000000020000000041c7c5bb00000000e3dbaa7f0000000000000007010000000000TTTTTTTT503257480002012f064374f55cb2efbbef29329de3b652013a76261876c55a1caf3a489c721ccd8c5dd422900917e8e26316fe598e8f062058d390644e0e36d42c187298420ccd010000000000000609fffffffb00000000000005cd00000001492c19bd00000000dd92071f00000000000000020000000041c7d3fb00000000dd92071f0000000000000001010000000000TTTTTTTT5032574800020171ddabd1a2c1fb6d6c4707b245b7c0ab6af0ae7b96b2ff866954a0b71124aee517fbe895e5416ddb4d5af9d83c599ee2c4f94cb25e8597f9e5978bd63a7cdcb70100000000000007bcfffffffb00000000000005e2000000014db2995d00000000dd8f775f00000000000000020000000041c7df9b00000000dd8f775f0000000000000003010000000000TTTTTTTT";

    function encodeTimestamp(timestamp) {
        return timestamp.toString(16).padStart(8, "0");
    }

    function generateRawBatchAttestation(timestamp) {
        return rawBatchPriceAttestation.replace(/TTTTTTTT/g, encodeTimestamp(timestamp));
    }

    it("should parse batch price attestation correctly", async function() {
        const magic = 1345476424;
        const version = 2;

        let timestamp = 1647273460;
        let rawBatch = generateRawBatchAttestation(timestamp); 
        let parsed = await this.pythProxy.parseBatchPriceAttestation(rawBatch);

        // Check the header
        assert.equal(parsed.header.magic, magic);
        assert.equal(parsed.header.version, version);
        assert.equal(parsed.header.payloadId, 2);

        assert.equal(parsed.nAttestations, 4);
        assert.equal(parsed.attestationSize, 150);

        assert.equal(parsed.attestations.length, 4);

        // Attestation #1
        assert.equal(parsed.attestations[0].header.magic, magic);
        assert.equal(parsed.attestations[0].header.version, version);
        assert.equal(parsed.attestations[0].header.payloadId, 1);
        assert.equal(parsed.attestations[0].productId, "0xc0e11df4c58a4e53f2bc059ba57a7c8f30ddada70b5bdc3753f90b824b64dd73");
        assert.equal(parsed.attestations[0].priceId, "0xc1902e05cdf03bc089a943d921f87ccd0e3e1b774b5660d037b9f428c0d3305e");
        assert.equal(parsed.attestations[0].priceType, 1);
        assert.equal(parsed.attestations[0].price, 1821);
        assert.equal(parsed.attestations[0].exponent, -5);
        assert.equal(parsed.attestations[0].emaPrice.value, 1527);
        assert.equal(parsed.attestations[0].emaPrice.numerator, 5143632829);
        assert.equal(parsed.attestations[0].emaPrice.denominator, 3368021343);
        assert.equal(parsed.attestations[0].emaConf.value, 3);
        assert.equal(parsed.attestations[0].emaConf.numerator, 1103607387);
        assert.equal(parsed.attestations[0].emaConf.denominator, 3368021343);
        assert.equal(parsed.attestations[0].confidenceInterval, 3);
        assert.equal(parsed.attestations[0].status, 1);
        assert.equal(parsed.attestations[0].corpAct, 0);
        assert.equal(parsed.attestations[0].timestamp, timestamp);

        // Attestation #2
        assert.equal(parsed.attestations[1].header.magic, magic);
        assert.equal(parsed.attestations[1].header.version, version);
        assert.equal(parsed.attestations[1].header.payloadId, 1);
        assert.equal(parsed.attestations[1].productId, "0x7090c4ecf0309718d04c5a162c08aa4b78f533f688fa2f3ccd7be74c2a253a54");
        assert.equal(parsed.attestations[1].priceId, "0xfd4caca566fc44a9d6585420959d13897877c606477b3f0e7f247295b7275620");
        assert.equal(parsed.attestations[1].priceType, 1);
        assert.equal(parsed.attestations[1].price, 1088);
        assert.equal(parsed.attestations[1].exponent, -5);
        assert.equal(parsed.attestations[1].emaPrice.value, 1531);
        assert.equal(parsed.attestations[1].emaPrice.numerator, 5855153309);
        assert.equal(parsed.attestations[1].emaPrice.denominator, 3822824063);
        assert.equal(parsed.attestations[1].emaConf.value, 2);
        assert.equal(parsed.attestations[1].emaConf.numerator, 1103611323);
        assert.equal(parsed.attestations[1].emaConf.denominator, 3822824063);
        assert.equal(parsed.attestations[1].confidenceInterval, 7);
        assert.equal(parsed.attestations[1].status, 1);
        assert.equal(parsed.attestations[1].corpAct, 0);
        assert.equal(parsed.attestations[1].timestamp, timestamp);

        // Attestation #3
        assert.equal(parsed.attestations[2].header.magic, magic);
        assert.equal(parsed.attestations[2].header.version, version);
        assert.equal(parsed.attestations[2].header.payloadId, 1);
        assert.equal(parsed.attestations[2].productId, "0x2f064374f55cb2efbbef29329de3b652013a76261876c55a1caf3a489c721ccd");
        assert.equal(parsed.attestations[2].priceId, "0x8c5dd422900917e8e26316fe598e8f062058d390644e0e36d42c187298420ccd");
        assert.equal(parsed.attestations[2].priceType, 1);
        assert.equal(parsed.attestations[2].price, 1545);
        assert.equal(parsed.attestations[2].exponent, -5);
        assert.equal(parsed.attestations[2].emaPrice.value, 1485);
        assert.equal(parsed.attestations[2].emaPrice.numerator, 5522594237);
        assert.equal(parsed.attestations[2].emaPrice.denominator, 3717334815);
        assert.equal(parsed.attestations[2].emaConf.value, 2);
        assert.equal(parsed.attestations[2].emaConf.numerator, 1103614971);
        assert.equal(parsed.attestations[2].emaConf.denominator, 3717334815);
        assert.equal(parsed.attestations[2].confidenceInterval, 1);
        assert.equal(parsed.attestations[2].status, 1);
        assert.equal(parsed.attestations[2].corpAct, 0);
        assert.equal(parsed.attestations[2].timestamp, timestamp);

        // Attestation #4
        assert.equal(parsed.attestations[3].header.magic, magic);
        assert.equal(parsed.attestations[3].header.version, version);
        assert.equal(parsed.attestations[3].header.payloadId, 1);
        assert.equal(parsed.attestations[3].productId, "0x71ddabd1a2c1fb6d6c4707b245b7c0ab6af0ae7b96b2ff866954a0b71124aee5");
        assert.equal(parsed.attestations[3].priceId, "0x17fbe895e5416ddb4d5af9d83c599ee2c4f94cb25e8597f9e5978bd63a7cdcb7");
        assert.equal(parsed.attestations[3].priceType, 1);
        assert.equal(parsed.attestations[3].price, 1980);
        assert.equal(parsed.attestations[3].exponent, -5);
        assert.equal(parsed.attestations[3].emaPrice.value, 1506);
        assert.equal(parsed.attestations[3].emaPrice.numerator, 5598517597);
        assert.equal(parsed.attestations[3].emaPrice.denominator, 3717166943);
        assert.equal(parsed.attestations[3].emaConf.value, 2);
        assert.equal(parsed.attestations[3].emaConf.numerator, 1103617947);
        assert.equal(parsed.attestations[3].emaConf.denominator, 3717166943);
        assert.equal(parsed.attestations[3].confidenceInterval, 3);
        assert.equal(parsed.attestations[3].status, 1);
        assert.equal(parsed.attestations[3].corpAct, 0);
        assert.equal(parsed.attestations[3].timestamp, timestamp);
    })

    async function attest(contract, data) {
        const vm = await signAndEncodeVM(
            1,
            1,
            testPyth2WormholeChainId,
            testPyth2WormholeEmitter,
            0,
            data,
            [
                testSigner1PK
            ],
            0,
            0
        );

        await contract.attestPriceBatch("0x"+vm);
    }

    it("should attest price updates over wormhole", async function() {
        let rawBatch = generateRawBatchAttestation(1647273460);
        await attest(this.pythProxy, rawBatch);
    })

    it("should cache price updates", async function() {
        let currentTimestamp = (await web3.eth.getBlock("latest")).timestamp;
        let rawBatch = generateRawBatchAttestation(currentTimestamp);
        await attest(this.pythProxy, rawBatch);

        let first = await this.pythProxy.queryPriceFeed("0xc1902e05cdf03bc089a943d921f87ccd0e3e1b774b5660d037b9f428c0d3305e");
        assert.equal(first.priceFeed.id, "0xc1902e05cdf03bc089a943d921f87ccd0e3e1b774b5660d037b9f428c0d3305e");
        assert.equal(first.priceFeed.productId, "0xc0e11df4c58a4e53f2bc059ba57a7c8f30ddada70b5bdc3753f90b824b64dd73");
        assert.equal(first.priceFeed.price, 1821);
        assert.equal(first.priceFeed.conf, 3);
        assert.equal(first.priceFeed.expo, -5);
        assert.equal(first.priceFeed.status.toString(), PythSDK.PriceStatus.TRADING.toString());
        assert.equal(first.priceFeed.numPublishers, 0);
        assert.equal(first.priceFeed.maxNumPublishers, 0);
        assert.equal(first.priceFeed.emaPrice, 1527);
        assert.equal(first.priceFeed.emaConf, 3);

        let second = await this.pythProxy.queryPriceFeed("0xfd4caca566fc44a9d6585420959d13897877c606477b3f0e7f247295b7275620");
        assert.equal(second.priceFeed.id, "0xfd4caca566fc44a9d6585420959d13897877c606477b3f0e7f247295b7275620");
        assert.equal(second.priceFeed.productId, "0x7090c4ecf0309718d04c5a162c08aa4b78f533f688fa2f3ccd7be74c2a253a54");
        assert.equal(second.priceFeed.price, 1088);
        assert.equal(second.priceFeed.conf, 7);
        assert.equal(second.priceFeed.expo, -5);
        assert.equal(second.priceFeed.status.toString(), PythSDK.PriceStatus.TRADING.toString());
        assert.equal(second.priceFeed.numPublishers, 0);
        assert.equal(second.priceFeed.maxNumPublishers, 0);
        assert.equal(second.priceFeed.emaPrice, 1531);
        assert.equal(second.priceFeed.emaConf, 2);
    })

    it("should fail transaction if a price is not found", async function() {
        await expectRevert(
            this.pythProxy.queryPriceFeed(
                "0xc1902e05cdf03bc089a943d921f87ccd0e3e1b774b5660d037b9f428c0d3305e"),
                "no price feed found for the given price id");
    })

    it("should show stale cached prices as unknown", async function() {
        let smallestTimestamp = 1;
        let rawBatch = generateRawBatchAttestation(smallestTimestamp);
        await attest(this.pythProxy, rawBatch);

        let all_price_ids = ["0xc1902e05cdf03bc089a943d921f87ccd0e3e1b774b5660d037b9f428c0d3305e",
            "0xfd4caca566fc44a9d6585420959d13897877c606477b3f0e7f247295b7275620",
            "0x8c5dd422900917e8e26316fe598e8f062058d390644e0e36d42c187298420ccd",
            "0x17fbe895e5416ddb4d5af9d83c599ee2c4f94cb25e8597f9e5978bd63a7cdcb7"
        ];
        for (var i = 0; i < all_price_ids.length; i++) {
            const price_id = all_price_ids[i];
            let priceFeedResult = await this.pythProxy.queryPriceFeed(price_id);
            assert.equal(priceFeedResult.priceFeed.status.toString(), PythSDK.PriceStatus.UNKNOWN.toString());
        }
    })

    it("should show cached prices too far into the future as unknown", async function() {
        let largestTimestamp = 4294967295;
        let rawBatch = generateRawBatchAttestation(largestTimestamp);
        await attest(this.pythProxy, rawBatch);

        let all_price_ids = ["0xc1902e05cdf03bc089a943d921f87ccd0e3e1b774b5660d037b9f428c0d3305e",
            "0xfd4caca566fc44a9d6585420959d13897877c606477b3f0e7f247295b7275620",
            "0x8c5dd422900917e8e26316fe598e8f062058d390644e0e36d42c187298420ccd",
            "0x17fbe895e5416ddb4d5af9d83c599ee2c4f94cb25e8597f9e5978bd63a7cdcb7"
        ];
        for (var i = 0; i < all_price_ids.length; i++) {
            const price_id = all_price_ids[i];
            let priceFeedResult = await this.pythProxy.queryPriceFeed(price_id);
            assert.equal(priceFeedResult.priceFeed.status.toString(), PythSDK.PriceStatus.UNKNOWN.toString());
        }
    })

    it("should only cache updates for new prices", async function() {
        // This test sends two batches of updates, for the same Price IDs. The second batch contains
        // different price values to the first batch, but only the first and last updates in
        // the second batch have a newer timestamp than those in the first batch, and so these 
        // are the only two which should be cached.

        let currentTimestamp = (await web3.eth.getBlock("latest")).timestamp;
        let encodedCurrentTimestamp = encodeTimestamp(currentTimestamp);
        let encodedNewerTimestamp = encodeTimestamp(currentTimestamp + 1);

        const firstBatch = generateRawBatchAttestation(currentTimestamp);

        let secondBatch = "0x"+"503257480002020004009650325748000201c0e11df4c58a4e53f2bc059ba57a7c8f30ddada70b5bdc3753f90b824b64dd73c1902e05cdf03bc089a943d921f87ccd0e3e1b774b5660d037b9f428c0d3305e01000000000000073dfffffffb00000000000005470000000132959bbd00000000c8bfed5f00000000000000030000000041c7b65b00000000c8bfed5f0000000000000003010000000000"+encodedNewerTimestamp+"503257480002017090c4ecf0309718d04c5a162c08aa4b78f533f688fa2f3ccd7be74c2a253a54fd4caca566fc44a9d6585420959d13897877c606477b3f0e7f247295b7275620010000000000000450fffffffb00000000000005fb000000015cfe8c9d00000000e3dbaa7f00000000000000020000000041c7c5bb00000000e3dbaa7f0000000000000007010000000000"+encodedCurrentTimestamp+"503257480002012f064374f55cb2efbbef29329de3b652013a76261876c55a1caf3a489c721ccd8c5dd422900917e8e26316fe598e8f062058d390644e0e36d42c187298420ccd010000000000000659fffffffb00000000000005cd00000001492c19bd00000000dd92071f00000000000000020000000041c7d3fb00000000dd92071f0000000000000001010000000000"+encodedCurrentTimestamp+"5032574800020181ddabd1a2c1fb6d6c4707b245b7c0ab6af0ae7b96b2ff866954a0b71124aee517fbe895e5416ddb4d5af9d83c599ee2c4f94cb25e8597f9e5978bd63a7cdcb70100000000000007bDfffffffb00000000000005e2000000014db2995d00000000dd8f775f00000000000000020000000041c7df9b00000000dd8f775f0000000000000003010000000000"+encodedNewerTimestamp;

        let all_price_ids = ["0xc1902e05cdf03bc089a943d921f87ccd0e3e1b774b5660d037b9f428c0d3305e",
            "0xfd4caca566fc44a9d6585420959d13897877c606477b3f0e7f247295b7275620",
            "0x8c5dd422900917e8e26316fe598e8f062058d390644e0e36d42c187298420ccd",
            "0x17fbe895e5416ddb4d5af9d83c599ee2c4f94cb25e8597f9e5978bd63a7cdcb7"
        ];

        // Send the first batch
        await attest(this.pythProxy, firstBatch);
        let prices_after_first_update = {};
        for (var i = 0; i < all_price_ids.length; i++) {
            const price_id = all_price_ids[i];
            prices_after_first_update[price_id] = await this.pythProxy.queryPriceFeed(price_id);
        }

        // Send the second batch
        await attest(this.pythProxy, secondBatch);
        let prices_after_second_update = {};
        for (var i = 0; i < all_price_ids.length; i++) {
            const price_id = all_price_ids[i];
            prices_after_second_update[price_id] = await this.pythProxy.queryPriceFeed(price_id);
        }

        // Price IDs which have newer timestamps
        let new_price_updates = [
            "0xc1902e05cdf03bc089a943d921f87ccd0e3e1b774b5660d037b9f428c0d3305e",
            "0x17fbe895e5416ddb4d5af9d83c599ee2c4f94cb25e8597f9e5978bd63a7cdcb7"
        ];

        // Price IDs which have older timestamps
        let old_price_updates = [
            "0xfd4caca566fc44a9d6585420959d13897877c606477b3f0e7f247295b7275620",
            "0x8c5dd422900917e8e26316fe598e8f062058d390644e0e36d42c187298420ccd"];

        // Check that the new price updates have been updated
        for (var i = 0; i < new_price_updates.length; i++) {
            const price_id = new_price_updates[i];
            assert.notEqual(prices_after_first_update[price_id].priceFeed.price, prices_after_second_update[price_id].priceFeed.price);
        }

        // Check that the old price updates have been discarded
        for (var i = 0; i < old_price_updates.length; i++) {
            const price_id = old_price_updates[i];
            assert.equal(prices_after_first_update[price_id].priceFeed.price, prices_after_second_update[price_id].priceFeed.price);
            assert.equal(prices_after_first_update[price_id].priceFeed.conf, prices_after_second_update[price_id].priceFeed.conf);
            assert.equal(prices_after_first_update[price_id].priceFeed.expo, prices_after_second_update[price_id].priceFeed.expo);
            assert.equal(prices_after_first_update[price_id].priceFeed.status.toString(), prices_after_second_update[price_id].priceFeed.status.toString());
            assert.equal(prices_after_first_update[price_id].priceFeed.numPublishers, prices_after_second_update[price_id].priceFeed.numPublishers);
            assert.equal(prices_after_first_update[price_id].priceFeed.maxNumPublishers, prices_after_second_update[price_id].priceFeed.maxNumPublishers);
            assert.equal(prices_after_first_update[price_id].priceFeed.emaPrice, prices_after_second_update[price_id].priceFeed.emaPrice);
            assert.equal(prices_after_first_update[price_id].priceFeed.emaConf, prices_after_second_update[price_id].priceFeed.emaConf);
        }
    })
});

const signAndEncodeVM = async function (
    timestamp,
    nonce,
    emitterChainId,
    emitterAddress,
    sequence,
    data,
    signers,
    guardianSetIndex,
    consistencyLevel
) {
    const body = [
        web3.eth.abi.encodeParameter("uint32", timestamp).substring(2 + (64 - 8)),
        web3.eth.abi.encodeParameter("uint32", nonce).substring(2 + (64 - 8)),
        web3.eth.abi.encodeParameter("uint16", emitterChainId).substring(2 + (64 - 4)),
        web3.eth.abi.encodeParameter("bytes32", emitterAddress).substring(2),
        web3.eth.abi.encodeParameter("uint64", sequence).substring(2 + (64 - 16)),
        web3.eth.abi.encodeParameter("uint8", consistencyLevel).substring(2 + (64 - 2)),
        data.substr(2)
    ]

    const hash = web3.utils.soliditySha3(web3.utils.soliditySha3("0x" + body.join("")))

    let signatures = "";

    for (let i in signers) {
        const ec = new elliptic.ec("secp256k1");
        const key = ec.keyFromPrivate(signers[i]);
        const signature = key.sign(hash.substr(2), {canonical: true});

        const packSig = [
            web3.eth.abi.encodeParameter("uint8", i).substring(2 + (64 - 2)),
            zeroPadBytes(signature.r.toString(16), 32),
            zeroPadBytes(signature.s.toString(16), 32),
            web3.eth.abi.encodeParameter("uint8", signature.recoveryParam).substr(2 + (64 - 2)),
        ]

        signatures += packSig.join("")
    }

    const vm = [
        web3.eth.abi.encodeParameter("uint8", 1).substring(2 + (64 - 2)),
        web3.eth.abi.encodeParameter("uint32", guardianSetIndex).substring(2 + (64 - 8)),
        web3.eth.abi.encodeParameter("uint8", signers.length).substring(2 + (64 - 2)),

        signatures,
        body.join("")
    ].join("");

    return vm
}

function zeroPadBytes(value, length) {
    while (value.length < 2 * length) {
        value = "0" + value;
    }
    return value;
}
