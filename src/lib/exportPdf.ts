import { jsPDF } from 'jspdf';
import { WeeklyReportSnapshot } from '../types';

export function exportWeeklyReportPdf(report: WeeklyReportSnapshot, displayName = 'Developer') {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  let y = 48;
  const left = 44;
  const maxWidth = 507;

  const writeLine = (text: string, size = 10, bold = false, color: [number, number, number] = [30, 41, 59]) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(size);
    doc.setTextColor(color[0], color[1], color[2]);
    const lines = doc.splitTextToSize(text, maxWidth) as string[];
    for (const line of lines) {
      if (y > 780) {
        doc.addPage();
        y = 48;
      }
      doc.text(line, left, y);
      y += size + 5;
    }
  };

  writeLine('Progress Tracker — Weekly Performance Report', 18, true, [15, 23, 42]);
  y += 2;
  writeLine(
    `Prepared for ${displayName}  ·  Period: ${report.weekStart} to ${report.weekEnd}`,
    10,
    false,
    [100, 116, 139]
  );
  y += 12;

  writeLine('Key Metrics Summary', 13, true, [16, 185, 129]);
  y += 2;
  writeLine(
    `Tasks Completed: ${report.tasksCompleted} / ${report.tasksPlanned} (${report.completionPct}%)`
  );
  writeLine(
    `Consistency Streak: ${report.currentStreak} days current  ·  ${report.longestStreak} days longest`
  );
  writeLine(
    `Deep Focus: ${report.focusHours} hrs  ·  Learning: ${report.learningHours} hrs  ·  GitHub Contributions: ${report.githubContributions}`
  );
  writeLine(`Project Milestones Completed: ${report.milestonesCompleted}`);
  y += 10;

  if (report.reportData?.accomplishedTasks?.length) {
    writeLine('Accomplished Tasks', 13, true, [15, 23, 42]);
    for (const t of report.reportData.accomplishedTasks) {
      writeLine(`• ${t.title} [${t.categoryName} · ${t.priority}]`, 10);
    }
    y += 8;
  }

  if (report.reportData?.unfinishedTasks?.length) {
    writeLine('Carried Over / Unfinished Tasks', 13, true, [180, 83, 9]);
    for (const t of report.reportData.unfinishedTasks) {
      writeLine(`• ${t.title}${t.dueDate ? ` (Due ${t.dueDate})` : ''}`, 10);
    }
    y += 8;
  }

  if (report.reportData?.milestones?.length) {
    writeLine('Completed Project Milestones', 13, true, [15, 23, 42]);
    for (const m of report.reportData.milestones) {
      writeLine(`• ${m.projectName}: ${m.title}`, 10);
    }
    y += 8;
  }

  writeLine('Focus & Improvement Areas', 13, true, [15, 23, 42]);
  for (const area of report.improvementAreas) {
    writeLine(`• ${area}`, 10);
  }

  doc.save(`progress-tracker-weekly-${report.weekStart}.pdf`);
}

export function exportWorkspacePdf(summary: {
  displayName: string;
  exportedAt: string;
  tasksCount: number;
  completedTasksCount: number;
  projectsCount: number;
  learningGoalsCount: number;
  focusSessionsCount: number;
  applicationsCount: number;
  certificationsCount: number;
}) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  let y = 52;
  const left = 44;

  const line = (text: string, size = 11, bold = false) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(size);
    doc.text(text, left, y);
    y += size + 8;
  };

  line('Progress Tracker — Workspace Archive Summary', 18, true);
  line(`Engineer: ${summary.displayName}`, 11);
  line(`Generated: ${summary.exportedAt}`, 10);
  y += 10;
  line(`Total Tasks: ${summary.tasksCount} (${summary.completedTasksCount} completed)`, 12);
  line(`Software Projects: ${summary.projectsCount}`, 12);
  line(`Learning Goals: ${summary.learningGoalsCount}`, 12);
  line(`Focus Mode Sessions: ${summary.focusSessionsCount}`, 12);
  line(`Job Applications Tracked: ${summary.applicationsCount}`, 12);
  line(`Certifications Tracked: ${summary.certificationsCount}`, 12);

  doc.save(`progress-tracker-summary-${new Date().toISOString().slice(0, 10)}.pdf`);
}
