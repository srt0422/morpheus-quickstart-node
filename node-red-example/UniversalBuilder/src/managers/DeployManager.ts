import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface DeployConfig {
  projectId: string;
  region: string;
  registry: string;
  nfaProxyVersion: string;
  consumerNodeVersion: string;
  environmentVars: Record<string, string>;
}

export interface DeployResult {
  nfaProxyUrl: string;
  consumerUrl: string;
}

export class DeployManager {
  private config: DeployConfig;
  private nfaProxyUrl: string = '';
  private consumerUrl: string = '';

  constructor(config: DeployConfig) {
    this.config = config;
  }

  private async ensureGCPContext(): Promise<void> {
    try {
      await execAsync(`gcloud config set project ${this.config.projectId}`);
      await execAsync(`gcloud config set compute/region ${this.config.region}`);
      console.log('GCP context set successfully');
    } catch (error) {
      console.error('Error setting GCP context:', error);
      throw error;
    }
  }

  private async checkDeployment(serviceName: string): Promise<boolean> {
    try {
      const maxAttempts = 30;
      const sleepTime = 10000; // 10 seconds

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        console.log(`Checking ${serviceName} deployment (attempt ${attempt}/${maxAttempts})...`);
        
        const { stdout } = await execAsync(
          `gcloud run services describe ${serviceName} \
          --region ${this.config.region} \
          --format 'value(status.conditions[0].status)'`
        );

        if (stdout.trim() === 'True') {
          console.log(`${serviceName} deployment successful!`);
          return true;
        }

        await new Promise(resolve => setTimeout(resolve, sleepTime));
      }

      throw new Error(`${serviceName} deployment did not become ready in time`);
    } catch (error) {
      console.error(`Error checking ${serviceName} deployment:`, error);
      throw error;
    }
  }

  private async checkServiceHealth(url: string): Promise<boolean> {
    try {
      const maxAttempts = 30;
      const sleepTime = 10000; // 10 seconds

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        console.log(`Checking service health at ${url} (attempt ${attempt}/${maxAttempts})...`);
        
        const { stdout } = await execAsync(`curl -s "${url}"`);
        if (stdout.toLowerCase().includes('healthy')) {
          console.log('Service is healthy!');
          return true;
        }

        await new Promise(resolve => setTimeout(resolve, sleepTime));
      }

      throw new Error('Service health check failed');
    } catch (error) {
      console.error('Error checking service health:', error);
      throw error;
    }
  }

  private async deployNFAProxy(): Promise<void> {
    try {
      const imageTag = this.config.nfaProxyVersion || 'latest';
      const imageName = `${this.config.registry}/openai-morpheus-proxy:${imageTag}`;

      console.log(`Deploying NFA Proxy version: ${imageTag}`);
      await execAsync(`gcloud run deploy nfa-proxy \
        --image ${imageName} \
        --platform managed \
        --region ${this.config.region} \
        --allow-unauthenticated \
        --set-env-vars "${this.formatEnvVars()}"`);

      await this.checkDeployment('nfa-proxy');

      const { stdout } = await execAsync(
        `gcloud run services describe nfa-proxy \
        --region ${this.config.region} \
        --format 'value(status.url)'`
      );
      this.nfaProxyUrl = stdout.trim();

      await this.checkServiceHealth(`${this.nfaProxyUrl}/health`);
      console.log('NFA Proxy deployed successfully:', this.nfaProxyUrl);
    } catch (error) {
      console.error('Error deploying NFA Proxy:', error);
      throw error;
    }
  }

  private async deployConsumerNode(): Promise<void> {
    try {
      const imageTag = this.config.consumerNodeVersion || 'latest';
      const imageName = `${this.config.registry}/morpheus-marketplace:${imageTag}`;

      console.log(`Deploying Consumer Node version: ${imageTag}`);
      await execAsync(`gcloud run deploy consumer-node \
        --image ${imageName} \
        --platform managed \
        --region ${this.config.region} \
        --allow-unauthenticated \
        --set-env-vars "${this.formatEnvVars()}"`);

      await this.checkDeployment('consumer-node');

      const { stdout } = await execAsync(
        `gcloud run services describe consumer-node \
        --region ${this.config.region} \
        --format 'value(status.url)'`
      );
      this.consumerUrl = stdout.trim();

      await this.checkServiceHealth(`${this.consumerUrl}/healthcheck`);
      console.log('Consumer Node deployed successfully:', this.consumerUrl);
    } catch (error) {
      console.error('Error deploying Consumer Node:', error);
      throw error;
    }
  }

  private async updateNFAProxyConfig(): Promise<void> {
    try {
      console.log('Updating NFA Proxy configuration...');
      await execAsync(`gcloud run services update nfa-proxy \
        --platform managed \
        --region ${this.config.region} \
        --set-env-vars "MARKETPLACE_PORT=3333,\
SESSION_DURATION=1h,\
MARKETPLACE_BASE_URL=${this.consumerUrl},\
MARKETPLACE_URL=${this.consumerUrl}/v1/chat/completions"`);

      console.log('NFA Proxy configuration updated successfully');
    } catch (error) {
      console.error('Error updating NFA Proxy configuration:', error);
      throw error;
    }
  }

  private formatEnvVars(): string {
    return Object.entries(this.config.environmentVars)
      .map(([key, value]) => `${key}=${value}`)
      .join(',');
  }

  async deployAll(): Promise<DeployResult> {
    try {
      await this.ensureGCPContext();
      await this.deployNFAProxy();
      await this.deployConsumerNode();
      await this.updateNFAProxyConfig();

      return {
        nfaProxyUrl: this.nfaProxyUrl,
        consumerUrl: this.consumerUrl
      };
    } catch (error) {
      console.error('Deployment process failed:', error);
      throw error;
    }
  }
} 