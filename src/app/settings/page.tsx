'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { LogOut, Camera, LayoutDashboard, Settings as SettingsIcon, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function SettingsPage() {
  const router = useRouter()
  const [minMinutes, setMinMinutes] = useState('5')
  const [maxMinutes, setMaxMinutes] = useState('15')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  const fetchConfig = async () => {
    const token = localStorage.getItem('token')
    if (!token) {
      router.push('/login')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/config', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.status === 401) {
        router.push('/login')
        return
      }
      const data = await res.json()
      setMinMinutes(String(data.interval_min_minutes ?? 5))
      setMaxMinutes(String(data.interval_max_minutes ?? 15))
    } catch {
      // ignore, keep defaults
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchConfig()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSave = async () => {
    const token = localStorage.getItem('token')
    if (!token) {
      router.push('/login')
      return
    }
    setSaving(true)
    setMessage('')
    try {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ interval_min_minutes: parseInt(minMinutes, 10), interval_max_minutes: parseInt(maxMinutes, 10) }),
      })
      const data = await res.json()
      if (!res.ok) {
        setMessage(data.error || 'Save failed')
      } else {
        setMinMinutes(String(data.interval_min_minutes))
        setMaxMinutes(String(data.interval_max_minutes))
        setMessage('Saved. The exe will pick up the new interval within a few minutes.')
      }
    } catch {
      setMessage('Save failed')
    }
    setSaving(false)
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
              <p className="text-xs text-muted-foreground">Settings</p>
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
              <SettingsIcon className="h-4 w-4" />
              Screenshot Interval
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex h-24 items-center justify-center text-muted-foreground">Loading settings...</div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  The exe takes a screenshot at a random time between the min and max below. Change the numbers and save, the exe picks it up within a few minutes, no rebuild needed.
                </p>
                <div className="flex flex-wrap items-end gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="minMinutes">Min interval (minutes)</Label>
                    <Input id="minMinutes" type="number" min="1" max="120" value={minMinutes} onChange={(e) => setMinMinutes(e.target.value)} className="w-[160px]" />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="maxMinutes">Max interval (minutes)</Label>
                    <Input id="maxMinutes" type="number" min="1" max="120" value={maxMinutes} onChange={(e) => setMaxMinutes(e.target.value)} className="w-[160px]" />
                  </div>
                  <Button onClick={handleSave} disabled={saving}>
                    <Save className="h-4 w-4" />
                    {saving ? 'Saving...' : 'Save'}
                  </Button>
                </div>
                {message && <p className="text-sm text-muted-foreground">{message}</p>}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
