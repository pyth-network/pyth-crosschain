import { PriceComponent, PriceType, Product } from '@pythnetwork/client'
import { PublicKey } from '@solana/web3.js'
import { PriceStatus } from '../utils/PriceStatus'

export interface PythPriceData {
  aggregate?: {
    status: PriceStatus
    price: number
    confidence: number
    publishSlot: number
    priceComponent: number
    confidenceComponent: number
  }
  emaPrice: {
    value: number
    valueComponent: number
  }
  emaConfidence: {
    value: number
    valueComponent: number
  }
  validSlot: number
  minPublishers: number
  priceComponents: PriceComponent[]
  priceType: PriceType
  exponent: number
  numComponentPrices: number
  numQuoters: number
  lastSlot: number
  previousTimestamp: BigInt
  timestamp: BigInt
}

export interface PythSymbolData {
  productAccountKey: PublicKey
  priceAccountKey: PublicKey
  price: PythPriceData
  product: {
    product: Product
  }
}

export interface PythData {
  [key: string]: PythSymbolData
}
