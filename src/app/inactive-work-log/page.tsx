'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Calendar, X, ChevronLeft, ChevronRight, LogOut, Clock, Camera, LayoutDashboard } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'

interface InactiveLog {
  id: string
  employee_id: string
  employee_name: string
  last_seen: string
  minutes_idle: number
  reason: string
  created_at: string
}

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

export default function InactiveWorkLogPage() {
  const router = useRouter()
  const [logs, setLogs] = useState<InactiveLog[]>([])
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 })
  const [loading, setLoading] = useState(true)
  const [employeeFilter, setEmployeeFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const fetchLogs = async (page = 1) => {
    const token = localStorage.getItem('token')
    if (!token) {
      router.push('/login')
      return
    }
    setLoading(true)
    const params = new URLSearchParams({ page: String(page), limit: '20' })
    if (employeeFilter) params.set('employee', employeeFilter)
    if (dateFrom) params.set('date_from', dateFrom)
    if (dateTo) params.set('date_to', dateTo)
    try {
      const res = await fetch(`/api/inactive-work-log?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.status === 401) {
        router.push('/login')
        return
      }
      const data = await res.json()
      setLogs(data.logs || [])
      setPagination(data.pagination || { page: 1, limit: 20, total: 0, totalPages: 0 })
    } catch {
      // ignore
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchLogs(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleFilter = () => fetchLogs(1)
  const handleClear = () => {
    setEmployeeFilter('')
    setDateFrom('')
    setDateTo('')
    setTimeout(() => fetchLogs(1), 0)
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    document.cookie = 'token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT'
    router.push('/login')
  }

  const formatDate = (iso: string) => {
    try {
      if (!iso) return '-'
      let datePart: string, timePart: string
      if (iso.includes('T')) {
        const [d, t] = iso.split('T')
        datePart = d
        timePart = t.split('.')[0].split('Z')[0].split('+')[0]
      } else {
        const parts = iso.split(' ')
        datePart = parts[0]
        timePart = parts[1] || '00:00:00'
      }
      const [year, month, day] = datePart.split('-')
      const [hourStr, minute, second] = timePart.split(':')
      let h = parseInt(hourStr, 10)
      const ampm = h >= 12 ? 'PM' : 'AM'
      h = h % 12 || 12
      return `${day}/${month}/${year}, ${h}:${minute}:${second} ${ampm}`
    } catch {
      return iso
    }
  }

  return (
    <div className="min-h-screen bg-muted/40">
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Camera className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-semibold tracking-tight">Task Tracking App</h1>
              <p className="text-xs text-muted-foreground">Inactive Work Log</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => router.push('/')}>
              <LayoutDashboard className="h-4 w-4" />
              Dashboard
            </Button>
            <Button variant="outline" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="container px-4 py-6 space-y-6">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => router.push('/inactive-log')}>
            <Clock className="h-4 w-4" />
            Inactive Log
          </Button>
          <Button variant="default" size="sm" onClick={() => router.push('/inactive-work-log')}>
            <Clock className="h-4 w-4" />
            Inactive Work Log
          </Button>
          <p className="text-xs text-muted-foreground">Inactive Work Log: punched in, no real work. Inactive Log: no screenshot upload.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Inactive Work Logs</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{pagination.total}</div>
              <p className="text-xs text-muted-foreground">Punched in, no real work for 10 minutes</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Employees</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{new Set(logs.map((l) => l.employee_id)).size}</div>
              <p className="text-xs text-muted-foreground">In current view</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Page</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{pagination.page} of {pagination.totalPages || 1}</div>
              <p className="text-xs text-muted-foreground">20 per page</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-end gap-4">
              <div className="grid gap-2">
                <Label htmlFor="employee">Employee</Label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input id="employee" value={employeeFilter} onChange={(e) => setEmployeeFilter(e.target.value)} placeholder="Name or ID" className="pl-8 w-[200px]" />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="dateFrom">Date From</Label>
                <div className="relative">
                  <Calendar className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input id="dateFrom" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="pl-8" />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="dateTo">Date To</Label>
                <div className="relative">
                  <Calendar className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input id="dateTo" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="pl-8" />
                </div>
              </div>
              <Button onClick={handleFilter}>
                <Search className="h-4 w-4" />
                Filter
              </Button>
              <Button variant="outline" onClick={handleClear}>
                <X className="h-4 w-4" />
                Clear
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex h-32 items-center justify-center text-muted-foreground">Loading inactive work logs...</div>
            ) : logs.length === 0 ? (
              <div className="flex h-32 flex-col items-center justify-center gap-2 text-muted-foreground">
                <Clock className="h-8 w-8" />
                <p>No inactive work logs found.</p>
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Last Seen</TableHead>
                      <TableHead>Minutes Idle</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Logged At</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((l) => (
                      <TableRow key={l.id}>
                        <TableCell>
                          <div className="font-medium">{l.employee_name || '-'}</div>
                          <div className="text-xs text-muted-foreground">{l.employee_id || '-'}</div>
                        </TableCell>
                        <TableCell className="text-sm">{formatDate(l.last_seen)}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{l.minutes_idle} min</Badge>
                        </TableCell>
                        <TableCell className="text-sm">{l.reason || '-'}</TableCell>
                        <TableCell className="text-sm">{formatDate(l.created_at)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <div className="flex items-center justify-between border-t px-4 py-3">
                  <p className="text-sm text-muted-foreground">
                    Page {pagination.page} of {pagination.totalPages} (Total: {pagination.total})
                  </p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={pagination.page <= 1} onClick={() => fetchLogs(pagination.page - 1)}>
                      <ChevronLeft className="h-4 w-4" />
                      Previous
                    </Button>
                    <Button variant="outline" size="sm" disabled={pagination.page >= pagination.totalPages} onClick={() => fetchLogs(pagination.page + 1)}>
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
