import { DeployManager, DeployConfig, DeployResult } from '../managers';

export interface DeployNodeConfig extends DeployConfig {
  // Add any additional deployment-specific configuration here
}

export class DeployNode {
  private manager: DeployManager;

  constructor(config: DeployNodeConfig) {
    this.manager = new DeployManager(config);
  }

  async execute(): Promise<DeployResult> {
    try {
      console.log('Starting deployment process...');
      const result = await this.manager.deployAll();
      console.log('Deployment completed successfully:', result);
      return result;
    } catch (error) {
      console.error('Deploy node execution failed:', error);
      throw error;
    }
  }
} 