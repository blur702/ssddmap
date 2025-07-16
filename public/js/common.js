/**
 * Common Module - Communication hub for core and plugins
 * Provides event bus and shared utilities
 */
export class EventBus {
    constructor() {
        this.events = {};
    }

    /**
     * Subscribe to an event
     */
    on(event, callback) {
        if (!this.events[event]) {
            this.events[event] = [];
        }
        this.events[event].push(callback);
    }

    /**
     * Unsubscribe from an event
     */
    off(event, callback) {
        if (!this.events[event]) return;
        
        this.events[event] = this.events[event].filter(cb => cb !== callback);
    }

    /**
     * Emit an event
     */
    emit(event, data) {
        if (!this.events[event]) return;
        
        this.events[event].forEach(callback => {
            try {
                callback(data);
            } catch (error) {
                console.error(`Error in event listener for ${event}:`, error);
            }
        });
    }

    /**
     * Remove all listeners for an event
     */
    removeAllListeners(event) {
        if (event) {
            delete this.events[event];
        } else {
            this.events = {};
        }
    }

    /**
     * Get all events (for debugging)
     */
    getEvents() {
        return Object.keys(this.events);
    }
}

/**
 * Base Plugin Class - All plugins extend this
 */
export class BasePlugin {
    constructor(name, core, eventBus) {
        this.name = name;
        this.core = core;
        this.eventBus = eventBus;
        this.isInitialized = false;
        this.isEnabled = true;
    }

    /**
     * Initialize the plugin (to be overridden)
     */
    initialize() {
        throw new Error(`Plugin ${this.name} must implement initialize() method`);
    }

    /**
     * Enable the plugin
     */
    enable() {
        this.isEnabled = true;
        this.eventBus.emit('pluginEnabled', { name: this.name });
    }

    /**
     * Disable the plugin
     */
    disable() {
        this.isEnabled = false;
        this.eventBus.emit('pluginDisabled', { name: this.name });
    }

    /**
     * Get plugin status
     */
    getStatus() {
        return {
            name: this.name,
            initialized: this.isInitialized,
            enabled: this.isEnabled
        };
    }
}

/**
 * Plugin Manager - Manages all plugins
 */
export class PluginManager {
    constructor(core, eventBus) {
        this.core = core;
        this.eventBus = eventBus;
        this.plugins = new Map();
        this.loadOrder = [];
    }

    /**
     * Register a plugin
     */
    register(plugin) {
        if (!(plugin instanceof BasePlugin)) {
            throw new Error('Plugin must extend BasePlugin');
        }
        
        this.plugins.set(plugin.name, plugin);
        this.loadOrder.push(plugin.name);
        
        console.log(`📦 Plugin registered: ${plugin.name}`);
        this.eventBus.emit('pluginRegistered', { name: plugin.name });
    }

    /**
     * Initialize all plugins
     */
    async initializeAll() {
        console.log('🚀 Initializing all plugins...');
        
        for (const pluginName of this.loadOrder) {
            const plugin = this.plugins.get(pluginName);
            if (plugin && plugin.isEnabled) {
                try {
                    await plugin.initialize();
                    plugin.isInitialized = true;
                    console.log(`✅ Plugin initialized: ${pluginName}`);
                } catch (error) {
                    console.error(`❌ Failed to initialize plugin ${pluginName}:`, error);
                }
            }
        }
    }

    /**
     * Get a plugin by name
     */
    getPlugin(name) {
        return this.plugins.get(name);
    }

    /**
     * Get all plugins status
     */
    getAllStatus() {
        const status = {};
        this.plugins.forEach((plugin, name) => {
            status[name] = plugin.getStatus();
        });
        return status;
    }

    /**
     * Enable a plugin
     */
    enablePlugin(name) {
        const plugin = this.plugins.get(name);
        if (plugin) {
            plugin.enable();
        }
    }

    /**
     * Disable a plugin
     */
    disablePlugin(name) {
        const plugin = this.plugins.get(name);
        if (plugin) {
            plugin.disable();
        }
    }
}

/**
 * Shared utilities
 */
export class CommonUtils {
    /**
     * Generate district key from state and district
     */
    static getDistrictKey(state, district) {
        return `${state}-${district}`;
    }

    /**
     * Parse district key into state and district
     */
    static parseDistrictKey(districtKey) {
        const parts = districtKey.split('-');
        return {
            state: parts[0],
            district: parts[1]
        };
    }

    /**
     * Get party colors
     */
    static getPartyColors() {
        return {
            'D': '#3b82f6', // Blue for Democrats
            'R': '#ef4444', // Red for Republicans
            'I': '#8b5cf6', // Purple for Independents
            'V': '#6b7280', // Gray for Vacant/Unknown
            default: '#6b7280'
        };
    }

    /**
     * Get color for a party
     */
    static getPartyColor(party) {
        const colors = CommonUtils.getPartyColors();
        return colors[party] || colors.default;
    }

    /**
     * Debounce function
     */
    static debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    /**
     * Deep merge objects
     */
    static deepMerge(target, ...sources) {
        if (!sources.length) return target;
        const source = sources.shift();

        if (CommonUtils.isObject(target) && CommonUtils.isObject(source)) {
            for (const key in source) {
                if (CommonUtils.isObject(source[key])) {
                    if (!target[key]) Object.assign(target, { [key]: {} });
                    CommonUtils.deepMerge(target[key], source[key]);
                } else {
                    Object.assign(target, { [key]: source[key] });
                }
            }
        }

        return CommonUtils.deepMerge(target, ...sources);
    }

    /**
     * Check if value is an object
     */
    static isObject(item) {
        return item && typeof item === 'object' && !Array.isArray(item);
    }
}