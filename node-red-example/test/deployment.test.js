const assert = require('assert');
const axios = require('axios');
const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);
const path = require('path');
const fs = require('fs').promises;
const dotenv = require('dotenv');
const { expect } = require('chai');

describe('Node-RED Deployment E2E Tests', function() {
    this.timeout(900000); // 15 minutes timeout for deployment tests
    
    const PROJECT_ID = process.env.PROJECT_ID || 'vireo-401203';
    const REGION = process.env.REGION || 'us-central1';
    const SERVICE_NAME = 'nodered-example';
    const CONFIG_PATH = path.resolve(__dirname, '../../cloud/config.sh');
    
    let serviceUrl;
    let containerName;
    let envVars = {};
    let isEnvironmentReady = false;

    // Helper function to check if required tools are available
    async function checkRequiredTools() {
        const tools = ['docker', 'gcloud'];
        const errors = [];

        for (const tool of tools) {
            try {
                await execAsync(`which ${tool}`);
            } catch (error) {
                errors.push(`${tool} is not installed or not in PATH`);
            }
        }

        if (errors.length > 0) {
            throw new Error(`Environment not ready:\n${errors.join('\n')}`);
        }
    }

    // Load environment variables from config.sh
    async function loadConfigVars() {
        try {
            const configContent = await fs.readFile(CONFIG_PATH, 'utf8');
            const vars = {};
            
            configContent.split('\n').forEach(line => {
                if (line.startsWith('export ')) {
                    const [_, key, value] = line.match(/export\s+(\w+)=["']?([^"'\n]+)["']?/) || [];
                    if (key && value) {
                        // Handle variable substitution
                        const resolvedValue = value.replace(/\${([^}]+)}/g, (match, varName) => {
                            const [mainVar, fallback] = varName.split(':-');
                            return vars[mainVar] || process.env[mainVar] || fallback || '';
                        });
                        vars[key] = resolvedValue;
                    }
                }
            });
            
            return vars;
        } catch (error) {
            throw new Error(`Failed to load config.sh: ${error.message}`);
        }
    }

    async function checkServiceDeployment(serviceName, timeoutMs = 300000) {
        const startTime = Date.now();
        let lastError = null;

        while (Date.now() - startTime < timeoutMs) {
            try {
                const { stdout } = await execAsync(
                    `gcloud run services describe ${serviceName} --platform managed --region ${REGION} --project ${PROJECT_ID} --format="get(status.conditions[0].status,status.url)"`
                );
                const [status, url] = stdout.trim().split('\n');
                if (status === 'True') {
                    return url;
                }
                await new Promise(resolve => setTimeout(resolve, 10000));
            } catch (error) {
                lastError = error;
                console.log(`Waiting for ${serviceName} deployment... (${Math.round((Date.now() - startTime)/1000)}s)`);
                await new Promise(resolve => setTimeout(resolve, 10000));
            }
        }
        throw new Error(`Timeout waiting for ${serviceName} deployment. Last error: ${lastError?.message}`);
    }

    // Setup before all tests
    before(async function() {
        try {
            // Check if required tools are available
            await checkRequiredTools();
            
            // Load environment variables
            envVars = await loadConfigVars();
            
            // Check if required environment variables are set
            const requiredVars = ['PROJECT_ID', 'REGION', 'DOCKER_REGISTRY', 'NFA_PROXY_VERSION'];
            const missingVars = requiredVars.filter(varName => 
                !envVars[varName] && !process.env[varName]
            );
            
            if (missingVars.length > 0) {
                throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
            }

            isEnvironmentReady = true;
        } catch (error) {
            console.warn(`Environment setup failed: ${error.message}`);
            console.warn('Some tests will be skipped');
        }
    });

    describe('Local Development Environment', function() {
        beforeEach(async function() {
            if (!isEnvironmentReady) {
                this.skip();
            }

            // Clean up any existing containers
            try {
                const { stdout: existingContainers } = await execAsync(
                    'docker ps -a --filter ancestor=srt0422/nodered-example-dev --format "{{.ID}}"'
                );
                if (existingContainers.trim()) {
                    await execAsync(
                        'docker rm -f $(docker ps -a --filter ancestor=srt0422/nodered-example-dev --format "{{.ID}}")'
                    );
                }
            } catch (error) {
                // Ignore errors if no containers exist
            }
        });

        afterEach(async function() {
            if (containerName) {
                try {
                    await execAsync(`docker rm -f ${containerName}`);
                } catch (error) {
                    console.warn(`Failed to cleanup container ${containerName}: ${error.message}`);
                }
            }
        });

        it('should build and run the development container', async function() {
            const projectRoot = path.resolve(__dirname, '..');
            
            // Build the container
            console.log('Building container...');
            const buildCmd = `cd ${projectRoot} && source ./scripts/dev.sh && BUILD_MODE=dev BUILD_PLATFORM=linux/arm64 npm run build`;
            
            try {
                const { stdout: buildOutput } = await execAsync(buildCmd, { 
                    shell: '/bin/bash',
                    env: { ...process.env, ...envVars }
                });
                console.log('Build completed');
            } catch (error) {
                throw new Error(`Build failed: ${error.message}`);
            }

            // Verify the image exists
            const { stdout: images } = await execAsync('docker images srt0422/nodered-example-dev --format "{{.ID}}"');
            expect(images.trim()).to.not.be.empty;

            // Start the container
            const dockerCmd = [
                'docker run -d',
                '-p 1880:1880',
                `-v "${projectRoot}/../../cloud:/usr/src/node-red/cloud"`,
                `-v "${process.env.HOME}/.config/gcloud:/home/node-red/.config/gcloud"`,
                ...Object.entries(envVars).map(([key, value]) => 
                    `-e "${key}=${value.replace(/"/g, '\\"')}"`
                ),
                '-e "NODE_ENV=development"',
                'srt0422/nodered-example-dev'
            ].join(' ');

            const { stdout: containerId } = await execAsync(dockerCmd);
            containerName = containerId.trim();
            
            // Wait for container to be ready
            await new Promise(resolve => setTimeout(resolve, 5000));
            
            // Verify container is running
            const { stdout: containerStatus } = await execAsync(`docker inspect -f {{.State.Status}} ${containerName}`);
            expect(containerStatus.trim()).to.equal('running');

            // Check if Node-RED is responding
            try {
                const response = await axios.get('http://localhost:1880/');
                expect(response.status).to.equal(200);
            } catch (error) {
                throw new Error(`Node-RED is not responding: ${error.message}`);
            }
        });
    });

    describe('Cloud Deployment', function() {
        beforeEach(function() {
            if (!isEnvironmentReady) {
                this.skip();
            }
        });

        it('should deploy to Cloud Run', async function() {
            try {
                // Deploy to Cloud Run
                const deployCmd = `gcloud run deploy ${SERVICE_NAME} \\
                    --image ${envVars.DOCKER_REGISTRY}/nodered-example:latest \\
                    --platform managed \\
                    --region ${REGION} \\
                    --project ${PROJECT_ID} \\
                    --allow-unauthenticated`;
                
                await execAsync(deployCmd);
                
                // Wait for deployment and get service URL
                serviceUrl = await checkServiceDeployment(SERVICE_NAME);
                expect(serviceUrl).to.be.a('string').that.is.not.empty;

                // Verify the deployment
                const response = await axios.get(serviceUrl);
                expect(response.status).to.equal(200);
            } catch (error) {
                throw new Error(`Cloud Run deployment failed: ${error.message}`);
            }
        });
    });
}); 