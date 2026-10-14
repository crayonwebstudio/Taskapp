'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Calendar, X, ChevronLeft, ChevronRight, LogOut, Monitor, Users, FolderKanban, Camera } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

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
      // EXE sends IST time (e.g. "2026-10-14 13:59:00"). Display as-is, no conversion.
      // Input may be "2026-10-14 13:59:00" or ISO "2026-10-14T13:59:00.000Z"
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

  const uniqueEmployees = new Set(screenshots.map(s => s.employee_id)).size

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
              <p className="text-xs text-muted-foreground">Screenshot monitoring</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={handleLogout}>
            <LogOut className="h-4 w-4" />
            Logout
          </Button>
        </div>
      </header>

      <main className="container px-4 py-6 space-y-6">
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Screenshots</CardTitle>
              <Monitor className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{pagination.total}</div>
              <p className="text-xs text-muted-foreground">Across all employees</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Employees</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{uniqueEmployees}</div>
              <p className="text-xs text-muted-foreground">In current view</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Page</CardTitle>
              <FolderKanban className="h-4 w-4 text-muted-foreground" />
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
                <Label htmlFor="project">Project</Label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input id="project" value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)} placeholder="Name or ID" className="pl-8 w-[200px]" />
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
              <div className="flex h-32 items-center justify-center text-muted-foreground">Loading screenshots...</div>
            ) : screenshots.length === 0 ? (
              <div className="flex h-32 flex-col items-center justify-center gap-2 text-muted-foreground">
                <Camera className="h-8 w-8" />
                <p>No screenshots found.</p>
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Screenshot</TableHead>
                      <TableHead>Employee</TableHead>
                      <TableHead>Project</TableHead>
                      <TableHead>Task ID</TableHead>
                      <TableHead>Captured At</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {screenshots.map((s) => (
                      <TableRow key={s.id} className="cursor-pointer" onClick={() => setSelected(s)}>
                        <TableCell>
                          <img src={s.image_url} alt="screenshot" className="h-[68px] w-[120px] rounded-md border object-cover" />
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{s.employee_name || '-'}</div>
                          <div className="text-xs text-muted-foreground">{s.employee_id || '-'}</div>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{s.project_name || '-'}</div>
                          <div className="text-xs text-muted-foreground">{s.project_id || '-'}</div>
                        </TableCell>
                        <TableCell>
                          {s.task_id ? <Badge variant="secondary">{s.task_id}</Badge> : <span className="text-muted-foreground">-</span>}
                        </TableCell>
                        <TableCell className="text-sm">{formatDate(s.captured_at)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <div className="flex items-center justify-between border-t px-4 py-3">
                  <p className="text-sm text-muted-foreground">
                    Page {pagination.page} of {pagination.totalPages} (Total: {pagination.total})
                  </p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={pagination.page <= 1} onClick={() => fetchScreenshots(pagination.page - 1)}>
                      <ChevronLeft className="h-4 w-4" />
                      Previous
                    </Button>
                    <Button variant="outline" size="sm" disabled={pagination.page >= pagination.totalPages} onClick={() => fetchScreenshots(pagination.page + 1)}>
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

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>
              {selected?.employee_name} ({selected?.employee_id})
            </DialogTitle>
            <p className="text-sm text-muted-foreground">
              {selected?.project_name} ({selected?.project_id}) | Task: {selected?.task_id || '-'} | {selected && formatDate(selected.captured_at)}
            </p>
          </DialogHeader>
          {selected && (
            <img src={selected.image_url} alt="full screenshot" className="max-h-[70vh] w-full rounded-lg border object-contain" />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
