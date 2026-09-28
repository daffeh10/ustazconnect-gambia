export function bookingStatusLabel(status: string | null) {
  switch (status) {
    case 'confirmed': return 'Accepted — awaiting payment.'
    case 'active': return 'Active'
    case 'cancelled': return 'Cancelled'
    case 'completed': return 'Completed'
    default: return 'Awaiting tutor response'
  }
}
