const { MockNode } = require('./mock-red');

module.exports = function(RED) {
    class DeployConfigNode extends MockNode {
        constructor(config) {
            super(config);
            
            // Copy configuration
            this.name = config.name || '';
            this.projectId = config.projectId || '';
            this.region = config.region || '';
            
            // Set valid state based on required parameters
            this.valid = !!(this.projectId && this.region);
        }
    }

    // Register node type
    if (RED && RED.nodes && typeof RED.nodes.registerType === 'function') {
        RED.nodes.registerType("deploy-config", DeployConfigNode, {
            category: 'config',
            defaults: {
                name: { value: "" },
                projectId: { value: "", required: true },
                region: { value: "", required: true }
            }
        });
    }

    return DeployConfigNode;
}; 