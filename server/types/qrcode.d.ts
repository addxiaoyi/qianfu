declare module 'qrcode' {
  export type QRCodeToBufferOptions = {
    type?: 'png';
    width?: number;
    margin?: number;
    errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H';
  };

  const QRCode: {
    toBuffer(text: string, options?: QRCodeToBufferOptions): Promise<Buffer>;
  };

  export default QRCode;
}
