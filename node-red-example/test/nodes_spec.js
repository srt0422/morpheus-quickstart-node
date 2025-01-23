const helper = require('node-red-node-test-helper');
const proxyNode = require('../../../UniversalBuilder/nodes/deploy-proxy');
const should = require('should');

describe('Morpheus Nodes Registration', function() {
    before(function(done) {
        helper.init(require.resolve('node-red'));
        done();
    });

    beforeEach(function(done) {
        helper.startServer(done);
    });

    afterEach(function(done) {
        helper.unload().then(function() {
            helper.stopServer(done);
        });
    });

    after(function(done) {
        helper.unload().then(function() {
            helper.stopServer(done);
        });
    });

    it('should be loaded with correct properties', function(done) {
        const flow = [{ id: "n1", type: "deploy-proxy", name: "test name" }];
        helper.load(proxyNode, flow, function() {
            try {
                // Get the node instance
                const n1 = helper.getNode("n1");
                n1.should.have.property('name', 'test name');
                n1.should.have.property('type', 'deploy-proxy');
                
                // Check if the node has the correct registration properties
                const nodeType = proxyNode.toString();
                nodeType.should.containEql('category: "Morpheus"');
                nodeType.should.containEql('label: function()');
                nodeType.should.containEql('paletteLabel: "Proxy"');
                
                // Test the label function
                const label = n1.name || "Proxy";
                label.should.equal('test name');
                
                done();
            } catch(err) {
                done(err);
            }
        });
    });
}); 