export interface User {
  id: string;
  email: string;
  name: string;
  role: "teacher" | "coach" | "admin";
  avatarUrl: string | null;
  voiceEnrollmentUrl: string | null;
  targetGrade: number | null;
  createdAt: string;
  updatedAt: string;
}
