import axios from 'axios'

const BASE = import.meta.env.VITE_BACKEND_BASE_URL ?? 'http://127.0.0.1:8010'

export const http = axios.create({ baseURL: BASE, timeout: 15000 })

// 响应拦截：BiliNote 风格 {code,msg,data}
http.interceptors.response.use(
  res => {
    const d = res.data
    if (typeof d === 'object' && 'code' in d && d.code !== 0) {
      return Promise.reject(new Error(d.msg ?? '请求失败'))
    }
    return res
  },
  err => Promise.reject(err)
)

export default http

