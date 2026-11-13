'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { LogOut, Camera, LayoutDashboard, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

interface EmployeeStat {
  employee_id: string
  employee_name: string
  screenshot_count: number
  screenshot_bytes: number
  screenshot_size: string
  inactive_log_count: number
  inactive_work_log_count: number
}

export default function CleanupPage() {
  const router = useRouter()
  const [employees, setEmployees] = useState<EmployeeStat[]>([])
  const [total, setTotal] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [message, setMessage] = useState('')

  const fetchStats = async () => {
    const token = localStorage.getItem('token')
    if (!token) {
      router.push('/login')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/cleanup', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.status === 401) {
        router.push('/login')
        return
      }
      const data = await res.json()
      setEmployees(data.employees || [])
      setTotal(data.total || null)
    } catch {
      setMessage('Failed to load storage stats')
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchStats()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const selected = employees.find((e) => e.employee_id === selectedId)

  const handleDelete = async () => {
    if (!selected) return
    if (!confirmed) {
      setMessage('Tick the confirm box first. This cannot be undone.')
      return
    }
    const label = `${selected.employee_name} (${selected.employee_id})`
    const range = dateFrom || dateTo ? ` from ${dateFrom || 'start'} to ${dateTo || 'end'}` : ' (all dates)'
    if (!window.confirm(`Delete ${selected.screenshot_count} screenshots and all inactive logs for ${label}${range}? This cannot be undone.`)) {
      return
    }
    const token = localStorage.getItem('token')
    if (!token) {
      router.push('/login')
      return
    }
    setDeleting(true)
    setMessage('')
    try {
      const res = await fetch('/api/cleanup', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ employee_id: selected.employee_id, date_from: dateFrom || undefined, date_to: dateTo || undefined, confirm: true }),
      })
      const data = await res.json()
      if (!res.ok) {
        setMessage(data.error || 'Delete failed')
      } else {
        setMessage(`${data.message}. Screenshots and their logs were deleted together.`)
        setConfirmed(false)
        setSelectedId('')
        setDateFrom('')
        setDateTo('')
        await fetchStats()
      }
    } catch {
      setMessage('Delete failed')
    }
    setDeleting(false)
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    document.cookie = 'token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT'
    router.push('/login')
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
              <p className="text-xs text-muted-foreground">Cleanup</p>
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
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Trash2 className="h-4 w-4" />
              Remove logs and screenshots
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Pick an employee, optionally limit it to a date range, and delete. One delete removes that employee&apos;s screenshots and their inactive logs and inactive work logs together, so no screenshot is left behind without its log, and no log is left behind without its screenshot. This cannot be undone.
            </p>
            {total && (
              <p className="mt-2 text-sm">
                Total: <strong>{total.screenshot_count} screenshots, {total.screenshot_size}</strong>
                {total.db_size ? `, database size ${total.db_size}` : ''}
              </p>
            )}
            <p className="mt-2 text-sm text-muted-foreground">
              Note: deleting frees space inside the database. The database file on the server only shrinks after a VACUUM FULL, so the size shown here is the space freed in the database, not necessarily the disk space freed right away.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex h-32 items-center justify-center text-muted-foreground">Loading storage...</div>
            ) : employees.length === 0 ? (
              <div className="flex h-32 items-center justify-center text-muted-foreground">No screenshots found.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Screenshots</TableHead>
                    <TableHead>Size</TableHead>
                    <TableHead>Inactive logs</TableHead>
                    <TableHead>Inactive work logs</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {employees.map((e) => (
                    <TableRow key={e.employee_id} className={selectedId === e.employee_id ? 'bg-muted' : ''}>
                      <TableCell>
                        <div className="font-medium">{e.employee_name}</div>
                        <div className="text-xs text-muted-foreground">{e.employee_id}</div>
                      </TableCell>
                      <TableCell>{e.screenshot_count}</TableCell>
                      <TableCell>{e.screenshot_size}</TableCell>
                      <TableCell>{e.inactive_log_count}</TableCell>
                      <TableCell>{e.inactive_work_log_count}</TableCell>
                      <TableCell>
                        <Button variant={selectedId === e.employee_id ? 'default' : 'outline'} size="sm" onClick={() => setSelectedId(e.employee_id)}>
                          Select
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {selected && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Delete {selected.employee_name} ({selected.employee_id})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  This will delete {selected.screenshot_count} screenshots ({selected.screenshot_size}), {selected.inactive_log_count} inactive logs and {selected.inactive_work_log_count} inactive work logs. Leave the dates blank to delete everything for this employee.
                </p>
                <div className="flex flex-wrap items-end gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="dateFrom">Date From</Label>
                    <Input id="dateFrom" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="dateTo">Date To</Label>
                    <Input id="dateTo" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
                  </div>
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
                  I understand this permanently deletes the screenshots and logs together and cannot be undone.
                </label>
                <Button variant="destructive" onClick={handleDelete} disabled={deleting || !confirmed}>
                  <Trash2 className="h-4 w-4" />
                  {deleting ? 'Deleting...' : `Delete ${selected.screenshot_count} screenshots and logs`}
                </Button>
                {message && <p className="text-sm text-muted-foreground">{message}</p>}
              </div>
            </CardContent>
          </Card>
        )}
        {!selected && message && <p className="text-sm text-muted-foreground">{message}</p>}
      </main>
    </div>
  )
}
