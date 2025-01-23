const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);
const env = global.get('env');

module.exports = function(RED) {
    function WebAppNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;

        // Store all configuration values
        this.projectId = config.projectId || env.PROJECT_ID;
        this.region = config.region || env.REGION || "us-west1";
        this.dockerRegistry = config.dockerRegistry || env.DOCKER_REGISTRY || "srt0422";
        this.version = config.version || env.VERSION || "latest";
        this.openaiApiUrl = config.openaiApiUrl || env.OPENAI_API_URL || "";
        this.modelName = config.modelName || env.MODEL_NAME || "Default Model";

        node.on('input', async function(msg) {
            try {
                const proxyUrl = msg.config.proxyUrl || 'http://placeholder-proxy-url';
                const effectiveConfig = {
                    projectId: msg.config.projectId || this.projectId,
                    region: msg.config.region || this.region,
                    dockerRegistry: msg.config.dockerRegistry || this.dockerRegistry,
                    version: msg.config.version || this.version,
                    openaiApiUrl: msg.config.openaiApiUrl || this.openaiApiUrl,
                    modelName: msg.config.modelName || this.modelName
                };
                
                if (proxyUrl.includes('placeholder')) {
                    console.log('Using placeholder URL, skipping webapp deployment');
                    msg.payload = {
                        status: 'pending',
                        action: 'deploy',
                        message: 'Waiting for real proxy URL before deploying'
                    };
                    node.send(msg);
                    return;
                }
                
                // Deploy Web App
                const deployCmd = [
                    'gcloud run deploy webapp-node',
                    `--image ${effectiveConfig.dockerRegistry}/openai-morpheus-webapp:${effectiveConfig.version}`,
                    '--platform managed',
                    `--region ${effectiveConfig.region}`,
                    '--allow-unauthenticated',
                    '--port 8080',
                    `--set-env-vars "PROXY_URL=${proxyUrl},MODEL_NAME=${effectiveConfig.modelName},OPENAI_API_URL=${effectiveConfig.openaiApiUrl}"`
                ].join(' ');
                
                console.log('Executing webapp deployment command:', deployCmd);
                const { stdout: deployOutput, stderr: deployError } = await execAsync(deployCmd, {
                    maxBuffer: 10 * 1024 * 1024 // 10MB buffer
                });
                console.log('Webapp deployment output:', deployOutput);
                if (deployError) console.error('Webapp deployment error:', deployError);
                
                // Get service URL
                const describeCmd = [
                    'gcloud run services describe webapp-node',
                    `--region ${effectiveConfig.region}`,
                    '--format "value(status.url)"'
                ].join(' ');
                
                console.log('Getting webapp URL:', describeCmd);
                const { stdout: urlOutput, stderr: urlError } = await execAsync(describeCmd);
                console.log('Webapp URL output:', urlOutput);
                if (urlError) console.error('Webapp URL error:', urlError);
                
                const webappUrl = urlOutput.trim();
                
                if (!webappUrl) {
                    throw new Error('Failed to get webapp URL after deployment');
                }
                
                // Pass configuration to next node
                msg.config = {
                    ...msg.config,
                    webappUrl
                };
                
                // Update payload with deployment results
                msg.payload = {
                    status: 'success',
                    action: 'deploy',
                    webappUrl,
                    output: deployOutput,
                    error: deployError
                };
                
                node.send(msg);
            } catch (error) {
                console.error('Error deploying webapp:', error);
                msg.payload = {
                    status: 'error',
                    action: 'deploy',
                    error: error.message,
                    output: error.stdout || '',
                    stderr: error.stderr || ''
                };
                node.send(msg);
            }
        });
    }

    RED.nodes.registerType("deploy-webapp", WebAppNode, {
        category: "Morpheus",
        color: "#a6bbcf",
        defaults: {
            name: { value: "" },
            projectId: { required: true },
            region: { value: "us-west1", required: true },
            dockerRegistry: { value: "srt0422", required: true },
            version: { value: "latest", required: true },
            openaiApiUrl: { value: "", required: true },
            modelName: { value: "Default Model", required: true }
        },
        inputs: 1,
        outputs: 1,
        icon: "white-globe.svg",
        label: function() {
            return this.name || "Web App";
        },
        paletteLabel: "Web App"
    });
} 