export interface AlarmPanelStrategy {
  arm(panel: any, partition: number, code: string): Promise<{ success: boolean; message: string }>;
  disarm(panel: any, partition: number, code: string): Promise<{ success: boolean; message: string }>;
  toggleSiren(panel: any, state: 'on' | 'off'): Promise<{ success: boolean; message: string }>;
  syncUser(panel: any, userNumber: number, name: string, code: string): Promise<{ success: boolean; message: string }>;
  deleteUser(panel: any, userNumber: number): Promise<{ success: boolean; message: string }>;
}
