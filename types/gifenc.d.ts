declare module 'gifenc' {
  export type RGB = [number, number, number]

  export interface WriteFrameOptions {
    palette: RGB[]
    delay?: number
    transparent?: boolean
    transparentIndex?: number
    dispose?: number
  }

  export interface Encoder {
    writeFrame(index: Uint8Array, width: number, height: number, options?: WriteFrameOptions): void
    finish(): void
    bytesView(): Uint8Array
  }

  export function GIFEncoder(options?: { auto?: boolean; initialCapacity?: number }): Encoder
  export function quantize(rgba: Uint8Array | Uint8ClampedArray, maxColors: number): RGB[]
  export function applyPalette(rgba: Uint8Array | Uint8ClampedArray, palette: RGB[]): Uint8Array
}
