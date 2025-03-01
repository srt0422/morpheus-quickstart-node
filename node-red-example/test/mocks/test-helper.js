const { MockRED } = require('./mock-red');

let RED;

// Helper function to create a mock node factory
const createMockNode = (type, config) => {
    // Create a new node with input/output handling
    const node = {
        id: config.id,
        type: config.type,
        name: config.name || '',
        wires: config.wires || [],
        _events: {},
        
        // Node methods
        on: function(event, callback) {
            this._events[event] = callback;
        },
        
        receive: function(msg) {
            if (this._events.input) {
                this._events.input(msg);
            }
        },
        
        send: function(msg) {
            if (!Array.isArray(this.wires) || this.wires.length === 0) return;
            
            // Find target nodes and send message
            this.wires.forEach(wire => {
                if (!Array.isArray(wire)) return;
                
                wire.forEach(nodeId => {
                    const targetNode = RED.nodes.getNode(nodeId);
                    if (targetNode && typeof targetNode.receive === 'function') {
                        targetNode.receive(msg);
                    }
                });
            });
        },
        
        status: function() {},
        error: console.error,
        warn: console.warn,
        debug: console.debug
    };
    
    // Copy configuration properties
    Object.keys(config).forEach(key => {
        if (!node[key] && key !== 'id' && key !== 'type' && key !== 'wires') {
            node[key] = config[key];
        }
    });
    
    return node;
};

module.exports = {
    init: function(settings) {
        RED = new MockRED();
        this.RED = RED;
    },

    load: function(nodeFactories, testFlow, done) {
        // Clear any existing nodes
        RED.nodes.clear();

        // Register node types from factories
        nodeFactories.forEach(factory => {
            if (typeof factory === 'function') {
                try {
                    factory(RED);
                } catch (err) {
                    console.warn('Failed to register node:', err.message);
                }
            }
        });

        // Create helper node type for testing
        RED.nodes.registerType("helper", function(config) {
            return createMockNode("helper", config);
        }, {
            inputs: 1,
            outputs: 1
        });

        // Create nodes from flow
        testFlow.forEach(nodeConfig => {
            try {
                const node = createMockNode(nodeConfig.type, nodeConfig);
                RED.nodes.createNode(node, nodeConfig);
            } catch (err) {
                console.warn(`Failed to create node ${nodeConfig.type}:`, err.message);
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