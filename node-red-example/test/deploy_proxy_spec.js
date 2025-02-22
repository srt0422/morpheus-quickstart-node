const helper = require('./mocks/test-helper');
const proxyNodeFactory = require('./mocks/deploy-proxy');
const { expect } = require('chai');

helper.init(require.resolve('node-red'));

describe('Deploy Proxy Flow', function() {
    this.timeout(10000); // Reduced timeout since we're using mocks
    
    let RED;
    let proxyNode;

    before(function(done) {
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
                
                const flow = [
                    {
                        id: "n1",
                        type: "deploy-config",
                        name: "Test Config",
                        projectId: "test-project",
                        region: "test-region"
                    },
                    {
                        id: "n2",
                        type: "deploy-proxy",
                        name: "Test Proxy",
                        config: "n1",
                        wires: [["n3"]]
                    },
                    {
                        id: "n3",
                        type: "helper"
                    }
                ];

                helper.load([proxyNode], flow, done);
            })
            .catch(done);
    });

    afterEach(function(done) {
        helper.unload().then(() => done()).catch(done);
    });

    it('should deploy proxy successfully', function(done) {
        const n2 = helper.getNode("n2");
        const n3 = helper.getNode("n3");
        
        n3.on("input", function(msg) {
            try {
                expect(msg).to.have.nested.property('payload.status', 'success');
                expect(msg).to.have.nested.property('payload.proxyUrl').that.is.a('string');
                done();
            } catch(err) {
                done(err);
            }
        });

        n2.receive({ payload: { deploy: true } });
    });

    it('should handle deployment failure gracefully', function(done) {
        const n2 = helper.getNode("n2");
        const n3 = helper.getNode("n3");

        // Force failure by removing required config
        n2.config = null;
        
        n3.on("input", function(msg) {
            try {
                expect(msg).to.have.nested.property('payload.status', 'error');
                expect(msg).to.have.nested.property('payload.error').that.is.a('string');
                done();
            } catch(err) {
                done(err);
            }
        });

        n2.receive({ payload: { deploy: true } });
    });

    it('should validate required configuration parameters', function(done) {
        const n2 = helper.getNode("n2");
        const n3 = helper.getNode("n3");

        // Remove required config
        n2.config = null;

        n3.on("input", function(msg) {
            try {
                expect(msg).to.have.nested.property('payload.status', 'error');
                expect(msg).to.have.nested.property('payload.error', 'Missing required configuration');
                done();
            } catch(err) {
                done(err);
            }
        });

        n2.receive({ payload: { deploy: true } });
    });
}); 