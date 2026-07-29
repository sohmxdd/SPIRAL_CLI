/// <reference types="vite/client" />

import { SpiralAPI } from './types'

declare global {
  interface Window {
    api: SpiralAPI
  }
}
