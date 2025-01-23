import { BuildNode, DeployNode } from '../nodes';

async function main() {
  try {
    // Configure and execute build
    const buildNode = new BuildNode({
      registry: 'srt0422',
      platforms: ['linux/amd64', 'linux/arm64'],
      nfaProxyImage: 'openai-morpheus-proxy',
      marketplaceImage: 'morpheus-marketplace',
      versionFile: '.version'
    });

    const version = await buildNode.execute();
    console.log(`Build completed with version: ${version}`);

    // Configure and execute deployment
    const deployNode = new DeployNode({
      projectId: 'your-project-id',
      region: 'us-central1',
      registry: 'srt0422',
      nfaProxyVersion: version,
      consumerNodeVersion: version,
      environmentVars: {
        WALLET_PRIVATE_KEY: process.env.WALLET_PRIVATE_KEY || '',
        WALLET_ADDRESS: process.env.WALLET_ADDRESS || '',
        PORT: '8080',
        MARKETPLACE_URL: 'http://localhost:9000/v1/chat/completions',
        SESSION_DURATION: '1h',
        DEFAULT_PORT: '8080',
        MODEL_ID: process.env.MODEL_ID || '',
        LOG_COLOR: 'true',
        ENVIRONMENT: 'development',
        SESSION_EXPIRATION_SECONDS: '1800'
      }
    });

    const result = await deployNode.execute();
    console.log('Deployment completed:', result);
  } catch (error) {
    console.error('Build and deploy process failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
} 