export const formatBytes = (bytes: number): string => {
  if (!bytes || bytes === 0) return '0 B'
  const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB']
  const i = Math.min(Math.floor(Math.log(Math.abs(bytes)) / Math.log(1024)), units.length - 1)
  const value = bytes / Math.pow(1024, i)
  return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}

export const formatDate = (dateStr?: string, fallback: string = 'N/A') => {
  if (!dateStr) return fallback
  const date = new Date(dateStr)
  // Check if date is Go's zero value (0001-01-01...)
  if (date.getFullYear() <= 1) return fallback
  return date.toLocaleString()
}

export const formatTimeOnly = (dateStr?: string, fallback: string = 'N/A') => {
  if (!dateStr) return fallback
  const date = new Date(dateStr)
  if (date.getFullYear() <= 1) return fallback
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export const formatTime = (seconds: number) => {
  if (!seconds || isNaN(seconds)) return '0s'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (h > 0) return `${h}h ${m}m ${s}s`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

export const formatStatus = (status: string) => {
  if (!status) return ''
  return status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
}
