'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

interface Screenshot {
  id: string
  employee_id: string
  employee_name: string
  project_id: string
  project_name: string
  task_id: string
  captured_at: string
  image_url: string
  created_at: string
}

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

export default function Dashboard() {
  const router = useRouter()
  const [screenshots, setScreenshots] = useState<Screenshot[]>([])
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 })
  const [loading, setLoading] = useState(true)
  const [employeeFilter, setEmployeeFilter] = useState('')
  const [projectFilter, setProjectFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [selected, setSelected] = useState<Screenshot | null>(null)

  const fetchScreenshots = async (page = 1) => {
    const token = localStorage.getItem('token')
    if (!token) {
      router.push('/login')
      return
    }
    setLoading(true)
    const params = new URLSearchParams({ page: String(page), limit: '20' })
    if (employeeFilter) params.set('employee', employeeFilter)
    if (projectFilter) params.set('project', projectFilter)
    if (dateFrom) params.set('date_from', dateFrom)
    if (dateTo) params.set('date_to', dateTo)
    try {
      const res = await fetch(`/api/screenshots?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.status === 401) {
        router.push('/login')
        return
      }
      const data = await res.json()
      setScreenshots(data.screenshots || [])
      setPagination(data.pagination || { page: 1, limit: 20, total: 0, totalPages: 0 })
    } catch {
      // ignore
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchScreenshots(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleFilter = () => fetchScreenshots(1)
  const handleClear = () => {
    setEmployeeFilter('')
    setProjectFilter('')
    setDateFrom('')
    setDateTo('')
    setTimeout(() => fetchScreenshots(1), 0)
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    document.cookie = 'token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT'
    router.push('/login')
  }

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
    } catch {
      return iso
    }
  }

  return (
    <div style={{ minHeight: '100vh' }}>
      <header style={{ background: '#fff', padding: '16px 24px', borderBottom: '1px solid #e0e0e0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ margin: 0, fontSize: 22 }}>Task Tracking App</h1>
        <button onClick={handleLogout} style={{ padding: '8px 16px', background: '#f44336', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}>Logout</button>
      </header>

      <div style={{ padding: 24 }}>
        <div style={{ background: '#fff', padding: 20, borderRadius: 8, marginBottom: 20, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'end' }}>
          <div>
            <label style={{ display: 'block', fontSize: 13, marginBottom: 4 }}>Employee</label>
            <input value={employeeFilter} onChange={(e) => setEmployeeFilter(e.target.value)} placeholder="Name or ID" style={{ padding: '8px 10px', border: '1px solid #ddd', borderRadius: 4, width: 180 }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 13, marginBottom: 4 }}>Project</label>
            <input value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)} placeholder="Name or ID" style={{ padding: '8px 10px', border: '1px solid #ddd', borderRadius: 4, width: 180 }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 13, marginBottom: 4 }}>Date From</label>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} style={{ padding: '8px 10px', border: '1px solid #ddd', borderRadius: 4 }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 13, marginBottom: 4 }}>Date To</label>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} style={{ padding: '8px 10px', border: '1px solid #ddd', borderRadius: 4 }} />
          </div>
          <button onClick={handleFilter} style={{ padding: '9px 20px', background: '#1976d2', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}>Filter</button>
          <button onClick={handleClear} style={{ padding: '9px 20px', background: '#fff', color: '#333', border: '1px solid #ddd', borderRadius: 4, cursor: 'pointer' }}>Clear</button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 40 }}>Loading...</div>
        ) : screenshots.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, background: '#fff', borderRadius: 8 }}>No screenshots found.</div>
        ) : (
          <div style={{ background: '#fff', borderRadius: 8, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f5f5f5', textAlign: 'left' }}>
                  <th style={{ padding: '12px 16px', fontSize: 13 }}>Screenshot</th>
                  <th style={{ padding: '12px 16px', fontSize: 13 }}>Employee</th>
                  <th style={{ padding: '12px 16px', fontSize: 13 }}>Project</th>
                  <th style={{ padding: '12px 16px', fontSize: 13 }}>Task ID</th>
                  <th style={{ padding: '12px 16px', fontSize: 13 }}>Captured At</th>
                </tr>
              </thead>
              <tbody>
                {screenshots.map((s) => (
                  <tr key={s.id} style={{ borderTop: '1px solid #eee', cursor: 'pointer' }} onClick={() => setSelected(s)}>
                    <td style={{ padding: '10px 16px' }}>
                      <img src={s.image_url} alt="screenshot" style={{ width: 120, height: 68, objectFit: 'cover', borderRadius: 4, border: '1px solid #ddd' }} />
                    </td>
                    <td style={{ padding: '10px 16px' }}>
                      <div style={{ fontWeight: 600 }}>{s.employee_name || '-'}</div>
                      <div style={{ fontSize: 12, color: '#666' }}>{s.employee_id || '-'}</div>
                    </td>
                    <td style={{ padding: '10px 16px' }}>
                      <div style={{ fontWeight: 600 }}>{s.project_name || '-'}</div>
                      <div style={{ fontSize: 12, color: '#666' }}>{s.project_id || '-'}</div>
                    </td>
                    <td style={{ padding: '10px 16px', fontSize: 14 }}>{s.task_id || '-'}</td>
                    <td style={{ padding: '10px 16px', fontSize: 14 }}>{formatDate(s.captured_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #eee' }}>
              <span style={{ fontSize: 13, color: '#666' }}>Page {pagination.page} of {pagination.totalPages} (Total: {pagination.total})</span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button disabled={pagination.page <= 1} onClick={() => fetchScreenshots(pagination.page - 1)} style={{ padding: '8px 16px', background: pagination.page <= 1 ? '#eee' : '#1976d2', color: pagination.page <= 1 ? '#999' : '#fff', border: 'none', borderRadius: 4, cursor: pagination.page <= 1 ? 'not-allowed' : 'pointer' }}>Previous</button>
                <button disabled={pagination.page >= pagination.totalPages} onClick={() => fetchScreenshots(pagination.page + 1)} style={{ padding: '8px 16px', background: pagination.page >= pagination.totalPages ? '#eee' : '#1976d2', color: pagination.page >= pagination.totalPages ? '#999' : '#fff', border: 'none', borderRadius: 4, cursor: pagination.page >= pagination.totalPages ? 'not-allowed' : 'pointer' }}>Next</button>
              </div>
            </div>
          </div>
        )}
      </div>

      {selected && (
        <div onClick={() => setSelected(null)} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: 8, maxWidth: '90vw', maxHeight: '90vh', overflow: 'auto', padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div>
                <div style={{ fontWeight: 600 }}>{selected.employee_name} ({selected.employee_id})</div>
                <div style={{ fontSize: 13, color: '#666' }}>{selected.project_name} ({selected.project_id}) | Task: {selected.task_id} | {formatDate(selected.captured_at)}</div>
              </div>
              <button onClick={() => setSelected(null)} style={{ padding: '6px 12px', background: '#f44336', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}>Close</button>
            </div>
            <img src={selected.image_url} alt="full screenshot" style={{ maxWidth: '100%', height: 'auto', borderRadius: 4 }} />
          </div>
        </div>
      )}
    </div>
  )
}
