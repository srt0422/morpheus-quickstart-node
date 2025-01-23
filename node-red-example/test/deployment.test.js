const assert = require('assert');
const axios = require('axios');
const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

describe('Node-RED Deployment E2E Tests', function() {
    this.timeout(900000); // 15 minutes timeout for deployment tests
    
    const PROJECT_ID = process.env.PROJECT_ID || 'vireo-401203';
    const REGION = process.env.REGION || 'us-central1';
    const SERVICE_NAME = 'nodered-example';
    let serviceUrl;
    let containerName;

    // Load environment variables from config.sh
    function loadConfigVars() {
        const configPath = path.resolve(__dirname, '../../cloud/config.sh');
        const configContent = fs.readFileSync(configPath, 'utf8');
        const envVars = {};
        
        configContent.split('\n').forEach(line => {
            if (line.startsWith('export ')) {
                const [_, key, value] = line.match(/export\s+(\w+)=["']?([^"'\n]+)["']?/) || [];
                if (key && value) {
                    // Handle variable substitution
                    const resolvedValue = value.replace(/\${([^}]+)}/g, (match, varName) => {
                        const fallback = varName.split(':-')[1];
                        const mainVar = varName.split(':-')[0];
                        return envVars[mainVar] || process.env[mainVar] || fallback || '';
                    });
                    envVars[key] = resolvedValue;
                }
            }
        });
        
        return envVars;
    }

    async function checkServiceDeployment(serviceName, timeoutMs = 300000) {
        const startTime = Date.now();
        while (Date.now() - startTime < timeoutMs) {
            try {
                const { stdout } = await execAsync(
                    `gcloud run services describe ${serviceName} --platform managed --region ${REGION} --project ${PROJECT_ID} --format="get(status.conditions[0].status,status.url)"`
                );
                const [status, url] = stdout.trim().split('\n');
                if (status === 'True') {
                    return url;
                }
            } catch (error) {
                console.log(`Waiting for ${serviceName} deployment...`);
            }
            await new Promise(resolve => setTimeout(resolve, 10000));
        }
        throw new Error(`Timeout waiting for ${serviceName} deployment`);
    }

    before(async function() {
        // Load environment variables
        const envVars = loadConfigVars();
        const envString = Object.entries(envVars)
            .map(([key, value]) => {
                // Properly escape the value for shell
                const escapedValue = value
                    .replace(/'/g, "'\\''")  // Escape single quotes
                    .replace(/"/g, '\\"')    // Escape double quotes
                    .replace(/\$/g, '\\$');  // Escape dollar signs
                return `-e "${key}=${escapedValue}"`;
            })
            .join(' ');

        // Start the Node-RED app in development mode
        console.log('Starting Node-RED app in development mode...');
        try {
            const projectRoot = path.resolve(__dirname, '..');
            
            // Clean up any existing containers
            console.log('Cleaning up existing containers...');
            try {
                const { stdout: existingContainers } = await execAsync('docker ps -a --filter ancestor=srt0422/nodered-example-dev --format "{{.ID}}"');
                if (existingContainers.trim()) {
                    console.log('Found existing containers:', existingContainers.trim());
                    await execAsync('docker rm -f $(docker ps -a --filter ancestor=srt0422/nodered-example-dev --format "{{.ID}}")');
                    console.log('Removed existing containers');
                }
            } catch (cleanupError) {
                console.log('No existing containers to clean up');
            }

            // Check Docker daemon status
            console.log('Checking Docker daemon...');
            try {
                await execAsync('docker info');
                console.log('Docker daemon is running');
            } catch (dockerError) {
                throw new Error(`Docker daemon not running: ${dockerError.message}`);
            }

            // Build the container
            console.log('Building container...');
            try {
                const buildCmd = `cd ${projectRoot} && source ./scripts/dev.sh && BUILD_MODE=dev BUILD_PLATFORM=linux/arm64 npm run build`;
                console.log('Running build command:', buildCmd);
                
                const { stdout: buildOutput, stderr: buildError } = await execAsync(buildCmd, { 
                    shell: '/bin/bash',
                    env: { ...process.env, PATH: process.env.PATH }
                });
                console.log('Build output:', buildOutput);
                if (buildError) console.error('Build stderr:', buildError);
                console.log('Build completed successfully!');
            } catch (buildError) {
                console.error('Build failed:', buildError);
                throw buildError;
            }

            // Verify the image exists
            console.log('Verifying image...');
            const { stdout: images } = await execAsync('docker images srt0422/nodered-example-dev --format "{{.ID}}"');
            if (!images.trim()) {
                throw new Error('Image not found after build');
            }
            console.log('Found image:', images.trim());
            
            // Start the container
            console.log('Starting container...');
            const dockerCmd = [
                'docker run -d',
                '-p 1880:1880',
                `-v "${projectRoot}/../../cloud:/usr/src/node-red/cloud"`,
                `-v "${process.env.HOME}/.config/gcloud:/home/node-red/.config/gcloud"`,
                envString,
                '-e "NODE_ENV=development"',
                '-e "GOOGLE_CLOUD_PROJECT=vireo-401203"',
                '-e "CLOUDSDK_CORE_PROJECT=vireo-401203"',
                '-e "CLOUDSDK_COMPUTE_REGION=us-central1"',
                '-e "HOME=/home/node-red"',
                `-e "PROJECT_ID=${process.env.PROJECT_ID || PROJECT_ID}"`,
                `-e "REGION=${process.env.REGION || REGION}"`,
                `-e "DOCKER_REGISTRY=${process.env.DOCKER_REGISTRY}"`,
                `-e "NFA_PROXY_VERSION=${process.env.NFA_PROXY_VERSION}"`,
                'srt0422/nodered-example-dev'
            ].join(' ');
            
            console.log('Running container with command:', dockerCmd);
            const { stdout: containerId, stderr: runError } = await execAsync(dockerCmd);
            if (runError) console.error('Container run stderr:', runError);
            containerName = containerId.trim();
            console.log('Container started with ID:', containerName);

            // Immediately check container status
            const { stdout: containerStatus } = await execAsync(`docker inspect --format='{{.State.Status}}' ${containerName}`);
            console.log('Initial container status:', containerStatus.trim());

            // Follow container logs
            const logProcess = exec(`docker logs -f ${containerName}`);
            logProcess.stdout.on('data', (data) => console.log('Container logs:', data));
            logProcess.stderr.on('data', (data) => console.error('Container error logs:', data));

            // Wait for Node-RED to be ready
            console.log('Waiting for Node-RED to be ready...');
            let ready = false;
            let lastError = null;
            let retryCount = 0;
            const maxRetries = 30;
            const startTime = Date.now();
            const maxWaitTime = 120000; // 2 minutes
            
            while (!ready && Date.now() - startTime < maxWaitTime) {
                try {
                    // Check container is still running
                    const { stdout: status } = await execAsync(`docker inspect -f '{{.State.Status}}' ${containerName}`);
                    if (status.trim() !== 'running') {
                        // Get container logs if it failed
                        const { stdout: logs } = await execAsync(`docker logs ${containerName}`);
                        throw new Error(`Container failed to start. Status: ${status}. Logs:\n${logs}`);
                    }

                    // Try health check with increased timeout
                    const response = await axios.get('http://localhost:1880/health', {
                        timeout: 10000,
                        validateStatus: false
                    });
                    
                    console.log(`Health check response: ${response.status}`);
                    
                    if (response.status === 200) {
                        // Additional check for Node-RED readiness with increased timeout
                        try {
                            const flowsResponse = await axios.get('http://localhost:1880/flows', {
                                timeout: 10000,
                                validateStatus: false
                            });
                            
                            console.log(`Flows check response: ${flowsResponse.status}`);
                            
                            if (flowsResponse.status === 200) {
                                ready = true;
                                console.log('Node-RED is ready!');
                                break;
                            } else {
                                console.log(`Unexpected flows response status: ${flowsResponse.status}`);
                            }
                        } catch (e) {
                            lastError = e;
                            console.log(`Waiting for flows to be available... Error: ${e.code || e.message}`);
                            if (e.code === 'ECONNREFUSED' || e.code === 'ECONNRESET' || e.message.includes('socket hang up')) {
                                console.log('Connection refused or reset - Node-RED might still be starting up');
                            }
                        }
                    } else {
                        console.log(`Unexpected health check status: ${response.status}`);
                    }
                } catch (error) {
                    lastError = error;
                    retryCount++;
                    const backoffTime = Math.min(2000 * Math.pow(1.5, retryCount - 1), 10000); // Exponential backoff capped at 10s
                    
                    console.log(`Attempt ${retryCount}/${maxRetries} - Waiting for Node-RED to start...`);
                    console.log(`Error type: ${error.code || 'Unknown'}`);
                    console.log(`Error message: ${error.message}`);
                    
                    if (error.code === 'ECONNREFUSED') {
                        console.log('Connection refused - Node-RED might still be starting up');
                    } else if (error.code === 'ECONNRESET' || error.message.includes('socket hang up')) {
                        console.log('Connection reset - Node-RED might be restarting');
                    }
                    
                    if (retryCount >= maxRetries) {
                        break;
                    }
                    
                    console.log(`Waiting ${backoffTime}ms before next attempt...`);
                    await new Promise(resolve => setTimeout(resolve, backoffTime));
                    continue;
                }
                
                // Standard delay between checks if no error occurred
                await new Promise(resolve => setTimeout(resolve, 2000));
            }

            if (!ready) {
                // Get container logs for debugging
                const { stdout: logs } = await execAsync(`docker logs ${containerName}`);
                throw new Error(`Node-RED failed to start within timeout (${maxWaitTime}ms). ` +
                    `Made ${retryCount} attempts. ` +
                    `Last error: ${lastError?.message}. ` +
                    `Container logs:\n${logs}`);
            }
        } catch (error) {
            console.error('Failed to start Node-RED:', error);
            // Cleanup on failure
            try {
                if (containerName) {
                    await execAsync(`docker logs ${containerName}`).then(
                        ({stdout}) => console.log('Container logs:', stdout)
                    );
                    await execAsync(`docker rm -f ${containerName}`);
                }
            } catch (cleanupError) {
                console.error('Cleanup failed:', cleanupError);
            }
            throw error;
        }
    });

    after(async function() {
        // Clean up the container
        if (containerName) {
            try {
                await execAsync(`docker stop ${containerName}`);
                await execAsync(`docker rm ${containerName}`);
            } catch (cleanupError) {
                console.error('Cleanup failed:', cleanupError);
            }
        }
    });

    it('should have Node-RED running with required nodes', async function() {
        const response = await axios.get('http://localhost:1880/flows');
        assert.strictEqual(response.status, 200);
        const flows = response.data;
        
        // Verify required nodes are present
        const requiredNodes = ['deploy-proxy', 'deploy-consumer', 'deploy-webapp'];
        const nodeTypes = flows.map(node => node.type);
        requiredNodes.forEach(nodeType => {
            assert(nodeTypes.includes(nodeType), `Missing required node: ${nodeType}`);
        });
    });

    it('should trigger deployment flow via HTTP and complete full deployment', async function() {
        // Trigger the deployment flow
        const response = await axios.post('http://localhost:1880/deploy', {});
        assert.strictEqual(response.status, 200);

        // Check NFA Proxy deployment
        console.log('Checking NFA Proxy deployment...');
        const proxyUrl = await checkServiceDeployment('nfa-proxy');
        assert(proxyUrl, 'NFA Proxy URL not found');

        // Check Consumer Node deployment
        console.log('Checking Consumer Node deployment...');
        const consumerUrl = await checkServiceDeployment('consumer-node');
        assert(consumerUrl, 'Consumer Node URL not found');

        // Verify Proxy configuration update
        console.log('Verifying Proxy configuration...');
        const { stdout: proxyConfig } = await execAsync(
            `gcloud run services describe nfa-proxy --platform managed --region ${REGION} --project ${PROJECT_ID} --format="get(spec.template.spec.containers[0].env)"`
        );
        assert(proxyConfig.includes('MARKETPLACE_BASE_URL'), 'Proxy not configured with marketplace URL');
        assert(proxyConfig.includes('MARKETPLACE_URL'), 'Proxy not configured with marketplace endpoint');

        // Check Web App deployment
        console.log('Checking Web App deployment...');
        const webappUrl = await checkServiceDeployment('morpheus-webapp');
        assert(webappUrl, 'Web App URL not found');

        // Final verification of all services
        const services = {
            'nfa-proxy': proxyUrl,
            'consumer-node': consumerUrl,
            'morpheus-webapp': webappUrl
        };

        for (const [service, url] of Object.entries(services)) {
            const healthResponse = await axios.get(`${url}/health`);
            assert.strictEqual(healthResponse.status, 200, `${service} health check failed`);
        }
    });

    it('should have correct environment variables set in deployed services', async function() {
        const services = ['nfa-proxy', 'consumer-node', 'morpheus-webapp'];
        
        for (const service of services) {
            const { stdout } = await execAsync(
                `gcloud run services describe ${service} --platform managed --region ${REGION} --project ${PROJECT_ID} --format="get(spec.template.spec.containers[0].env)"`
            );
            
            // Verify service-specific required environment variables
            switch (service) {
                case 'nfa-proxy':
                    assert(stdout.includes('MARKETPLACE_PORT'));
                    assert(stdout.includes('SESSION_DURATION'));
                    assert(stdout.includes('MARKETPLACE_BASE_URL'));
                    break;
                case 'consumer-node':
                    assert(stdout.includes('BLOCKCHAIN_HTTP_URL'));
                    assert(stdout.includes('ETH_NODE_CHAIN_ID'));
                    assert(stdout.includes('EXPLORER_API_URL'));
                    break;
                case 'morpheus-webapp':
                    assert(stdout.includes('OPENAI_API_URL'));
                    assert(stdout.includes('CONSUMER_URL'));
                    break;
            }
        }
    });
}); 