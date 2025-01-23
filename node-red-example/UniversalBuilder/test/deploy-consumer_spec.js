const helper = require('node-red-node-test-helper');
const deployConsumer = require('../nodes/deploy-consumer.js');
const { expect } = require('chai');
const sinon = require('sinon');

helper.init(require.resolve('node-red'));

describe('deploy-consumer Node', function() {
    beforeEach(function(done) {
        helper.startServer(done);
    });

    afterEach(function(done) {
        helper.unload();
        helper.stopServer(done);
    });

    it('should be loaded with correct defaults', async function() {
        const flow = [{
            id: "n1",
            type: "deploy-consumer",
            name: "test consumer"
        }];

        await helper.load(deployConsumer, flow);
        const n1 = helper.getNode("n1");
        expect(n1).to.have.property('name', 'test consumer');
    });

    it('should validate blockchain configuration', async function() {
        const flow = [{
            id: "n1",
            type: "deploy-consumer",
            name: "test consumer",
            walletKey: "test-key",
            contractAddress: "0x123",
            blockchainWsUrl: "ws://test",
            blockchainHttpUrl: "http://test"
        }];

        await helper.load(deployConsumer, flow);
        const n1 = helper.getNode("n1");
        expect(n1).to.have.property('walletKey', 'test-key');
        expect(n1).to.have.property('contractAddress', '0x123');
        expect(n1).to.have.property('blockchainWsUrl', 'ws://test');
        expect(n1).to.have.property('blockchainHttpUrl', 'http://test');
    });

    it('should handle deployment configuration from previous node', async function() {
        const flow = [
            {
                id: "n1",
                type: "deploy-consumer",
                name: "test consumer",
                wires: [["n2"]]
            },
            { id: "n2", type: "helper" }
        ];

        await helper.load(deployConsumer, flow);
        const n2 = helper.getNode("n2");
        const n1 = helper.getNode("n1");

        return new Promise((resolve) => {
            n2.on("input", function(msg) {
                try {
                    expect(msg).to.have.property('payload');
                    expect(msg.payload).to.have.property('status');
                    resolve();
                } catch (err) {
                    resolve(err);
                }
            });
            n1.receive({
                config: {
                    dockerRegistry: "test-registry",
                    consumerImage: "test-image",
                    consumerPort: "3333"
                }
            });
        });
    });

    it('should handle deployment errors gracefully', async function() {
        const flow = [
            {
                id: "n1",
                type: "deploy-consumer",
                name: "test consumer",
                wires: [["n2"]]
            },
            { id: "n2", type: "helper" }
        ];

        await helper.load(deployConsumer, flow);
        const n2 = helper.getNode("n2");
        const n1 = helper.getNode("n1");

        return new Promise((resolve) => {
            n2.on("input", function(msg) {
                try {
                    expect(msg.payload).to.have.property('error');
                    resolve();
                } catch (err) {
                    resolve(err);
                }
            });
            // Send message without required config
            n1.receive({payload: "test"});
        });
    });

    it('should validate environment variables', async function() {
        process.env.WALLET_KEY = 'test-wallet-key';
        process.env.CONTRACT_ADDRESS = 'test-contract-address';

        const flow = [{
            id: "n1",
            type: "deploy-consumer",
            name: "test consumer",
            walletKey: "${WALLET_KEY}",
            contractAddress: "${CONTRACT_ADDRESS}"
        }];

        await helper.load(deployConsumer, flow);
        const n1 = helper.getNode("n1");
        expect(n1.walletKey).to.equal('test-wallet-key');
        expect(n1.contractAddress).to.equal('test-contract-address');

        // Cleanup
        delete process.env.WALLET_KEY;
        delete process.env.CONTRACT_ADDRESS;
    });
}); 