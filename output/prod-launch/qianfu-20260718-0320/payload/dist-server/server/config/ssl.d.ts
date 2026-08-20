interface SSLConfig {
    enabled: boolean;
    key?: Buffer;
    cert?: Buffer;
    ca?: Buffer;
}
export declare function loadSSLConfig(): SSLConfig;
export declare function createHTTPServer(app: any, sslConfig: SSLConfig): any;
export {};
//# sourceMappingURL=ssl.d.ts.map