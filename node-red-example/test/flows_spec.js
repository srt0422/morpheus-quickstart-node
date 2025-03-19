const path = require('path');
const fs = require('fs');
const { expect } = require('chai');

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

// Helper function to get required node types for a flow
function getRequiredNodeTypes(flow) {
    if (!Array.isArray(flow)) {
        throw new Error('Flow must be an array');
    }

    // Skip special node types
    const skipTypes = ['tab', 'link in', 'link out'];
    
    // Extract unique node types
    const nodeTypes = Array.from(new Set(
        flow
            .filter(node => !skipTypes.includes(node.type))
            .map(node => node.type)
    ));
    
    return nodeTypes;
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

describe('Node Type Analysis Tests', function() {
    it('should identify required node types correctly', function() {
        const flow = [
            { id: 'tab1', type: 'tab', label: 'Test Flow' },
            { id: 'n1', type: 'inject', z: 'tab1' },
            { id: 'n2', type: 'function', z: 'tab1' },
            { id: 'n3', type: 'debug', z: 'tab1' },
            { id: 'n4', type: 'link out', z: 'tab1', links: ['n5'] },
            { id: 'n5', type: 'link in', z: 'tab1' }
        ];
        
        const types = getRequiredNodeTypes(flow);
        expect(types).to.have.members(['inject', 'function', 'debug']);
        expect(types).to.not.include('tab');
        expect(types).to.not.include('link out');
        expect(types).to.not.include('link in');
    });

    it('should handle empty flow', function() {
        const types = getRequiredNodeTypes([]);
        expect(types).to.be.an('array').that.is.empty;
    });

    it('should handle flow with only special nodes', function() {
        const flow = [
            { id: 'tab1', type: 'tab', label: 'Test Flow' },
            { id: 'n4', type: 'link out', z: 'tab1', links: ['n5'] },
            { id: 'n5', type: 'link in', z: 'tab1' }
        ];
        
        const types = getRequiredNodeTypes(flow);
        expect(types).to.be.an('array').that.is.empty;
    });
});

describe('Deployment Flow Analysis', function() {
    // Only run this test if flows.json exists
    const flowPath = path.join(__dirname, '..', 'flows.json');
    const flowsExist = fs.existsSync(flowPath);
    
    (flowsExist ? it : it.skip)('should extract deployment flow from flows.json', function() {
        if (!flowsExist) this.skip();
        
        const allFlows = JSON.parse(fs.readFileSync(flowPath, 'utf8'));
        
        try {
            const deploymentFlow = extractTestFlow('Morpheus Deployment Flow', allFlows);
            expect(deploymentFlow).to.be.an('array');
            expect(deploymentFlow[0]).to.have.property('type', 'tab');
            
            const nodeTypes = getRequiredNodeTypes(deploymentFlow);
            console.log('Node types required for deployment flow:', nodeTypes);
            
            // Check for expected node types (adjust based on your actual flow)
            expect(nodeTypes).to.include.any.members(['deploy-proxy', 'deploy-config']);
        } catch (err) {
            if (err.message.includes('not found')) {
                console.log('Flow "Morpheus Deployment Flow" not found in flows.json');
                this.skip();
            } else {
                throw err;
            }
        }
    });
    
    it('should validate flow structure for deployment', function() {
        // Create a minimal deployment flow
        const mockDeployFlow = [
            { id: 'tab1', type: 'tab', label: 'Deployment Flow' },
            { id: 'config1', type: 'deploy-config', z: 'tab1', projectId: 'test', region: 'us-west1' },
            { id: 'inject1', type: 'inject', z: 'tab1', wires: [['proxy1']] },
            { id: 'proxy1', type: 'deploy-proxy', z: 'tab1', config: 'config1', wires: [['debug1']] },
            { id: 'debug1', type: 'debug', z: 'tab1' }
        ];
        
        // Validate flow structure
        const hasConfig = mockDeployFlow.some(n => n.type === 'deploy-config');
        const hasProxy = mockDeployFlow.some(n => n.type === 'deploy-proxy');
        const proxyNode = mockDeployFlow.find(n => n.type === 'deploy-proxy');
        
        expect(hasConfig).to.be.true;
        expect(hasProxy).to.be.true;
        expect(proxyNode).to.have.property('config', 'config1');
        
        // Verify wiring
        const injectNode = mockDeployFlow.find(n => n.type === 'inject');
        expect(injectNode.wires[0]).to.include(proxyNode.id);
        
        const proxyWires = proxyNode.wires;
        expect(proxyWires[0]).to.include(mockDeployFlow.find(n => n.type === 'debug').id);
    });
}); 