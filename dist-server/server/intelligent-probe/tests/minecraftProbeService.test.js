import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getMinecraftServerStatus } from '../services/minecraftProbeService';
import * as mcutil from 'minecraft-server-util';
// Mock the minecraft-server-util library
vi.mock('minecraft-server-util', () => {
    return {
        status: vi.fn(),
        statusBedrock: vi.fn()
    };
});
// Mock node:dns lookup to ensure deterministic resolution
vi.mock('node:dns', () => {
    return {
        default: {
            lookup: (hostname, callback) => callback(null, { address: '8.8.8.8' }),
            resolveSrv: (hostname, callback) => callback(null, [])
        },
        lookup: (hostname, callback) => callback(null, { address: '8.8.8.8' }),
        resolveSrv: (hostname, callback) => callback(null, [])
    };
});
describe('minecraftProbeService', () => {
    // Reset mocks before each test
    beforeEach(() => {
        vi.clearAllMocks();
        vi.setConfig({ testTimeout: 15000 });
    });
    it('should successfully probe a Java server and return formatted status', async () => {
        // Mock a successful status response
        mcutil.status.mockResolvedValue({
            version: { name: '1.19.4', protocol: 762 },
            players: { online: 10, max: 100, sample: [{ id: '1', name: 'Player1' }] },
            motd: { raw: 'Test Server', clean: 'Test Server', html: '<span>Test Server</span>' },
            favicon: 'data:image/png;base64,...',
            roundTripLatency: 50,
        });
        const host = 'example.com';
        const status = await getMinecraftServerStatus(host, false);
        expect(mcutil.status).toHaveBeenCalledWith('8.8.8.8', 25565, expect.objectContaining({ timeout: 5000, enableSRV: false }));
        expect(status).toEqual({
            online: true,
            host: 'example.com',
            port: 25565,
            version: { name_raw: '1.19.4', protocol: 762 },
            players: {
                online: 10,
                max: 100,
                list: [{ name_raw: 'Player1', uuid: '1' }],
            },
            motd: { raw: 'Test Server', clean: 'Test Server', html: '<span>Test Server</span>' },
            favicon: 'data:image/png;base64,...',
            srv_record: null,
        });
    });
    it('should successfully probe a Bedrock server', async () => {
        mcutil.statusBedrock.mockResolvedValue({
            version: { name: '1.19.0', protocol: 527 },
            players: { online: 5, max: 20 },
            motd: { raw: 'Bedrock Server', clean: 'Bedrock Server', html: 'Bedrock Server' },
            roundTripLatency: 30,
        });
        const host = 'bedrock.example.com';
        const status = await getMinecraftServerStatus(host, true);
        expect(mcutil.statusBedrock).toHaveBeenCalledWith('8.8.8.8', 19132, expect.objectContaining({ timeout: 5000 }));
        expect(status.online).toBe(true);
        expect(status.version.name_raw).toBe('1.19.0');
    });
    it('should throw a custom error if all retries fail', async () => {
        const errorMessage = 'Connection refused';
        mcutil.status.mockRejectedValue(new Error(errorMessage));
        const host = 'nonexistent.com';
        await expect(getMinecraftServerStatus(host, false)).rejects.toThrow(`Failed to probe server ${host}: ${errorMessage}`);
        expect(mcutil.status).toHaveBeenCalledTimes(2);
    }, 20000);
    it('should handle empty player sample gracefully', async () => {
        mcutil.status.mockResolvedValue({
            version: { name: '1.20', protocol: 763 },
            players: { online: 0, max: 20, sample: null },
            motd: { raw: 'Empty Players', clean: 'Empty Players', html: 'Empty Players' },
            roundTripLatency: 60,
        });
        const host = 'emptyplayers.com';
        const status = await getMinecraftServerStatus(host, false);
        expect(status.players.list).toEqual([]);
    });
});
//# sourceMappingURL=minecraftProbeService.test.js.map