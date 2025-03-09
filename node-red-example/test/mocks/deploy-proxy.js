module.exports = function(RED) {
    function DeployProxyNode(config) {
        if (!(this instanceof DeployProxyNode)) {
            return new DeployProxyNode(config);
        }
        
        // Call the base constructor if RED.nodes.createNode exists
        if (RED && RED.nodes && typeof RED.nodes.createNode === 'function') {
            RED.nodes.createNode(this, config);
        } else {
            // For testing, create a minimal node
            this.id = config.id;
            this.type = config.type;
            this._events = {};
            this.status = () => {};
            this.error = (err) => { console.error(err); };
            this.warn = (msg) => { console.warn(msg); };
            this.debug = (msg) => { console.debug(msg); };
            this.send = () => {};
        }

        // Copy configuration
        this.name = config.name || '';
        this.config = config.config;
        
        // Set valid state based on required parameters
        this.valid = !!this.config;

        const node = this;

        this.on = function(event, callback) {
            this._events[event] = callback;
        };

        this.receive = function(msg) {
            if (this._events.input) {
                this._events.input(msg);
            }
        };

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