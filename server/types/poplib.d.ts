declare module 'poplib' {
  type PopOptions = { enabletls?: boolean; tlserrs?: boolean; debug?: boolean };
  type PopCallback = (...args: any[]) => void;
  export default class POP3Client {
    constructor(port: number, host: string, options?: PopOptions);
    on(event: string, callback: PopCallback): this;
    once(event: string, callback: PopCallback): this;
    removeListener(event: string, callback: PopCallback): this;
    login(username: string, password: string): void;
    stat(): void;
    uidl(): void;
    retr(messageNumber: number): void;
    quit(): void;
  }
}
