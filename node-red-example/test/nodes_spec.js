const helper = require('./mocks/test-helper');
const path = require('path');
const should = require('should');
const { expect } = require('chai');
const { MockRED } = require('./mocks/mock-red');

// Get the mock node
const proxyNodeFactory = require('./mocks/deploy-proxy');

describe('Morpheus Nodes Registration', function() {
    let RED;
    let proxyNode;

    before(function(done) {
        helper.init(require.resolve('node-red'));
        helper.startServer(done);
    });

    after(function(done) {
        helper.stopServer(done);
    });

    beforeEach(function(done) {
        helper.unload()
            .then(() => {
                RED = helper.RED;
                proxyNode = proxyNodeFactory(RED);
                helper.load([proxyNode], [], done);
            })
            .catch(done);
    });

    afterEach(function(done) {
        helper.unload().then(() => done()).catch(done);
    });

    describe('deploy-proxy Node', function() {
        it('should be loaded with correct properties', function(done) {
            const nodeType = helper.RED.nodes.getType('deploy-proxy');
            expect(nodeType).to.exist;
            expect(nodeType).to.have.property('name', 'deploy-proxy');
            done();
        });

        it('should register with correct category and palette label', function(done) {
            const nodeType = helper.RED.nodes.getType('deploy-proxy');
            expect(nodeType).to.exist;
            expect(nodeType).to.have.property('category', 'morpheus');
            expect(nodeType).to.have.property('paletteLabel', 'deploy proxy');
            done();
        });

        it('should generate correct label based on name or default', function(done) {
            const nodeType = helper.RED.nodes.getType('deploy-proxy');
            expect(nodeType).to.exist;

            // Create a node instance with a name
            const node1 = helper.getNode('n1');
            expect(node1).to.have.property('name', 'Test Node');
            expect(node1).to.have.property('label', 'Test Node');

            // Create a node instance without a name
            const node2 = helper.getNode('n2');
            expect(node2.name).to.be.empty;
            expect(node2.label).to.equal('deploy proxy');

            done();
        });

        it('should validate required fields', function(done) {
            const nodeType = helper.RED.nodes.getType('deploy-proxy');
            expect(nodeType).to.exist;
            expect(nodeType.defaults).to.exist;

            // Check required fields
            expect(nodeType.defaults.name).to.exist;
            expect(nodeType.defaults.name.value).to.equal('');
            expect(nodeType.defaults.name.required).to.be.false;

            expect(nodeType.defaults.config).to.exist;
            expect(nodeType.defaults.config.type).to.equal('deploy-config');
            expect(nodeType.defaults.config.required).to.be.true;

            done();
        });

        it('should have correct input and output definitions', function(done) {
            const nodeType = helper.RED.nodes.getType('deploy-proxy');
            expect(nodeType).to.exist;
            expect(nodeType.inputs).to.equal(1);
            expect(nodeType.outputs).to.equal(1);
            done();
        });
    });
}); 