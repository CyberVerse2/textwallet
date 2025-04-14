'use client' // Error components must be Client Components

import { useEffect } from 'react'
import { Button } from '@/components/ui/button' // Assuming Button component path

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error("Unhandled Error:", error)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center">
      <h2 className="text-2xl font-bold mb-4">Something went wrong!</h2>
      <p className="mb-4 text-red-600">{error.message || "An unexpected error occurred."}</p>
      <Button
        onClick={() => reset()} // Attempt to recover by re-rendering the segment
        variant="destructive"
      >
        Try again
      </Button>
    </div>
  )
}
