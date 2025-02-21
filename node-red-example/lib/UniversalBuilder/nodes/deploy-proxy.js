const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);
const https = require('https');
const http = require('http');
const { spawn } = require('child_process');

module.exports = function(RED) {
    function ProxyNode(config) {
        RED.nodes.createNode(this, config);
        
        // Store configuration with validation
        this.name = config.name;
        this.action = config.action || 'deploy';
        this.projectId = config.projectId;
        this.region = config.region;
        this.dockerRegistry = config.dockerRegistry;
        this.proxyVersion = config.proxyVersion;
        this.internalApiPort = config.internalApiPort || "8080";
        this.marketplacePort = config.marketplacePort || "3333";
        this.sessionDuration = config.sessionDuration || "1h";
        this.marketplaceBaseUrl = config.marketplaceBaseUrl;
        this.marketplaceUrl = config.marketplaceUrl;
        this.consumerUsername = config.consumerUsername || "proxy";
        this.consumerPassword = config.consumerPassword;
        this.consumerNodeUrl = config.consumerNodeUrl;
        
        const node = this;
        
        // Allow exec function injection for testing
        this._execAsync = execAsync;
        
        // Validate required configuration
        function validateConfig(config) {
            const required = [
                'projectId', 
                'region', 
                'dockerRegistry', 
                'proxyVersion',
                'marketplaceUrl'
            ];
            const missing = required.filter(field => !config[field]);
            if (missing.length > 0) {
                throw new Error(`Missing required configuration: ${missing.join(', ')}`);
            }
        }
        
        // Handle deployment errors
        function handleError(err, msg) {
            node.error(err);
            node.status({fill:"red",shape:"dot",text:err.message});
            msg.payload = {
                error: err.message || err,
                status: 'error'
            };
            return msg;
        }

        // Interactive GCP authentication
        async function authenticateGCP() {
            return new Promise((resolve, reject) => {
                // Start the gcloud auth login process - will automatically open browser
                const gcloudAuth = spawn('gcloud', ['auth', 'login']);
                
                gcloudAuth.stderr.on('data', (data) => {
                    const output = data.toString();
                    if (!output.includes("Opening in existing browser session")) {
                        node.warn(output);
                    }
                });

                gcloudAuth.on('close', (code) => {
                    if (code === 0) {
                        node.status({fill:"green",shape:"dot",text:"Authenticated"});
                        resolve();
                    } else {
                        node.status({fill:"red",shape:"dot",text:"Authentication failed"});
                        reject(new Error('Authentication failed'));
                    }
                });
            });
        }

        // Ensure GCP context
        async function checkGCPAuth() {
            try {
                await execAsync('gcloud auth print-access-token');
                return true;
            } catch (err) {
                return false;
            }
        }

        // Check deployment status
        async function checkDeployment(serviceName, region) {
            try {
                const cmd = `gcloud run services describe ${serviceName} --region ${region} --format 'get(status.conditions[0].status,status.conditions[0].message)'`;
                const { stdout } = await execAsync(cmd);
                const [status, message] = stdout.trim().split('\n');
                return status === 'True';
            } catch (err) {
                throw new Error(`Failed to check deployment status: ${err.message}`);
            }
        }

        // Get service URL
        async function getServiceUrl(serviceName, region) {
            try {
                const cmd = `gcloud run services describe ${serviceName} --region ${region} --format 'get(status.url)'`;
                const { stdout } = await execAsync(cmd);
                return stdout.trim();
            } catch (err) {
                throw new Error(`Failed to get service URL: ${err.message}`);
            }
        }

        // Check service health
        async function checkServiceHealth(url) {
            return new Promise((resolve) => {
                const protocol = url.startsWith('https') ? https : http;
                const healthUrl = url.replace(/\/$/, '') + '/health';
                
                const req = protocol.get(healthUrl, (res) => {
                    resolve(res.statusCode === 200);
                });
                
                req.on('error', () => {
                    resolve(false);
                });
                
                req.setTimeout(5000, () => {
                    req.destroy();
                    resolve(false);
                });
            });
        }

        node.on('input', async function(msg) {
            try {
                const existingPayload = msg.payload || {};
                const msgConfig = msg.config || {};
                
                // Merge configuration with message config taking precedence
                const effectiveConfig = {
                    projectId: msgConfig.projectId || this.projectId,
                    region: msgConfig.region || this.region,
                    dockerRegistry: msgConfig.dockerRegistry || this.dockerRegistry,
                    proxyVersion: msgConfig.proxyVersion || this.proxyVersion,
                    internalApiPort: msgConfig.internalApiPort || this.internalApiPort || '8080',
                    marketplacePort: msgConfig.marketplacePort || this.marketplacePort || '3333',
                    sessionDuration: msgConfig.sessionDuration || this.sessionDuration || '1h',
                    marketplaceBaseUrl: msgConfig.marketplaceBaseUrl || this.marketplaceBaseUrl || 'http://consumer-url',
                    marketplaceUrl: msgConfig.marketplaceUrl || this.marketplaceUrl || 'http://consumer-url/chat/completions',
                    consumerUsername: msgConfig.consumerUsername || this.consumerUsername || 'proxy',
                    consumerPassword: msgConfig.consumerPassword || this.consumerPassword,
                    consumerNodeUrl: msgConfig.consumerNodeUrl || this.consumerNodeUrl || 'http://placeholder-consumer-node'
                };
                
                // Validate configuration before proceeding
                validateConfig(effectiveConfig);

                // Ensure GCP context with the effective configuration
                async function ensureGcpContext() {
                    try {
                        // Set project ID first
                        await execAsync(`gcloud config set project ${effectiveConfig.projectId}`);
                        
                        // Check if already authenticated
                        const isAuthenticated = await checkGCPAuth();
                        if (!isAuthenticated) {
                            // If not authenticated, start interactive authentication
                            await authenticateGCP();
                        }
                    } catch (err) {
                        throw new Error('Failed to set GCP project: ' + err.message);
                    }
                }

                // Ensure GCP context first
                await ensureGcpContext();

                const imageName = `${effectiveConfig.dockerRegistry}/openai-morpheus-proxy:${effectiveConfig.proxyVersion}`;
                const serviceName = 'nfa-proxy';
                
                if (this.action === 'update') {
                    // Update existing service
                    try {
                        const updateCmd = `gcloud run services update ${serviceName} \
                            --platform managed \
                            --region ${effectiveConfig.region} \
                            --image ${imageName} \
                            --port ${effectiveConfig.internalApiPort} \
                            --allow-unauthenticated \
                            --update-env-vars "PORT=${effectiveConfig.internalApiPort},\
INTERNAL_API_PORT=${effectiveConfig.internalApiPort},\
MARKETPLACE_PORT=${effectiveConfig.marketplacePort},\
MARKETPLACE_BASE_URL=${effectiveConfig.marketplaceBaseUrl},\
MARKETPLACE_URL=${effectiveConfig.marketplaceUrl},\
CONSUMER_USERNAME=${effectiveConfig.consumerUsername},\
CONSUMER_PASSWORD=${effectiveConfig.consumerPassword},\
CONSUMER_NODE_URL=${effectiveConfig.consumerNodeUrl},\
SESSION_DURATION=${effectiveConfig.sessionDuration}"`;

                        await this._execAsync(updateCmd);
                        
                        // Wait for deployment to complete
                        let deployed = false;
                        for (let i = 0; i < 30 && !deployed; i++) {
                            deployed = await checkDeployment(serviceName, effectiveConfig.region);
                            if (!deployed) await new Promise(resolve => setTimeout(resolve, 2000));
                        }
                        
                        if (!deployed) {
                            throw new Error('Deployment timed out');
                        }

                        const serviceUrl = await getServiceUrl(serviceName, effectiveConfig.region);

                        // Check service health
                        if (!await checkServiceHealth(serviceUrl)) {
                            throw new Error('Failed to verify service health');
                        }
                        
                        msg.payload = {
                            proxyUrl: serviceUrl,
                            status: 'updated',
                            action: 'update'
                        };

                        // Set OPENAI_API_URL for downstream nodes
                        msg.config = msg.config || {};
                        msg.config.OPENAI_API_URL = serviceUrl;
                    } catch (updateErr) {
                        throw new Error(`Update failed: ${updateErr.message}`);
                    }
                } else {
                    // Deploy new service
                    try {
                        const deployCmd = `gcloud run deploy ${serviceName} \
                            --platform managed \
                            --region ${effectiveConfig.region} \
                            --image ${imageName} \
                            --port ${effectiveConfig.internalApiPort} \
                            --allow-unauthenticated \
                            --set-env-vars "INTERNAL_API_PORT=${effectiveConfig.internalApiPort},\
MARKETPLACE_PORT=${effectiveConfig.marketplacePort},\
MARKETPLACE_BASE_URL=${effectiveConfig.marketplaceBaseUrl},\
MARKETPLACE_URL=${effectiveConfig.marketplaceUrl},\
CONSUMER_USERNAME=${effectiveConfig.consumerUsername},\
CONSUMER_PASSWORD=${effectiveConfig.consumerPassword},\
CONSUMER_NODE_URL=${effectiveConfig.consumerNodeUrl},\
SESSION_DURATION=${effectiveConfig.sessionDuration}"`;

                        await this._execAsync(deployCmd);
                        
                        // Wait for deployment to complete
                        let deployed = false;
                        for (let i = 0; i < 30 && !deployed; i++) {
                            deployed = await checkDeployment(serviceName, effectiveConfig.region);
                            if (!deployed) await new Promise(resolve => setTimeout(resolve, 2000));
                        }
                        
                        if (!deployed) {
                            throw new Error('Deployment timed out');
                        }

                        const serviceUrl = await getServiceUrl(serviceName, effectiveConfig.region);

                        // Check service health
                        if (!await checkServiceHealth(serviceUrl)) {
                            throw new Error('Failed to verify service health');
                        }
                        
                        msg.payload = {
                            proxyUrl: serviceUrl,
                            status: 'deployed',
                            action: 'deploy'
                        };

                        // Set OPENAI_API_URL for downstream nodes
                        msg.config = msg.config || {};
                        msg.config.OPENAI_API_URL = serviceUrl;
                    } catch (deployErr) {
                        throw new Error(`Deployment failed: ${deployErr.message}`);
                    }
                }
                
                node.send(msg);
            } catch (err) {
                node.send(handleError(err, msg));
            }
        });
        
        node.on('close', function() {
            // Cleanup resources if needed
        });
    }
    
    RED.nodes.registerType("deploy-proxy", ProxyNode, {
        defaults: {
            name: { value: "" },
            action: { value: "deploy" },
            projectId: { value: "", required: true },
            region: { value: "us-west1", required: true },
            dockerRegistry: { value: "srt0422", required: true },
            proxyVersion: { value: "v0.0.31", required: true },
            internalApiPort: { value: "8080" },
            marketplacePort: { value: "3333" },
            sessionDuration: { value: "1h" },
            marketplaceBaseUrl: { value: "" },
            marketplaceUrl: { value: "" },
            consumerUsername: { value: "proxy" },
            consumerPassword: { value: "yosz9BZCuu7Rli7mYe4G1JbIO0Yprvwl" },
            consumerNodeUrl: { value: "" }
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