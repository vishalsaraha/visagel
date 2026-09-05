declare module 'pngjs' {
  export class PNG {
    constructor(options?: { width?: number; height?: number; fill?: boolean });
    width: number;
    height: number;
    data: Buffer;
    static sync: {
      read(buffer: Buffer | Uint8Array, options?: any): { width: number; height: number; data: Buffer };
      write(png: PNG, options?: any): Buffer;
    };
  }
}
