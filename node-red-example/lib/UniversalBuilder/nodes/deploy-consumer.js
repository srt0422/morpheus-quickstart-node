const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

module.exports = function(RED) {
    function ConsumerNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;

        // Add label function
        this.name = config.name;

        // Store all configuration values
        node.walletKey = config.walletKey;
        node.contractAddress = config.contractAddress;
        node.morTokenAddress = config.morTokenAddress;
        node.blockchainWsUrl = config.blockchainWsUrl;
        node.blockchainHttpUrl = config.blockchainHttpUrl;
        node.explorerApiUrl = config.explorerApiUrl;
        node.ethNodeChainId = config.ethNodeChainId;
        node.ethNodeLegacyTx = config.ethNodeLegacyTx;
        node.ethNodeUseSubscriptions = config.ethNodeUseSubscriptions;
        node.proxyAddress = config.proxyAddress;
        node.webAddress = config.webAddress;
        node.webPublicUrl = config.webPublicUrl;
        node.environment = config.environment;
        node.proxyStoreChatContext = config.proxyStoreChatContext;
        node.proxyStoragePath = config.proxyStoragePath;
        node.logLevel = config.logLevel;
        node.logFormat = config.logFormat;
        node.logColor = config.logColor;
        node.providerCacheTtl = config.providerCacheTtl;
        node.maxConcurrentSessions = config.maxConcurrentSessions;
        node.sessionTimeout = config.sessionTimeout;

        node.on('input', async function(msg) {
            try {
                await deployConsumer(node, msg);
            } catch (error) {
                console.error('Error in consumer node:', error);
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

    async function deployConsumer(node, msg) {
        if (!msg.config) {
            msg.payload = { error: 'Missing deployment configuration' };
            node.send(msg);
            return;
        }

        try {
            const { dockerRegistry, consumerImage, region, projectId } = msg.config;
            const proxyUrl = msg.config.proxyUrl || 'http://placeholder-proxy-url';
            
            // Get environment variables for deployment
            const env = {
                // Blockchain Configuration
                WALLET_PRIVATE_KEY: node.walletKey,
                DIAMOND_CONTRACT_ADDRESS: node.contractAddress,
                MOR_TOKEN_ADDRESS: node.morTokenAddress,
                BLOCKCHAIN_WS_URL: node.blockchainWsUrl,
                BLOCKCHAIN_HTTP_URL: node.blockchainHttpUrl,
                EXPLORER_API_URL: node.explorerApiUrl,
                ETH_NODE_CHAIN_ID: node.ethNodeChainId,
                ETH_NODE_LEGACY_TX: node.ethNodeLegacyTx,
                ETH_NODE_USE_SUBSCRIPTIONS: node.ethNodeUseSubscriptions,
                ETH_NODE_ADDRESS: node.blockchainHttpUrl, // Using HTTP URL as node address

                // Service Configuration
                PROXY_ADDRESS: node.proxyAddress,
                WEB_ADDRESS: node.webAddress,
                WEB_PUBLIC_URL: node.webPublicUrl || 'http://consumer-service:9000',
                ENVIRONMENT: node.environment,
                PROXY_URL: `${proxyUrl}/v1`,

                // Storage Configuration
                PROXY_STORE_CHAT_CONTEXT: node.proxyStoreChatContext,
                PROXY_STORAGE_PATH: node.proxyStoragePath,

                // Logging Configuration
                LOG_LEVEL: node.logLevel,
                LOG_FORMAT: node.logFormat,
                LOG_COLOR: node.logColor,

                // Performance Configuration
                PROVIDER_CACHE_TTL: node.providerCacheTtl,
                MAX_CONCURRENT_SESSIONS: node.maxConcurrentSessions,
                SESSION_TIMEOUT: node.sessionTimeout,

                // Additional environment variables from config
                ...(msg.config.env || {})
            };
            
            // Format environment variables for gcloud command
            const envVars = Object.entries(env)
                .filter(([_, v]) => v !== undefined && v !== '')
                .map(([k, v]) => `${k}=${v}`)
                .join(',');
            
            // Deploy Consumer Node
            const deployCmd = [
                'gcloud run deploy consumer-node',
                `--image ${dockerRegistry}/${consumerImage}`,
                '--platform managed',
                `--region ${region}`,
                '--allow-unauthenticated',
                '--port=8082',
                `--set-env-vars "${envVars}"`
            ].join(' ');
            
            console.log('Executing consumer deployment command:', deployCmd);
            const { stdout: deployOutput, stderr: deployError } = await execAsync(deployCmd, {
                maxBuffer: 10 * 1024 * 1024 // 10MB buffer
            });
            console.log('Consumer deployment output:', deployOutput);
            if (deployError) console.error('Consumer deployment error:', deployError);
            
            // Get service URL
            const describeCmd = [
                'gcloud run services describe consumer-node',
                `--region ${region}`,
                '--format "value(status.url)"'
            ].join(' ');
            
            console.log('Getting consumer URL:', describeCmd);
            const { stdout: urlOutput, stderr: urlError } = await execAsync(describeCmd);
            console.log('Consumer URL output:', urlOutput);
            if (urlError) console.error('Consumer URL error:', urlError);
            
            const consumerUrl = urlOutput.trim();
            
            if (!consumerUrl) {
                throw new Error('Failed to get consumer URL after deployment');
            }
            
            // Pass configuration to next node
            msg.config = {
                ...msg.config,
                consumerUrl,
                proxyUrl
            };
            
            // Update payload with deployment results
            msg.payload = {
                status: 'success',
                action: 'deploy',
                consumerUrl,
                proxyUrl,
                output: deployOutput,
                error: deployError
            };
            
            node.send(msg);
        } catch (error) {
            console.error('Error deploying consumer:', error);
            msg.payload = {
                status: 'error',
                action: 'deploy',
                error: error.message || 'Unknown error during consumer deployment',
                output: error.stdout || '',
                stderr: error.stderr || ''
            };
            node.send(msg);
        }
    }

    RED.nodes.registerType("deploy-consumer", ConsumerNode, {
        category: "Morpheus",
        color: "#a6bbcf",
        defaults: {
            name: { value: "" },
            deployConfig: { type: "deploy-config", required: true },
            // ... keep existing defaults ...
        },
        inputs: 1,
        outputs: 1,
        icon: "consumer.png",
        label: function() {
            return this.name || "Consumer";
        },
        paletteLabel: "Consumer"
    });
} 