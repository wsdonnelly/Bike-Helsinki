import axios from 'axios';

const API  = axios.create({ baseURL: 'http://localhost:3000' })

export function snapToGraph(lat, lon) {
  return API
    .get('/snap', { params: { lat, lon } })
    .then(res => res.data)
}

export function getRoute(startIdx, endIdx) {
  return API
    .get('/route', { params: { startIdx, endIdx } })
    .then(res => res.data.path)
}

export async function setSurfaceFilter(mask) {
  try {
    const res = await API.post('/filter', { mask }) // ✅ use API instance with baseURL
    console.log(`✔ Surface filter updated: 0x${mask.toString(16).padStart(4, '0')}`)
    return res.status === 204
  } catch (err) {
    console.error('✖ Failed to set surface filter:', err.response?.data || err.message)
    throw err
  }
}

