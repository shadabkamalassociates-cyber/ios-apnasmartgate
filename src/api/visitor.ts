import api from './client';

export type CreateVisitor = {
  name: string;
  phone: string;
  vehicleinfo?: string;
  flat_id: string | number;
  societyId: string | number;
  check_in?: string;
};

export type UpdateVisitor = {
  name?: string;
  phone?: string;
  vehicleinfo?: string;
  flat_id?: string | number;
};

export type VisitorAttendance = {
  id: number;
  check_in?: string;
  check_out?: string;
  status?: string;
  visitor?: { id: number; name: string; phone?: string; vehicleinfo?: string; flat_id?: string | number };
};

export type CreateVisitorResponse = {
  success: boolean;
  message?: string;
  data?: VisitorAttendance;
};

export type VisitorStatus = 'approve' | 'unapprove';

/**
 * Backend route is `/visitor/get/:id` and (despite the param name in some backends)
 * it fetches visitor attendance by **flat_id**.
 */
export function getVisitorsByFlatId(flatId: string | number) {
  return api
    .get<{ success: boolean; data?: VisitorAttendance[]; message?: string }>(`/visitor/get/${flatId}`)
    .then((r) => r.data);
}

// Backwards-compatible alias (older call sites used "resident").
export const getVisitorsByResident = getVisitorsByFlatId;

export function getVisitorById(id: string | number) {
  return api.get(`/visitor/fetch/${id}`).then((r) => r.data);
}

export function createVisitor(data: CreateVisitor) {
  return api.post<CreateVisitorResponse>('/visitor/create', data).then((r) => r.data);
}

export function updateVisitor(id: string | number, data: UpdateVisitor) {
  return api.put('/visitor/update', { id, ...data }).then((r) => r.data);
}

export function deleteVisitor(id: string | number) {
  return api.delete(`/visitor/delete/${id}`).then((r) => r.data);
}

export function updateVisitorStatus(attendanceId: string | number, status: VisitorStatus) {
  return api
    .put<{ success: boolean; message?: string }>('/getpass/approve-gatepass', { id: attendanceId, status })
    .then((r) => r.data);
}

/**
 * The FCM notification only contains visitors.id, but the approve API
 * needs visitor_attendance.id. This fetches the resident's attendance
 * records (same as Visitors page) and finds the matching one.
 */
export async function findWaitingAttendance(
  visitorId: string | number | undefined,
  visitorName: string | undefined,
  flatId: string | number,
): Promise<{ attendanceId: number; visitor?: VisitorAttendance['visitor'] } | null> {
  const res = await getVisitorsByFlatId(flatId);
  const records: VisitorAttendance[] = res?.data ?? [];

  if (!records.length) return null;

  // 1. Match by visitor.id + waiting status
  if (visitorId) {
    const byId = records.find(
      (r) => r.visitor && String(r.visitor.id) === String(visitorId) && r.status === 'waiting',
    );
    if (byId) return { attendanceId: byId.id, visitor: byId.visitor };
  }

  // 2. Match by visitor name + waiting status
  if (visitorName) {
    const byName = records.find(
      (r) => r.visitor?.name?.toLowerCase() === visitorName.toLowerCase() && r.status === 'waiting',
    );
    if (byName) return { attendanceId: byName.id, visitor: byName.visitor };
  }

  // 3. Match by visitor.id (any status)
  if (visitorId) {
    const anyStatus = records.find(
      (r) => r.visitor && String(r.visitor.id) === String(visitorId),
    );
    if (anyStatus) return { attendanceId: anyStatus.id, visitor: anyStatus.visitor };
  }

  // 4. Latest waiting record as last resort
  const latestWaiting = records.find((r) => r.status === 'waiting');
  if (latestWaiting) return { attendanceId: latestWaiting.id, visitor: latestWaiting.visitor };

  return null;
}
