import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { logger } from '../utils/logger';
import { hookService, MotiaHook } from './hookService';
const __filenameResolved = typeof import.meta.url !== 'undefined' ? fileURLToPath(import.meta.url) : (typeof __filename !== 'undefined' ? __filename : '');
const __dirnameResolved = __filenameResolved ? path.dirname(__filenameResolved) : (typeof __dirname !== 'undefined' ? __dirname : '');
/**
 * Plugin Loader Service
 * Dynamically loads and initializes plugins from the plugins directory
 */
export class PluginLoader {
    static pluginsDir = path.resolve(__dirnameResolved, '../plugins');
    /**
     * Initialize and load all plugins
     */
    static async init() {
        logger.info('[PluginLoader] Starting to load plugins...');
        // Ensure plugins directory exists
        if (!fs.existsSync(this.pluginsDir)) {
            logger.warn(`[PluginLoader] Plugins directory not found at ${this.pluginsDir}. Skipping.`);
            return;
        }
        try {
            const files = fs.readdirSync(this.pluginsDir);
            const loadPromises = [];
            for (const file of files) {
                // Load .ts and .js files (but not .d.ts or map files)
                if ((file.endsWith('.ts') || file.endsWith('.js')) && !file.endsWith('.d.ts') && !file.endsWith('.map')) {
                    loadPromises.push(this.loadPlugin(file));
                }
            }
            await Promise.all(loadPromises);
            logger.info(`[PluginLoader] Finished loading ${loadPromises.length} plugins.`);
            // Trigger CORE_INIT hook
            hookService.trigger(MotiaHook.CORE_INIT);
        }
        catch (error) {
            logger.error('[PluginLoader] Error reading plugins directory:', {
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }
    /**
     * Load a single plugin
     */
    static async loadPlugin(filename) {
        const pluginPath = path.join(this.pluginsDir, filename);
        const pluginName = path.parse(filename).name;
        try {
            logger.debug(`[PluginLoader] Loading plugin: ${pluginName}...`);
            // Dynamic import - use pathToFileURL for Windows compatibility
            const { pathToFileURL } = await import('url');
            const module = await import(pathToFileURL(pluginPath).href);
            // Check for default export (function) or named 'init' function
            const initFunc = module.default || module.init;
            if (typeof initFunc === 'function') {
                // Initialize the plugin
                await initFunc();
                logger.info(`[PluginLoader] Plugin "${pluginName}" loaded and initialized.`);
            }
            else {
                logger.warn(`[PluginLoader] Plugin "${pluginName}" does not export a default function or an 'init' function. Skipping.`);
            }
        }
        catch (error) {
            logger.error(`[PluginLoader] Failed to load plugin "${pluginName}":`, {
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }
}
//# sourceMappingURL=pluginLoader.js.map