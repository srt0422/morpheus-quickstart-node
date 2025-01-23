const helper = require('node-red-node-test-helper');
const path = require('path');
const fs = require('fs');
let expect;

// Initialize helper with Node-RED runtime
helper.init(require.resolve('node-red'));

before(async function() {
    const chai = await import('chai');
    expect = chai.expect;
});

describe('E2E Deployment Flow', function() {
    this.timeout(900000); // 15 minutes total timeout

    // Define test flow
    const flowPath = path.join(__dirname, '..', 'flows.json');
    const flows = JSON.parse(fs.readFileSync(flowPath, 'utf8'));
    const deploymentFlow = flows.filter(node => 
        node.type === 'tab' && node.label === 'Morpheus Deployment Flow' || 
        node.z === 'deployment-flow'
    );

    // Load required nodes
    const deployConfig = require('../../../UniversalBuilder/nodes/deploy-config');
    const deployProxy = require('../../../UniversalBuilder/nodes/deploy-proxy');
    const deployConsumer = require('../../../UniversalBuilder/nodes/deploy-consumer');
    const deployWebapp = require('../../../UniversalBuilder/nodes/deploy-webapp');

    beforeEach(function(done) {
        console.log('=== Setting up test environment ===');
        // Clean up runtime
        helper.unload();
        
        // Start server and load nodes
        console.log('Loading nodes and starting server...');
        helper.load([
            deployConfig,
            deployProxy,
            deployConsumer,
            deployWebapp,
            require('@node-red/nodes/core/common/20-inject'),
            require('@node-red/nodes/core/common/21-debug')
        ], deploymentFlow, function() {
            console.log('Nodes loaded, starting server...');
            helper.startServer(function() {
                console.log('Server started');
                // Add event listeners to all nodes in the flow
                deploymentFlow.forEach(node => {
                    const loadedNode = helper.getNode(node.id);
                    if (loadedNode) {
                        console.log(`Node loaded: ${node.id} (${node.type})`);
                        // Add error event listener
                        loadedNode.on('error', function(err) {
                            console.error(`Error in node ${node.id}:`, err);
                        });
                        // Add input event listener
                        loadedNode.on('input', function(msg) {
                            console.log(`Node ${node.id} received input:`, msg);
                        });
                    } else {
                        console.warn(`Failed to load node: ${node.id} (${node.type})`);
                    }
                });
                done();
            });
        });
    });

    afterEach(function(done) {
        console.log('=== Cleaning up test environment ===');
        helper.unload().then(function() {
            helper.stopServer(done);
        });
    });

    it('should deploy and configure services correctly', function(done) {
        console.log('\n=== Starting Deployment Flow Test ===');
        console.log('Loading deployment flow:', JSON.stringify(deploymentFlow, null, 2));

        // Get the inject node that starts the flow
        const startNode = helper.getNode("start1");
        if (!startNode) {
            console.error('Failed to load start node');
            done(new Error('Failed to load start node'));
            return;
        }
        console.log('Start node loaded successfully');
        
        // Get the debug node
        const debugNode = helper.getNode("debug1");
        if (!debugNode) {
            console.error('Failed to load debug node');
            done(new Error('Failed to load debug node'));
            return;
        }
        console.log('Debug node loaded successfully');
        
        // Add input listener to debug node
        debugNode.on("input", function(msg) {
            console.log('\nDebug node received message:', JSON.stringify(msg.payload, null, 2));
            
            if (msg.payload.status === 'success') {
                if (msg.payload.webappUrl) {
                    console.log('Deployment completed successfully');
                    done();
                } else {
                    console.log('Success status but no webappUrl');
                }
            } else if (msg.payload.status === 'error') {
                console.error('Deployment failed:', msg.payload.error);
                done(new Error(msg.payload.error));
            } else {
                console.log('Unexpected message status:', msg.payload.status);
            }
        });
        
        // Add error listener to debug node
        debugNode.on("error", function(err) {
            console.error('Debug node error:', err);
        });
        
        console.log('Starting flow execution...');
        // Start the flow with an empty message
        startNode.receive({});
        console.log('Flow triggered');
    });
}); 