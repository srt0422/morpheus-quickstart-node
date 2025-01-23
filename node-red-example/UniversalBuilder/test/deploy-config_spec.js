const helper = require('node-red-node-test-helper');
const deployConfig = require('../nodes/deploy-config.js');
const { expect } = require('chai');
const sinon = require('sinon');

helper.init(require.resolve('node-red'));

describe('deploy-config Node', function() {
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
            type: "deploy-config",
            name: "test config"
        }];

        await helper.load(deployConfig, flow);
        const n1 = helper.getNode("n1");
        expect(n1).to.have.property('name', 'test config');
    });

    it('should validate required configuration fields', async function() {
        const flow = [{
            id: "n1",
            type: "deploy-config",
            name: "test config",
            dockerRegistry: "test-registry",
            proxyImage: "test-proxy",
            consumerImage: "test-consumer",
            proxyPort: "8080",
            consumerPort: "3333",
            projectId: "test-project",
            region: "test-region",
            zone: "test-zone"
        }];

        await helper.load(deployConfig, flow);
        const n1 = helper.getNode("n1");
        expect(n1).to.have.property('dockerRegistry', 'test-registry');
        expect(n1).to.have.property('proxyImage', 'test-proxy');
        expect(n1).to.have.property('consumerImage', 'test-consumer');
        expect(n1).to.have.property('proxyPort', '8080');
        expect(n1).to.have.property('consumerPort', '3333');
        expect(n1).to.have.property('projectId', 'test-project');
        expect(n1).to.have.property('region', 'test-region');
        expect(n1).to.have.property('zone', 'test-zone');
    });

    it('should pass configuration to the next node', async function() {
        const flow = [
            {
                id: "n1",
                type: "deploy-config",
                name: "test config",
                dockerRegistry: "test-registry",
                wires: [["n2"]]
            },
            { id: "n2", type: "helper" }
        ];

        await helper.load(deployConfig, flow);
        const n2 = helper.getNode("n2");
        const n1 = helper.getNode("n1");

        return new Promise((resolve) => {
            n2.on("input", function(msg) {
                try {
                    expect(msg).to.have.nested.property('config.dockerRegistry', 'test-registry');
                    resolve();
                } catch (err) {
                    resolve(err);
                }
            });
            n1.receive({payload: ""});
        });
    });

    it('should handle missing optional fields', async function() {
        const flow = [{
            id: "n1",
            type: "deploy-config",
            name: "test config",
            dockerRegistry: "test-registry"
        }];

        await helper.load(deployConfig, flow);
        const n1 = helper.getNode("n1");
        expect(n1).to.have.property('dockerRegistry', 'test-registry');
        expect(n1.proxyPort).to.be.undefined;
    });
}); 