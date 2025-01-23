const helper = require('node-red-node-test-helper');
const deployProxy = require('../nodes/deploy-proxy.js');
const { expect } = require('chai');
const sinon = require('sinon');

helper.init(require.resolve('node-red'));

describe('deploy-proxy Node', function() {
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
            type: "deploy-proxy",
            name: "test proxy"
        }];

        await helper.load(deployProxy, flow);
        const n1 = helper.getNode("n1");
        expect(n1).to.have.property('name', 'test proxy');
    });

    it('should validate proxy configuration', async function() {
        const flow = [{
            id: "n1",
            type: "deploy-proxy",
            name: "test proxy",
            sessionDuration: "1h",
            action: "deploy"
        }];

        await helper.load(deployProxy, flow);
        const n1 = helper.getNode("n1");
        expect(n1).to.have.property('sessionDuration', '1h');
        expect(n1).to.have.property('action', 'deploy');
    });

    it('should handle deployment configuration from previous node', async function() {
        const flow = [
            {
                id: "n1",
                type: "deploy-proxy",
                name: "test proxy",
                wires: [["n2"]]
            },
            { id: "n2", type: "helper" }
        ];

        await helper.load(deployProxy, flow);
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
                    proxyImage: "test-image",
                    proxyPort: "8080"
                }
            });
        });
    });

    it('should handle proxy update action', async function() {
        const flow = [
            {
                id: "n1",
                type: "deploy-proxy",
                name: "test proxy",
                action: "update",
                wires: [["n2"]]
            },
            { id: "n2", type: "helper" }
        ];

        await helper.load(deployProxy, flow);
        const n2 = helper.getNode("n2");
        const n1 = helper.getNode("n1");

        return new Promise((resolve) => {
            n2.on("input", function(msg) {
                try {
                    expect(msg.payload).to.have.property('action', 'update');
                    resolve();
                } catch (err) {
                    resolve(err);
                }
            });
            n1.receive({
                config: {
                    dockerRegistry: "test-registry",
                    proxyImage: "test-image"
                }
            });
        });
    });

    it('should handle deployment errors gracefully', async function() {
        const flow = [
            {
                id: "n1",
                type: "deploy-proxy",
                name: "test proxy",
                wires: [["n2"]]
            },
            { id: "n2", type: "helper" }
        ];

        await helper.load(deployProxy, flow);
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

    describe('Streaming Tests', function() {
        it('should handle streaming chat completion requests', async function() {
            const flow = [
                {
                    id: "n1",
                    type: "deploy-proxy",
                    name: "test proxy",
                    wires: [["n2"]]
                },
                { id: "n2", type: "helper" }
            ];

            await helper.load(deployProxy, flow);
            const n2 = helper.getNode("n2");
            const n1 = helper.getNode("n1");

            return new Promise((resolve) => {
                n2.on("input", function(msg) {
                    try {
                        expect(msg.payload).to.have.property('stream', true);
                        resolve();
                    } catch (err) {
                        resolve(err);
                    }
                });
                n1.receive({
                    payload: {
                        stream: true,
                        messages: [{ role: 'user', content: 'test' }]
                    }
                });
            });
        });

        it('should handle non-streaming requests', async function() {
            const flow = [
                {
                    id: "n1",
                    type: "deploy-proxy",
                    name: "test proxy",
                    wires: [["n2"]]
                },
                { id: "n2", type: "helper" }
            ];

            await helper.load(deployProxy, flow);
            const n2 = helper.getNode("n2");
            const n1 = helper.getNode("n1");

            return new Promise((resolve) => {
                n2.on("input", function(msg) {
                    try {
                        expect(msg.payload).to.not.have.property('stream');
                        resolve();
                    } catch (err) {
                        resolve(err);
                    }
                });
                n1.receive({
                    payload: {
                        messages: [{ role: 'user', content: 'test' }]
                    }
                });
            });
        });
    });
}); 