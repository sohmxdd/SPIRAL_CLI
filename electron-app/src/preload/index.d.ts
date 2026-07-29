import { SpiralAPI } from './index'

declare global {
  interface Window {
    api: SpiralAPI
  }
}
