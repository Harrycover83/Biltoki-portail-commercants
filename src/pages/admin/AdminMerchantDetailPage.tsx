import { useParams } from 'react-router-dom'

export function AdminMerchantDetailPage() {
  const { id } = useParams()
  return <h1 className="text-2xl font-semibold">Administration / Commerçant {id}</h1>
}
