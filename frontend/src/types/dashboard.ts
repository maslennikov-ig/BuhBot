export interface SlaComplianceMetric {
  period: "today" | "week" | "month";
  totalRequests: number;
  metSla: number;
  breachedSla: number;
  compliancePercentage: number; // (met / total) * 100
}

export interface ResponseTimeMetric {
  period: "today" | "week" | "month";
  averageMinutes: number;
  previousPeriodAverage: number; // for trend calculation
  trendPercentage: number; // +15% or -10%
}

export interface ActiveAlertItem {
  id: string; // Request ID
  chatTitle: string;
  clientName: string;
  messagePreview: string;
  receivedAt: Date;
  slaDeadline: Date; // Calculated based on working hours
  status: "warning" | "breach";
}
