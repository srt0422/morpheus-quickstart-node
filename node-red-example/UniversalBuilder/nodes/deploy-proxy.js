const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);
const env = global.get('env');

module.exports = function(RED) {
    function ProxyNode(config) {
        RED.nodes.createNode(this, config);
        
        // Store configuration
        this.name = config.name;
        this.action = config.action;
        this.projectId = config.projectId;
        this.region = config.region;
        this.dockerRegistry = config.dockerRegistry;
        this.proxyVersion = config.proxyVersion;
        this.internalApiPort = config.internalApiPort || "8080";
        this.marketplacePort = config.marketplacePort || "3333";
        this.sessionDuration = config.sessionDuration || "1h";
        this.marketplaceBaseUrl = config.marketplaceBaseUrl;
        this.marketplaceUrl = config.marketplaceUrl;
        
        const node = this;
        
        node.on('input', async function(msg) {
            try {
                const existingPayload = msg.payload || {};
                const msgConfig = msg.config || {};
                
                // Merge configuration with message config taking precedence
                const effectiveConfig = {
                    projectId: msgConfig.projectId || this.projectId || env.PROJECT_ID,
                    region: msgConfig.region || this.region || env.REGION,
                    dockerRegistry: msgConfig.dockerRegistry || this.dockerRegistry || env.DOCKER_REGISTRY,
                    proxyVersion: msgConfig.proxyVersion || this.proxyVersion || env.NFA_PROXY_VERSION || 'latest',
                    internalApiPort: msgConfig.proxyPort || this.internalApiPort || '8080',
                    marketplacePort: msgConfig.env?.MARKETPLACE_PORT || this.marketplacePort || '3333',
                    sessionDuration: msgConfig.env?.SESSION_DURATION || this.sessionDuration || '1h',
                    marketplaceBaseUrl: this.marketplaceBaseUrl,
                    marketplaceUrl: this.marketplaceUrl
                };
                
                const imageName = `${effectiveConfig.dockerRegistry}/${msgConfig.proxyImage || 'openai-morpheus-proxy:' + effectiveConfig.proxyVersion}`;
                
                if (this.action === 'update') {
                    // Get URLs from either payload or config
                    const proxyUrl = existingPayload.proxyUrl || msgConfig.proxyUrl;
                    const consumerUrl = existingPayload.consumerUrl || msgConfig.consumerUrl;
                    
                    if (!proxyUrl || !consumerUrl) {
                        msg.payload = {
                            status: 'error',
                            action: 'update',
                            message: 'Missing required URLs for update'
                        };
                        node.send(msg);
                        return;
                    }
                    
                    // Get environment variables for update
                    const env = {
                        INTERNAL_API_PORT: effectiveConfig.internalApiPort,
                        MARKETPLACE_PORT: effectiveConfig.marketplacePort,
                        SESSION_DURATION: effectiveConfig.sessionDuration,
                        MARKETPLACE_BASE_URL: consumerUrl,
                        MARKETPLACE_URL: `${consumerUrl}/v1/chat/completions`
                    };
                    
                    // Format environment variables for gcloud command
                    const envVars = Object.entries(env)
                        .filter(([_, v]) => v !== undefined && v !== '')
                        .map(([k, v]) => `${k}=${v}`)
                        .join(',');
                    
                    // Update NFA Proxy configuration
                    const updateCmd = [
                        'gcloud run services update nfa-proxy',
                        '--platform managed',
                        `--region ${effectiveConfig.region}`,
                        `--set-env-vars "${envVars}"`
                    ].join(' ');
                    
                    console.log('Executing proxy update command:', updateCmd);
                    const { stdout: updateOutput, stderr: updateError } = await execAsync(updateCmd, {
                        maxBuffer: 10 * 1024 * 1024 // 10MB buffer
                    });
                    console.log('Proxy update output:', updateOutput);
                    if (updateError) console.error('Proxy update error:', updateError);
                    
                    msg.payload = {
                        status: 'success',
                        action: 'update',
                        proxyUrl,
                        consumerUrl,
                        output: updateOutput,
                        error: updateError
                    };
                } else {
                    // Deploy NFA Proxy
                    const deployCmd = [
                        'gcloud run deploy nfa-proxy',
                        `--image ${imageName}`,
                        '--platform managed',
                        `--region ${effectiveConfig.region}`,
                        '--allow-unauthenticated',
                        `--set-env-vars "INTERNAL_API_PORT=${effectiveConfig.internalApiPort},` +
                        `MARKETPLACE_PORT=${effectiveConfig.marketplacePort},` +
                        `SESSION_DURATION=${effectiveConfig.sessionDuration},` +
                        `MARKETPLACE_BASE_URL=${effectiveConfig.marketplaceBaseUrl || ''},` +
                        `MARKETPLACE_URL=${effectiveConfig.marketplaceUrl || ''}"`,
                    ].join(' ');
                    
                    console.log('Executing proxy deployment command:', deployCmd);
                    const { stdout: deployOutput, stderr: deployError } = await execAsync(deployCmd, {
                        maxBuffer: 10 * 1024 * 1024 // 10MB buffer
                    });
                    console.log('Proxy deployment output:', deployOutput);
                    if (deployError) console.error('Proxy deployment error:', deployError);
                    
                    // Get service URL
                    const describeCmd = [
                        'gcloud run services describe nfa-proxy',
                        `--region ${effectiveConfig.region}`,
                        '--format "value(status.url)"'
                    ].join(' ');
                    
                    console.log('Getting proxy URL:', describeCmd);
                    const { stdout: urlOutput, stderr: urlError } = await execAsync(describeCmd);
                    console.log('Proxy URL output:', urlOutput);
                    if (urlError) console.error('Proxy URL error:', urlError);
                    
                    const proxyUrl = urlOutput.trim();
                    
                    if (!proxyUrl) {
                        throw new Error('Failed to get proxy URL after deployment');
                    }
                    
                    msg.payload = {
                        status: 'success',
                        action: 'deploy',
                        proxyUrl,
                        output: deployOutput,
                        error: deployError
                    };
                }
                
                // Pass configuration to next node
                msg.config = {
                    ...msgConfig,
                    proxyUrl: msg.payload.proxyUrl,
                    consumerUrl: msg.payload.consumerUrl
                };

                node.send(msg);
            } catch (error) {
                console.error('Proxy deployment/update error:', error);
                msg.payload = {
                    status: 'error',
                    action: this.action,
                    error: error.message || 'Proxy deployment/update failed',
                    proxyUrl: msg.config?.proxyUrl || null,
                    consumerUrl: msg.config?.consumerUrl || null,
                    output: error.stdout || '',
                    stderr: error.stderr || ''
                };

                // Ensure config is preserved even in error case
                msg.config = {
                    ...msg.config,
                    proxyUrl: msg.config?.proxyUrl || null,
                    consumerUrl: msg.config?.consumerUrl || null
                };

                node.error(error.message);
                node.send(msg);
            }
        });
    }
    
    RED.nodes.registerType("deploy-proxy", ProxyNode, {
        defaults: {
            name: { value: "" },
            action: { value: "deploy" },
            projectId: { value: "", required: true },
            region: { value: "us-west1", required: true },
            dockerRegistry: { value: "srt0422", required: true },
            proxyVersion: { value: "" },
            internalApiPort: { value: "8080" },
            marketplacePort: { value: "3333" },
            sessionDuration: { value: "1h" },
            marketplaceBaseUrl: { value: "" },
            marketplaceUrl: { value: "" }
        },
        category: "Morpheus",
        color: "#a6bbcf",
        inputs: 1,
        outputs: 1,
        icon: "cloud.png",
        label: function() {
            return this.name || "Proxy";
        },
        paletteLabel: "Proxy"
    });
} 