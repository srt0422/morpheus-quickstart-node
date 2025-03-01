module.exports = function(RED) {
    function DeployConfigNode(config) {
        if (!(this instanceof DeployConfigNode)) {
            return new DeployConfigNode(config);
        }
        
        // Call the base constructor if RED.nodes.createNode exists
        if (RED && RED.nodes && typeof RED.nodes.createNode === 'function') {
            RED.nodes.createNode(this, config);
        } else {
            // For testing, create a minimal node
            this.id = config.id;
            this.type = config.type;
            this._events = {};
        }

        // Store configuration
        this.name = config.name || 'Default Config';
        this.projectId = config.projectId || 'test-project';
        this.region = config.region || 'us-central1';
        this.environment = config.environment || 'development';
    }

    // Register node type
    if (RED && RED.nodes && typeof RED.nodes.registerType === 'function') {
        RED.nodes.registerType('deploy-config', DeployConfigNode, {
            category: 'config',
            defaults: {
                name: { value: "Default Config" },
                projectId: { value: "", required: true },
                region: { value: "us-central1", required: true },
                environment: { value: "development" }
            }
        });
    }

    return DeployConfigNode;
}; 