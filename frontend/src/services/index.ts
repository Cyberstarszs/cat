import apiClient, { API_BASE_URL } from './api';
import {
  User,
  LoginResponse,
  ExamCategory,
  Exam,
  ExamSession,
  SessionEnrollment,
  Question,
  StartAttemptResponse,
  AttemptDetail,
  ExamResult,
  ResultDetail,
  Certificate,
  VerifyCertificateResponse,
  Appeal,
  AuditLog,
  NotificationItem,
  StudentProfile,
} from '../types';

// ==================== AUTH SERVICE ====================
export const authService = {
  async login(username: string, password: string): Promise<LoginResponse> {
    const res = await apiClient.post<LoginResponse>('/auth/login', { username, password });
    return res.data;
  },

  async logout(): Promise<void> {
    try {
      await apiClient.post('/auth/logout');
    } finally {
      localStorage.removeItem('cat_token');
      localStorage.removeItem('cat_user');
    }
  },

  async changePassword(oldPassword: string, newPassword: string): Promise<void> {
    try {
      await apiClient.post('/auth/change-password', {
        old_password: oldPassword,
        new_password: newPassword,
      });
    } catch (err: any) {
      if (err?.response?.status === 404) {
        await apiClient.post('/me/password', {
          old_password: oldPassword,
          new_password: newPassword,
        });
        return;
      }
      throw err;
    }
  },

  async getMe(): Promise<{ user: User; profile?: StudentProfile | null }> {
    const res = await apiClient.get('/me');
    return res.data;
  },

  async updateProfile(data: { full_name?: string; phone?: string; institution?: string }): Promise<StudentProfile> {
    const res = await apiClient.patch('/me/profile', data);
    return res.data.profile;
  },
};

// ==================== EXAMS & CATEGORIES SERVICE ====================
export const examService = {
  async getCategories(): Promise<ExamCategory[]> {
    try {
      const res = await apiClient.get<{ data: ExamCategory[] }>('/categories');
      return res.data.data;
    } catch (err: any) {
      if (err?.status === 404 || err?.response?.status === 404) {
        const res = await apiClient.get<{ data: ExamCategory[] }>('/question-categories');
        return res.data.data;
      }
      throw err;
    }
  },

  async createCategory(data: { name: string; code: string; description?: string }): Promise<ExamCategory> {
    try {
      const res = await apiClient.post<{ category: ExamCategory }>('/categories', data);
      return res.data.category;
    } catch (err: any) {
      if (err?.status === 404 || err?.response?.status === 404) {
        const res = await apiClient.post<{ category: ExamCategory }>('/question-categories', data);
        return res.data.category;
      }
      throw err;
    }
  },

  async updateCategory(id: string, data: { name?: string; code?: string; description?: string }): Promise<ExamCategory> {
    try {
      const res = await apiClient.patch<{ category: ExamCategory }>(`/categories/${id}`, data);
      return res.data.category;
    } catch (err: any) {
      if (err?.status === 404 || err?.response?.status === 404) {
        const res = await apiClient.patch<{ category: ExamCategory }>(`/question-categories/${id}`, data);
        return res.data.category;
      }
      throw err;
    }
  },

  async deleteCategory(id: string): Promise<void> {
    try {
      await apiClient.delete(`/categories/${id}`);
    } catch (err: any) {
      if (err?.status === 404 || err?.response?.status === 404) {
        await apiClient.delete(`/question-categories/${id}`);
        return;
      }
      throw err;
    }
  },

  async getExams(): Promise<Exam[]> {
    const res = await apiClient.get<{ data: Exam[] }>('/exams');
    return res.data.data;
  },

  async getExamById(id: string): Promise<Exam> {
    const res = await apiClient.get<{ exam: Exam }>(`/exams/${id}`);
    return res.data.exam;
  },

  async createExam(data: {
    title: string;
    code: string;
    description?: string;
    passing_score: number;
    duration_minutes: number;
    rules?: { category_id: string; question_count: number }[];
  }): Promise<Exam> {
    const res = await apiClient.post<{ exam: Exam }>('/exams', data);
    return res.data.exam;
  },

  async updateExam(id: string, data: Partial<Exam>): Promise<Exam> {
    const res = await apiClient.patch<{ exam: Exam }>(`/exams/${id}`, data);
    return res.data.exam;
  },

  async deleteExam(id: string): Promise<void> {
    await apiClient.delete(`/exams/${id}`);
  },

  async addRule(examId: string, categoryId: string, count: number): Promise<void> {
    await apiClient.post(`/exams/${examId}/rules`, {
      category_id: categoryId,
      question_count: count,
    });
  },

  async updateRule(examId: string, ruleId: string, count: number): Promise<void> {
    await apiClient.patch(`/exams/${examId}/rules/${ruleId}`, {
      question_count: count,
    });
  },

  async deleteRule(examId: string, ruleId: string): Promise<void> {
    await apiClient.delete(`/exams/${examId}/rules/${ruleId}`);
  },
};

// ==================== QUESTIONS SERVICE ====================
export const questionService = {
  async getQuestions(params?: { category_id?: string; search?: string }): Promise<Question[]> {
    const res = await apiClient.get<{ data: Question[] }>('/questions', { params });
    return res.data.data;
  },

  async getQuestionById(id: string): Promise<Question> {
    const res = await apiClient.get<{ question: Question }>(`/questions/${id}`);
    return res.data.question;
  },

  async createQuestion(data: {
    code: string;
    category_id: string;
    stem: string;
    weight: number;
    difficulty?: string;
    options: { label: string; text: string; is_correct: boolean }[];
  }): Promise<Question> {
    const res = await apiClient.post<{ question: Question }>('/questions', data);
    return res.data.question;
  },

  async createNewVersion(
    questionId: string,
    data: {
      stem: string;
      weight: number;
      options: { label: string; text: string; is_correct: boolean }[];
    }
  ): Promise<void> {
    await apiClient.post(`/questions/${questionId}/versions`, data);
  },

  async previewQuestion(questionId: string): Promise<any> {
    const res = await apiClient.get(`/questions/${questionId}/preview`);
    return res.data;
  },

  async previewImportQuestions(file: File): Promise<{
    success: boolean;
    filename: string;
    file_type: 'docx' | 'csv';
    total_rows: number;
    valid_rows: number;
    invalid_rows: number;
    rows: any[];
    valid_payload: any[];
  }> {
    const formData = new FormData();
    formData.append('file', file);
    const res = await apiClient.post('/questions/import/preview', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },

  async commitImportQuestions(questions: any[]): Promise<{
    success: boolean;
    total_imported: number;
    imported_count: number;
  }> {
    const res = await apiClient.post('/questions/import/commit', { questions, items: questions });
    return res.data;
  },

  async previewImportCSV(file: File): Promise<any> {
    return this.previewImportQuestions(file);
  },

  async commitImportCSV(items: any[]): Promise<any> {
    return this.commitImportQuestions(items);
  },

  async previewCorrection(versionId: string, type: string, oldOptionId?: string, newOptionId?: string): Promise<any> {
    const res = await apiClient.post(`/question-versions/${versionId}/corrections/preview`, {
      type,
      old_option_id: oldOptionId,
      new_option_id: newOptionId,
    });
    return res.data.preview;
  },

  async applyCorrection(
    versionId: string,
    type: string,
    reason: string,
    oldOptionId?: string,
    newOptionId?: string
  ): Promise<any> {
    const res = await apiClient.post(`/question-versions/${versionId}/corrections`, {
      type,
      reason,
      old_option_id: oldOptionId,
      new_option_id: newOptionId,
    });
    return res.data;
  },
};

// ==================== SESSIONS SERVICE ====================
export const sessionService = {
  async getSessions(): Promise<ExamSession[]> {
    const res = await apiClient.get<{ data: ExamSession[] }>('/sessions');
    return res.data.data;
  },

  async getMySessions(): Promise<any[]> {
    const res = await apiClient.get<{ data: any[] }>('/me/sessions');
    return res.data.data;
  },

  async getSessionById(id: string): Promise<ExamSession> {
    const res = await apiClient.get<{ session: ExamSession }>(`/sessions/${id}`);
    return res.data.session;
  },

  async createSession(data: {
    exam_id: string;
    code: string;
    name: string;
    starts_at: string;
    ends_at: string;
  }): Promise<ExamSession> {
    const res = await apiClient.post<{ session: ExamSession }>('/sessions', data);
    return res.data.session;
  },

  async updateSession(id: string, data: Partial<ExamSession>): Promise<ExamSession> {
    const res = await apiClient.patch<{ session: ExamSession }>(`/sessions/${id}`, data);
    return res.data.session;
  },

  async deleteSession(id: string): Promise<void> {
    await apiClient.delete(`/sessions/${id}`);
  },

  async getEnrollments(sessionId: string): Promise<SessionEnrollment[]> {
    const res = await apiClient.get<{ data: SessionEnrollment[] }>(`/sessions/${sessionId}/enrollments`);
    return res.data.data;
  },

  async previewEnrollments(sessionId: string, studentIdentifiers: string[]): Promise<any> {
    const res = await apiClient.post(`/sessions/${sessionId}/enrollments/preview`, {
      student_identifiers: studentIdentifiers,
    });
    return res.data;
  },

  async enrollStudents(sessionId: string, studentIdentifiers: string[]): Promise<any> {
    const res = await apiClient.post(`/sessions/${sessionId}/enrollments`, {
      student_identifiers: studentIdentifiers,
    });
    return res.data;
  },

  async finalizeSession(sessionId: string): Promise<any> {
    const res = await apiClient.post(`/sessions/${sessionId}/finalize`);
    return res.data;
  },
};

// ==================== ATTEMPTS & CAT EXAM SERVICE ====================
export const attemptService = {
  async startAttempt(sessionId: string): Promise<StartAttemptResponse> {
    const res = await apiClient.post<StartAttemptResponse>(`/sessions/${sessionId}/start-attempt`);
    return res.data;
  },

  async getAttempt(attemptId: string): Promise<AttemptDetail> {
    const res = await apiClient.get<{ attempt: AttemptDetail }>(`/attempts/${attemptId}`);
    return res.data.attempt;
  },

  async autosaveAnswer(
    attemptId: string,
    data: {
      attempt_question_id: string;
      selected_option_id: string | null;
      client_seq: number;
    }
  ): Promise<any> {
    const res = await apiClient.put(`/attempts/${attemptId}/answers`, data);
    return res.data;
  },

  async recordEvent(
    attemptId: string,
    eventType: 'blur' | 'focus' | 'tab_switch' | 'heartbeat',
    payload?: any
  ): Promise<void> {
    await apiClient.post(`/attempts/${attemptId}/events`, {
      event_type: eventType,
      payload,
    });
  },

  async finishAttempt(attemptId: string): Promise<{ result_id: string; score: number; passed: boolean }> {
    const res = await apiClient.post(`/attempts/${attemptId}/finish`);
    return res.data;
  },

  async getAttemptResult(attemptId: string): Promise<ExamResult> {
    const res = await apiClient.get<{ result: ExamResult }>(`/attempts/${attemptId}/result`);
    return res.data.result;
  },
};

// ==================== RESULTS, APPEALS & CERTIFICATES ====================
export const resultService = {
  async getResults(params?: { session_id?: string; search?: string }): Promise<ExamResult[]> {
    const res = await apiClient.get<{ data: ExamResult[] }>('/results', { params });
    return res.data.data;
  },

  async getMyResults(): Promise<ExamResult[]> {
    const res = await apiClient.get<{ data: ExamResult[] }>('/me/results');
    return res.data.data;
  },

  async getResultById(id: string): Promise<ResultDetail> {
    const res = await apiClient.get<{ result: ResultDetail }>(`/results/${id}`);
    return res.data.result;
  },

  async publishResult(id: string): Promise<void> {
    await apiClient.post(`/results/${id}/publish`);
  },

  async publishSessionResults(sessionId: string): Promise<void> {
    await apiClient.post(`/results/publish-session/${sessionId}`);
  },

  async submitAppeal(resultId: string, reason: string): Promise<Appeal> {
    const res = await apiClient.post<{ appeal: Appeal }>(`/results/${resultId}/appeals`, { reason });
    return res.data.appeal;
  },

  async getAppeals(): Promise<Appeal[]> {
    const res = await apiClient.get<{ data: Appeal[] }>('/appeals');
    return res.data.data;
  },

  async resolveAppeal(appealId: string, status: 'approved' | 'rejected', notes: string): Promise<void> {
    await apiClient.patch(`/appeals/${appealId}`, { status, admin_notes: notes });
  },

  async getCertificate(id: string): Promise<Certificate> {
    const res = await apiClient.get<{ certificate: Certificate }>(`/certificates/${id}`);
    return res.data.certificate;
  },

  async downloadCertificatePDF(certificateId: string): Promise<Blob> {
    const res = await apiClient.get(`/certificates/${certificateId}/pdf`, {
      responseType: 'blob',
    });
    return res.data;
  },

  async verifyCertificate(code: string): Promise<VerifyCertificateResponse> {
    const res = await apiClient.get<VerifyCertificateResponse>(`/verify/${code}`);
    return res.data;
  },
};

// ==================== USERS & STUDENTS SERVICE ====================
export const userService = {
  async getStudents(params?: { search?: string }): Promise<StudentProfile[]> {
    const res = await apiClient.get<{ data: StudentProfile[] }>('/students', { params });
    return res.data.data;
  },

  async createStudent(data: {
    identifier: string;
    full_name: string;
    email: string;
    institution?: string;
    phone?: string;
  }): Promise<{ student: StudentProfile; initial_password?: string }> {
    const res = await apiClient.post('/students', data);
    return res.data;
  },

  async importStudentsCSV(file: File): Promise<any> {
    const formData = new FormData();
    formData.append('file', file);
    const res = await apiClient.post('/students/import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },

  async getUsers(params?: { search?: string; role?: string }): Promise<User[]> {
    const res = await apiClient.get<{ data: User[] }>('/users', { params });
    return res.data.data;
  },

  async updateUserStatus(userId: string, status: 'active' | 'suspended'): Promise<void> {
    await apiClient.patch(`/users/${userId}`, { status });
  },

  async resetPassword(userId: string): Promise<{ new_password: string }> {
    const res = await apiClient.post(`/users/${userId}/reset-password`);
    return res.data;
  },
};

// ==================== AUDIT & NOTIFICATIONS SERVICE ====================
export const auditService = {
  async getAuditLogs(params?: { action?: string; limit?: number }): Promise<AuditLog[]> {
    const res = await apiClient.get<{ data: AuditLog[] }>('/audit-logs', { params });
    return res.data.data;
  },
};

export const notificationService = {
  async getNotifications(): Promise<NotificationItem[]> {
    try {
      const res = await apiClient.get<{ data: NotificationItem[] }>('/me/notifications');
      return res.data.data;
    } catch {
      const res = await apiClient.get<{ data: NotificationItem[] }>('/notifications');
      return res.data.data;
    }
  },

  async markAsRead(id: string): Promise<void> {
    try {
      await apiClient.patch(`/me/notifications/${id}/read`);
    } catch {
      await apiClient.patch(`/notifications/${id}/read`);
    }
  },
};

// ==================== REPORTS SERVICE ====================
export const reportService = {
  async getExamReport(examId: string): Promise<any> {
    const res = await apiClient.get(`/reports/exams/${examId}`);
    return res.data;
  },

  async exportSessionCSV(sessionId: string): Promise<Blob> {
    const res = await apiClient.get(`/reports/sessions/${sessionId}/export`, {
      responseType: 'blob',
    });
    return res.data;
  },
};
