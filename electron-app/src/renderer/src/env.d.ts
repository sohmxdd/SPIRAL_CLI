/// <reference types="vite/client" />

import { SpiralAPI } from '../../preload/index'

declare global {
  interface Window {
    api: SpiralAPI
  }
}
