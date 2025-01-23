import { BuildManager, BuildConfig } from '../managers';

export interface BuildNodeConfig extends BuildConfig {
  // Add any additional build-specific configuration here
}

export class BuildNode {
  private manager: BuildManager;

  constructor(config: BuildNodeConfig) {
    this.manager = new BuildManager(config);
  }

  async execute(): Promise<string> {
    try {
      console.log('Starting build process...');
      const version = await this.manager.buildAll();
      console.log(`Build completed successfully with version: ${version}`);
      return version;
    } catch (error) {
      console.error('Build node execution failed:', error);
      throw error;
    }
  }
} 