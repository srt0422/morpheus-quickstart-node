class ValidationUtils {
    static validateDeploymentConfig(config) {
        const errors = [];

        if (!config.image) {
            errors.push('Container image is required');
        }

        if (!config.env) {
            errors.push('Environment variables configuration is required');
        }

        if (config.ports && typeof config.ports !== 'object') {
            errors.push('Ports must be an object');
        }

        if (config.portBindings && typeof config.portBindings !== 'object') {
            errors.push('Port bindings must be an object');
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    static validateCredentials(config) {
        const errors = [];

        if (!config.walletCredentials) {
            errors.push('Wallet credentials are required');
        }

        if (!config.apiKey) {
            errors.push('API key is required');
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }
}

module.exports = ValidationUtils; 