const { MockRED } = require('./mock-red');

let RED;

module.exports = {
    init: function(settings) {
        RED = new MockRED();
        this.RED = RED;
    },

    load: function(nodeList, testFlow, done) {
        // Clear any existing nodes
        RED.nodes.clear();

        // Register node types
        nodeList.forEach(node => {
            if (typeof node === 'function') {
                try {
                    const NodeConstructor = node(RED);
                    if (NodeConstructor && typeof NodeConstructor === 'function') {
                        // Store constructor for later use
                        RED.nodes.nodeConstructors = RED.nodes.nodeConstructors || new Map();
                        RED.nodes.nodeConstructors.set(NodeConstructor.name, NodeConstructor);
                    }
                } catch (err) {
                    console.warn('Failed to register node:', err.message);
                }
            }
        });

        // Create test nodes
        testFlow.forEach(n => {
            try {
                const nodeType = RED.nodes.getType(n.type);
                if (nodeType) {
                    const NodeConstructor = RED.nodes.nodeConstructors.get(nodeType.constructor.name);
                    if (NodeConstructor) {
                        const node = new NodeConstructor(n);
                        RED.nodes.createNode(node, n);
                    }
                }
            } catch (err) {
                console.warn(`Failed to create node ${n.type}:`, err.message);
            }
        });

        done();
    },

    unload: function() {
        return new Promise((resolve) => {
            RED.nodes.clear();
            resolve();
        });
    },

    getNode: function(id) {
        return RED.nodes.getNode(id);
    },

    startServer: function(done) {
        done();
    },

    stopServer: function(done) {
        done();
    },

    RED: RED
}; 