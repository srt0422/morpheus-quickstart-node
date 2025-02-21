const { MockNode } = require('./mock-red');

module.exports = function(RED) {
    class DeployProxyNode extends MockNode {
        constructor(config) {
            super(config);
            
            // Copy configuration
            this.name = config.name || '';
            this.config = config.config;
            
            // Set valid state based on required parameters
            this.valid = !!this.config;

            const node = this;

            this.on('input', async function(msg) {
                try {
                    // Validate required configuration
                    if (!node.config) {
                        msg.payload = {
                            status: 'error',
                            error: 'Missing required configuration'
                        };
                        node.send(msg);
                        return;
                    }

                    // Mock successful deployment
                    msg.payload = {
                        status: 'success',
                        proxyUrl: 'http://localhost:8080'
                    };
                    
                    node.send(msg);
                } catch (error) {
                    msg.payload = {
                        status: 'error',
                        error: error.message
                    };
                    node.send(msg);
                }
            });
        }
    }

    // Register node type
    if (RED && RED.nodes && typeof RED.nodes.registerType === 'function') {
        RED.nodes.registerType("deploy-proxy", DeployProxyNode, {
            category: 'morpheus',
            color: '#a6bbcf',
            defaults: {
                name: { value: "" },
                config: { type: "deploy-config", required: true }
            },
            inputs: 1,
            outputs: 1,
            icon: "file.png",
            label: function() {
                return this.name || "deploy proxy";
            },
            paletteLabel: "deploy proxy"
        });
    }

    return DeployProxyNode;
}; 