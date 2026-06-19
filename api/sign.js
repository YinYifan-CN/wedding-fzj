const KEY = 'wedding_sign_records'

export default async function handler(req, res) {
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
    res.status(501).json({ error: 'KV is not configured.' })
    return
  }

  try {
    if (req.method === 'GET') {
      const records = await redisCommand(['LRANGE', KEY, '0', '999'])
      res.status(200).json({ records: records.map(safeJsonParse).filter(Boolean) })
      return
    }

    if (req.method === 'POST') {
      await redisCommand(['LPUSH', KEY, JSON.stringify(sanitizeRecord(req.body))])
      res.status(200).json({ ok: true })
      return
    }

    res.status(405).json({ error: 'Method not allowed' })
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Server error' })
  }
}

async function redisCommand(command) {
  const response = await fetch(process.env.KV_REST_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(command),
  })

  if (!response.ok) throw new Error(`KV request failed: ${response.status}`)

  const payload = await response.json()
  if (payload.error) throw new Error(payload.error)

  return payload.result || []
}

function sanitizeRecord(body) {
  const source = typeof body === 'object' && body ? body : {}
  const text = (value, maxLength) =>
    String(value || '')
      .trim()
      .slice(0, maxLength)

  return {
    id: text(source.id, 80) || `${Date.now()}`,
    name: text(source.name, 40),
    table: text(source.table, 8),
    count: Math.max(1, Math.min(20, Number(source.count) || 1)),
    message: text(source.message, 160),
    createdAt: text(source.createdAt, 40) || new Date().toISOString(),
  }
}

function safeJsonParse(value) {
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}
