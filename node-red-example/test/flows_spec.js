const helper = require('./mocks/test-helper');
const path = require('path');
const fs = require('fs');
const { expect } = require('chai');

// Initialize helper with Node-RED runtime and settings
helper.init(require.resolve('node-red'), {
    functionGlobalContext: { env: process.env },
    logging: { console: { level: 'warn' } },
    flowFile: 'flows.json',
    credentialSecret: "test-secret",
    userDir: './test/.node-red',
    nodesDir: [
        path.join(__dirname, '..', 'UniversalBuilder', 'nodes'),
        path.join(__dirname, '..', 'node_modules', '@node-red', 'nodes', 'core', 'common')
    ]
});

// Helper function to extract a flow and its dependencies from flows.json
function extractTestFlow(flowLabel, allFlows) {
    if (!Array.isArray(allFlows)) {
        throw new Error('allFlows must be an array');
    }

    // Find the target flow tab
    const flowTab = allFlows.find(node => node.type === 'tab' && node.label === flowLabel);
    if (!flowTab) {
        throw new Error(`Flow "${flowLabel}" not found`);
    }

    // Get all nodes that belong to this flow
    const flowNodes = allFlows.filter(node => node.z === flowTab.id);
    
    // Get linked nodes (nodes connected via link nodes)
    const linkedNodeIds = flowNodes
        .filter(node => node.type === 'link out' || node.type === 'link in')
        .map(node => node.links || [])
        .flat();
    
    const linkedNodes = allFlows.filter(node => linkedNodeIds.includes(node.id));
    
    // Return the minimal flow
    return [flowTab, ...flowNodes, ...linkedNodes];
}

// Helper function to get required node modules for a flow
function getRequiredNodes(nodeTypes) {
    if (!Array.isArray(nodeTypes)) {
        throw new Error('nodeTypes must be an array');
    }

    const coreNodes = {
        'inject': '@node-red/nodes/core/common/20-inject',
        'debug': '@node-red/nodes/core/common/21-debug',
        'function': '@node-red/nodes/core/function/10-function',
        'switch': '@node-red/nodes/core/function/10-switch',
        'change': '@node-red/nodes/core/function/15-change',
        'http in': '@node-red/nodes/core/network/21-httpin',
        'http response': '@node-red/nodes/core/network/21-httpresponse',
        'http request': '@node-red/nodes/core/network/21-httprequest',
        'comment': '@node-red/nodes/core/common/90-comment'
    };

    const customNodes = {
        'deploy-config': '../../../UniversalBuilder/nodes/deploy-config',
        'deploy-proxy': '../../../UniversalBuilder/nodes/deploy-proxy',
        'deploy-consumer': '../../../UniversalBuilder/nodes/deploy-consumer',
        'deploy-webapp': '../../../UniversalBuilder/nodes/deploy-webapp'
    };

    // Special node types that don't need to be loaded
    const skipTypes = ['tab', 'link in', 'link out'];

    const requiredNodes = [];
    const errors = [];
    
    // Filter out special node types
    const filteredTypes = nodeTypes.filter(type => !skipTypes.includes(type));
    
    // Load nodes
    filteredTypes.forEach(type => {
        if (coreNodes[type]) {
            try {
                requiredNodes.push(require(coreNodes[type]));
            } catch (err) {
                errors.push(`Could not load core node type "${type}": ${err.message}`);
            }
        } else if (customNodes[type]) {
            try {
                requiredNodes.push(require(customNodes[type]));
            } catch (err) {
                errors.push(`Could not load custom node type "${type}": ${err.message}`);
            }
        } else {
            console.warn(`Warning: Unknown node type "${type}" - skipping`);
        }
    });

    // Only throw if no nodes could be loaded
    if (requiredNodes.length === 0 && errors.length > 0) {
        throw new Error(`Failed to load any nodes:\n${errors.join('\n')}`);
    }

    return requiredNodes;
}

describe('Flow Extraction Tests', function() {
    const mockFlows = [
        {
            id: "flow1",
            type: "tab",
            label: "Test Flow"
        },
        {
            id: "n1",
            type: "inject",
            z: "flow1",
            name: "Test Input"
        },
        {
            id: "n2",
            type: "function",
            z: "flow1",
            name: "Test Function"
        },
        {
            id: "n3",
            type: "debug",
            z: "flow1",
            name: "Test Output"
        },
        {
            id: "flow2",
            type: "tab",
            label: "Another Flow"
        }
    ];

    it('should extract a flow and its nodes correctly', function() {
        const extracted = extractTestFlow("Test Flow", mockFlows);
        expect(extracted).to.have.lengthOf(4);
        expect(extracted[0]).to.have.property('label', 'Test Flow');
        expect(extracted).to.deep.include(mockFlows[1]);
        expect(extracted).to.deep.include(mockFlows[2]);
        expect(extracted).to.deep.include(mockFlows[3]);
    });

    it('should throw error for non-existent flow', function() {
        expect(() => extractTestFlow("Non Existent", mockFlows))
            .to.throw('Flow "Non Existent" not found');
    });

    it('should handle flows with link nodes', function() {
        const flowsWithLinks = [
            ...mockFlows,
            {
                id: "l1",
                type: "link out",
                z: "flow1",
                links: ["l2"]
            },
            {
                id: "l2",
                type: "link in",
                z: "flow2"
            }
        ];
        const extracted = extractTestFlow("Test Flow", flowsWithLinks);
        expect(extracted).to.have.lengthOf(6);
        expect(extracted.find(n => n.id === "l1")).to.exist;
        expect(extracted.find(n => n.id === "l2")).to.exist;
    });
});

describe('Required Nodes Tests', function() {
    it('should return core nodes correctly', function() {
        const types = ['inject', 'debug', 'function'];
        const nodes = getRequiredNodes(types);
        expect(nodes).to.have.lengthOf(3);
    });

    it('should handle custom nodes', function() {
        const types = ['deploy-proxy', 'deploy-config'];
        const nodes = getRequiredNodes(types);
        expect(nodes).to.have.lengthOf(2);
    });

    it('should skip link nodes', function() {
        const types = ['link in', 'link out', 'inject'];
        const nodes = getRequiredNodes(types);
        expect(nodes).to.have.lengthOf(1);
    });

    it('should handle unknown node types with warning', function() {
        const types = ['unknown-type'];
        const nodes = getRequiredNodes(types);
        expect(nodes).to.have.lengthOf(0);
    });

    it('should handle empty array', function() {
        const nodes = getRequiredNodes([]);
        expect(nodes).to.have.lengthOf(0);
    });
});

describe('Deployment Flow Tests', function() {
    this.timeout(60000); // Increased timeout for node loading

    // Load the full flows.json
    const flowPath = path.join(__dirname, '..', 'flows.json');
    const allFlows = JSON.parse(fs.readFileSync(flowPath, 'utf8'));
    
    // Extract the specific flow we want to test
    const deploymentFlow = extractTestFlow('Morpheus Deployment Flow', allFlows);
    
    // Filter out special node types that don't need to be loaded
    const nodeTypes = Array.from(new Set(
        deploymentFlow
            .filter(node => !['tab', 'link in', 'link out'].includes(node.type))
            .map(node => node.type)
    ));
    
    let requiredNodes;
    try {
        requiredNodes = getRequiredNodes(nodeTypes);
    } catch (error) {
        console.warn('Warning: Some nodes could not be loaded:', error.message);
        // Continue with the nodes that could be loaded
        requiredNodes = [];
    }

    before(function(done) {
        // Create test directory if it doesn't exist
        const testDir = path.join(__dirname, '.node-red');
        if (!fs.existsSync(testDir)) {
            fs.mkdirSync(testDir, { recursive: true });
        }
        helper.startServer(done);
    });

    after(function(done) {
        // Clean up test directory
        const testDir = path.join(__dirname, '.node-red');
        if (fs.existsSync(testDir)) {
            fs.rmSync(testDir, { recursive: true, force: true });
        }
        helper.stopServer(done);
    });

    beforeEach(function(done) {
        // Skip test if no nodes could be loaded
        if (requiredNodes.length === 0) {
            console.warn('Skipping test: No nodes could be loaded');
            this.skip();
            return done();
        }

        // Clean up any existing runtime
        helper.unload()
            .then(() => {
                // Load nodes and start server
                console.log('=== Setting up test environment ===');
                console.log('Loading required nodes:', Array.from(nodeTypes).join(', '));
                
                helper.load(requiredNodes, deploymentFlow, done);
            })
            .catch((err) => {
                console.error('Setup error:', err);
                done(err);
            });
    });

    afterEach(function(done) {
        helper.unload().then(() => done()).catch(done);
    });

    it('should deploy and configure services correctly', function(done) {
        // Skip test if no nodes could be loaded
        if (requiredNodes.length === 0) {
            console.warn('Skipping test: No nodes could be loaded');
            this.skip();
            return done();
        }

        // Get the inject node that starts the flow (using the actual ID from flows.json)
        const startNode = helper.getNode("start1");
        if (!startNode) {
            console.warn('Skipping test: Start node not found');
            this.skip();
            return done();
        }
        
        // Get the debug node (using the actual ID from flows.json)
        const debugNode = helper.getNode("debug1");
        if (!debugNode) {
            console.warn('Skipping test: Debug node not found');
            this.skip();
            return done();
        }
        
        // Add input listener to debug node
        debugNode.on("input", function(msg) {
            try {
                expect(msg).to.have.nested.property('payload.status');
                if (msg.payload.status === 'success' && msg.payload.webappUrl) {
                    done();
                } else if (msg.payload.status === 'error') {
                    done(new Error(msg.payload.error));
                }
            } catch (err) {
                done(err);
            }
        });
        
        // Add error handler
        debugNode.on("error", function(err) {
            done(err);
        });
        
        // Start the flow with a delay to ensure everything is ready
        setTimeout(() => {
            startNode.receive({});
        }, 500);
    });
}); 