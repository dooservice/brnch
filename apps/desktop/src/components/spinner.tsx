import { Loader2Icon } from 'lucide-react'

export default function Spinner({ className }: { className?: string }) {
  return <Loader2Icon role="status" aria-label="loading" className={className} />
}
