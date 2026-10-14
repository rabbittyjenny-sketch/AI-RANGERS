/** รหัสเครื่อง (สุ่มครั้งแรกแล้วเก็บใน browser) — ใช้นับเครดิตและเป็นเจ้าของแบรนด์/ประวัติแชท */
export function getDeviceId(): string | null {
  try {
    let id = localStorage.getItem('ranger_uid');
    if (!id && typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      id = crypto.randomUUID();
      localStorage.setItem('ranger_uid', id);
    }
    return id;
  } catch {
    return null;
  }
}
