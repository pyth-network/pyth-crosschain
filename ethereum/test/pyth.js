const jsonfile = require('jsonfile');
const elliptic = require('elliptic');
const BigNumber = require('bignumber.js');

const PythSDK = artifacts.require("PythSDK");
const Wormhole = artifacts.require("Wormhole");
const PythDataBridge = artifacts.require("PythDataBridge");
const PythImplementation = artifacts.require("PythImplementation");
const MockPythImplementation = artifacts.require("MockPythImplementation");

const testSigner1PK = "cfb12303a19cde580bb4dd771639b0d26bc68353645571a8cff516ab2ee113a0";
const testSigner2PK = "892330666a850761e7370376430bb8c2aa1494072d3bfeaed0c4fa3d5a9135fe";

const WormholeImplementationFullABI = jsonfile.readFileSync("build/contracts/Implementation.json").abi
const P2WImplementationFullABI = jsonfile.readFileSync("build/contracts/PythImplementation.json").abi

contract("Pyth", function () {
    const testSigner1 = web3.eth.accounts.privateKeyToAccount(testSigner1PK);
    const testSigner2 = web3.eth.accounts.privateKeyToAccount(testSigner2PK);
    const testChainId = "2";
    const testGovernanceChainId = "3";
    const testGovernanceContract = "0x0000000000000000000000000000000000000000000000000000000000000004";
    const testPyth2WormholeChainId = "1";
    const testPyth2WormholeEmitter = "0x71f8dcb863d176e2c420ad6610cf687359612b6fb392e0642b0ca6b1f186aa3b";


    it("should be initialized with the correct signers and values", async function(){
        const initialized = new web3.eth.Contract(P2WImplementationFullABI, PythDataBridge.address);

        // chain id
        const chainId = await initialized.methods.chainId().call();
        assert.equal(chainId, testChainId);

        // governance
        const governanceChainId = await initialized.methods.governanceChainId().call();
        assert.equal(governanceChainId, testGovernanceChainId);
        const governanceContract = await initialized.methods.governanceContract().call();
        assert.equal(governanceContract, testGovernanceContract);

        // pyth2wormhole
        const pyth2wormChain = await initialized.methods.pyth2WormholeChainId().call();
        assert.equal(pyth2wormChain, testPyth2WormholeChainId);
        const pyth2wormEmitter = await initialized.methods.pyth2WormholeEmitter().call();
        assert.equal(pyth2wormEmitter, testPyth2WormholeEmitter);
    })

    it("should accept a valid upgrade", async function() {
        const initialized = new web3.eth.Contract(P2WImplementationFullABI, PythDataBridge.address);
        const accounts = await web3.eth.getAccounts();

        const mock = await MockPythImplementation.new();

        let data = [
            "0x0000000000000000000000000000000000000000000000000000000050797468",
            "01",
            web3.eth.abi.encodeParameter("uint16", testChainId).substring(2 + (64 - 4)),
            web3.eth.abi.encodeParameter("address", mock.address).substring(2),
        ].join('')

        const vm = await signAndEncodeVM(
            1,
            1,
            testGovernanceChainId,
            testGovernanceContract,
            0,
            data,
            [
                testSigner1PK
            ],
            0,
            0
        );

        let before = await web3.eth.getStorageAt(PythDataBridge.address, "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc");

        assert.equal(before.toLowerCase(), PythImplementation.address.toLowerCase());

        await initialized.methods.upgrade("0x" + vm).send({
            value : 0,
            from : accounts[0],
            gasLimit : 2000000
        });

        let after = await web3.eth.getStorageAt(PythDataBridge.address, "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc");

        assert.equal(after.toLowerCase(), mock.address.toLowerCase());

        const mockImpl = new web3.eth.Contract(MockPythImplementation.abi, PythDataBridge.address);

        let isUpgraded = await mockImpl.methods.testNewImplementationActive().call();

        assert.ok(isUpgraded);
    })

    const rawBatchPriceAttestation = "0x"+"503257480002020004009650325748000201c0e11df4c58a4e53f2bc059ba57a7c8f30ddada70b5bdc3753f90b824b64dd73c1902e05cdf03bc089a943d921f87ccd0e3e1b774b5660d037b9f428c0d3305e01000000000000071dfffffffb00000000000005f70000000132959bbd00000000c8bfed5f00000000000000030000000041c7b65b00000000c8bfed5f0000000000000003010000000000622f65f4503257480002017090c4ecf0309718d04c5a162c08aa4b78f533f688fa2f3ccd7be74c2a253a54fd4caca566fc44a9d6585420959d13897877c606477b3f0e7f247295b7275620010000000000000440fffffffb00000000000005fb000000015cfe8c9d00000000e3dbaa7f00000000000000020000000041c7c5bb00000000e3dbaa7f0000000000000007010000000000622f65f4503257480002012f064374f55cb2efbbef29329de3b652013a76261876c55a1caf3a489c721ccd8c5dd422900917e8e26316fe598e8f062058d390644e0e36d42c187298420ccd010000000000000609fffffffb00000000000005cd00000001492c19bd00000000dd92071f00000000000000020000000041c7d3fb00000000dd92071f0000000000000001010000000000622f65f45032574800020171ddabd1a2c1fb6d6c4707b245b7c0ab6af0ae7b96b2ff866954a0b71124aee517fbe895e5416ddb4d5af9d83c599ee2c4f94cb25e8597f9e5978bd63a7cdcb70100000000000007bcfffffffb00000000000005e2000000014db2995d00000000dd8f775f00000000000000020000000041c7df9b00000000dd8f775f0000000000000003010000000000622f65f4";

    it("should parse batch price attestation correctly", async function() {
        const initialized = new web3.eth.Contract(P2WImplementationFullABI, PythDataBridge.address);

        const magic = 1345476424;
        const version = 2;

        let parsed = await initialized.methods.parseBatchPriceAttestation(rawBatchPriceAttestation).call();

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
        assert.equal(parsed.attestations[0].timestamp, 1647273460);

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
        assert.equal(parsed.attestations[1].timestamp, 1647273460);

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
        assert.equal(parsed.attestations[2].timestamp, 1647273460);

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
        assert.equal(parsed.attestations[3].timestamp, 1647273460);
    })

    async function attest(contract, data) {
        const accounts = await web3.eth.getAccounts();

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

        let result = await contract.methods.attestPriceBatch("0x"+vm).send({
            value : 0,
            from : accounts[0],
            gasLimit : 2000000
        });
    }

    it("should attest price updates over wormhole", async function() {
        const initialized = new web3.eth.Contract(P2WImplementationFullABI, PythDataBridge.address);

        await attest(initialized, rawBatchPriceAttestation);
    })

    it("should cache price updates", async function() {
        const initialized = new web3.eth.Contract(P2WImplementationFullABI, PythDataBridge.address);

        await attest(initialized, rawBatchPriceAttestation);

        let first = await initialized.methods.latestPriceInfo("0xc1902e05cdf03bc089a943d921f87ccd0e3e1b774b5660d037b9f428c0d3305e").call();
        assert.equal(first.price.id, "0xc1902e05cdf03bc089a943d921f87ccd0e3e1b774b5660d037b9f428c0d3305e");
        assert.equal(first.price.productId, "0xc0e11df4c58a4e53f2bc059ba57a7c8f30ddada70b5bdc3753f90b824b64dd73");
        assert.equal(first.price.price, 1821);
        assert.equal(first.price.conf, 3);
        assert.equal(first.price.expo, -5);
        assert.equal(first.price.status.toString(), PythSDK.PriceStatus.TRADING.toString());
        assert.equal(first.price.numPublishers, 0);
        assert.equal(first.price.maxNumPublishers, 0);
        assert.equal(first.price.emaPrice, 1527);
        assert.equal(first.price.emaConf, 3);
        assert.equal(first.attestation_time, 1647273460);

        let second = await initialized.methods.latestPriceInfo("0xfd4caca566fc44a9d6585420959d13897877c606477b3f0e7f247295b7275620").call();
        assert.equal(second.price.id, "0xfd4caca566fc44a9d6585420959d13897877c606477b3f0e7f247295b7275620");
        assert.equal(second.price.productId, "0x7090c4ecf0309718d04c5a162c08aa4b78f533f688fa2f3ccd7be74c2a253a54");
        assert.equal(second.price.price, 1088);
        assert.equal(second.price.conf, 7);
        assert.equal(second.price.expo, -5);
        assert.equal(second.price.status.toString(), PythSDK.PriceStatus.TRADING.toString());
        assert.equal(second.price.numPublishers, 0);
        assert.equal(second.price.maxNumPublishers, 0);
        assert.equal(second.price.emaPrice, 1531);
        assert.equal(second.price.emaConf, 2);
        assert.equal(second.attestation_time, 1647273460);
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
