const env = global.get('env');

module.exports = function(RED) {
    function ConfigNode(config) {
        RED.nodes.createNode(this, config);
        
        // Store configuration
        this.name = config.name;
        this.dockerRegistry = config.dockerRegistry || env.DOCKER_REGISTRY;
        this.proxyImage = config.proxyImage || 'openai-morpheus-proxy:' + (env.NFA_PROXY_VERSION || 'latest');
        this.consumerImage = config.consumerImage || 'openai-morpheus-consumer:latest';
        this.proxyPort = config.proxyPort || '8080';
        this.consumerPort = config.consumerPort || '3333';
        this.projectId = config.projectId || env.PROJECT_ID;
        this.region = config.region || env.REGION;
        this.zone = config.zone || env.ZONE;
        
        this.on('input', function(msg) {
            const marketplacePort = this.env?.MARKETPLACE_PORT || msg.config?.env?.MARKETPLACE_PORT || this.consumerPort;
            
            // Pass configuration to next node
            msg.config = {
                dockerRegistry: msg.config?.dockerRegistry || this.dockerRegistry,
                proxyImage: msg.config?.proxyImage || this.proxyImage,
                consumerImage: msg.config?.consumerImage || this.consumerImage,
                proxyPort: msg.config?.proxyPort || this.proxyPort,
                consumerPort: marketplacePort,
                projectId: msg.config?.projectId || this.projectId,
                region: msg.config?.region || this.region,
                zone: msg.config?.zone || this.zone,
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