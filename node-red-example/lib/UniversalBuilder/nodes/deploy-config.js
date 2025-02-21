module.exports = function(RED) {
    function ConfigNode(config) {
        RED.nodes.createNode(this, config);
        
        // Store configuration
        this.name = config.name;
        this.dockerRegistry = config.dockerRegistry;
        this.proxyImage = config.proxyImage;
        this.consumerImage = config.consumerImage;
        this.proxyPort = config.proxyPort;
        this.consumerPort = config.consumerPort;
        this.projectId = config.projectId;
        this.region = config.region;
        this.zone = config.zone;
        
        this.on('input', function(msg) {
            const marketplacePort = this.env?.MARKETPLACE_PORT || msg.config?.env?.MARKETPLACE_PORT || this.consumerPort;
            
            // Pass configuration to next node
            msg.config = {
                dockerRegistry: this.dockerRegistry,
                proxyImage: this.proxyImage,
                consumerImage: this.consumerImage,
                proxyPort: this.proxyPort,
                consumerPort: marketplacePort,
                projectId: this.projectId,
                region: this.region,
                zone: this.zone,
                env: {
                    ...(this.env || {}),
                    ...(msg.config?.env || {}),
                    MARKETPLACE_PORT: marketplacePort,
                    SESSION_DURATION: "1h"
                }
            };
            this.send(msg);
        });

        // Clean up resources when node is removed
        this.on('close', function() {
            // Cleanup code
        });
    }
    
    ConfigNode.prototype.label = function() {
        return this.name || "Config";
    };
    
    RED.nodes.registerType("deploy-config", ConfigNode, {
        category: "config",
        defaults: {
            name: { value: "" },
            walletCredentials: { value: "", required: true },
            apiKey: { value: "" },
            environmentVars: { value: {} }
        },
        credentials: {
            walletSecret: { type: "password" }
        },
        label: function() {
            return this.name || "Configuration";
        },
        paletteLabel: "Configuration"
    });
} 