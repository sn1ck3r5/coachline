export interface User {
  id: string;
  email: string;
  name: string;
  role: "teacher" | "coach" | "admin";
  avatarUrl: string | null;
  voiceEnrollmentUrl: string | null;
  createdAt: string;
  updatedAt: string;
}
