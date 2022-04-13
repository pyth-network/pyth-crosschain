const jsonfile = require('jsonfile');
const elliptic = require('elliptic');
const BigNumber = require('bignumber.js');

const PythStructs = artifacts.require("PythStructs");

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
    const testGovernanceChainId = "3";
    const testGovernanceContract = "0x0000000000000000000000000000000000000000000000000000000000000004";
    const testPyth2WormholeChainId = "1";
    const testPyth2WormholeEmitter = "0x71f8dcb863d176e2c420ad6610cf687359612b6fb392e0642b0ca6b1f186aa3b";
    const notOwnerError = "Ownable: caller is not the owner -- Reason given: Ownable: caller is not the owner.";

    beforeEach(async function () {
        this.pythProxy = await deployProxy(
            PythUpgradable,
            [
                (await Wormhole.deployed()).address,
                testPyth2WormholeChainId,
                testPyth2WormholeEmitter,
            ]
        );
    });

    it("should be initialized with the correct signers and values", async function(){
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

    // NOTE(2022-04-11): Raw hex payload obtained from format serialization unit tests in `p2w-sdk/rust`
    // Latest known addition: num_publishers, max_num_publishers
    //
    // Tests rely on a p2w-sdk mock price/prod ID generation rule:
    // nthProdByte(n) = n % 256, starting with n=1
    // nthPriceByte(n) = 255 - (n % 256), starting with n=1
    //
    // Examples:
    // 1st prod = "0x010101[...]"
    // 1st price = "0xFEFEFE[...]"
    // 2nd prod = "0x020202[...]"
    // 2nd price = "0xFDFDFD[...]"
    // 3rd prod = "0x030303[...]"
    // 3rd price = "0xFCFCFC[...]"
    const RAW_BATCH_TIMESTAMP_REGEX = /DEADBEEFFADEDEED/g;
    const RAW_BATCH_PRICE_REGEX = /0000002BAD2FEED7/g;
    const RAW_BATCH_ATTESTATION_COUNT = 10;
    const rawBatchPriceAttestation = "0x" + "50325748000202000A009E503257480002010101010101010101010101010101010101010101010101010101010101010101FEFEFEFEFEFEFEFEFEFEFEFEFEFEFEFEFEFEFEFEFEFEFEFEFEFEFEFEFEFEFEFE010000002BAD2FEED7FFFFFFFDFFFFFFFFFFFFFFD6000000000000000F0000000000000025000000000000002A000000000000045700000000000008AE00000000000000650100DEADBEEFFADEDEED0001E14C0004E6D0503257480002010202020202020202020202020202020202020202020202020202020202020202FDFDFDFDFDFDFDFDFDFDFDFDFDFDFDFDFDFDFDFDFDFDFDFDFDFDFDFDFDFDFDFD010000002BAD2FEED7FFFFFFFDFFFFFFFFFFFFFFD6000000000000000F0000000000000025000000000000002A000000000000045700000000000008AE00000000000000650100DEADBEEFFADEDEED0001E14C0004E6D0503257480002010303030303030303030303030303030303030303030303030303030303030303FCFCFCFCFCFCFCFCFCFCFCFCFCFCFCFCFCFCFCFCFCFCFCFCFCFCFCFCFCFCFCFC010000002BAD2FEED7FFFFFFFDFFFFFFFFFFFFFFD6000000000000000F0000000000000025000000000000002A000000000000045700000000000008AE00000000000000650100DEADBEEFFADEDEED0001E14C0004E6D0503257480002010404040404040404040404040404040404040404040404040404040404040404FBFBFBFBFBFBFBFBFBFBFBFBFBFBFBFBFBFBFBFBFBFBFBFBFBFBFBFBFBFBFBFB010000002BAD2FEED7FFFFFFFDFFFFFFFFFFFFFFD6000000000000000F0000000000000025000000000000002A000000000000045700000000000008AE00000000000000650100DEADBEEFFADEDEED0001E14C0004E6D0503257480002010505050505050505050505050505050505050505050505050505050505050505FAFAFAFAFAFAFAFAFAFAFAFAFAFAFAFAFAFAFAFAFAFAFAFAFAFAFAFAFAFAFAFA010000002BAD2FEED7FFFFFFFDFFFFFFFFFFFFFFD6000000000000000F0000000000000025000000000000002A000000000000045700000000000008AE00000000000000650100DEADBEEFFADEDEED0001E14C0004E6D0503257480002010606060606060606060606060606060606060606060606060606060606060606F9F9F9F9F9F9F9F9F9F9F9F9F9F9F9F9F9F9F9F9F9F9F9F9F9F9F9F9F9F9F9F9010000002BAD2FEED7FFFFFFFDFFFFFFFFFFFFFFD6000000000000000F0000000000000025000000000000002A000000000000045700000000000008AE00000000000000650100DEADBEEFFADEDEED0001E14C0004E6D0503257480002010707070707070707070707070707070707070707070707070707070707070707F8F8F8F8F8F8F8F8F8F8F8F8F8F8F8F8F8F8F8F8F8F8F8F8F8F8F8F8F8F8F8F8010000002BAD2FEED7FFFFFFFDFFFFFFFFFFFFFFD6000000000000000F0000000000000025000000000000002A000000000000045700000000000008AE00000000000000650100DEADBEEFFADEDEED0001E14C0004E6D0503257480002010808080808080808080808080808080808080808080808080808080808080808F7F7F7F7F7F7F7F7F7F7F7F7F7F7F7F7F7F7F7F7F7F7F7F7F7F7F7F7F7F7F7F7010000002BAD2FEED7FFFFFFFDFFFFFFFFFFFFFFD6000000000000000F0000000000000025000000000000002A000000000000045700000000000008AE00000000000000650100DEADBEEFFADEDEED0001E14C0004E6D0503257480002010909090909090909090909090909090909090909090909090909090909090909F6F6F6F6F6F6F6F6F6F6F6F6F6F6F6F6F6F6F6F6F6F6F6F6F6F6F6F6F6F6F6F6010000002BAD2FEED7FFFFFFFDFFFFFFFFFFFFFFD6000000000000000F0000000000000025000000000000002A000000000000045700000000000008AE00000000000000650100DEADBEEFFADEDEED0001E14C0004E6D0503257480002010A0A0A0A0A0A0A0A0A0A0A0A0A0A0A0A0A0A0A0A0A0A0A0A0A0A0A0A0A0A0A0AF5F5F5F5F5F5F5F5F5F5F5F5F5F5F5F5F5F5F5F5F5F5F5F5F5F5F5F5F5F5F5F5010000002BAD2FEED7FFFFFFFDFFFFFFFFFFFFFFD6000000000000000F0000000000000025000000000000002A000000000000045700000000000008AE00000000000000650100DEADBEEFFADEDEED0001E14C0004E6D0";

    // Takes an unsigned 64-bit integer, converts it to hex with 0-padding
    function u64ToHex(timestamp) {
        // u64 -> 8 bytes -> 16 hex bytes
        return timestamp.toString(16).padStart(16, "0");
    }

    function generateRawBatchAttestation(timestamp, priceVal) {
        const ts = u64ToHex(timestamp);
        const price = u64ToHex(priceVal);
        const replaced = rawBatchPriceAttestation
	    .replace(RAW_BATCH_TIMESTAMP_REGEX, ts)
	    .replace(RAW_BATCH_PRICE_REGEX, price);
        return replaced;
    }

    it("should parse batch price attestation correctly", async function() {
        const magic = 0x50325748;
        const version = 2;

        let timestamp = 1647273460;
        let priceVal = 1337;
        let rawBatch = generateRawBatchAttestation(timestamp, priceVal);
        let parsed = await this.pythProxy.parseBatchPriceAttestation(rawBatch);

        // Check the header
        assert.equal(parsed.header.magic, magic);
        assert.equal(parsed.header.version, version);
        assert.equal(parsed.header.payloadId, 2);

        assert.equal(parsed.nAttestations, RAW_BATCH_ATTESTATION_COUNT);
        assert.equal(parsed.attestationSize, 158);

        assert.equal(parsed.attestations.length, parsed.nAttestations);

        for (var i = 0; i < parsed.attestations.length; ++i) {
            const prodId = "0x" + (i+1).toString(16).padStart(2, "0").repeat(32);
            const priceByte = 255 - ((i+1) % 256);
            const priceId = "0x" + priceByte.toString(16).padStart(2, "0").repeat(32);


            assert.equal(parsed.attestations[i].header.magic, magic);
            assert.equal(parsed.attestations[i].header.version, version);
            assert.equal(parsed.attestations[i].header.payloadId, 1);
            assert.equal(parsed.attestations[i].productId, prodId);
            assert.equal(parsed.attestations[i].priceId, priceId);
            assert.equal(parsed.attestations[i].priceType, 1);
            assert.equal(parsed.attestations[i].price, priceVal);
            assert.equal(parsed.attestations[i].exponent, -3);
            assert.equal(parsed.attestations[i].emaPrice.value, -42);
            assert.equal(parsed.attestations[i].emaPrice.numerator, 15);
            assert.equal(parsed.attestations[i].emaPrice.denominator, 37);
            assert.equal(parsed.attestations[i].emaConf.value, 42);
            assert.equal(parsed.attestations[i].emaConf.numerator, 1111);
            assert.equal(parsed.attestations[i].emaConf.denominator, 2222);
            assert.equal(parsed.attestations[i].confidenceInterval, 101);
            assert.equal(parsed.attestations[i].status, 1);
            assert.equal(parsed.attestations[i].corpAct, 0);
            assert.equal(parsed.attestations[i].timestamp, timestamp);
            assert.equal(parsed.attestations[i].num_publishers, 123212);
            assert.equal(parsed.attestations[i].max_num_publishers, 321232);

            console.debug(`attestation ${i + 1}/${parsed.attestations.length} parsed OK`);
      }
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
        await contract.updatePriceBatchFromVm("0x"+vm);
    }

    it("should attest price updates over wormhole", async function() {
        let rawBatch = generateRawBatchAttestation(1647273460, 1337);
        await attest(this.pythProxy, rawBatch);
    })

    it("should cache price updates", async function() {
        let currentTimestamp = (await web3.eth.getBlock("latest")).timestamp;
        let priceVal = 521;
        let rawBatch = generateRawBatchAttestation(currentTimestamp, priceVal);
        await attest(this.pythProxy, rawBatch);

        let first_prod_id = "0x" + "01".repeat(32)
        let first_price_id = "0x" + "fe".repeat(32)
        let second_prod_id = "0x" + "02".repeat(32)
        let second_price_id = "0x" + "fd".repeat(32)

        let first = await this.pythProxy.queryPriceFeed(first_price_id);
        console.debug(`first is ${JSON.stringify(first)}`);
        assert.equal(first.price, priceVal);

        let second = await this.pythProxy.queryPriceFeed(second_price_id);
        assert.equal(second.price, priceVal);

        // Confirm the price is bumped after a new attestation updates each record
        let nextTimestamp = currentTimestamp + 1;
        let rawBatch2 = generateRawBatchAttestation(nextTimestamp, priceVal + 5);
        await attest(this.pythProxy, rawBatch2);

        first = await this.pythProxy.queryPriceFeed(first_price_id);
        assert.equal(first.price, priceVal + 5);

        second = await this.pythProxy.queryPriceFeed(second_price_id);
        assert.equal(second.price, priceVal + 5);

        // Confirm the price is *NOT* bumped after outdated attestations arrive
        let oldTimestamp = currentTimestamp - 1;
        let rawBatch3 = generateRawBatchAttestation(nextTimestamp, priceVal + 10);
        await attest(this.pythProxy, rawBatch3);

        first = await this.pythProxy.queryPriceFeed(first_price_id);
        assert.notEqual(first.price, priceVal + 10);

        second = await this.pythProxy.queryPriceFeed(second_price_id);
        assert.notEqual(second.price, priceVal + 10);
    })

    it("should fail transaction if a price is not found", async function() {
        await expectRevert(
            this.pythProxy.queryPriceFeed(
                "0xdeadfeeddeadfeeddeadfeeddeadfeeddeadfeeddeadfeeddeadfeeddeadfeed"),
                "no price feed found for the given price id");
    })

    it("should show stale cached prices as unknown", async function() {
        let smallestTimestamp = 1;
      let rawBatch = generateRawBatchAttestation(smallestTimestamp, 1337);
        await attest(this.pythProxy, rawBatch);

        for (var i = 1; i <= RAW_BATCH_ATTESTATION_COUNT; i++) {
	    const price_id = "0x" + (255 - (i % 256)).toString(16).padStart(2, "0").repeat(32);
            let priceFeedResult = await this.pythProxy.queryPriceFeed(price_id);
            assert.equal(priceFeedResult.status.toString(), PythStructs.PriceStatus.UNKNOWN.toString());
        }
    })

    it("should show cached prices too far into the future as unknown", async function() {
        let largestTimestamp = 4294967295;
      let rawBatch = generateRawBatchAttestation(largestTimestamp, 1337);
        await attest(this.pythProxy, rawBatch);

        for (var i = 1; i <= RAW_BATCH_ATTESTATION_COUNT; i++) {
	    const price_id = "0x" + (255 - (i % 256)).toString(16).padStart(2, "0").repeat(32);
            let priceFeedResult = await this.pythProxy.queryPriceFeed(price_id);
            assert.equal(priceFeedResult.status.toString(), PythStructs.PriceStatus.UNKNOWN.toString());
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
