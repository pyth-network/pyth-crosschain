import { NextApiRequest, NextApiResponse } from 'next'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { chain, sequenceNumber, isMainnet } = req.query

  if (!chain || !sequenceNumber) {
    return res.status(400).json({ error: 'Missing parameters' })
  }

  const baseUrl = isMainnet === 'true'
    ? 'https://fortuna.dourolabs.app'
    : 'https://fortuna-staging.dourolabs.app'

  try {
    const response = await fetch(
      `${baseUrl}/v1/chains/${chain}/revelations/${sequenceNumber}`,
      {
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include'
      }
    )
    const data = await response.json()
    return res.status(200).json(data)
  } catch (error) {
    console.error('Proxy error:', error)
    return res.status(500).json({ error: 'Failed to fetch data' })
  }
} 