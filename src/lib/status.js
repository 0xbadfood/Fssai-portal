// Application / licence status labels used by the dashboard (the licence rules themselves live on the server).
export const STATUS = {
  DRAFT: 'DRAFT',
  SUBMITTED: 'SUBMITTED',
  UNDER_SCRUTINY: 'UNDER_SCRUTINY',
  CLARIFICATION_REQUESTED: 'CLARIFICATION_REQUESTED',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
}

export const STATUS_META = {
  [STATUS.DRAFT]: { label: 'Draft', color: 'slate' },
  [STATUS.SUBMITTED]: { label: 'Submitted', color: 'blue' },
  [STATUS.UNDER_SCRUTINY]: { label: 'Under Scrutiny', color: 'amber' },
  [STATUS.CLARIFICATION_REQUESTED]: { label: 'Clarification Requested', color: 'orange' },
  [STATUS.APPROVED]: { label: 'Approved', color: 'green' },
  [STATUS.REJECTED]: { label: 'Rejected', color: 'red' },
}

export function generateApplicationReference() {
  let ref = ''
  for (let i = 0; i < 17; i++) ref += Math.floor(Math.random() * 10)
  return ref
}

export function generateLicenceNumber() {
  let ref = ''
  for (let i = 0; i < 14; i++) ref += Math.floor(Math.random() * 10)
  return ref
}
