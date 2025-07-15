const ValidationOrchestrator = require('./ValidationOrchestrator');

/**
 * Validation Service
 * Facade for the validation orchestrator to maintain backward compatibility
 */
class ValidationService {
    constructor(pool) {
        this.orchestrator = new ValidationOrchestrator(pool);
    }

    /**
     * Parse address (delegates to orchestrator)
     */
    parseAddress(addressString) {
        return this.orchestrator.parseAddress(addressString);
    }

    /**
     * Validate address with all available methods (backward compatibility)
     */
    async validateAddress(addressString) {
        return await this.orchestrator.validateWithAll(addressString);
    }

    /**
     * Validate address with specific methods
     */
    async validateAddressWithMethods(addressString, methods) {
        return await this.orchestrator.validateWithMethods(addressString, methods);
    }

    /**
     * Get validation service status
     */
    getStatus() {
        return this.orchestrator.getStatus();
    }

    /**
     * Test specific validator
     */
    async testValidator(validatorId) {
        return await this.orchestrator.testValidator(validatorId);
    }
}

module.exports = ValidationService;