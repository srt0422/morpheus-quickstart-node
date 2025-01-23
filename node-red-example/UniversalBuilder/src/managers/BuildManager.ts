import { exec } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface BuildConfig {
  registry: string;
  platforms: string[];
  nfaProxyImage: string;
  marketplaceImage: string;
  versionFile: string;
}

export class BuildManager {
  private config: BuildConfig;

  constructor(config: BuildConfig) {
    this.config = config;
  }

  private getNextVersion(): string {
    try {
      const currentVersion = readFileSync(this.config.versionFile, 'utf8').trim();
      const match = currentVersion.match(/^v(\d+)\.(\d+)\.(\d+)$/);
      if (!match) return 'v0.0.0';

      const [, major, minor, patch] = match;
      const newPatch = parseInt(patch) + 1;
      const newVersion = `v${major}.${minor}.${newPatch}`;
      writeFileSync(this.config.versionFile, newVersion);
      return newVersion;
    } catch {
      writeFileSync(this.config.versionFile, 'v0.0.0');
      return 'v0.0.0';
    }
  }

  private async setupBuildx(): Promise<void> {
    try {
      await execAsync('docker buildx create --use --name multiarch-builder --platform ' + 
        this.config.platforms.join(','));
      await execAsync('docker buildx inspect --bootstrap');
    } catch (error) {
      console.error('Error setting up buildx:', error);
      throw error;
    }
  }

  private async buildAndPush(context: string, dockerfile: string, image: string, version: string): Promise<void> {
    try {
      const platforms = this.config.platforms.join(',');
      const cmd = `docker buildx build \
        --platform ${platforms} \
        --push \
        -t ${this.config.registry}/${image}:${version} \
        -t ${this.config.registry}/${image}:latest \
        -f ${dockerfile} \
        ${context}`;
      
      const { stdout, stderr } = await execAsync(cmd);
      console.log('Build output:', stdout);
      if (stderr) console.error('Build warnings:', stderr);
    } catch (error) {
      console.error(`Error building ${image}:`, error);
      throw error;
    }
  }

  async buildAll(): Promise<string> {
    try {
      await this.setupBuildx();
      const version = this.getNextVersion();
      console.log(`Building version: ${version}`);

      // Build NFA Proxy
      console.log('Building NFA Proxy...');
      await this.buildAndPush(
        '.',
        'Dockerfile.proxy',
        this.config.nfaProxyImage,
        version
      );

      // Build Marketplace
      console.log('Building Marketplace...');
      await this.buildAndPush(
        './morpheus-node/proxy-router',
        './morpheus-node/proxy-router/Dockerfile',
        this.config.marketplaceImage,
        version
      );

      console.log('Build completed successfully!');
      return version;
    } catch (error) {
      console.error('Build process failed:', error);
      throw error;
    }
  }
} 